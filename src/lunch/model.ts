import {
  angle,
  corners,
  distance,
  idleInput,
  integrate,
  offset,
  overlap,
  rigRects,
  type Input,
  type Point,
  type Rect,
  type Truck,
} from "../game/simulation";
import type { OrderLine } from "./menu";
export type { Truck, Point, Input } from "../game/simulation";
export const KIOSK = { x: -33.7, z: 28.2 };
export const PARK = { x: -24, z: 43.5, w: 6, d: 23 };
export const EXIT = { x: 54, z: 34, halfWidth: 12 };
export const PARKINGS = [-27, -9, 9].map((x, index) => ({
  id: index,
  x,
  z: -27,
  heading: 0,
}));
export const normalizeParking = (id: number | null) =>
  id === null
    ? null
    : ((id % PARKINGS.length) + PARKINGS.length) % PARKINGS.length;
export type Phase =
  | "arrive"
  | "walk-kiosk"
  | "kiosk"
  | "walk-truck"
  | "pickup"
  | "exit"
  | "complete";
export type Player = {
  email: string;
  truck: Truck;
  driver: Point;
  phase: Phase;
  parking: number | null;
  lines: OrderLine[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  updatedAt: number;
};
export type Order = {
  email: string;
  lines: OrderLine[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  placedAt: number;
};
export type Snapshot = { me: Player; players: Player[]; orders: Order[] };
export const spawn = (): Truck => ({
  x: -24,
  z: 62,
  heading: Math.PI,
  trailerHeading: Math.PI,
  speed: 0,
  steer: 0,
});
export const newPlayer = (email: string): Player => ({
  email,
  truck: spawn(),
  driver: { x: -27, z: 43 },
  phase: "arrive",
  parking: null,
  lines: [],
  subtotalCents: 0,
  feeCents: 0,
  totalCents: 0,
  updatedAt: Date.now(),
});
export const walking = (p: Player) =>
  ["walk-kiosk", "kiosk", "walk-truck"].includes(p.phase);
export const attached = (p: Player) => p.phase === "exit";
export function parked(p: Player) {
  return (
    Math.abs(p.truck.speed) < 0.35 &&
    corners(rigRects(p.truck)[0]).every(
      (c) =>
        Math.abs(c.x - PARK.x) <= PARK.w / 2 &&
        Math.abs(c.z - PARK.z) <= PARK.d / 2,
    )
  );
}
export function pickupBody(p: Player): Rect | null {
  const bay = PARKINGS.find((b) => b.id === p.parking);
  return p.phase === "pickup" && bay
    ? { x: bay.x, z: bay.z - 6.7, w: 2.55, d: 9, h: 0 }
    : null;
}
export function pickupReady(p: Player) {
  const bay = PARKINGS.find((b) => b.id === p.parking);
  return (
    p.phase === "pickup" &&
    !!bay &&
    distance(p.truck, bay) < 3.6 &&
    Math.abs(angle(p.truck.heading)) < 1.1 &&
    p.truck.speed < -0.05 &&
    p.truck.speed > -1.2 &&
    !overlap(rigRects(p.truck)[0], pickupBody(p)!)
  );
}
export function exited(p: Player) {
  return (
    p.phase === "exit" &&
    corners(rigRects(p.truck)[1]).every(
      (c) => c.x > EXIT.x && Math.abs(c.z - EXIT.z) < EXIT.halfWidth,
    ) &&
    Math.abs(angle(p.truck.heading - Math.PI / 2)) < 0.5
  );
}
export function chooseParking(occupied: number[], random: number) {
  const free = PARKINGS.filter((b) => !occupied.includes(b.id));
  const pool = free.length ? free : PARKINGS;
  return pool[
    Math.min(pool.length - 1, Math.floor(Math.max(0, random) * pool.length))
  ].id;
}
const rect = (x: number, z: number, w: number, d: number): Rect => ({
  x,
  z,
  w,
  d,
  h: 0,
});
export const OBSTACLES: Rect[] = [
  rect(-53, 14, 2, 132),
  rect(53, -11, 2, 66),
  rect(53, 64, 2, 36),
  rect(0, -54.6, 106, 20),
  rect(0, 81, 106, 2),
  rect(-20.2, 12, 64, 0.4),
  rect(38, 12, 28, 0.4),
  rect(-41, 21, 9, 5),
  rect(-33.7, 26, 1.1, 0.8),
];
export function drive(p: Player, input: Input, dt: number) {
  if (p.phase === "kiosk") return;
  if (walking(p)) {
    const len = Math.max(1, Math.hypot(input.walkX, input.walkZ));
    const next = {
      x: p.driver.x + (input.walkX / len) * 3 * dt,
      z: p.driver.z + (input.walkZ / len) * 3 * dt,
    };
    if (
      Math.abs(next.x) < 51 &&
      next.z > -43 &&
      next.z < 78 &&
      ![...OBSTACLES, rigRects(p.truck)[0]].some((o) =>
        overlap(rect(next.x, next.z, 0.55, 0.55), o),
      )
    )
      p.driver = next;
    return;
  }
  const before = { ...p.truck };
  integrate(p.truck, input, attached(p), dt);
  if (!attached(p)) p.truck.trailerHeading = p.truck.heading;
  const body = pickupBody(p);
  const shapes = rigRects(p.truck).slice(0, attached(p) ? 2 : 1);
  const outside = shapes
    .flatMap(corners)
    .some(
      (c) =>
        c.x < -52 ||
        c.x > 86 ||
        c.z < -44 ||
        c.z > 80 ||
        (c.x > 52 && Math.abs(c.z - EXIT.z) > EXIT.halfWidth),
    );
  const path = rect(-32.5, 39, 2.6, 39);
  if (
    outside ||
    (!!body && overlap(shapes[0], body)) ||
    shapes.some((s) => [...OBSTACLES, path].some((o) => overlap(s, o))) ||
    (attached(p) &&
      Math.abs(angle(p.truck.heading - p.truck.trailerHeading)) > 1.12 &&
      p.truck.speed < 0)
  )
    Object.assign(p.truck, before, { speed: 0 });
}
export function validPose(t: Truck, p: Point) {
  return (
    [...Object.values(t), p.x, p.z].every(Number.isFinite) &&
    t.x >= -52 &&
    t.x <= 86 &&
    t.z >= -44 &&
    t.z <= 80 &&
    Math.abs(t.heading) <= Math.PI + 0.001 &&
    Math.abs(t.trailerHeading) <= Math.PI + 0.001 &&
    Math.abs(t.speed) <= 5.6 &&
    Math.abs(t.steer) <= 0.58 &&
    Math.abs(p.x) <= 51 &&
    p.z >= -43 &&
    p.z <= 78
  );
}
export function interaction(p: Player): string {
  if (p.phase === "arrive" && parked(p)) return "Get out · go to the kiosk";
  if (p.phase === "walk-kiosk" && distance(p.driver, KIOSK) < 2.4)
    return "Open lunch menu";
  if (p.phase === "walk-truck" && distance(p.driver, p.truck) < 5.3)
    return "Get in · collect your trailer";
  if (pickupReady(p)) return "Attach your lunch trailer";
  return "";
}
export function interact(p: Player) {
  if (!interaction(p)) throw new Error("Go to the marker and stop.");
  p.truck.speed = 0;
  if (p.phase === "arrive") {
    p.phase = "walk-kiosk";
    p.driver = offset(p.truck, p.truck.heading + Math.PI / 2, 3);
  } else if (p.phase === "walk-kiosk") p.phase = "kiosk";
  else if (p.phase === "walk-truck") p.phase = "pickup";
  else if (p.phase === "pickup") {
    p.phase = "exit";
    p.truck.trailerHeading = 0;
  }
}
export function recover(p: Player) {
  p.truck = spawn();
  p.driver = { x: -27, z: 43 };
  if (p.phase !== "complete") p.phase = p.lines.length ? "pickup" : "arrive";
}
export function objective(p: Player): {
  title: string;
  detail: string;
  target: Point;
  step: number;
} {
  switch (p.phase) {
    case "arrive":
      return {
        title: "Park beside the kiosk",
        detail: "Drive your truck to P02. Stop between the lines and get out.",
        target: PARK,
        step: 1,
      };
    case "walk-kiosk":
    case "kiosk":
      return {
        title: "What's for lunch?",
        detail:
          "Walk to the kiosk and choose your lunch. A €1 fee applies per order.",
        target: KIOSK,
        step: 2,
      };
    case "walk-truck":
      return {
        title: "Your lunch trailer is ready",
        detail: `Walk back to your truck, then collect your trailer at P0${(p.parking ?? 0) + 1}. Your order has not been placed yet.`,
        target: p.truck,
        step: 3,
      };
    case "pickup":
      return {
        title: `Collect your trailer · P0${(p.parking ?? 0) + 1}`,
        detail:
          "Find your trailer and back gently towards its front. Press E while reversing slowly. A slight angle is fine.",
        target: PARKINGS[p.parking ?? 0],
        step: 3,
      };
    case "exit":
      return {
        title: "Drive to the exit",
        detail:
          "Drive into the marked exit area through the right-hand fence. Bring your entire trailer inside to place your order.",
        target: { x: 68, z: EXIT.z },
        step: 4,
      };
    case "complete":
      return {
        title: "Your order is placed!",
        detail:
          "Thanks! Your lunch is on the order list. You can keep driving as a ghost.",
        target: { x: 68, z: EXIT.z },
        step: 4,
      };
  }
}
export { idleInput };
