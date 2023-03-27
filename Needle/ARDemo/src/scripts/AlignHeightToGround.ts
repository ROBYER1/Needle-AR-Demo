import { Behaviour, GameObject } from "@needle-tools/engine/src/engine-components/Component";
import { Raycaster, Vector3 } from "three";
import { IsGround } from "./IsGround";

export class AlignHeightToGround extends Behaviour
{
    raycaster = new Raycaster();
    grounds: GameObject[] = [];

    public isInAr: Boolean = false;

    onEnable()
    {
        let grounds = GameObject.findObjectsOfType(IsGround, this.context).map(g => g.gameObject); // map == Linq.Select
    }

    update()
    {
        if(this.isInAr == false)
        {
            this.updateHeight();
        }
    }

    updateHeight()
    {
        this.raycaster.set(
            new Vector3(this.gameObject.position.x, this.gameObject.position.y + 50, this.gameObject.position.z), 
            new Vector3(0, -1, 0)
        );
        const grounds = GameObject.findObjectsOfType(IsGround, this.context).map(g => g.gameObject); 
        const hits = this.raycaster.intersectObjects(grounds);
        if(hits.length == 0) return;

        const sortedByHeight = hits.sort((a, b) => { return a.point.y - b.point.y});
        const highest = sortedByHeight[hits.length - 1];
        this.gameObject.position.y = highest.point.y;
    }
}
