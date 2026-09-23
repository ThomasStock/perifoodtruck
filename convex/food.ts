import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
  canConfirm,
  inOrderArea,
  DISHES,
  pickupReady,
  RESPAWN_MS,
  spawn,
  validPose,
} from "../src/food/model";
const pose = v.object({
  x: v.number(),
  z: v.number(),
  heading: v.number(),
  trailerHeading: v.number(),
  speed: v.number(),
  steer: v.number(),
});
async function identity(ctx: QueryCtx | MutationCtx) {
  const id = await ctx.auth.getUserIdentity();
  if (!id?.email || id.emailVerified !== true)
    throw new Error("Sign in with a verified Google email.");
  const allowed = process.env.ALLOWED_EMAIL_DOMAIN?.toLowerCase();
  if (allowed && id.email.toLowerCase().split("@")[1] !== allowed)
    throw new Error("Please use your company Google account.");
  return { subject: id.tokenIdentifier, email: id.email.toLowerCase() };
}
async function player(ctx: QueryCtx | MutationCtx, session?: string) {
  const id = await identity(ctx);
  const p = await ctx.db
    .query("players")
    .withIndex("by_subject", (q) => q.eq("subject", id.subject))
    .unique();
  if (!p) throw new Error("Join the yard first.");
  if (session && p.session !== session)
    throw new Error(
      "This account joined in another tab. Sign in again here to continue.",
    );
  return p;
}
export const join = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const id = await identity(ctx);
    const existing = await ctx.db
      .query("players")
      .withIndex("by_subject", (q) => q.eq("subject", id.subject))
      .unique();
    if (existing)
      await ctx.db.patch(existing._id, {
        session,
        email: id.email,
        updatedAt: Date.now(),
        truck: { ...existing.truck, speed: 0 },
      });
    else
      await ctx.db.insert("players", {
        ...id,
        session,
        truck: spawn(),
        dish: null,
        basket: [],
        confirmed: null,
        updatedAt: Date.now(),
      });
    for (const { id: dish } of DISHES) {
      if (
        !(await ctx.db
          .query("bays")
          .withIndex("by_dish", (q) => q.eq("dish", dish))
          .unique())
      )
        await ctx.db.insert("bays", { dish, readyAt: 0 });
    }
  },
});
export const world = query({
  args: {},
  handler: async (ctx) => {
    const me = await player(ctx);
    const publicPlayer = ({
      email,
      truck,
      dish,
      basket,
      confirmed,
      updatedAt,
    }: typeof me) => ({ email, truck, dish, basket, confirmed, updatedAt });
    return {
      me: publicPlayer(me),
      players: (await ctx.db.query("players").collect()).map(publicPlayer),
      bays: (await ctx.db.query("bays").collect()).map(({ dish, readyAt }) => ({
        dish,
        readyAt,
      })),
      orders: (await ctx.db.query("orders").collect()).map(
        ({ email, dishes }) => ({ email, dishes }),
      ),
    };
  },
});
export const move = mutation({
  args: { session: v.string(), truck: pose },
  handler: async (ctx, { session, truck }) => {
    const p = await player(ctx, session);
    if (!validPose(truck)) throw new Error("Invalid truck position.");
    const elapsed = Math.min(
      30,
      Math.max(0, (Date.now() - p.updatedAt) / 1000),
    );
    if (Math.hypot(truck.x - p.truck.x, truck.z - p.truck.z) > 6 * elapsed + 2)
      throw new Error("Movement out of range. Rejoin the yard.");
    await ctx.db.patch(p._id, { truck, updatedAt: Date.now() });
  },
});
export const pickup = mutation({
  args: { session: v.string(), dish: v.number() },
  handler: async (ctx, { session, dish }) => {
    const p = await player(ctx, session);
    if (p.confirmed !== null || p.dish !== null || !pickupReady(p.truck, dish))
      throw new Error("Stop and line up your hitch at the pickup marker.");
    const bay = await ctx.db
      .query("bays")
      .withIndex("by_dish", (q) => q.eq("dish", dish))
      .unique();
    if (!bay || bay.readyAt > Date.now())
      throw new Error("A new trailer is rising. Please wait.");
    await ctx.db.patch(bay._id, { readyAt: Date.now() + RESPAWN_MS });
    await ctx.db.patch(p._id, {
      dish,
      truck: { ...p.truck, trailerHeading: Math.PI },
    });
  },
});
export const release = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    if (p.confirmed !== null || Math.abs(p.truck.speed) >= 0.35)
      throw new Error("Stop before returning your trailer.");
    await ctx.db.patch(p._id, { dish: null });
  },
});
export const dropoff = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    if (
      p.confirmed !== null ||
      p.dish === null ||
      !inOrderArea(p.truck) ||
      Math.abs(p.truck.speed) >= 0.35
    )
      throw new Error("Stop with the whole trailer inside the order area.");
    if (p.basket.length >= 20)
      throw new Error("Your basket is full. Confirm or remove a dish first.");
    await ctx.db.patch(p._id, { basket: [...p.basket, p.dish], dish: null });
  },
});
export const removeItem = mutation({
  args: { session: v.string(), index: v.number() },
  handler: async (ctx, { session, index }) => {
    const p = await player(ctx, session);
    if (p.confirmed !== null)
      throw new Error("Your order is already confirmed.");
    await ctx.db.patch(p._id, {
      basket: p.basket.filter((_, i) => i !== index),
    });
  },
});
export const confirm = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    // Transactional and idempotent: retries and repeated clicks never duplicate an order.
    if (p.confirmed !== null) return;
    if (!canConfirm(p))
      throw new Error("Deliver a trailer to your basket first.");
    await ctx.db.insert("orders", {
      subject: p.subject,
      email: p.email,
      dishes: p.basket,
      confirmedAt: Date.now(),
    });
    await ctx.db.patch(p._id, { confirmed: p.basket, basket: [], dish: null });
  },
});
export const recover = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    await ctx.db.patch(p._id, {
      truck: spawn(),
      dish: null,
      updatedAt: Date.now(),
    });
  },
});
