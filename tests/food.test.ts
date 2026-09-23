import { test } from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import {
  canConfirm,
  drive,
  idleInput,
  inOrderArea,
  pickupReady,
  spawn,
  type Player,
} from "../src/food/model";
import { integrate } from "../src/game/simulation";
const modules = {
  "../convex/food.ts": () => import("../convex/food"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};
function setup() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({
    subject: "alice",
    email: "alice@example.com",
    emailVerified: true,
  });
  const bob = t.withIdentity({
    subject: "bob",
    email: "bob@example.com",
    emailVerified: true,
  });
  return { t, alice, bob };
}
type Harness = ReturnType<typeof setup>["t"];
async function put(t: Harness, email: string, patch: Partial<Player>) {
  await t.run(async (ctx) => {
    const p = (await ctx.db.query("players").collect()).find(
      (p) => p.email === email,
    )!;
    await ctx.db.patch(p._id, patch);
  });
}
test("the new game retains the original attached truck physics", () => {
  const a = spawn(),
    b = spawn(),
    input = { ...idleInput(), throttle: 1, steer: 0.5 };
  for (let i = 0; i < 120; i++) {
    drive(a, input, true, 1 / 60);
    integrate(b, input, true, 1 / 60);
  }
  assert.deepEqual(a, b);
});
test("pickup requires alignment and stopping; delivery requires all trailer corners", () => {
  const truck = { ...spawn(), x: 0, z: -42 };
  assert.equal(pickupReady(truck, 3), true);
  assert.equal(pickupReady({ ...truck, heading: 0 }, 3), false);
  assert.equal(pickupReady({ ...truck, speed: 2 }, 3), false);
  assert.equal(inOrderArea({ ...truck, z: 40 }), true);
  assert.equal(inOrderArea({ ...truck, z: 52 }), false);
  assert.equal(inOrderArea({ ...truck, z: 40, x: 14 }), false);
});
test("authentication and company domain protect yard access", async () => {
  const { t, alice } = setup();
  await assert.rejects(
    t.mutation(api.food.join, { session: "one" }),
    /Sign in/,
  );
  await assert.rejects(t.query(api.food.world, {}), /Sign in/);
  await assert.rejects(
    t
      .withIdentity({ email: "x@example.com", emailVerified: false })
      .mutation(api.food.join, { session: "one" }),
    /verified/,
  );
  process.env.ALLOWED_EMAIL_DOMAIN = "company.example";
  try {
    await assert.rejects(
      alice.mutation(api.food.join, { session: "one" }),
      /company/,
    );
  } finally {
    delete process.env.ALLOWED_EMAIL_DOMAIN;
  }
});
test("two drivers claim one trailer; replacement becomes available after the lift", async () => {
  const { t, alice, bob } = setup();
  await alice.mutation(api.food.join, { session: "a" });
  await bob.mutation(api.food.join, { session: "b" });
  for (const email of ["alice@example.com", "bob@example.com"])
    await put(t, email, { truck: { ...spawn(), x: 0, z: -42 } });
  const claims = await Promise.allSettled([
    alice.mutation(api.food.pickup, { session: "a", dish: 3 }),
    bob.mutation(api.food.pickup, { session: "b", dish: 3 }),
  ]);
  assert.equal(claims.filter((c) => c.status === "fulfilled").length, 1);
  const state = await alice.query(api.food.world, {});
  assert.equal(state.players.filter((p) => p.dish === 3).length, 1);
  assert.ok(state.bays.find((b) => b.dish === 3)!.readyAt > Date.now());
  await t.run(async (ctx) => {
    const bay = await ctx.db
      .query("bays")
      .withIndex("by_dish", (q) => q.eq("dish", 3))
      .unique();
    await ctx.db.patch(bay!._id, { readyAt: 0 });
  });
  const loser = state.me.dish === null ? alice : bob;
  await loser.mutation(api.food.pickup, {
    session: state.me.dish === null ? "a" : "b",
    dish: 3,
  });
  assert.equal(
    (await alice.query(api.food.world, {})).players.filter((p) => p.dish === 3)
      .length,
    2,
  );
});
test("drop off, drive away, confirm anywhere once, then rejoin as a ghost", async () => {
  const { t, alice } = setup();
  await alice.mutation(api.food.join, { session: "a" });
  await put(t, "alice@example.com", {
    dish: 2,
    truck: { ...spawn(), x: 0, z: 40 },
  });
  await alice.mutation(api.food.dropoff, { session: "a" });
  let state = await alice.query(api.food.world, {});
  assert.equal(state.me.dish, null);
  assert.deepEqual(state.me.basket, [2]);
  await assert.rejects(alice.mutation(api.food.dropoff, { session: "a" }));
  await put(t, "alice@example.com", { truck: spawn() });
  assert.equal(canConfirm((await alice.query(api.food.world, {})).me), true);
  await Promise.all([
    alice.mutation(api.food.confirm, { session: "a" }),
    alice.mutation(api.food.confirm, { session: "a" }),
  ]);
  await alice.mutation(api.food.join, { session: "return" });
  state = await alice.query(api.food.world, {});
  assert.deepEqual(state.me.confirmed, [2]);
  assert.equal(state.orders.length, 1);
  assert.deepEqual(state.orders[0].dishes, [2]);
  await assert.rejects(
    alice.mutation(api.food.pickup, { session: "return", dish: 3 }),
  );
  await assert.rejects(
    alice.mutation(api.food.removeItem, { session: "return", index: 0 }),
  );
  await alice.mutation(api.food.move, {
    session: "return",
    truck: { ...spawn(), z: 39 },
  });
});
test("basket persists across sessions, supports quantities and removal, rejects empty confirmation", async () => {
  const { t, alice } = setup();
  await alice.mutation(api.food.join, { session: "a" });
  await assert.rejects(
    alice.mutation(api.food.confirm, { session: "a" }),
    /Deliver/,
  );
  await put(t, "alice@example.com", { basket: [1, 1, 3] });
  await alice.mutation(api.food.join, { session: "b" });
  assert.deepEqual(
    (await alice.query(api.food.world, {})).me.basket,
    [1, 1, 3],
  );
  await assert.rejects(
    alice.mutation(api.food.removeItem, { session: "a", index: 0 }),
    /another tab/,
  );
  await alice.mutation(api.food.removeItem, { session: "b", index: 1 });
  await alice.mutation(api.food.confirm, { session: "b" });
  assert.deepEqual(
    (await alice.query(api.food.world, {})).orders[0].dishes,
    [1, 3],
  );
});
test("server rejects invalid movement and delivery outside the zone", async () => {
  const { t, alice } = setup();
  await alice.mutation(api.food.join, { session: "a" });
  await assert.rejects(
    alice.mutation(api.food.move, {
      session: "a",
      truck: { ...spawn(), x: NaN },
    }),
    /Invalid/,
  );
  await assert.rejects(
    alice.mutation(api.food.move, {
      session: "a",
      truck: { ...spawn(), x: 80 },
    }),
    /range/,
  );
  await put(t, "alice@example.com", { dish: 1 });
  await assert.rejects(
    alice.mutation(api.food.dropoff, { session: "a" }),
    /whole trailer/,
  );
  assert.deepEqual((await alice.query(api.food.world, {})).me.basket, []);
});
