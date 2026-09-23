import { objective, walking, type Player, type Point } from "./model";

export function guideRoute(player: Player): Point[] {
  const points = [walking(player) ? player.driver : player.truck];
  if (!walking(player)) {
    if (player.phase === "pickup" && player.truck.z > 12)
      points.push({ x: 18, z: 25 }, { x: 18, z: 0 });
    if (player.phase === "exit" && player.truck.z < 16)
      points.push({ x: 18, z: 0 }, { x: 18, z: 28 });
  }
  if (player.phase === "walk-kiosk" && player.driver.z > 31)
    points.push({ x: -28, z: 29.5 });
  points.push(objective(player).target);
  return points;
}
