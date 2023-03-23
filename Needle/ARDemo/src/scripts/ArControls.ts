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

export class ARControls extends Behaviour
{
    
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

    /*
    public _groundPlane: THREE.Plane = new THREE.Plane();
    
    //@ts-ignore
    public _cameraPlane: THREE.Plane = new THREE.Plane();

    public _hasGroundPlane: boolean = false;
    //@ts-ignore
    
    public _groundOffset: THREE.Vector3 = new THREE.Vector3();
    public _groundOffsetFactor: number = 0;
    public _groundDistance: number = 0;
    public _groundPlanePoint: THREE.Vector3 = new THREE.Vector3();
*/
    public _raycaster = new THREE.Raycaster();
    public _raycaster1 = new THREE.Raycaster();
    public _cameraPlaneOffset = new THREE.Vector3();
    public _intersection = new THREE.Vector3();
    //public _worldPosition = new THREE.Vector3();
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
    private initialWorldAngle: THREE.Vector3;
    timer: number = 2; //10 seconds to wait until autorotate
    private lastAngle: number =  0;
    private ROTATION_RATE: number = 1.5;
    private goalYaw: number = 0;

private _origin: THREE.Vector3 = new THREE.Vector3(0,0,0);
private _direction: THREE.Vector3 = new THREE.Vector3();

private isRotateScale: boolean = false;

public screenPointToRay(x: number, y: number, ray?: THREE.Ray): THREE.Ray {
    const origin = new THREE.Vector3(x,y,-1);
    //console.log(origin);
    this.convertScreenspaceToRaycastSpace(origin);
    //this.context.input.convertScreenspaceToRaycastSpace(origin);
    origin.unproject(this.context.mainCamera);
    //console.log(origin);
    const dir = this._direction.set(origin.x, origin.y, origin.z);
    //console.log(dir);
    const camPosition = getWorldPosition(this.context.mainCamera);
    //console.log(camPosition);
    dir.sub(camPosition);
    dir.normalize();
    if (ray) {
        ray.set(camPosition, dir);
        //console.log("ray", ray);
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

/*
onXRStarted()
{

}
*/

*WaitThenReset() {
    while (true) {
        yield WaitForSeconds(0.5);
        console.log("isrotatefalse");
        this.isRotateScale = false;
    }
}

start()
{
   // WebXR.addEventListener(WebXREvent.XRStarted, this.onXRStarted.bind(this));
    
   window.addEventListener("pointerdown", e => {
    //console.log("pointerdown", e);
    if (!this.context.isInAR) {
        console.log("Wasn't in AR");
        this.isDragging = true;
    this.startCoroutine(this.showThenHideTouchCube(), FrameEvent.Update);
    GameObject.setActive(this.object2, false);
    GameObject.setActive(this.object3, false);
    this.touched();
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
                //console.log("pointermove");
        this.activePointerEvent = e;
        GameObject.setActive(this.object2, true);
            }
        
        
        }
    });

    //@ts-ignore
    window.addEventListener("pointerup", e => {
        //console.log("pointerup");
        if (!this.context.isInAR) {
        this.isDragging = false;
        GameObject.setActive(this.object1, false);
        GameObject.setActive(this.object2, false);
        GameObject.setActive(this.object3, true);
        this.unTouched();
        }
        if(e != null)
        {

        }
    });


    window.addEventListener("touchstart", e => {
        //console.log("touchstart", e);
        //console.log(e.targetTouches);
        this.activeTouchEvent = e;
        this.initialScale = this.gameObject.scale.x;
        this.initialWorldAngle = utils.getWorldRotation(this.gameObject);
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
      
        
    });
   
    //@ts-ignore
    window.addEventListener("touchmove", e => {
        //console.log("touchmove");
        this.activeTouchEvent = e;
        this.isDragging = true;
        GameObject.setActive(this.object2, true);
        /*
        if(e.touches.length >= 2)
        {
            var a = e.touches[0].clientX - e.touches[1].clientX;
            //this.gameObject.rotation.y += a * 0.0002;
        }
        */

    });

    //@ts-ignore
    window.addEventListener("touchend", e => {
        //console.log("touchend");
        //console.log(e.touches.length);
        if(e.touches.length == 0)
        {
            this.stopCoroutine(this.WaitThenReset());
            this.startCoroutine(this.WaitThenReset());
        }
        //this.isTouch = false;
        this.isDragging = false;
        GameObject.setActive(this.object1, false);
        GameObject.setActive(this.object2, false);
        GameObject.setActive(this.object3, true);
        this.unTouched();
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

public touched()
{
 //console.log("touched");
 this.setTargetFromRaycast();
}

public unTouched()
{
 //console.log("unTouched");
 this.clearTarget();
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
    //console.log(rc);

    //@ts-ignore
    this._raycaster.setFromCamera(rc, this.context.mainCamera);
    //Gizmos.DrawRay(this._raycaster.ray.origin, this._raycaster.ray.direction, 0xff0000, 10);
    for (const hit of rc) {
        //console.log("Set target hit: ", hit.object.name);
        if (hit.distance > 0 && GameObject.isActiveInHierarchy(hit.object)) {
            //console.log("Set target", hit.object.name, hit.object);
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
    //Keep orbit script disabled for now
    //if (this.orbit) this.orbit.enabled = true;
}

update()
{
    if(this.isSelected == true)
    {
        
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
                        const touch = this.activeTouchEvent.touches[0];
                        const ray = this.screenPointToRay(touch.clientX, touch.clientY);
                        //const ray = this.context.mainCameraComponent!.screenPointToRay(touch.clientX, touch.clientY);
                        //Gizmos.DrawRay(ray.origin, ray.direction, 0xff0000, 10);
            
                        //const rc = new THREE.Vector2(touch.clientX, touch.clientY);
                        this._raycaster.ray = ray;
                        //Gizmos.DrawRay(this._raycaster.ray.origin, this._raycaster.ray.direction, 0xff0000, 10,);
                    
                        const opts = new RaycastOptions();
                        const hits = this.context.physics.raycastFromRay(ray, opts);
                        for (let j = 0; j < hits.length; j++) {
                                const hit = hits[j];
                                //console.log(hit.object.name)
                                if(hit.object.name == "GroundPlane")
                                {
                                    setWorldPosition(this.gameObject, hit.point);
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
                        //console.log("dist: ", dist);
                        var mainScale = Mathf.clamp(this.initialScale * (factor), 0.1, 10);
                        //console.log(factor);
                        this.gameObject.scale.set(mainScale, mainScale, mainScale);
                        //this.gameObject.scale.set(dist, dist, dist);

                        //Raycast touch
                        /*
                        const touch1 = this.activeTouchEvent.touches[1];
                        const ray = this.screenPointToRay(touch1.clientX, touch1.clientY);
                        //const ray = this.context.mainCameraComponent!.screenPointToRay(touch.clientX, touch.clientY);
                        //Gizmos.DrawRay(ray.origin, ray.direction, 0xff0000, 10);
            
                        //const rc = new THREE.Vector2(touch1.clientX, touch1.clientY);
                        this._raycaster.ray = ray;
                        //Gizmos.DrawRay(this._raycaster.ray.origin, this._raycaster.ray.direction, 0xff0000, 10,);
                    
                        const opts = new RaycastOptions();
                        const hits = this.context.physics.raycastFromRay(ray, opts);
                        
                        if(hits.length > 0)
                        {
                            var hitPoint = hits[0].point;
                        }
                        */
                        /*
                        for (let j = 0; j < hits.length; j++) {
                                const hit = hits[j];
                                if(hit.object.name == "GroundPlane")
                                {
                                  
                                }
                                
                            }  
                            */       
                           /*
                        const fingerOne = new THREE.Vector2(this.activeTouchEvent.touches[0].clientX, this.activeTouchEvent.touches[0].clientY);
                        console.log(fingerOne);
                        const fingerTwo = new THREE.Vector2(this.activeTouchEvent.touches[1].clientX, this.activeTouchEvent.touches[1].clientY);
                        console.log(fingerTwo);
                        const deltaX = fingerTwo.x - fingerOne.x;
                        const deltaY = fingerTwo.y - fingerOne.y;
                        console.log(deltaX, deltaY);
                        //Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                        const angle = Math.atan2(deltaY, deltaX);
                        console.log(angle);
                        let deltaYaw = this.lastAngle - angle;
                        if (deltaYaw > Math.PI) {
                        deltaYaw -= 2 * Math.PI;
                        } 
                        else if (deltaYaw < -Math.PI) {
                        deltaYaw += 2 * Math.PI;
                        }
                        console.log(deltaYaw);
                        this.lastAngle = angle;
                        //separation = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                        const newangle = this.activeTouchEvent.touches[1].clientX * this.ROTATION_RATE;
                        this.goalYaw += newangle - this.lastAngle;
                        this.lastAngle = newangle;
                        console.log(this.goalYaw);
                        this.gameObject.rotation(new THREE.Vector3(0,1,0), this.goalYaw);
                        */
                        
                        //current
                        /*
                        if(hitPoint != null)
                        {
                            var hitpointscreen = new THREE.Vector3(a, 0, 0);
                        var mx = new THREE.Matrix4().lookAt(this.gameObject.position,hitpointscreen,new THREE.Vector3(0,1,0));
                        var qt = new THREE.Quaternion().setFromRotationMatrix(mx);
                        var tt = new THREE.Quaternion();
                        qt = tt.multiplyQuaternions(qt,this.gameObject.quaternion);
                        console.log(mx);
                        console.log(qt);
                        var diffAngle = this.initialWorldAngle.angleTo(hitPoint);
                        //console.log(hitPoint);
                        //console.log("angle: ", diffAngle);
                        qt.x = 0;
                        qt.z = 0;
                        this.gameObject.quaternion.slerp(qt, this.context.time.deltaTime);
                        //Rotate
                        //this.gameObject.rotateOnWorldAxis(new THREE.Vector3( 0,1,0), -(a * 0.0005));
                        if(this.initialRotPos > a)
                        {
                            //this.gameObject.rotateOnWorldAxis(new THREE.Vector3( 0,1,0), diffAngle);
                            
                        }
                        else if (this.initialRotPos < a)
                        {
                            //this.gameObject.rotateOnWorldAxis(new THREE.Vector3( 0,1,0), -diffAngle);
                        }
                    }
                    */

                    //this.gameObject.rotation.y += a * 0.005;
                    this.gameObject.rotation.y += a * 0.0002;
                        break;

                }
        }
    }
    //Otherwise is a pointer
        else
        {
        console.log("jeff");

            GameObject.setActive(this.pointerObject, true);
            for (let i = 0; i < this.activePointerEvent.pointerType.length; i++) {
                const rc = this.context.input.getPointerPositionRC(0);
                this._raycaster.setFromCamera(rc, this.context.mainCamera);
                const ray = this._raycaster.ray;
                //Gizmos.DrawRay(this._raycaster.ray.origin, this._raycaster.ray.direction, 0xff0000, 10,);
                
                const opts = new RaycastOptions();
                const hits = this.context.physics.raycastFromRay(ray, opts);
                for (let i = 0; i < hits.length; i++) {
                    const hit = hits[i];
                    //console.log(hit.object.name)
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
