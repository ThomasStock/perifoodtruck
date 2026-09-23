import { OBSTACLES, walking, type Player, type Point } from "./model";
export type Burger = Point & { id: string; from: Point; thrownAt: number };
export const canThrow = (p: Player) => walking(p) && p.phase !== "kiosk";
export function burgerLanding(from: Point, target: Point): Point {
  if (![target.x, target.z].every(Number.isFinite))
    throw new Error("Aim inside the yard.");
  const dx = target.x - from.x,
    dz = target.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.2) throw new Error("Aim a little farther away.");
  const range = Math.min(9, length);
  let last = { ...from };
  for (let step = 0.25; step <= range; step += 0.25) {
    const next = {
      x: from.x + (dx / length) * step,
      z: from.z + (dz / length) * step,
    };
    if (
      Math.abs(next.x) > 50 ||
      next.z < -42 ||
      next.z > 77 ||
      OBSTACLES.some(
        (o) =>
          Math.abs(next.x - o.x) < o.w / 2 + 0.35 &&
          Math.abs(next.z - o.z) < o.d / 2 + 0.35,
      )
    )
      break;
    last = next;
  }
  return last;
}
export function closestBurger(p: Point, burgers: Burger[], now = Date.now()) {
  return burgers
    .filter(
      (b) => now - b.thrownAt >= 700 && Math.hypot(b.x - p.x, b.z - p.z) <= 3,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z) ||
        a.id.localeCompare(b.id),
    )[0];
}
