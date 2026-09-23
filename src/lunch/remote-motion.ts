import type { Object3D } from "three";
import { blendPoint, blendTruck, distance } from "../game/simulation";
import type { Player } from "./model";
type Pose = Pick<Player, "truck" | "driver">;
type Sample = Pose & { at: number };
/** Render a little behind the network, so position and heading share one timeline. */
export class RemoteMotion {
  private samples: Sample[] = [];
  private revision = -1;
  private phase = "";
  sample(p: Player, now: number): Pose {
    const phase = `${p.phase}:${!!p.onFoot}`;
    if (p.updatedAt !== this.revision || phase !== this.phase) {
      const last = this.samples.at(-1);
      if (
        phase !== this.phase ||
        (last &&
          (distance(last.truck, p.truck) > 12 ||
            distance(last.driver, p.driver) > 12 ||
            now - last.at > 1000))
      )
        this.samples = [];
      this.samples.push({
        at: now,
        truck: { ...p.truck },
        driver: { ...p.driver },
      });
      this.revision = p.updatedAt;
      this.phase = phase;
    }
    const target = now - 150;
    while (this.samples.length > 2 && this.samples[1].at <= target)
      this.samples.shift();
    const a = this.samples[0],
      b = this.samples[1];
    if (!b || target <= a.at)
      return { truck: { ...a.truck }, driver: { ...a.driver } };
    const t = Math.min(1, (target - a.at) / Math.max(1, b.at - a.at));
    return {
      truck: blendTruck(a.truck, b.truck, t),
      driver: blendPoint(a.driver, b.driver, t),
    };
  }
}

/** Apply the network pose to cloned vehicle roots. */
export function applyRemoteTruckPose(
  cab: Object3D,
  trailer: Object3D,
  pose: Player["truck"],
) {
  cab.position.set(pose.x, 0, pose.z);
  // Quaternion-to-Euler conversion during cloning can leave X/Z at pi.
  // Replace all axes; changing only Y can point the clone backwards.
  cab.rotation.set(0, pose.heading, 0);
  trailer.position.copy(cab.position);
  trailer.rotation.set(0, pose.trailerHeading, 0);
}
