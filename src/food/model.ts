import {
  angle,
  corners,
  distance,
  idleInput,
  integrate,
  rigRects,
  type Input,
  type Truck,
} from "../game/simulation";
export type { Truck } from "../game/simulation";
export const DISHES = [1, 2, 3, 4, 5].map((id) => ({
  id,
  name: `Dish ${id}`,
  color: ["#ffb85b", "#ed798b", "#a3bd74", "#8ea9e8", "#bb93db"][id - 1],
  x: (id - 3) * 22,
  z: -42,
}));
export const ORDER_AREA = { x: 0, z: 44, w: 30, d: 25 };
export const BOUNDS = { x: 83, z: 79 };
export const RESPAWN_MS = 5500;
export type Player = {
  email: string;
  truck: Truck;
  dish: number | null;
  basket: number[];
  confirmed: number[] | null;
  updatedAt: number;
};
export type Bay = { dish: number; readyAt: number };
export type Order = { email: string; dishes: number[] };
export type Snapshot = {
  me: Player;
  players: Player[];
  bays: Bay[];
  orders: Order[];
};
export const spawn = (): Truck => ({
  x: -36,
  z: 40,
  heading: Math.PI,
  trailerHeading: Math.PI,
  speed: 0,
  steer: 0,
});
export function pickupReady(truck: Truck, dish: number) {
  const bay = DISHES.find((d) => d.id === dish);
  return (
    !!bay &&
    distance(truck, bay) < 2.8 &&
    Math.abs(angle(truck.heading - Math.PI)) < 0.35 &&
    Math.abs(truck.speed) < 0.35
  );
}
export function inOrderArea(truck: Truck) {
  return corners(rigRects(truck)[1]).every(
    (p) =>
      Math.abs(p.x - ORDER_AREA.x) <= ORDER_AREA.w / 2 &&
      Math.abs(p.z - ORDER_AREA.z) <= ORDER_AREA.d / 2,
  );
}
export function canConfirm(player: Player) {
  return player.confirmed === null && player.basket.length > 0;
}
export function drive(
  truck: Truck,
  input: Input,
  attached: boolean,
  dt: number,
) {
  const before = { ...truck };
  integrate(truck, input, attached, dt);
  if (!attached) truck.trailerHeading = truck.heading;
  const shapes = rigRects(truck).slice(0, attached ? 2 : 1);
  if (
    shapes
      .flatMap(corners)
      .some((p) => Math.abs(p.x) > BOUNDS.x || Math.abs(p.z) > BOUNDS.z)
  )
    Object.assign(truck, before, { speed: 0 });
}
export function validPose(t: Truck) {
  return (
    Object.values(t).every(Number.isFinite) &&
    Math.abs(t.x) <= BOUNDS.x &&
    Math.abs(t.z) <= BOUNDS.z &&
    Math.abs(t.speed) <= 5.6 &&
    Math.abs(t.steer) <= 0.58 &&
    Math.abs(t.heading) <= Math.PI + 0.001 &&
    Math.abs(t.trailerHeading) <= Math.PI + 0.001
  );
}
export { idleInput };
