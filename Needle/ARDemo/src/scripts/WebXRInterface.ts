import {
  AssetReference,
  Camera,
  getComponent,
  Gizmos,
  Mathf,
  Rigidbody,
  serializable,
  WebARSessionRoot,
  WebXR,
  WebXRController,
} from "@needle-tools/engine";
import { Behaviour, GameObject } from "@needle-tools/engine";
import * as THREE from "three";
import {
  getWorldPosition,
  getWorldQuaternion,
  setWorldPosition,
} from "@needle-tools/engine/src/engine/engine_three_utils";
import { OrbitControls } from "@needle-tools/engine";
import { Context, FrameEvent, XRSessionMode } from "@needle-tools/engine";
import { WebXREvent } from "@needle-tools/engine";
import { CoroutineData, Vec2 } from "@needle-tools/engine";
import { RaycastOptions } from "@needle-tools/engine";
import { WaitForSeconds } from "@needle-tools/engine";
import { Time } from "@needle-tools/engine";
import { Vec3 } from "@needle-tools/engine";
import * as utils from "@needle-tools/engine/src/engine/engine_three_utils";
import {
  ArrayCamera,
  Color,
  Euler,
  EventDispatcher,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  RingGeometry,
  Texture,
  Vector3,
} from "three";
import { ARReticle } from "./ARReticle";

// not sure if this should be a behaviour.
// for now we dont really need it to go through the usual update loop
export class WebXRInterface extends Behaviour {
  @serializable(AssetReference)
  public testReticle?: AssetReference;

  private SpawnedReticule?: GameObject;

  private camera: THREE.Camera;
  private controller: THREE.XRTargetRaySpace;

  private reticle: Object3D | null = null;
  private reticleParent: Object3D | null = null;

  private hitTestSource: XRHitTestSource | null = null;
  private hitTestSourceRequested: boolean = false;
  //Not supported in Mozilla
  //private offsetRay: XRRay | null = null;
  //

  private session: XRSession;
  private sessionRoot: WebARSessionRoot | null = null;
  private rigidTransform: XRRigidTransform | null = null;

  private webxr: WebXR;

  private hasEnteredAr: boolean = false;

  async start() {
    //Not supported in Mozilla
    //this.updateOffsetRay();
    WebXR.addEventListener(WebXREvent.XRStarted, this.onXRStarted.bind(this));
    WebXR.addEventListener(WebXREvent.XRStopped, this.onXRStopped.bind(this));
    this.webxr = GameObject.findObjectOfType(WebXR);
    if (GameObject.findObjectOfType(ARReticle) == null) {
      this.SpawnedReticule =
        (await this.testReticle?.instantiate()) as GameObject;
      console.log(this.SpawnedReticule.getComponent(ARReticle));
      //this.SpawnedReticule.addNewComponent(ARReticle);
    }
    //console.log("webxr found: ", this.webxr);
    this.camera = this.context.mainCamera;

    const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32).translate(
      0,
      0.1,
      0
    );

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

    this.controller = this.context.renderer.xr.getController(0);
    this.controller.addEventListener("select", onSelect);
    this.context.scene.add(this.controller);

    this.reticle = new Mesh(
      new RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({ color: 0xff0000 })
    );
    this.reticle.name = "AR Placement reticle";
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.context.scene.add(this.reticle);

    if (
      !this.sessionRoot ||
      this.sessionRoot.destroyed ||
      !this.sessionRoot.activeAndEnabled
    )
      this.sessionRoot = GameObject.findObjectOfType(
        WebARSessionRoot,
        this.context
      );
  }

  onXRStarted() {
    console.log("XR Started!");
    //
    this.hasEnteredAr = true;
    this.reticle.visible = true;
  }

  onXRStopped() {
    console.log("XR Stopped!");
    this.reticle.visible = false;
    this.SpawnedReticule.visible = false;
    this.hitTestSource = null;
  }

  async onBegin(session: XRSession) {
    //const context = this.webxr.context;
    //console.log("begin, checking hit test source");
    session.requestReferenceSpace("viewer").then((referenceSpace) => {
      session.requestHitTestSource
        ?.call(session, { space: referenceSpace })
        ?.then((source) => {
          this.hitTestSource = source;
        })
        .catch((err) => {
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

    //console.log("webxr is in xr", WebXR.IsInWebXR);
    if (WebXR.IsInWebXR === true && this.hasEnteredAr == true) {
      this.onEnterXR(this.session, frame);
    }

    if (this.session) {
      const pose = frame.getViewerPose(
        this.context.renderer.xr.getReferenceSpace()
      );
      if (!pose) return;
      this.onUpdate(this.session, frame);
      this.rigidTransform = pose?.transform;
    }
  }

  private onEnterXR(session: XRSession, frame: XRFrame) {
    //console.log("[XR] session begin", session);
    //WebXR._isInXr = true;
    if (frame != null) {
    }
    // when we set unity layers objects will only be rendered on one eye
    // we set layers to sync raycasting and have a similar behaviour to unity
    const xr = this.context.renderer.xr;
    this.onBegin(session);
  }

  /*
    private updateOffsetRay()
    {
        if(this.rigidTransform != null)
        {
        this.offsetRay = new XRRay(this.rigidTransform, new Vector3(0, 0, -1).applyMatrix4(this.context.mainCamera.matrixWorld));
        //this.offsetRay = new XRRay(this.rigidTransform);
        }
    }
    */

  onUpdate(session: XRSession, frame: XRFrame) {
    //Not supported in Mozilla
    //this.updateOffsetRay();
    /*
            const referenceSpace = this.context.renderer.xr.getReferenceSpace();
            //const session = this.context.renderer.xr.getSession();

            if ( this.hitTestSourceRequested === false ) {

                session.requestReferenceSpace( 'viewer' ).then( function ( referenceSpa_directionvec4ce ) {

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
    //console.log("hittestsouurce: ",this.hitTestSource);
    if (!this.hitTestSource) return;
    //console.log("update");
    const hitTestResults = frame.getHitTestResults(this.hitTestSource);
    if (hitTestResults.length) {
      //console.log("hit");
      const hit = hitTestResults[0];
      const referenceSpace = this.webxr.context.renderer.xr.getReferenceSpace();
      //console.log("ref space: ", referenceSpace);
      if (referenceSpace) {
        const pose = hit.getPose(referenceSpace);

        if (this.reticle) {
          if (pose) {
            const matrix = pose.transform.matrix;
            this.reticle.matrix.fromArray(matrix);
            this.reticle.matrix.premultiply(this.webxr.Rig.matrix);
            //console.log("place reticule");
            this.SpawnedReticule.position.setFromMatrixPosition(
              this.reticle.matrix
            );
          }
          //}
        }
      }
    } else {
      console.log("NO hit");
      this.sessionRoot?.onUpdate(this.webxr.Rig, session, null);
      if (this.reticle) {
        //this.reticle.visible = false;
      }
    }
  }
}
