import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DriverRig } from "../src/rig";
import { createState, idleInput, angle } from "../src/game/simulation";
test("a remote walker faces its observed movement with no local keyboard input", () => {
  const root = new THREE.Group();
  const rig = new DriverRig(root);
  rig.bind();
  const state = createState();
  state.phase = "walk-kiosk";
  state.driver = { x: 0, z: 0 };
  rig.update(state, idleInput(), 1 / 60, false);
  for (let i = 1; i <= 120; i++) {
    state.driver = { x: i * 0.05, z: 0 };
    rig.update(state, idleInput(), 1 / 60, false);
  }
  assert.ok(
    Math.abs(angle(root.rotation.y - Math.PI / 2)) < 0.05,
    "must face east while walking east",
  );
});

import { RemoteMotion } from "../src/lunch/remote-motion";
import { newPlayer } from "../src/lunch/model";
test("remote trucks preserve forward/reverse heading and cross the angle seam without spinning", () => {
  const p = newPlayer("remote@example.com");
  p.updatedAt = 1;
  p.truck = {
    ...p.truck,
    x: 0,
    z: 0,
    heading: Math.PI - 0.1,
    trailerHeading: Math.PI - 0.1,
    speed: 5,
  };
  const motion = new RemoteMotion();
  motion.sample(p, 0);
  p.updatedAt = 2;
  p.truck.z = -0.6;
  p.truck.heading = -Math.PI + 0.1;
  motion.sample(p, 120);
  const mid = motion.sample(p, 210);
  assert.ok(Math.abs(Math.abs(mid.truck.heading) - Math.PI) < 0.001);
  assert.ok(Math.abs(mid.truck.z + 0.3) < 0.001);
  p.updatedAt = 3;
  p.truck.speed = -2;
  p.truck.z = -0.36;
  motion.sample(p, 240);
  const reverse = motion.sample(p, 390);
  assert.equal(reverse.truck.speed, -2);
  assert.equal(
    reverse.truck.heading,
    p.truck.heading,
    "reverse motion must not flip the cab",
  );
});
test("remote walking interpolates between packets; recovery snaps instead of sliding across yard", () => {
  const p = newPlayer("walker@example.com");
  p.phase = "walk-kiosk";
  p.driver = { x: 0, z: 0 };
  p.updatedAt = 1;
  const motion = new RemoteMotion();
  motion.sample(p, 0);
  p.driver.x = 1.08;
  p.updatedAt = 2;
  motion.sample(p, 120);
  assert.ok(Math.abs(motion.sample(p, 210).driver.x - 0.54) < 0.001);
  p.driver.x = 40;
  p.updatedAt = 3;
  assert.equal(motion.sample(p, 240).driver.x, 40);
});
