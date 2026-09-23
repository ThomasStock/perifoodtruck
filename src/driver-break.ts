import * as THREE from "three";
import { DriverRig } from "./rig";
import type { Truck } from "./game/simulation";

/** Cosmetic breaks beside an idle cab; never changes a player's simulation. */
export class DriverBreak {
  private rig: DriverRig;
  private wait = 3 + Math.random() * 15;
  private route: { x: number; z: number; pause: number }[] = [];
  private origin: Truck | null = null;
  private x = 0;
  private z = 0;
  private heading = 0;
  constructor(private person: THREE.Group) {
    this.rig = new DriverRig(person);
    this.rig.bind();
    person.visible = false;
  }

  update(truck: Truck, eligible: boolean, dt: number, reducedMotion = false) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    if (
      !eligible ||
      Math.abs(truck.speed) > 0.08 ||
      (this.origin &&
        (Math.hypot(truck.x - this.origin.x, truck.z - this.origin.z) > 0.15 ||
          Math.abs(truck.heading - this.origin.heading) > 0.03))
    ) {
      this.route = [];
      this.origin = null;
      this.wait = 5 + Math.random() * 20;
      this.person.visible = false;
      return;
    }
    if (!this.route.length) {
      this.person.visible = false;
      this.wait -= dt;
      if (this.wait > 0) return;
      this.origin = { ...truck };
      const point = (x: number, z: number, pause = 0) => ({
        x: truck.x + x * Math.cos(truck.heading) + z * Math.sin(truck.heading),
        z: truck.z - x * Math.sin(truck.heading) + z * Math.cos(truck.heading),
        pause,
      });
      const door = point(-1.5, 3.1);
      this.x = door.x;
      this.z = door.z;
      const side = 2.6 + Math.random() * 0.8;
      this.route = [
        point(-2.3, 3.1),
        point(-side, 4 + Math.random() * 2, 1 + Math.random() * 3),
        point(-side, 1 + Math.random() * 2, 1 + Math.random() * 2),
        point(-2.3, 3.1),
        door,
      ];
    }
    const target = this.route[0];
    const dx = target.x - this.x,
      dz = target.z - this.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.01) {
      const step = Math.min(distance, dt * 1.15);
      this.x += (dx / distance) * step;
      this.z += (dz / distance) * step;
      this.heading = Math.atan2(dx, dz);
    } else {
      target.pause -= dt;
      if (target.pause <= 0) this.route.shift();
    }
    this.rig.walk(this.x, this.z, this.heading, dt, reducedMotion);
    if (!this.route.length) {
      this.person.visible = false;
      this.origin = null;
      this.wait = 12 + Math.random() * 30;
    }
  }
}
