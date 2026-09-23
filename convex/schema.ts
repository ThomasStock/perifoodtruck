import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
