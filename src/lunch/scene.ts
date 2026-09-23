import * as THREE from "three";
import { createBurgerSign } from "./burger-sign";
import { YardScene } from "../scene";
import { DriverRig } from "../rig";
import { RigWheels } from "../wheels";
import { blendTruck, createState, type State } from "../game/simulation";
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
function label(text: string, width = 7) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#153e39e6";
  ctx.beginPath();
  ctx.roundRect(2, 2, 1020, 124, 30);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 48px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 64, 970);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    }),
  );
  sprite.scale.set(width, width / 8, 1);
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
  constructor(container: HTMLElement) {
    this.base = new YardScene(container, true);
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
          cab = clone(this.base.tractor, 0.25),
          trailer = clone(this.base.trailer, 0.25),
          driver = clone(this.base.driver, 0.25),
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
        };
        this.remotes.set(p.email, v);
      }
      v.pose = blendTruck(v.pose, p.truck, 1 - Math.exp(-12 * dt));
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
      v.rig.update(this.sceneState({ ...p, truck: v.pose }), input, dt, false);
      const actor = walking(p) ? p.driver : v.pose;
      v.name.position.set(actor.x, 7, actor.z);
      v.name.material.opacity = 0.55;
    }
    for (const [email, v] of this.remotes)
      if (!visible.has(email)) {
        this.base.scene.remove(v.root);
        dispose(v.root);
        this.remotes.delete(email);
      }
    const parkedNow = new Set<string>(),
      stack = new Map<number, number>();
    for (const p of [
      ...players.filter((p) => p.email !== me?.email),
      ...(me ? [me] : []),
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
        group.add(trailer, label(p.email, 8));
        this.base.scene.add(group);
        this.parked.set(p.email, group);
      }
      group.position.set(bay.x, 0, bay.z);
      group.rotation.y = 0;
      const index = stack.get(bay.id) ?? 0;
      stack.set(bay.id, index + 1);
      group.children[1].position.set(0, 6 + index * 1.5, -5);
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
    this.base.target.visible = guiding;
  }
}
