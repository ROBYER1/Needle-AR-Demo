import { Behaviour, GameObject } from "@needle-tools/engine";
import { Camera } from "@needle-tools/engine";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { LookAtConstraint } from "@needle-tools/engine";
import * as THREE from "three";
import { getWorldPosition } from "@needle-tools/engine/src/engine/engine_three_utils";
import { Physics, RaycastOptions } from "@needle-tools/engine";
import { serializeable } from "@needle-tools/engine";

export class OrbitControlsEpm extends Behaviour {

    public get controls() {
        return this._controls;
    }

    public get controllerObject(): THREE.Object3D | null {
        return this._targetObject;
    }

    //@nonSerialized
    public onStartInteraction(func: Function) {
       this.controls?.addEventListener("start", func as any);
    }
//
    enableRotate: boolean = true;
    autoRotate: boolean = false;
    autoRotateSpeed: number = 1.0;
    enableDamping: boolean = true;
    dampingFactor: number = 0.1;
    enableZoom: boolean = true;
    private minZoom: number = 0;
    private maxZoom: number = Infinity;
    enablePan: boolean = true;
    @serializeable(LookAtConstraint)
    lookAtConstraint: LookAtConstraint | null = null;
    lookAtConstraint01: number = 1;
    middleClickToFocus: boolean = true;
    doubleClickToFocus: boolean = true;


    debugLog: boolean = false;
    targetLerpSpeed = 5;

    private camGo?: GameObject;
    private cam?: Camera;
    private minTargetPan: THREE.Vector3 = new THREE.Vector3(-10, 0.01, -10);
    private maxTargetPan: THREE.Vector3 = new THREE.Vector3(10, 2, 20);
    private minCamPan: THREE.Vector3 = new THREE.Vector3(-11, 0.01, -12);
    private maxCamPan: THREE.Vector3 = new THREE.Vector3(11, 40, 20);
    private targetPosition!: THREE.Vector3;
    private _controls: ThreeOrbitControls | null = null;
    private _targetObject: THREE.Object3D | null = null;

    private _lerpToTargetPosition: boolean = false;
    private _lerpCameraToTarget: boolean = false;
    private _cameraTargetPosition: THREE.Vector3 | null = null;

    private _inputs: number = 0;
    private _enableTime : number = 0; // use to disable double click when double clicking on UI

    awake(): void {
        this.targetPosition = new THREE.Vector3();
    }

    public changedPan()
    {
        //@ts-ignore
        if(this.cam != null)
        {
            //@ts-ignore
        this.cam.position.clamp(this.minCamPan, this.maxCamPan);
        }
        this._controls?.target.clamp(this.minTargetPan, this.maxTargetPan);
    }


    onEnable() {
        this._enableTime = this.context.time.time;
        //@ts-ignore
        this.camGo = GameObject.getComponent(this.gameObject, Camera);
         //@ts-ignore
        this.cam = this.camGo?.cam;

        if (!this._controls) {
            console.assert(this.cam !== null && this.cam !== undefined, "Missing camera", this);
            if (this.cam)
            {
                //@ts-ignore
                this._targetObject = this.cam;
            }
            //@ts-ignore
            this._controls = new ThreeOrbitControls(this.cam!, this.context.renderer.domElement);
        }

        if (this._controls) {
            this._controls.enableDamping = this.enableDamping;
            this._controls.autoRotate = this.autoRotate;
            this._controls.autoRotateSpeed = this.autoRotateSpeed;
            this._controls.enableRotate = this.enableRotate;
            this._controls.enableZoom = this.enableZoom;
            //@ts-ignore
            if (this.cam?.type === "PerspectiveCamera") {
                this._controls.minDistance = this.minZoom;
                this._controls.maxDistance = this.maxZoom;
            }
            else {
                this._controls.minZoom = this.minZoom;
                this._controls.maxZoom = this.maxZoom;
            }
            this._controls.dampingFactor = this.dampingFactor;
            this._controls.enablePan = this.enablePan;
        }
    }


    onDisable() {
        if (this._controls) {
            this._controls.enabled = false;
            this._controls.autoRotate = false;
            // this._controls.reset();
        }
    }

    start() {
        if (this._controls) {
            //@ts-ignore
            this.camGo = GameObject.getComponent(this.gameObject, Camera);
            if (this.camGo && !this.setFromTargetPosition()) {
                console.log("NO TARGET");
                    //@ts-ignore
                const forward = new THREE.Vector3(0, 0, -1).applyMatrix4(this.camGo.cam.matrixWorld);
                this.setTarget(forward);
            }
        }
        this.startCoroutine(this.startRaycastDelayed());
        
        //@ts-ignore
        this._controls.addEventListener("change", (eventArgs) =>
        {
            this.changedPan();
        } );
        
    }

    // we need to wait one frame (when starting the scene for the very first time)
    private * startRaycastDelayed() {
        yield;
        if (!this.setFromTargetPosition()) {
            const opts = new RaycastOptions();
            // center of the screen:
            opts.screenPoint = new THREE.Vector2(0, 0);
            opts.lineThreshold = 0.1;
            const hits = this.context.physics.raycast(opts);
            if (hits.length > 0) {
                this.setTarget(hits[0].point);
            }
        }
    }

    onBeforeRender() {
        if (!this._controls) return;

        if (this.context.input.getPointerDown(0) || this.context.input.getPointerDown(1) || this.context.input.getPointerDown(2)) {
            this._inputs += 1;
        }
        if (this._inputs > 0) {
            this._controls.autoRotate = false;
            this._lerpCameraToTarget = false;
            this._lerpToTargetPosition = false;
        }
        this._inputs = 0;

        // if (this.context.input.getPointerLongPress(0) && this.context.time.frameCount % 20 === 0) console.log("LP", this.context.alias);

        let focusAtPointer = (this.middleClickToFocus && this.context.input.getPointerClicked(1));
        focusAtPointer ||= (this.doubleClickToFocus && this.context.input.getPointerDoubleClicked(0) && this.context.time.time - this._enableTime > .3);
        if (focusAtPointer) {
            this.setTargetFromRaycast();
        }
        else if (this.context.input.getPointerDown(0) || this.context.input.mouseWheelChanged) {
            this._lerpToTargetPosition = false;
            this._lerpCameraToTarget = false;
        }

        if (this._lerpToTargetPosition || this._lerpCameraToTarget) {
            const step = this.context.time.deltaTime * this.targetLerpSpeed;

            if (this._lerpCameraToTarget && this._cameraTargetPosition && this._targetObject) {
                this._targetObject?.position.lerp(this._cameraTargetPosition, step);
                if (this._targetObject.position.distanceTo(this._cameraTargetPosition) < .01) {
                    this._lerpCameraToTarget = false;
                    console.log("Finished");
                }
            }

            if (this._lerpToTargetPosition) {

                this.lerpTarget(this.targetPosition, step);
                if (this.targetPosition.distanceTo(this._controls.target) < .005) {
                    this._lerpToTargetPosition = false;
                }
            }
        }

        if (this.lookAtConstraint?.locked) this.setFromTargetPosition(0, this.lookAtConstraint01);


        if (this._controls) {
            if (this.debugLog)
                this._controls.domElement = this.context.renderer.domElement;
            this._controls.enabled = true;
            this._controls.update();
        }
    }

    public setCameraTarget(position: THREE.Vector3) {
        this._lerpCameraToTarget = true;
        this._cameraTargetPosition = position?.clone();
    }

    public setFromTargetPosition(index: number = 0, t: number = 1): boolean {
        if (!this._controls) return false;
        const sources = this.lookAtConstraint?.sources;
        if (sources && sources.length > 0) {
            const target = sources[index];
            if (target) {
                target.getWorldPosition(this.targetPosition);
                this.lerpTarget(this.targetPosition, t);
                return true;
            }
        }
        return false;
    }

    public setTarget(position: THREE.Vector3 | null = null, immediate: boolean = false) {
        if (!this._controls) return;
        if (position !== null) this.targetPosition.copy(position);
        if (immediate)
            this._controls.target.copy(this.targetPosition);
        else this._lerpToTargetPosition = true;
    }

    public lerpTarget(position: THREE.Vector3, delta: number) {
        if (!this._controls) return;
        this._controls.target.lerp(position, delta);
    }

    public distanceToTarget(position: THREE.Vector3): number {
        if (!this._controls) return -1;
        return this._controls.target.distanceTo(position);
    }

    private setTargetFromRaycast() {
        if (!this.controls) return;
        const rc = this.context.physics.raycast();
        for (const hit of rc) {
            if (hit.distance > 0 && GameObject.isActiveInHierarchy(hit.object)) {
                // if (hit.object && hit.object.parent) {
                //     const par: any = hit.object.parent;
                //     if (par.isUI) continue;
                // }
                // console.log("Set target", this.targetPosition, hit.object.name, hit.object);
                this.targetPosition.copy(hit.point);
                this._lerpToTargetPosition = true;
                this._cameraTargetPosition = null;
                if (this.context.mainCamera) {
                    this._lerpCameraToTarget = true;
                    const pos = getWorldPosition(this.context.mainCamera);
                    this._cameraTargetPosition = pos.clone().sub(this.controls.target).add(this.targetPosition);
                }
                break;
            }
        }
    }

    // private onPositionDrag(){

    // }
}
