import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { blendTruck } from "../game/simulation";
import { RigWheels } from "../wheels";
import {
  DISHES,
  ORDER_AREA,
  RESPAWN_MS,
  type Bay,
  type Player,
  type Truck,
} from "./model";
const material = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
type Vehicle = {
  cab: THREE.Group;
  trailer: THREE.Group;
  label: THREE.Sprite;
  wheels: RigWheels;
  ghost: boolean;
  pose: Truck;
};
export class FoodScene {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 650);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  mode: "follow" | "yard" | "overhead" = "yard";
  private cab!: THREE.Group;
  private trailer!: THREE.Group;
  private vehicles = new Map<string, Vehicle>();
  private bays: {
    trailer: THREE.Group;
    left: THREE.Mesh;
    right: THREE.Mesh;
  }[] = [];
  private focus = new THREE.Vector3(0, 0, 0);
  private zoom = 1;
  private area: THREE.Mesh;
  constructor(private container: HTMLElement) {
    this.scene.background = new THREE.Color("#c9d9cb");
    this.scene.fog = new THREE.Fog("#c9d9cb", 260, 530);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor("#c9d9cb");
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight("#fff7e7", "#70816e", 2.8));
    const sun = new THREE.DirectionalLight("#fff5df", 3.2);
    sun.position.set(-60, 100, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -120,
      right: 120,
      top: 120,
      bottom: -120,
      far: 280,
    });
    sun.shadow.normalBias = 0.08;
    this.scene.add(sun);
    this.box(0, -0.5, 0, 600, 0.6, 600, "#8caa81");
    this.box(0, -0.12, 0, 170, 0.25, 162, "#8b9691");
    // Perimeter curbs and warm pedestrian paths.
    for (const x of [-85, 85]) this.box(x, 0.15, 0, 2, 0.4, 164, "#e5dac4");
    for (const z of [-81, 81]) this.box(0, 0.15, z, 172, 0.4, 2, "#e5dac4");
    for (let z = -20; z <= 60; z += 10) {
      this.box(-62, 0.025, z, 0.22, 0.04, 4, "#e9e3cd");
      this.box(62, 0.025, z, 0.22, 0.04, 4, "#e9e3cd");
    }
    for (const d of DISHES) {
      this.outline(d.x, -36, 12, 23, d.color);
      this.box(d.x, -0.005, -36, 10, 0.08, 21, "#424e4b");
      this.label(d.name.toUpperCase(), d.x, 0.12, -66, d.color, 12, true);
      this.label(`0${d.id}`, d.x, 6, -62, d.color, 5);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 1.55, 40),
        new THREE.MeshBasicMaterial({ color: d.color, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(d.x, 0.08, d.z);
      this.scene.add(ring);
      this.label("HITCH", d.x, 0.1, -48, "#f8eddb", 4, true);
    }
    this.area = this.box(
      ORDER_AREA.x,
      0.012,
      ORDER_AREA.z,
      ORDER_AREA.w,
      0.025,
      ORDER_AREA.d,
      "#738b78",
    );
    this.outline(
      ORDER_AREA.x,
      ORDER_AREA.z,
      ORDER_AREA.w,
      ORDER_AREA.d,
      "#f5e9be",
      0.32,
    );
    this.label("ORDER AREA", 0, 0.09, 56, "#fff1be", 17, true);
    this.label("DROP YOUR TRAILER HERE", 0, 0.1, 33, "#fff1be", 15, true);
    for (const x of [-18, 18])
      for (const z of [30, 58]) {
        this.box(x, 0.55, z, 0.5, 1.1, 0.5, "#f6c768");
      }
    // Café frontage and a sculpture garden give spectators somewhere to explore.
    this.box(0, 4, -91, 125, 8, 13, "#ede3cc");
    this.box(0, 8.2, -91, 129, 0.7, 16, "#345b50");
    this.label("THE LUNCH YARD", 0, 8, -83, "#224f42", 35);
    for (const x of [-44, -22, 0, 22, 44])
      this.box(x, 3, -84.3, 12, 4.4, 0.2, "#567a6d");
    this.box(0, 0.03, 4, 33, 0.16, 21, "#c9bea3");
    this.box(0, 0.15, 4, 25, 0.4, 14, "#78906d");
    const sculpture = new THREE.Mesh(
      new THREE.TorusKnotGeometry(2.8, 0.75, 72, 10),
      material("#eeaf63"),
    );
    sculpture.position.set(0, 4, 4);
    sculpture.castShadow = true;
    this.scene.add(sculpture);
    this.label("TAKE A LUNCH BREAK", 0, 0.4, 12, "#ffefcb", 18, true);
    for (const x of [-73, 73])
      for (const z of [-63, -30, 5, 40, 69]) this.tree(x, z);
    for (const x of [-20, 20]) {
      this.tree(x, 4);
      this.box(x * 0.67, 0.7, 12, 4, 0.4, 1.1, "#c39363");
      this.box(x * 0.67, 1.4, 12.5, 4, 1, 0.2, "#c39363");
    }
    container.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom = THREE.MathUtils.clamp(
          this.zoom + e.deltaY * 0.001,
          0.7,
          1.8,
        );
      },
      { passive: false },
    );
    const resize = () => {
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(container);
    resize();
    this.camera.position.set(125, 145, 165);
    this.camera.lookAt(0, 0, 0);
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = h > 0.3;
    this.scene.add(mesh);
    return mesh;
  }
  outline(
    x: number,
    z: number,
    w: number,
    d: number,
    color: string,
    thickness = 0.17,
  ) {
    for (const side of [-1, 1]) {
      this.box(x + (side * w) / 2, 0.05, z, thickness, 0.035, d, color);
      this.box(x, 0.05, z + (side * d) / 2, w, 0.035, thickness, color);
    }
  }
  tree(x: number, z: number) {
    this.box(x, 1.7, z, 0.65, 3.4, 0.65, "#856a4b");
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.5, 1),
      material("#507453"),
    );
    crown.position.set(x, 5, z);
    crown.castShadow = true;
    this.scene.add(crown);
  }
  label(
    text: string,
    x: number,
    y: number,
    z: number,
    color: string,
    width: number,
    ground = false,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "600 58px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 512, 64, 1000);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (ground) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, width / 8),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      return mesh;
    }
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: false }),
    );
    sprite.scale.set(width, width / 8, 1);
    sprite.position.set(x, y, z);
    this.scene.add(sprite);
    return sprite;
  }
  async load() {
    const loader = new GLTFLoader();
    const [cab, trailer] = await Promise.all([
      loader.loadAsync("/models/tractor.glb"),
      loader.loadAsync("/models/trailer.glb"),
    ]);
    this.cab = cab.scene;
    this.trailer = trailer.scene;
    for (const d of DISHES) {
      const t = this.clone(this.trailer);
      this.tintTrailer(t, d.id);
      t.position.set(d.x, 0, d.z);
      t.rotation.y = Math.PI;
      this.scene.add(t);
      this.bays.push({
        trailer: t,
        left: this.box(d.x - 2.8, 0.03, -36, 5.5, 0.1, 21, "#737f77"),
        right: this.box(d.x + 2.8, 0.03, -36, 5.5, 0.1, 21, "#737f77"),
      });
    }
  }
  private clone(source: THREE.Group) {
    const clone = source.clone(true);
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return clone;
  }
  private tintTrailer(t: THREE.Group, dish: number) {
    t.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (
            m instanceof THREE.MeshStandardMaterial &&
            /white|body|panel|teal|cladding|porcelain/i.test(m.name)
          )
            m.color.set(DISHES[dish - 1].color);
      }
    });
  }
  private vehicle(p: Player) {
    let v = this.vehicles.get(p.email);
    if (!v) {
      const cab = this.clone(this.cab),
        trailer = this.clone(this.trailer);
      this.scene.add(cab, trailer);
      const label = this.label(p.email, 0, 7, 0, "#153e34", 17) as THREE.Sprite;
      const wheels = new RigWheels();
      wheels.bind(cab, trailer);
      v = { cab, trailer, label, wheels, ghost: false, pose: { ...p.truck } };
      this.vehicles.set(p.email, v);
    }
    return v;
  }
  render(
    me: Player | null,
    others: Player[],
    bays: Bay[],
    dt: number,
    inBasket: boolean,
  ) {
    const visible = new Set<string>();
    if (this.cab)
      for (const p of [
        ...others.filter(
          (p) => p.email !== me?.email && Date.now() - p.updatedAt < 15000,
        ),
        ...(me ? [me] : []),
      ]) {
        visible.add(p.email);
        const v = this.vehicle(p);
        v.pose =
          p === me
            ? { ...p.truck }
            : blendTruck(v.pose, p.truck, 1 - Math.exp(-dt * 12));
        const t = v.pose;
        v.cab.position.set(t.x, 0, t.z);
        v.cab.rotation.y = t.heading;
        for (const name of ["steering-left", "steering-right"]) {
          const wheel = v.cab.getObjectByName(name);
          if (wheel) wheel.rotation.y = t.steer;
        }
        v.trailer.position.copy(v.cab.position);
        v.trailer.rotation.y = t.trailerHeading;
        v.trailer.visible = p.dish !== null;
        if (p.dish !== null) this.tintTrailer(v.trailer, p.dish);
        v.label.position.set(t.x, 7, t.z);
        v.wheels.update(t);
        const ghost = p.confirmed !== null;
        if (v.ghost !== ghost) {
          v.ghost = ghost;
          v.cab.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = !ghost;
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material]) {
                m.transparent = ghost;
                m.opacity = ghost ? 0.38 : 1;
                m.depthWrite = !ghost;
                m.needsUpdate = true;
              }
            }
          });
          v.label.material.opacity = ghost ? 0.6 : 1;
        }
      }
    for (const [email, v] of this.vehicles)
      if (!visible.has(email)) {
        this.scene.remove(v.cab, v.trailer, v.label);
        // Geometry is shared with the templates. Dispose only per-player materials.
        for (const group of [v.cab, v.trailer])
          group.traverse((o) => {
            if (o instanceof THREE.Mesh)
              for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material])
                m.dispose();
          });
        v.label.material.map?.dispose();
        v.label.material.dispose();
        this.vehicles.delete(email);
      }
    this.bays.forEach((b, i) => {
      const remaining = Math.max(
        0,
        (bays.find((b) => b.dish === i + 1)?.readyAt ?? 0) - Date.now(),
      );
      const progress = 1 - remaining / RESPAWN_MS;
      const opening =
        remaining > 0 ? Math.min(1, progress * 5, (1 - progress) * 6) : 0;
      b.left.position.x = DISHES[i].x - 2.8 - opening * 5.4;
      b.right.position.x = DISHES[i].x + 2.8 + opening * 5.4;
      b.trailer.position.y =
        remaining > 0
          ? -5.5 * (1 - Math.max(0, Math.min(1, (progress - 0.23) / 0.6)))
          : 0;
      b.trailer.visible = remaining === 0 || progress > 0.23;
    });
    (this.area.material as THREE.MeshStandardMaterial).color.set(
      inBasket ? "#a7bd77" : "#738b78",
    );
    const target = new THREE.Vector3(me?.truck.x ?? 0, 0, me?.truck.z ?? 0);
    const overview = this.mode === "yard" || !me;
    if (overview) target.set(0, 0, -3);
    this.focus.lerp(target, 1 - Math.exp(-dt * 4));
    const offset = overview
      ? new THREE.Vector3(114, 144, 160)
      : this.mode === "overhead"
        ? new THREE.Vector3(0, 80, 0.01)
        : new THREE.Vector3(31, 43, 42);
    offset.multiplyScalar(this.zoom * (this.camera.aspect < 0.85 ? 1.4 : 1));
    this.camera.position.lerp(
      this.focus.clone().add(offset),
      1 - Math.exp(-dt * 4),
    );
    this.camera.lookAt(this.focus);
    this.renderer.render(this.scene, this.camera);
  }
}
