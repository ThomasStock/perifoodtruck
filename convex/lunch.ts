import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import {
  chooseParking,
  exited,
  interact as applyInteraction,
  KIOSK,
  newPlayer,
  recover as applyRecovery,
  validPose,
  walking,
  type Player,
} from "../src/lunch/model";
import { priceCart } from "../src/lunch/menu";
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
    throw new Error("Meld je aan met een geverifieerd Google-account.");
  if (
    process.env.ALLOWED_EMAIL_DOMAIN &&
    id.email.toLowerCase().split("@")[1] !==
      process.env.ALLOWED_EMAIL_DOMAIN.toLowerCase()
  )
    throw new Error("Gebruik je bedrijfsaccount.");
  return { subject: id.tokenIdentifier, email: id.email.toLowerCase() };
}
async function player(ctx: QueryCtx | MutationCtx, session?: string) {
  const id = await identity(ctx);
  const p = await ctx.db
    .query("lunchPlayers")
    .withIndex("by_subject", (q) => q.eq("subject", id.subject))
    .unique();
  if (!p) throw new Error("Meld je eerst aan.");
  if (session && p.session !== session)
    throw new Error(
      "Je truck is actief in een ander tabblad. Meld je hier opnieuw aan.",
    );
  return p;
}
const publicPlayer = (p: Player): Player => ({
  email: p.email,
  truck: p.truck,
  driver: p.driver,
  phase: p.phase,
  parking: p.parking,
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
    if (!validPose(truck, driver)) throw new Error("Ongeldige positie.");
    const elapsed = Math.min(
      30,
      Math.max(0, (Date.now() - p.updatedAt) / 1000),
    );
    if (
      distance(truck, p.truck) > (walking(p) ? 0.01 : 6 * elapsed + 2) ||
      distance(driver, p.driver) > (walking(p) ? 4 * elapsed + 1 : 0.01)
    )
      throw new Error("Positie niet gesynchroniseerd. Meld je opnieuw aan.");
    if (p.phase === "kiosk" && distance(driver, p.driver) > 0.01)
      throw new Error("Sluit de kiosk om verder te lopen.");
    const next = { ...p, truck, driver, updatedAt: Date.now() };
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
      throw new Error("Bestel aan de kiosk.");
    const priced = priceCart(cart);
    const others = await ctx.db.query("lunchPlayers").collect();
    const occupied = others
      .filter(
        (o) => o.parking !== null && ["walk-truck", "pickup"].includes(o.phase),
      )
      .map((o) => o.parking!);
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
