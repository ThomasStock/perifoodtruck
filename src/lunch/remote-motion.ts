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
    if (p.updatedAt !== this.revision || p.phase !== this.phase) {
      const last = this.samples.at(-1);
      if (
        p.phase !== this.phase ||
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
      this.phase = p.phase;
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
