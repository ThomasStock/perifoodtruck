import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const lunchLine = v.object({
  productId: v.string(),
  quantity: v.number(),
  name: v.string(),
  unitCents: v.number(),
  freeQuantity: v.optional(v.number()),
});
const truckPose = v.object({
  x: v.number(),
  z: v.number(),
  heading: v.number(),
  trailerHeading: v.number(),
  speed: v.number(),
  steer: v.number(),
});
export default defineSchema({
  lunchPlayers: defineTable({
    subject: v.string(),
    email: v.string(),
    session: v.string(),
    truck: truckPose,
    driver: v.object({ x: v.number(), z: v.number() }),
    phase: v.union(
      v.literal("arrive"),
      v.literal("walk-kiosk"),
      v.literal("kiosk"),
      v.literal("walk-truck"),
      v.literal("pickup"),
      v.literal("exit"),
      v.literal("complete"),
    ),
    parking: v.union(v.number(), v.null()),
    lines: v.array(lunchLine),
    subtotalCents: v.number(),
    feeCents: v.number(),
    totalCents: v.number(),
    updatedAt: v.number(),
  }).index("by_subject", ["subject"]),
  lunchOrders: defineTable({
    subject: v.string(),
    email: v.string(),
    lines: v.array(lunchLine),
    subtotalCents: v.number(),
    feeCents: v.number(),
    totalCents: v.number(),
    placedAt: v.number(),
  }).index("by_subject", ["subject"]),
  players: defineTable({
    subject: v.string(),
    email: v.string(),
    session: v.string(),
    truck: v.object({
      x: v.number(),
      z: v.number(),
      heading: v.number(),
      trailerHeading: v.number(),
      speed: v.number(),
      steer: v.number(),
    }),
    dish: v.union(v.number(), v.null()),
    basket: v.array(v.number()),
    confirmed: v.union(v.array(v.number()), v.null()),
    updatedAt: v.number(),
  }).index("by_subject", ["subject"]),
  bays: defineTable({ dish: v.number(), readyAt: v.number() }).index(
    "by_dish",
    ["dish"],
  ),
  orders: defineTable({
    subject: v.string(),
    email: v.string(),
    dishes: v.array(v.number()),
    confirmedAt: v.number(),
  }).index("by_subject", ["subject"]),
  results: defineTable({
    runId: v.string(),
    name: v.string(),
    seconds: v.number(),
    splits: v.array(v.number()),
    contacts: v.number(),
    recoveries: v.number(),
    assisted: v.boolean(),
    date: v.string(),
  })
    .index("by_seconds", ["seconds", "date"])
    .index("by_runId", ["runId"]),
});
