import * as THREE from "three";

/** A low-poly rooftop burger, built in the yard's own visual style. */
export function createBurgerSign() {
  const root = new THREE.Group();
  root.name = "lunch-burger-sign";
  root.position.set(-41, 0, 21);
  const material = (color: string) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      flatShading: true,
    });
  const burger = new THREE.Group();
  burger.name = "rotating-hamburger";
  // Roof top is 3.885m; the lower bun extends 0.325m below its centre.
  burger.position.y = 4.21;
  root.add(burger);
  const layer = (geometry: THREE.BufferGeometry, color: string, y: number) => {
    const mesh = new THREE.Mesh(geometry, material(color));
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    burger.add(mesh);
    return mesh;
  };
  layer(new THREE.CylinderGeometry(2.05, 1.85, 0.65, 24), "#dc9c45", 0);
  layer(new THREE.CylinderGeometry(2.08, 2.08, 0.48, 20), "#573426", 0.56);
  const cheese = layer(new THREE.BoxGeometry(3.3, 0.12, 3.3), "#ffca3d", 0.88);
  cheese.rotation.y = 0.3;
  layer(new THREE.CylinderGeometry(2.03, 2.03, 0.22, 24), "#ca4e35", 1.07);
  // Wavy lettuce edge breaks up the circular silhouette.
  const lettuce = new THREE.CylinderGeometry(2.22, 2.18, 0.2, 24);
  const positions = lettuce.attributes.position;
  for (let i = 0; i < positions.count; i++)
    positions.setY(
      i,
      positions.getY(i) +
        Math.sin(Math.atan2(positions.getZ(i), positions.getX(i)) * 9) * 0.14,
    );
  lettuce.computeVertexNormals();
  layer(lettuce, "#79a944", 1.3);
  const top = layer(
    new THREE.SphereGeometry(2.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    "#edb85d",
    1.42,
  );
  top.scale.y = 0.53;
  const seedMaterial = material("#fff0c3");
  const seedGeometry = new THREE.SphereGeometry(0.095, 6, 4);
  for (let i = 0; i < 30; i++) {
    const a = i * 2.39996,
      r = 1.8 * Math.sqrt((i + 0.5) / 30);
    const seed = new THREE.Mesh(seedGeometry, seedMaterial);
    seed.position.set(
      Math.cos(a) * r,
      1.44 + Math.sqrt(2.1 ** 2 - r ** 2) * 0.53,
      Math.sin(a) * r,
    );
    seed.scale.set(0.55, 0.45, 1.6);
    seed.rotation.y = a;
    burger.add(seed);
  }
  return { root, burger };
}
