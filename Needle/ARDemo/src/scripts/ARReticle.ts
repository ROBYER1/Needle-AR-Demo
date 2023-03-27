import { findObjectsOfType, serializable } from "@needle-tools/engine";
import { Behaviour, GameObject } from "@needle-tools/engine/src/engine-components/Component";
import { ARControls } from "./ArControls";

export class ARReticle extends Behaviour
{
    start()
    {
        console.log("started");
        for (const ctrl of GameObject.findObjectsOfType(ARControls)) {
            ctrl.placementTarget = this.gameObject;
            console.log("this target reticle: ", ctrl.gameObject.name);
            console.log("target set to: ", ctrl.placementTarget);
        }
    }
}
