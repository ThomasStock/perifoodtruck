import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
  chooseParking,
  normalizeParking,
  exited,
  interact as applyInteraction,
  KIOSK,
  newPlayer,
  recover as applyRecovery,
  validPose,
  walking,
  toggleCab,
  type Player,
} from "../src/lunch/model";
import { priceCart } from "../src/lunch/menu";
import { burgerLanding, canThrow, closestBurger } from "../src/lunch/burgers";
import { distance } from "../src/game/simulation";
export const pose = v.object({
  x: v.number(),
  z: v.number(),
  heading: v.number(),
  trailerHeading: v.number(),
  speed: v.number(),
  steer: v.number(),
});
const point = v.object({ x: v.number(), z: v.number() });
async function identity(ctx: QueryCtx | MutationCtx) {
  const id = await ctx.auth.getUserIdentity();
  if (!id?.email || id.emailVerified !== true)
    throw new Error("Sign in with a verified Google account.");
  if (
    process.env.ALLOWED_EMAIL_DOMAIN &&
    id.email.toLowerCase().split("@")[1] !==
      process.env.ALLOWED_EMAIL_DOMAIN.toLowerCase()
  )
    throw new Error("Use your company account.");
  return { subject: id.tokenIdentifier, email: id.email.toLowerCase() };
}
async function player(ctx: QueryCtx | MutationCtx, session?: string) {
  const id = await identity(ctx);
  const p = await ctx.db
    .query("lunchPlayers")
    .withIndex("by_subject", (q) => q.eq("subject", id.subject))
    .unique();
  if (!p) throw new Error("Please sign in first.");
  if (session && p.session !== session)
    throw new Error("Your truck is active in another tab. Sign in here again.");
  return { ...p, parking: normalizeParking(p.parking) };
}
const publicPlayer = (p: Player): Player => ({
  email: p.email,
  truck: p.truck,
  driver: p.driver,
  phase: p.phase,
  onFoot: p.onFoot ?? false,
  parking: normalizeParking(p.parking),
  lines: p.lines,
  subtotalCents: p.subtotalCents,
  feeCents: p.feeCents,
  totalCents: p.totalCents,
  updatedAt: p.updatedAt,
});
export const join = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const id = await identity(ctx);
    const p = await ctx.db
      .query("lunchPlayers")
      .withIndex("by_subject", (q) => q.eq("subject", id.subject))
      .unique();
    if (p)
      await ctx.db.patch(p._id, {
        session,
        email: id.email,
        updatedAt: Date.now(),
        truck: { ...p.truck, speed: 0 },
      });
    else
      await ctx.db.insert("lunchPlayers", {
        ...newPlayer(id.email),
        subject: id.subject,
        session,
      });
  },
});
export const world = query({
  args: {},
  handler: async (ctx) => {
    const me = await player(ctx);
    return {
      me: publicPlayer(me),
      burgers: (await ctx.db.query("lunchBurgers").collect()).map(
        ({ _id, x, z, from, thrownAt }) => ({ id: _id, x, z, from, thrownAt }),
      ),
      players: (await ctx.db.query("lunchPlayers").collect()).map((p) => ({
        ...publicPlayer(p),
        lines: [],
        subtotalCents: 0,
        feeCents: 0,
        totalCents: 0,
      })),
      orders: (await ctx.db.query("lunchOrders").collect()).map(
        ({ email, lines, subtotalCents, feeCents, totalCents, placedAt }) => ({
          email,
          lines,
          subtotalCents,
          feeCents,
          totalCents,
          placedAt,
        }),
      ),
    };
  },
});
export const move = mutation({
  args: { session: v.string(), truck: pose, driver: point },
  handler: async (ctx, { session, truck, driver }) => {
    const p = await player(ctx, session);
    if (!validPose(truck, driver)) throw new Error("Invalid position.");
    const elapsed = Math.min(
      30,
      Math.max(0, (Date.now() - p.updatedAt) / 1000),
    );
    if (
      distance(truck, p.truck) > (walking(p) ? 0.01 : 17 * elapsed + 2) ||
      distance(driver, p.driver) > (walking(p) ? 10 * elapsed + 1 : 0.01)
    )
      throw new Error("Position out of sync. Please sign in again.");
    if (p.phase === "kiosk" && distance(driver, p.driver) > 0.01)
      throw new Error("Close the kiosk to continue walking.");
    const next = {
      ...p,
      truck: walking(p) ? p.truck : truck,
      driver,
      updatedAt: Date.now(),
    };
    if (exited(next)) {
      // This is the only commit point. Kiosk confirmation merely reserves a trailer.
      const existing = await ctx.db
        .query("lunchOrders")
        .withIndex("by_subject", (q) => q.eq("subject", p.subject))
        .unique();
      if (!existing)
        await ctx.db.insert("lunchOrders", {
          subject: p.subject,
          email: p.email,
          lines: p.lines,
          subtotalCents: p.subtotalCents,
          feeCents: p.feeCents,
          totalCents: p.totalCents,
          placedAt: Date.now(),
        });
      next.phase = "complete";
      next.parking = null;
    }
    await ctx.db.patch(p._id, publicPlayer(next));
  },
});
export const interact = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    applyInteraction(p);
    await ctx.db.patch(p._id, publicPlayer(p));
  },
});
export const cab = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    toggleCab(p);
    await ctx.db.patch(p._id, publicPlayer(p));
  },
});
export const leaveKiosk = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    if (p.phase === "kiosk") await ctx.db.patch(p._id, { phase: "walk-kiosk" });
  },
});
export const reserve = mutation({
  args: {
    session: v.string(),
    cart: v.array(v.object({ productId: v.string(), quantity: v.number() })),
  },
  handler: async (ctx, { session, cart }) => {
    const p = await player(ctx, session);
    if (
      p.lines.length &&
      ["walk-truck", "pickup", "exit", "complete"].includes(p.phase)
    )
      return;
    if (p.phase !== "kiosk" || distance(p.driver, KIOSK) >= 2.4)
      throw new Error("Order at the kiosk.");
    const priced = priceCart(cart);
    const others = await ctx.db.query("lunchPlayers").collect();
    const occupied = others
      .filter(
        (o) => o.parking !== null && ["walk-truck", "pickup"].includes(o.phase),
      )
      .map((o) => normalizeParking(o.parking)!);
    const parking = chooseParking(occupied, Math.random());
    await ctx.db.patch(p._id, { ...priced, parking, phase: "walk-truck" });
  },
});
export const recover = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    applyRecovery(p);
    await ctx.db.patch(p._id, publicPlayer(p));
  },
});

export const cancelOrder = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    const order = await ctx.db
      .query("lunchOrders")
      .withIndex("by_subject", (q) => q.eq("subject", p.subject))
      .unique();
    if (order) await ctx.db.delete(order._id);
    await ctx.db.patch(p._id, publicPlayer(newPlayer(p.email)));
  },
});

export const throwBurger = mutation({
  args: { session: v.string(), target: point },
  handler: async (ctx, { session, target }) => {
    const p = await player(ctx, session);
    if (!canThrow(p))
      throw new Error("Get out of your truck to throw burgers.");
    const latest = await ctx.db
      .query("lunchBurgers")
      .withIndex("by_subject", (q) => q.eq("subject", p.subject))
      .order("desc")
      .first();
    if (latest && Date.now() - latest.thrownAt < 800) return;
    const burgers = await ctx.db.query("lunchBurgers").collect();
    if (burgers.length >= 100)
      throw new Error("The yard is full of burgers. Clean some up first!");
    const landing = burgerLanding(p.driver, target);
    await ctx.db.insert("lunchBurgers", {
      subject: p.subject,
      ...landing,
      from: p.driver,
      thrownAt: Date.now(),
    });
  },
});
export const cleanBurger = mutation({
  args: { session: v.string() },
  handler: async (ctx, { session }) => {
    const p = await player(ctx, session);
    if (!canThrow(p)) throw new Error("Get out of your truck to clean up.");
    const burgers = await ctx.db.query("lunchBurgers").collect();
    const closest = closestBurger(
      p.driver,
      burgers.map((b) => ({ ...b, id: b._id })),
    );
    const target = burgers.find((b) => b._id === closest?.id);
    if (target) await ctx.db.delete(target._id);
  },
});
