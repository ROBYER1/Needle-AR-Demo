import { Camera, getComponent, Gizmos, Mathf, Rigidbody, serializable, WebXR } from "@needle-tools/engine";
import { Behaviour, GameObject } from "@needle-tools/engine/src/engine-components/Component";
import * as THREE from "three";
import { getWorldPosition, getWorldQuaternion, setWorldPosition } from "@needle-tools/engine/src/engine/engine_three_utils";
import { OrbitControls } from "@needle-tools/engine/src/engine-components/OrbitControls";
import { Context, FrameEvent, XRSessionMode } from "@needle-tools/engine/src/engine/engine_setup";
import { WebXREvent } from "@needle-tools/engine/src/engine-components/WebXR";
import { CoroutineData, Vec2 } from "@needle-tools/engine/src/engine/engine_types";
import { RaycastOptions } from "@needle-tools/engine/src/engine/engine_physics";
import { WaitForSeconds } from "@needle-tools/engine/src/engine/engine_coroutine";
import { Time } from "@needle-tools/engine/src/engine/engine_time";
import { Vec3 } from "@needle-tools/engine/src/engine-schemes/vec3";
import * as utils from "@needle-tools/engine/src/engine/engine_three_utils"
import { AlignHeightToGround } from "./AlignHeightToGround";

export class ARControls extends Behaviour
{
    @serializable(AlignHeightToGround)
    public heightAlignScript: AlignHeightToGround;

    public placementTarget: GameObject;

    @serializable(GameObject)
    public debugTouch1?: GameObject;
    @serializable(GameObject)
    public debugTouch2?: GameObject;
    
    @serializable(GameObject)
    public pointerObject?: GameObject;

    @serializable(GameObject)
    public object1?: GameObject;
    @serializable(GameObject)
    public object2?: GameObject;
    @serializable(GameObject)
    public object3?: GameObject;

    @serializable(GameObject)
    public target?: GameObject;

    public isSelected?: Boolean = false;

    private mainTarget?: GameObject | null;
    private arctrl?: ARControls;

    private eventSub_WebXRStartEvent: Function | null = null;
     
    // @nonSerialized
    public _context: Context | null = null;

    @serializable(GameObject)
    public _camera: THREE.Camera;;

    public _raycaster = new THREE.Raycaster();
    public _raycaster1 = new THREE.Raycaster();
    public _cameraPlaneOffset = new THREE.Vector3();
    public _intersection = new THREE.Vector3();
    public _inverseMatrix = new THREE.Matrix4();
    private _rbs: Rigidbody[] = [];

    public _groundLine: THREE.Line;
    public _groundMarker: THREE.Object3D;
    private geometry?: THREE.BufferGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]);

    public _groundOffsetVector = new THREE.Vector3(0, 1, 0);
    public _requireUpdateGroundPlane = true;
    public _didDragOnGroundPlaneLastFrame: boolean = false;

    private orbit: OrbitControls | null = null;

    private isDragging: boolean = false;
    private activePointerEvent: PointerEvent;
    private activeTouchEvent: TouchEvent;
    private isTouch: boolean = false;
    private initialDist: number;
    private initialScale: number;
    private initialRotPos: number;
    timer: number = 2; //10 seconds to wait until autorotate

    private _direction: THREE.Vector3 = new THREE.Vector3();

    private isRotateScale: boolean = false;

    private isInAr: boolean = false;

    private isTouching: boolean = false;

public screenPointToRay(x: number, y: number, ray?: THREE.Ray): THREE.Ray {
    const origin = new THREE.Vector3(x,y,-1);
    this.convertScreenspaceToRaycastSpace(origin);
    origin.unproject(this.context.mainCamera);
    const dir = this._direction.set(origin.x, origin.y, origin.z);
    const camPosition = getWorldPosition(this.context.mainCamera);
    dir.sub(camPosition);
    dir.normalize();
    if (ray) {
        ray.set(camPosition, dir);
        return ray;
    }
    else {
        return new THREE.Ray(camPosition.clone(), dir.clone());
    }
}

convertScreenspaceToRaycastSpace(vec2: Vec2) {
    if (this.context.isInAR) {
    vec2.x = (vec2.x - 0) / window.innerWidth * 2 - 1;
    vec2.y = -((vec2.y - 0) / window.innerHeight) * 2 + 1;
    }
    else
    {
        vec2.x = (vec2.x - this.context.domX) / window.innerWidth * 2 - 1;
        vec2.y = -((vec2.y - this.context.domY) / window.innerHeight) * 2 + 1;
    }
}

*showThenHideTouchCube()
{
    this.timer = 2;
    while (true) {
        GameObject.setActive(this.object1, true);
        this.timer = Math.max(0, Math.min(this.timer - (this.context.time.deltaTime * 1)));
        yield;
        if(this.timer <= 0.01)
        {
            GameObject.setActive(this.object1, false);
            return;
        }
    }
}

*WaitThenReset() {
    while (true) {
        yield WaitForSeconds(0.5);
        this.isRotateScale = false;
    }
}

start()
{
    WebXR.addEventListener(WebXREvent.XRStarted, this.onXRStarted.bind(this));
    WebXR.addEventListener(WebXREvent.XRStopped, this.onXRStopped.bind(this));
    if(this.heightAlignScript == null)
    {
        this.heightAlignScript = this.gameObject.getComponent(AlignHeightToGround);
    }
   window.addEventListener("pointerdown", e => {
    if (!this.context.isInAR) {
        this.isDragging = true;
    this.startCoroutine(this.showThenHideTouchCube(), FrameEvent.Update);
    GameObject.setActive(this.object2, false);
    GameObject.setActive(this.object3, false);
    if(e != null)
    {
    }
}
});

    //@ts-ignore
    window.addEventListener("pointermove", e => {
        
        if (!this.context.isInAR) {
            if(this.isDragging == true)
            {
        this.activePointerEvent = e;
        GameObject.setActive(this.object2, true);
            }
        
        
        }
    });

    //@ts-ignore
    window.addEventListener("pointerup", e => {
        if (!this.context.isInAR) {
        this.isDragging = false;
        GameObject.setActive(this.object1, false);
        GameObject.setActive(this.object2, false);
        GameObject.setActive(this.object3, true);
        }
        if(e != null)
        {

        }
    });


    window.addEventListener("touchstart", e => {
        this.activeTouchEvent = e;
        this.initialScale = this.gameObject.scale.x;
        if(e.targetTouches.length == 1)
        {
            GameObject.setActive(this.debugTouch2, false);
            GameObject.setActive(this.debugTouch1, true);
        }
        else if(e.targetTouches.length >= 2)
        {
            this.initialRotPos = this.activeTouchEvent.touches[0].clientX - this.activeTouchEvent.touches[1].clientX;
            var b = this.activeTouchEvent.touches[0].clientY - this.activeTouchEvent.touches[1].clientY;
            this.initialDist = Mathf.clamp((Math.sqrt(this.initialRotPos*this.initialRotPos + b*b) / 350), 0, 10);
            GameObject.setActive(this.debugTouch1, false);
            GameObject.setActive(this.debugTouch2, true);
        }
        this.isTouch = true;
        this.startCoroutine(this.showThenHideTouchCube(), FrameEvent.Update);
        GameObject.setActive(this.object2, false);
        GameObject.setActive(this.object3, false);
        this.touchedSingle();
    });
   
    //@ts-ignore
    window.addEventListener("touchmove", e => {
        this.activeTouchEvent = e;
        this.isDragging = true;
        GameObject.setActive(this.object2, true);
    });

    //@ts-ignore
    window.addEventListener("touchend", e => {
        if(e.touches.length == 0)
        {
            this.stopCoroutine(this.WaitThenReset());
            this.startCoroutine(this.WaitThenReset());
            this.unTouchedSingle();
        }
        this.isDragging = false;
        GameObject.setActive(this.object1, false);
        GameObject.setActive(this.object2, false);
        GameObject.setActive(this.object3, true);
    });

    const line = new THREE.Line(this.geometry);
    const mat = line.material as THREE.LineBasicMaterial;
    mat.color = new THREE.Color(.4, .4, .4);
    line.layers.set(2);
    line.name = 'line';
    line.scale.y = 1;
    this._groundLine = line;

    const geometry = new THREE.SphereGeometry(.5, 22, 22);
    const material = new THREE.MeshBasicMaterial({ color: mat.color });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.visible = false;
    sphere.layers.set(2);
    this._groundMarker = sphere;

    this.orbit = GameObject.findObjectOfType(OrbitControls, this.context);
    //@ts-ignore
    GameObject.setActive(this.indicator, false);

}


onXRStarted()
{
    console.log("XR Started!");
    //On start AR - set object position to 0,0,0
    this.heightAlignScript.isInAr = true;
    this.gameObject.position.set(0,0,0);
    this.isInAr = true;
}

onXRStopped()
{
    console.log("XR Stopped!");
    this.heightAlignScript.isInAr = false;
    this.gameObject.position.set(0,0,0);
    this.isInAr = false;
    
}

private touchedSingle()
{
 console.log("untouched");
 this.setTargetFromRaycast();
 if(this.isInAr == true)
 {
 //Always move on touch in AR
 this.placementTarget.visible = true;
 }
 this.isTouching = true;
}

private unTouchedSingle()
{
    console.log("untouched");
 this.clearTarget();
 if(this.isInAr == true)
 {
 //Always move on touch in AR
 this.placementTarget.visible = false;
 }
 this.isTouching = false;
}

private contains(obj: THREE.Object3D, toSearch: THREE.Object3D): boolean {
    if (obj === toSearch) return true;
    if (obj.children) {
        for (const child of obj.children) {
            if (this.contains(child, toSearch)) return true;
        }
    }
    return false;
}

private setTargetFromRaycast() {
    if(this.isTouch == true)
    {
        this.isSelected = true;
        /*
        const rc = this.context.physics.raycast();
        console.log(rc);
    
        //@ts-ignore
        this._raycaster.setFromCamera(rc, this.context.mainCamera);
        Gizmos.DrawRay(this._raycaster.ray.origin, this._raycaster.ray.direction, 0xff0000, 10);
        for (const hit of rc) {
            console.log(hit.object.name);
            if (hit.distance > 0 && GameObject.isActiveInHierarchy(hit.object)) {
                console.log("Set target", hit.object.name, hit.object);
                //@ts-ignore
                this.mainTarget = hit.object as THREE.Object3D;
                if(hit.object.name == "GroundPlane")
                {
                    this.isSelected = false;
                    break;
                }
                this.arctrl = GameObject.getComponentInParent(this.mainTarget, ARControls);
                if(this.arctrl != null)
                {
                if (this.orbit) this.orbit.enabled = false;
                GameObject.setActive(this.arctrl.target, true);
                this.isSelected = true;
                }
                else
                {
                    return
                }
                break;
            }
        }
        */
    }
    else
    {
    const rc = this.context.physics.raycast();
    //@ts-ignore
    this._raycaster.setFromCamera(rc, this.context.mainCamera);
    for (const hit of rc) {
        if (hit.distance > 0 && GameObject.isActiveInHierarchy(hit.object)) {
            //@ts-ignore
            this.mainTarget = hit.object as THREE.Object3D;
            if(hit.object.name == "GroundPlane")
            {
                this.isSelected = false;
                break;
            }
            this.arctrl = GameObject.getComponentInParent(this.mainTarget, ARControls);
            if(this.arctrl != null)
            {
            if (this.orbit) this.orbit.enabled = false;
            GameObject.setActive(this.arctrl.target, true);
            this.isSelected = true;
            }
            else
            {
                return
            }
            break;
        }
    }
}
}

private clearTarget()
{
    if(this.arctrl != null)
    {
    this.isSelected = false;
    GameObject.setActive(this.arctrl.target, false)
    }
    this.mainTarget = null;
    this.arctrl = null;
}

update()
{
    if(this.isSelected == true)
    {
        
    }
    if(this.isTouch == true)
    {
        if(this.activeTouchEvent != null)
        {
            if(this.isInAr == true)
            {
                if(this.isTouching == true)
                {
                    //Always move on touch in AR
                    setWorldPosition(this.gameObject, this.placementTarget.position);
                }
            }
        }
    }
    if(this.isDragging == true)
    {
        //Reset debug everytime
        GameObject.setActive(this.pointerObject, false);
        console.log(this.isRotateScale);
        //Is touch
        if(this.isTouch == true)
        {
            if(this.activeTouchEvent != null)
            {
                switch(this.activeTouchEvent.touches.length)
                {
                    //Dragging
                    case 1:
                        if(this.isRotateScale == false)
                        {
                                if(this.isInAr == false)
                                {
                                //Place on ground plane
                                
                            const touch = this.activeTouchEvent.touches[0];
                            const ray = this.screenPointToRay(touch.clientX, touch.clientY);
                            this._raycaster.ray = ray;
                            const opts = new RaycastOptions();
                            const hits = this.context.physics.raycastFromRay(ray, opts);
                            for (let j = 0; j < hits.length; j++) {
                                    const hit = hits[j];
                                    if(hit.object.name == "GroundPlane")
                                    {
                                        setWorldPosition(this.gameObject, hit.point);
                                    }
                                }
                            }
                        }
                        
                        break;

                    //Double touch
                    case 2:
                        this.isRotateScale = true;
                        //Scaling
                        var a = this.activeTouchEvent.touches[0].clientX - this.activeTouchEvent.touches[1].clientX;
                        var b = this.activeTouchEvent.touches[0].clientY - this.activeTouchEvent.touches[1].clientY;
                        var dist = Mathf.clamp((Math.sqrt(a*a + b*b) / 350), 0, 10);
                        var factor = dist / this.initialDist;
                        var mainScale = Mathf.clamp(this.initialScale * (factor), 0.1, 10);
                        this.gameObject.scale.set(mainScale, mainScale, mainScale);
                        this.gameObject.rotation.y += a * 0.0002;
                        break;

                }
        }
    }
    //Otherwise is a pointer
        else
        {
            GameObject.setActive(this.pointerObject, true);
            for (let i = 0; i < this.activePointerEvent.pointerType.length; i++) {
                const rc = this.context.input.getPointerPositionRC(0);
                this._raycaster.setFromCamera(rc, this.context.mainCamera);
                const ray = this._raycaster.ray;
                const opts = new RaycastOptions();
                const hits = this.context.physics.raycastFromRay(ray, opts);
                for (let i = 0; i < hits.length; i++) {
                    const hit = hits[i];
                    if(hit.object.name == "GroundPlane")
                    {
                        setWorldPosition(this.gameObject, hit.point);
                    }
                }
            }   
        }   
        }
    }
}
