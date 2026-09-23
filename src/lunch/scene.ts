import { RemoteMotion } from "./remote-motion";
import { BurgerLitter } from "./burger-litter";
import type { Burger } from "./burgers";
import * as THREE from "three";
import { createBurgerSign } from "./burger-sign";
import { YardScene } from "../scene";
import { DriverRig } from "../rig";
import { RigWheels } from "../wheels";
import { idleInput, createState, type State } from "../game/simulation";
import {
  attached,
  objective,
  walking,
  PARKINGS,
  EXIT,
  type Player,
  type Input,
  type Point,
} from "./model";
function label(email: string, own = false, others = 0) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const at = email.lastIndexOf("@");
  const title = own ? "Your trailer" : email.slice(0, at > 0 ? at : undefined);
  const detail = own ? email : at > 0 ? email.slice(at) : "Lunch driver";
  const suffix = others ? `  ·  +${others} here` : "";
  ctx.font = "500 24px system-ui";
  const width = Math.min(
    540,
    Math.max(220, ctx.measureText(detail + suffix).width + 58),
  );
  ctx.font = "600 30px system-ui";
  canvas.width = Math.max(
    width,
    Math.min(540, ctx.measureText(title).width + 66),
  );
  canvas.height = 112;
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.strokeStyle = own ? "#80c6b6" : "#d5dfda";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(2, 2, canvas.width - 4, 96, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = own ? "#009b80" : "#849c94";
  ctx.beginPath();
  ctx.arc(25, 34, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#21483f";
  ctx.font = "600 30px system-ui";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 42, 34, canvas.width - 62);
  ctx.fillStyle = "#698177";
  ctx.font = "500 24px system-ui";
  ctx.fillText(detail + suffix, 22, 72, canvas.width - 44);
  // A small pointer anchors the tag to its vehicle, without a floating bar.
  ctx.fillStyle = own ? "#80c6b6" : "#d5dfda";
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 6, 100);
  ctx.lineTo(canvas.width / 2, 108);
  ctx.lineTo(canvas.width / 2 + 6, 100);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.scale.set(canvas.width / 110, canvas.height / 110, 1);
  return sprite;
}
function tint(root: THREE.Object3D, opacity: number) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = opacity === 1;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.transparent = opacity < 1;
        m.opacity = opacity;
        m.depthWrite = opacity === 1;
        m.needsUpdate = true;
      }
    }
  });
}
function clone(root: THREE.Group, opacity: number) {
  const copy = root.clone(true);
  copy.visible = true;
  copy.traverse((o) => {
    if (o instanceof THREE.Mesh)
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
  });
  tint(copy, opacity);
  return copy;
}
function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.dispose();
    if (o instanceof THREE.Sprite) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
}
type Remote = {
  root: THREE.Group;
  cab: THREE.Group;
  trailer: THREE.Group;
  driver: THREE.Group;
  name: THREE.Sprite;
  rig: DriverRig;
  wheels: RigWheels;
  pose: Player["truck"];
  motion: RemoteMotion;
};
export class LunchScene {
  base: YardScene;
  private state = createState();
  private remotes = new Map<string, Remote>();
  private parked = new Map<string, THREE.Group>();
  private ownName = label("");
  private name = "";
  private ghost = false;
  private elapsed = 0;
  private arrows: THREE.InstancedMesh;
  private burgerSign = createBurgerSign();
  private burgerLitter = new BurgerLitter();
  setBurgers(burgers: Burger[]) {
    this.burgerLitter.update(burgers);
  }
  aimAt(clientX: number, clientY: number): Point | null {
    const rect = this.base.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.base.camera,
    );
    const hit = ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
    return hit ? { x: hit.x, z: hit.z } : null;
  }
  constructor(container: HTMLElement) {
    this.base = new YardScene(container, true);
    this.base.scene.add(this.burgerLitter.root);
    this.base.mode = "yard";
    this.base.scene.add(this.burgerSign.root);
    const arrow = new THREE.Shape();
    arrow.moveTo(-0.8, -0.18);
    arrow.lineTo(0.2, -0.18);
    arrow.lineTo(0.2, -0.55);
    arrow.lineTo(0.9, 0);
    arrow.lineTo(0.2, 0.55);
    arrow.lineTo(0.2, 0.18);
    arrow.lineTo(-0.8, 0.18);
    arrow.closePath();
    const arrowGeometry = new THREE.ShapeGeometry(arrow);
    arrowGeometry.rotateX(-Math.PI / 2);
    this.arrows = new THREE.InstancedMesh(
      arrowGeometry,
      new THREE.MeshBasicMaterial({
        color: "#a6efcd",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
      100,
    );
    this.arrows.count = 0;
    this.arrows.frustumCulled = false;
    this.base.scene.add(this.ownName);
    this.base.gate.rotation.z = Math.PI * 0.48;
    for (const bay of PARKINGS) {
      const material = new THREE.MeshBasicMaterial({ color: "#e5e7ca" });
      for (const side of [-1, 1]) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.015, 18),
          material,
        );
        line.position.set(bay.x + side * 3, 0.08, bay.z - 5);
        this.base.scene.add(line);
      }
    }
    const exitFill = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 24),
      new THREE.MeshBasicMaterial({
        color: "#00b38e",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    exitFill.rotation.x = -Math.PI / 2;
    exitFill.position.set(68, 0.09, 34);
    this.base.scene.add(exitFill);
    for (const [x, z, w, d] of [
      [54, 34, 0.25, 24],
      [82, 34, 0.25, 24],
      [68, 22, 28, 0.25],
      [68, 46, 28, 0.25],
    ]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.02, d),
        new THREE.MeshBasicMaterial({ color: "#b6ffe1" }),
      );
      stripe.position.set(x, 0.12, z);
      this.base.scene.add(stripe);
    }
    for (const z of [22, 46]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 5, 0.4),
        new THREE.MeshStandardMaterial({ color: "#00a990" }),
      );
      post.position.set(52, 2.5, z);
      this.base.scene.add(post);
    }
    for (const x of [34, 43, 57, 66, 75]) {
      const arrow = new THREE.Shape();
      arrow.moveTo(-2, -0.35);
      arrow.lineTo(0.5, -0.35);
      arrow.lineTo(0.5, -1.1);
      arrow.lineTo(2, 0);
      arrow.lineTo(0.5, 1.1);
      arrow.lineTo(0.5, 0.35);
      arrow.lineTo(-2, 0.35);
      arrow.closePath();
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(arrow),
        new THREE.MeshBasicMaterial({
          color: "#d9f9b7",
          side: THREE.DoubleSide,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.1, 34);
      this.base.scene.add(mesh);
    }
  }
  get mode() {
    return this.base.mode;
  }
  set mode(value: YardScene["mode"]) {
    this.base.mode = value;
  }
  async load() {
    await this.base.load();
    this.base.scene.add(this.arrows);
  }
  project(p: Point) {
    return this.base.project(p, 4);
  }
  private sceneState(p: Player): State {
    const s = {
      ...this.state,
      truck: p.truck,
      driver: p.driver,
      gateOpen: true,
      dispatched: false,
      elapsed: this.elapsed,
    };
    s.phase =
      p.phase === "walk-kiosk" ||
      p.phase === "kiosk" ||
      p.phase === "walk-truck"
        ? p.phase
        : p.phase === "arrive"
          ? "arrive"
          : "gate";
    return s;
  }
  render(me: Player | null, players: Player[], input: Input, dt: number) {
    this.elapsed += dt;
    this.burgerSign.burger.rotation.y = this.elapsed * 0.55;
    const local = me ?? {
      email: "",
      truck: this.state.truck,
      driver: this.state.driver,
      phase: "arrive" as const,
      parking: null,
      lines: [],
      subtotalCents: 0,
      feeCents: 0,
      totalCents: 0,
      updatedAt: 0,
    };
    const visible = new Set<string>();
    for (const p of players.filter(
      (p) => p.email !== me?.email && Date.now() - p.updatedAt < 15000,
    )) {
      visible.add(p.email);
      let v = this.remotes.get(p.email);
      if (!v) {
        const root = new THREE.Group(),
          cab = clone(this.base.tractor, 0.38),
          trailer = clone(this.base.trailer, 0.38),
          driver = clone(this.base.driver, 0.55),
          name = label(p.email);
        const rig = new DriverRig(driver);
        rig.bind();
        const wheels = new RigWheels();
        wheels.bind(cab, trailer);
        root.add(cab, trailer, driver, name);
        this.base.scene.add(root);
        v = {
          root,
          cab,
          trailer,
          driver,
          name,
          rig,
          wheels,
          pose: { ...p.truck },
          motion: new RemoteMotion(),
        };
        this.remotes.set(p.email, v);
      }
      const smoothed = v.motion.sample(p, performance.now());
      v.pose = smoothed.truck;
      v.cab.position.set(v.pose.x, 0, v.pose.z);
      v.cab.rotation.y = v.pose.heading;
      v.trailer.position.copy(v.cab.position);
      v.trailer.rotation.y = v.pose.trailerHeading;
      v.trailer.visible = attached(p);
      v.wheels.update(v.pose);
      for (const name of ["steering-left", "steering-right"]) {
        const wheel = v.cab.getObjectByName(name);
        if (wheel) wheel.rotation.y = v.pose.steer;
      }
      v.rig.update(
        this.sceneState({ ...p, ...smoothed }),
        idleInput(),
        dt,
        false,
      );
      const actor = walking(p) ? smoothed.driver : v.pose;
      v.name.position.set(actor.x, walking(p) ? 2.8 : 4.8, actor.z);
      v.name.material.opacity = 0.85;
    }
    for (const [email, v] of this.remotes)
      if (!visible.has(email)) {
        this.base.scene.remove(v.root);
        dispose(v.root);
        this.remotes.delete(email);
      }
    const parkedNow = new Set<string>(),
      stack = new Set<number>();
    const bayCounts = new Map<number, number>();
    for (const p of [
      ...players.filter((p) => p.email !== me?.email),
      ...(me ? [me] : []),
    ]) {
      if (p.parking !== null && ["walk-truck", "pickup"].includes(p.phase))
        bayCounts.set(p.parking, (bayCounts.get(p.parking) ?? 0) + 1);
    }
    for (const p of [
      ...(me ? [me] : []),
      ...players.filter((p) => p.email !== me?.email),
    ]) {
      if (p.parking === null || !["walk-truck", "pickup"].includes(p.phase))
        continue;
      const bay = PARKINGS[p.parking];
      if (!bay) continue;
      parkedNow.add(p.email);
      let group = this.parked.get(p.email);
      if (!group) {
        group = new THREE.Group();
        const trailer = clone(
          this.base.trailer,
          p.email === me?.email ? 1 : 0.23,
        );
        trailer.position.set(0, 0, 0);
        trailer.rotation.set(0, 0, 0);
        group.add(trailer);
        this.base.scene.add(group);
        this.parked.set(p.email, group);
      }
      group.position.set(bay.x, 0, bay.z);
      group.rotation.y = 0;
      const count = (bayCounts.get(bay.id) ?? 1) - 1;
      const tagKey = `${p.email}:${count}:${p.email === me?.email}`;
      if (group.userData.tagKey !== tagKey) {
        const old = group.children[1];
        if (old) {
          group.remove(old);
          dispose(old);
        }
        group.add(label(p.email, p.email === me?.email, count));
        group.userData.tagKey = tagKey;
      }
      group.children[1].position.set(0, 5.5, -5);
      group.children[1].visible = !stack.has(bay.id);
      stack.add(bay.id);
    }
    for (const [email, group] of this.parked)
      if (!parkedNow.has(email)) {
        this.base.scene.remove(group);
        dispose(group);
        this.parked.delete(email);
      }
    if (me?.email !== this.name) {
      this.base.scene.remove(this.ownName);
      dispose(this.ownName);
      this.name = me?.email ?? "";
      this.ownName = label(this.name);
      this.base.scene.add(this.ownName);
    }
    const ghost = me?.phase === "complete";
    if (ghost !== this.ghost) {
      tint(this.base.tractor, ghost ? 0.35 : 1);
      this.ghost = ghost;
    }
    const actor = walking(local) ? local.driver : local.truck;
    this.ownName.position.set(actor.x, walking(local) ? 3.3 : 6.5, actor.z);
    this.ownName.visible = false;
    const obj = objective(local);
    const points = [actor];
    if (local.phase === "pickup" && local.truck.z > 12)
      points.push({ x: 18, z: 25 }, { x: 18, z: 0 });
    if (local.phase === "exit" && local.truck.z < 16)
      points.push({ x: 18, z: 0 }, { x: 18, z: 28 });
    if (local.phase === "walk-kiosk" && local.driver.z > 31)
      points.push({ x: -28, z: 29.5 });
    points.push(obj.target);
    const guiding = !!me && me.phase !== "complete" && me.phase !== "kiosk";
    this.arrows.visible = guiding;
    const marker = new THREE.Object3D();
    let count = 0;
    const spacing = walking(local) ? 2 : 5;
    for (let i = 1; i < points.length && count < 100; i++) {
      const from = points[i - 1],
        to = points[i];
      const dx = to.x - from.x,
        dz = to.z - from.z,
        length = Math.hypot(dx, dz);
      for (let d = spacing; d < length && count < 100; d += spacing) {
        marker.position.set(
          from.x + (dx * d) / length,
          0.12,
          from.z + (dz * d) / length,
        );
        marker.rotation.y = -Math.atan2(dz, dx);
        marker.scale.setScalar(walking(local) ? 0.65 : 1);
        marker.updateMatrix();
        this.arrows.setMatrixAt(count++, marker.matrix);
      }
    }
    this.arrows.count = count;
    this.arrows.instanceMatrix.needsUpdate = true;
    this.base.render(this.sceneState(local), input, dt, !!me, {
      target: obj.target,
      attached: attached(local),
    });
    this.base.target.visible = guiding && local.phase !== "exit";
  }
}
