import { Behaviour, GameObject } from "@needle-tools/engine";
import * as THREE from "three";

export class MouseIncrementRotate extends Behaviour{

  private rotationSpeed: number = 1;
  private angleStopFloat: number = 0;
  private checkRotation = new THREE.Quaternion();
  private Interval: number = 0;
  private SelectedProduct: number = 1;
  private dragging: boolean = false;
  public stopping: boolean = false;
  public SnapSpeed: number = 10;
  private spin: boolean = true;
  private rotationStore = new THREE.Quaternion();
  private delta = new THREE.Vector3();

  onEnable(){
    this.rotationSpeed = 2;
    window.addEventListener("mousedown", this.onMouseDown.bind(this), false);
    window.addEventListener("mousemove", this.onMouseMove.bind(this), false);
    window.addEventListener("mouseup", this.onMouseUp.bind(this), false);
  }

  private onMouseDown(event: MouseEvent){
    console.log("mouse down");
    if (this.spin) {
      this.dragging = true;
      this.stopping = false;
    }
  }

  private onMouseMove(event: MouseEvent){
    
    if (this.dragging) {
        console.log("drag mouse move", this.rotationSpeed);
      const x = event.movementX;
      const y = event.movementY;
      this.delta = new THREE.Vector3(-y * this.rotationSpeed, -x * this.rotationSpeed, 0);
      this.delta = this.delta.multiplyScalar(Math.PI / 180);
      const localEuler = new THREE.Euler;
      localEuler.setFromVector3(this.delta);
      const quaternion = new THREE.Quaternion().setFromEuler(localEuler);
      this.gameObject.quaternion.multiply(quaternion);
    }
    this.checkRotation.copy(this.rotationStore)
    }

    private onMouseUp(event: MouseEvent){
        console.log("mouse up");
        if (this.spin) {
          this.dragging = false;
          this.stopping = true;
        }
      }

      update(){
          //console.log(this.rotationSpeed);
      }

}