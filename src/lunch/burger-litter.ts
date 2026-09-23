import * as THREE from "three";
import type { Burger } from "./burgers";

export class BurgerLitter {
  root = new THREE.Group();
  private layers: { mesh: THREE.InstancedMesh; y: number }[] = [];
  private pose = new THREE.Object3D();
  constructor() {
    for (const [radius, height, y, color] of [
      [0.32, 0.12, 0.06, 0xdfa450],
      [0.34, 0.1, 0.17, 0x64402c],
      [0.37, 0.045, 0.245, 0x7eac4a],
      [0.34, 0.045, 0.28, 0xffc746],
      [0.34, 0.22, 0.3, 0xeab66b],
    ]) {
      const isTopBun = color === 0xeab66b;
      const geometry = isTopBun
        ? new THREE.SphereGeometry(
            radius,
            24,
            12,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
          )
        : new THREE.CylinderGeometry(radius, radius * 0.94, height, 24);
      if (isTopBun) geometry.scale(1, height / radius, 1);
      const mesh = new THREE.InstancedMesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.9,
          flatShading: false,
        }),
        100,
      );
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(mesh);
      this.layers.push({ mesh, y });
    }
  }
  update(burgers: Burger[]) {
    const now = Date.now();
    const items = burgers.slice(0, 100);
    for (const { mesh, y } of this.layers) {
      mesh.count = items.length;
      items.forEach((b, i) => {
        const t = THREE.MathUtils.clamp((now - b.thrownAt) / 700, 0, 1);
        this.pose.position.set(
          THREE.MathUtils.lerp(b.from.x, b.x, t),
          y + (1 - t) * 1.2 + Math.sin(t * Math.PI) * 2.4,
          THREE.MathUtils.lerp(b.from.z, b.z, t),
        );
        this.pose.rotation.set(0, t * Math.PI * 3 + (b.thrownAt % 7), 0);
        this.pose.updateMatrix();
        mesh.setMatrixAt(i, this.pose.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
