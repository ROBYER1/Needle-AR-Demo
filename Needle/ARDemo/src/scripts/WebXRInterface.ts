import { Camera, getComponent, Gizmos, Mathf, Rigidbody, serializable, WebARSessionRoot, WebXR, WebXRController } from "@needle-tools/engine";
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
import { ArrayCamera, Color, Euler, EventDispatcher, Group, Matrix4, Mesh, MeshBasicMaterial, Object3D, Quaternion, RingGeometry, Texture, Vector3 } from 'three';

// not sure if this should be a behaviour. 
// for now we dont really need it to go through the usual update loop
export class WebXRInterface extends Behaviour 
{
    private camera: THREE.Camera;
    private controller: THREE.XRTargetRaySpace;

    private reticle: Object3D | null = null;
    private reticleParent: Object3D | null = null;

    private hitTestSource: XRHitTestSource | null = null;
    private hitTestSourceRequested: boolean = false;

//

private session: XRSession;
private sessionRoot: WebARSessionRoot | null = null;

private webxr: WebXR;

private hasEnteredAr: boolean = false;

 start() {
    WebXR.addEventListener(WebXREvent.XRStarted, this.onXRStarted.bind(this));
    WebXR.addEventListener(WebXREvent.XRStopped, this.onXRStarted.bind(this));
    this.webxr = GameObject.findObjectOfType(WebXR);
    console.log("webxr found: ", this.webxr);
        this.camera = this.context.mainCamera;

        const geometry = new THREE.CylinderGeometry( 0.1, 0.1, 0.2, 32 ).translate( 0, 0.1, 0 );

        function onSelect() {
                /*
            //if ( this.reticle.visible ) {

                const material = new THREE.MeshPhongMaterial( { color: 0xffffff * Math.random() } );
                const mesh = new THREE.Mesh( geometry, material );
                this.reticle.matrix.decompose( mesh.position, mesh.quaternion, mesh.scale );
                mesh.scale.y = Math.random() * 2 + 1;
                this.context.scene.add( mesh );

            //}
            */

        }

        this.controller = this.context.renderer.xr.getController( 0 );
        this.controller.addEventListener( 'select', onSelect );
        this.context.scene.add( this.controller );

        this.reticle = new Mesh(
            new RingGeometry(0.07, 0.09, 32).rotateX(- Math.PI / 2),
            new MeshBasicMaterial({color: 0xff0000})
        );
        this.reticle.name = "AR Placement reticle";
        this.reticle.matrixAutoUpdate = false;
        this.reticle.visible = true;
        this.context.scene.add( this.reticle );

        if (!this.sessionRoot || this.sessionRoot.destroyed || !this.sessionRoot.activeAndEnabled)
            this.sessionRoot = GameObject.findObjectOfType(WebARSessionRoot, this.context);

    }

    onXRStarted()
    {
        console.log("XR Started!");
        //
        this.hasEnteredAr = true;
    }

    onXRStopped()
    {
        console.log("XR Stopped!");
    }

    async onBegin(session: XRSession) {
        //const context = this.webxr.context;
        console.log("begin, checking hit test source");
        session.requestReferenceSpace('viewer').then((referenceSpace) => {
            session.requestHitTestSource?.call(session, { space: referenceSpace })?.then((source) => {
                this.hitTestSource = source;
            }).catch((err) => {
                //this.noHitTestAvailable = true;
                console.warn("WebXR: Hit test not supported", err);
            });
        });
        this.hasEnteredAr = false;
    }

    onBeforeRender(frame) {
        if (!frame) return;

        // TODO: figure out why screen is black if we enable the code written here
        // const referenceSpace = renderer.xr.getReferenceSpace();
        this.session = this.context.renderer.xr.getSession();

        console.log("webxr is in xr", WebXR.IsInWebXR);
        if (WebXR.IsInWebXR === true && this.hasEnteredAr == true) {
            this.onEnterXR(this.session, frame);
        }
        

        if (this.session) {
            const pose = frame.getViewerPose(this.context.renderer.xr.getReferenceSpace());
            if(!pose) return;
                this.onUpdate(this.session, frame);
        }
    }


    private onEnterXR(session: XRSession, frame: XRFrame) {
        console.log("[XR] session begin", session);
        //WebXR._isInXr = true;

        // when we set unity layers objects will only be rendered on one eye
        // we set layers to sync raycasting and have a similar behaviour to unity
        const xr = this.context.renderer.xr;
        this.onBegin(session);


    }

    onUpdate(session: XRSession, frame: XRFrame) {
        
        /*
            const referenceSpace = this.context.renderer.xr.getReferenceSpace();
            //const session = this.context.renderer.xr.getSession();

            if ( this.hitTestSourceRequested === false ) {

                session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpace ) {

                    session.requestHitTestSource( { space: referenceSpace } ).then( function ( source ) {

                        this.hitTestSource = source;
console.log("requesting hit space");
                    } );

                } );

                session.addEventListener( 'end', e =>  {
                    this.hitTestSourceRequested = false;
                    this.hitTestSource = null;
                    if (e != null)
                    {

                    }
                } );

                this.hitTestSourceRequested = true;

            }

            if ( this.hitTestSource ) {

                const hitTestResults = frame.getHitTestResults( this.hitTestSource );

                if ( hitTestResults.length ) {

                    const hit = hitTestResults[ 0 ];

                    this.reticle.visible = true;
                    this.reticle.matrix.fromArray( hit.getPose( referenceSpace ).transform.matrix );

                } else {

                    //this.reticle.visible = false;

                }

            }
            */
            console.log("hittestsouurce: ",this.hitTestSource);
            if (!this.hitTestSource) return;
            console.log("update");
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);
            if (hitTestResults.length) {
                console.log("hit");
                const hit = hitTestResults[0];
                const referenceSpace = this.webxr.context.renderer.xr.getReferenceSpace();
                console.log("ref space: ", referenceSpace);
                if (referenceSpace) {
                    const pose = hit.getPose(referenceSpace);

                    if (this.reticle) {

                            if (pose) {
                                const matrix = pose.transform.matrix;
                                this.reticle.matrix.fromArray(matrix);
                                this.reticle.matrix.premultiply(this.webxr.Rig.matrix);
                                    console.log("place reticule");
                            }
                        //}
                    }
                }
    
            } 
            else {
                console.log("NO hit");
                this.sessionRoot?.onUpdate(this.webxr.Rig, session, null);
                if (this.reticle)
                {
                //this.reticle.visible = false;
                }
                    
            }
    }
}