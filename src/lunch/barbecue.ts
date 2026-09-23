import * as THREE from "three";
import { nameTag } from "./name-tag";
import { DriverRig } from "../rig";

/** A lunch crew on the check-in forecourt, clear of the door and kiosk path. */
export class Barbecue {
  readonly root = new THREE.Group();
  private smoke: THREE.Sprite[] = [];
  private crew: {
    root: THREE.Group;
    rig: DriverRig;
    x: number;
    z: number;
    heading: number;
  }[] = [];
  private heat: THREE.MeshStandardMaterial;
  private time = 0;

  constructor() {
    this.root.name = "check-in-barbecue";
    this.root.position.set(-42.3, 0.3, 26);
    const mat = (color: string, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness });
    const black = mat("#263b3a", 0.45),
      steel = mat("#a6b5af", 0.7),
      wood = mat("#b77d48"),
      meat = mat("#713b28");
    const mesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      this.root.add(m);
      return m;
    };
    const box = (
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      material: THREE.Material,
    ) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
    // Open charcoal grill: enamel firebox, glowing coals, individual steel bars.
    box(0, 0.96, 0, 2, 0.42, 1.05, black);
    this.heat = new THREE.MeshStandardMaterial({
      color: "#652718",
      emissive: "#ff5b16",
      emissiveIntensity: 1.5,
      roughness: 1,
    });
    box(0, 1.16, 0, 1.82, 0.06, 0.86, this.heat);
    for (let i = 0; i < 18; i++) {
      const coal = mesh(
        new THREE.DodecahedronGeometry(0.12, 0),
        i % 3 ? black : this.heat,
        ((i % 6) - 2.5) * 0.29,
        1.17,
        (Math.floor(i / 6) - 1) * 0.27,
      );
      coal.scale.y = 0.6;
    }
    for (let i = 0; i < 13; i++)
      box(-0.9 + i * 0.15, 1.23, 0, 0.025, 0.035, 0.95, steel);
    for (const x of [-0.8, 0.8])
      for (const z of [-0.35, 0.35]) box(x, 0.4, z, 0.07, 0.8, 0.07, steel);
    box(0, 0.3, 0, 1.7, 0.045, 0.75, black);
    const lid = box(0, 1.7, -0.48, 2, 0.92, 0.09, black);
    lid.rotation.x = -0.2;
    box(0, 1.95, -0.3, 0.5, 0.055, 0.1, wood);
    box(1.38, 1.19, 0, 0.65, 0.07, 1, wood);
    // Six thick patties, each with dark sear stripes.
    for (const x of [-0.6, 0, 0.6])
      for (const z of [-0.25, 0.25]) {
        mesh(
          new THREE.CylinderGeometry(0.22, 0.24, 0.11, 14),
          meat,
          x,
          1.31,
          z,
        );
        for (const dx of [-0.09, 0, 0.09]) {
          const mark = box(x + dx, 1.369, z, 0.022, 0.007, 0.31, black);
          mark.rotation.y = 0.25;
        }
      }
    const tray = box(1.38, 1.25, 0.03, 0.53, 0.035, 0.75, steel);
    tray.name = "burger-bun-tray";
    const bun = mat("#eab66b");
    for (const z of [-0.18, 0.2]) {
      const top = mesh(
        new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        bun,
        1.38,
        1.28,
        z,
      );
      top.scale.y = 0.6;
    }
    // One shared soft texture, with pooled billboards: no per-frame allocations.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
    gradient.addColorStop(0, "rgba(235,240,228,0.6)");
    gradient.addColorStop(0.45, "rgba(224,231,220,0.32)");
    gradient.addColorStop(1, "rgba(224,231,220,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    for (let i = 0; i < 32; i++) {
      const puff = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      puff.name = "barbecue-smoke";
      this.root.add(puff);
      this.smoke.push(puff);
    }
  }

  bind(driver: THREE.Group) {
    for (const [i, [x, z, heading]] of [
      [0, 0.95, Math.PI],
      [-1.75, 0.6, 1.9],
      [2.25, 0.25, -1.5],
    ].entries()) {
      const root = new THREE.Group();
      root.name = `barbecue-worker-${i + 1}`;
      const model = driver.clone(true);
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      root.add(model);
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.castShadow = o.receiveShadow = true;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        const tinted = materials.map((m) => {
          const tint = m.clone() as THREE.MeshStandardMaterial;
          if (m.name === "Safety amber")
            tint.color.set(i === 1 ? "#cfec3a" : "#ff8b22");
          if (m.name === "Safety yellow")
            tint.color.set(i === 2 ? "#f4f1dd" : "#f4cf43");
          return tint;
        });
        o.material = Array.isArray(o.material) ? tinted : tinted[0];
      });
      const rig = new DriverRig(root);
      rig.bind();
      this.root.add(root);
      this.crew.push({ root, rig, x, z, heading });
      if (i === 0) {
        const tag = nameTag("Bart from the Yard");
        tag.position.set(0, 2.8, 0);
        root.add(tag);
        const arm = root.getObjectByName("arm-right");
        if (arm) {
          const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.045, 0.42, 0.045),
            new THREE.MeshStandardMaterial({ color: "#a16a3b" }),
          );
          handle.position.set(0, -0.66, 0);
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.24, 0.025),
            new THREE.MeshStandardMaterial({
              color: "#bbc9c5",
              metalness: 0.7,
              roughness: 0.35,
            }),
          );
          blade.position.set(0, -0.95, 0);
          arm.add(handle, blade);
        }
      }
    }
  }

  update(dt: number, reducedMotion: boolean) {
    if (!reducedMotion) this.time += Math.min(dt, 0.1);
    const t = this.time;
    this.heat.emissiveIntensity = reducedMotion
      ? 1.2
      : 1.3 + Math.sin(t * 4) * 0.2 + Math.sin(t * 7.3) * 0.12;
    this.smoke.forEach((puff, i) => {
      const age = (t * 0.19 + i / this.smoke.length) % 1;
      const swirl = i * 2.399 + age * 5;
      puff.position.set(
        Math.sin(i * 7.1) * 0.65 + age * 1.5 + Math.sin(swirl) * age * 0.45,
        1.4 + age * 3.7,
        Math.cos(i * 4.7) * 0.24 + age * 0.4 + Math.cos(swirl) * age * 0.4,
      );
      puff.scale.setScalar(0.35 + age * 2.2);
      puff.material.opacity = Math.sin(Math.PI * age) * 0.65;
      puff.material.rotation = i + age * 1.5;
    });
    this.crew.forEach(({ root, rig, x, z, heading }, i) => {
      rig.stand(x, z, heading, false, dt, reducedMotion);
      const arm = root.getObjectByName("arm-right");
      if (arm) {
        arm.rotation.x =
          i === 0
            ? -1.1 + Math.sin(t * 1.6) * 0.16
            : -0.3 + Math.sin(t * 1.1 + i) * 0.12;
        arm.rotation.z = i === 0 ? Math.sin(t * 0.8) * 0.12 : -0.1;
      }
    });
  }
}
