import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { MENU, priceCart } from "../src/lunch/menu";
import {
  chooseParking,
  drive,
  exited,
  idleInput,
  interact,
  KIOSK,
  newPlayer,
  OBSTACLES,
  PARKINGS,
  pickupReady,
  spawn,
  type Player,
  type Snapshot,
} from "../src/lunch/model";
import { integrate, overlap, rigRects } from "../src/game/simulation";
const modules = {
  "../convex/lunch.ts": () => import("../convex/lunch"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};
const fn = (name: string) => makeFunctionReference<"mutation">(`lunch:${name}`);
const world = makeFunctionReference<"query", Record<string, never>, Snapshot>(
  "lunch:world",
);
const cart = [
  { productId: "kleine-puntzak", quantity: 1 },
  { productId: "bicky-burger", quantity: 1 },
];
function setup() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({
    subject: "alice",
    email: "alice@example.com",
    emailVerified: true,
  });
  return { t, alice };
}
type Harness = ReturnType<typeof setup>["t"];
async function put(t: Harness, email: string, patch: Partial<Player>) {
  await t.run(async (ctx) => {
    const p = (await ctx.db.query("lunchPlayers").collect()).find(
      (p) => p.email === email,
    )!;
    await ctx.db.patch(p._id, patch);
  });
}
test("menu preserves supplied prices, excludes Friet maison, charges one euro once", () => {
  assert.equal(MENU.filter((p) => p.category === "Frieten").length, 7);
  assert.equal(MENU.filter((p) => p.category === "Burgers").length, 13);
  assert.equal(MENU.filter((p) => p.category === "Snacks").length, 34);
  assert.equal(
    MENU.some((p) => /maison/i.test(p.name)),
    false,
  );
  assert.equal(new Set(MENU.map((p) => p.id)).size, MENU.length);
  assert.equal(priceCart(cart).totalCents, 980);
  assert.equal(
    priceCart([{ productId: "friet-rombautje", quantity: 2 }]).totalCents,
    2140,
  );
  assert.throws(() => priceCart([]));
  assert.throws(() => priceCart([{ productId: "fake", quantity: 1 }]));
  assert.throws(() => priceCart([{ productId: "bicky-burger", quantity: -1 }]));
  assert.throws(() =>
    priceCart([{ productId: "bicky-burger", quantity: 1.5 }]),
  );
  assert.throws(() => priceCart([cart[0], cart[0]]));
});
test("tractor starts unattached, original driving physics remain, gate is open and exit gap is real", () => {
  const p = newPlayer("driver@example.com");
  const input = { ...idleInput(), throttle: 1 };
  const before = { ...p.truck };
  drive(p, input, 1 / 60);
  integrate(before, input, false, 1 / 60);
  assert.equal(p.truck.x, before.x);
  assert.equal(p.truck.z, before.z);
  assert.equal(p.truck.trailerHeading, p.truck.heading);
  p.truck = { ...spawn(), x: 18, z: 20 };
  for (let i = 0; i < 240; i++) drive(p, input, 1 / 60);
  assert.ok(p.truck.z < 12, "open gate permits crossing");
  p.truck = {
    ...spawn(),
    x: 43,
    z: 34,
    heading: Math.PI / 2,
    trailerHeading: Math.PI / 2,
  };
  for (let i = 0; i < 240; i++) drive(p, input, 1 / 60);
  assert.ok(p.truck.x > 54, "exit opening permits driving out");
  p.truck = {
    ...spawn(),
    x: 43,
    z: 52,
    heading: Math.PI / 2,
    trailerHeading: Math.PI / 2,
  };
  for (let i = 0; i < 240; i++) drive(p, input, 1 / 60);
  assert.ok(p.truck.x < 52, "fence outside exit remains solid");
});
test("parking, walking to kiosk, and own-trailer alignment govern interactions", () => {
  const p = newPlayer("a@example.com");
  assert.throws(() => interact(p));
  p.truck.z = 43;
  interact(p);
  assert.equal(p.phase, "walk-kiosk");
  assert.throws(() => interact(p));
  p.driver = { ...KIOSK };
  interact(p);
  assert.equal(p.phase, "kiosk");
  p.phase = "pickup";
  p.parking = 2;
  p.truck = { ...spawn(), ...PARKINGS[2], trailerHeading: 0 };
  assert.equal(pickupReady(p), true);
  p.truck.heading = Math.PI;
  assert.equal(pickupReady(p), false);
});
test("random allocation fills free parkings before allowing overlapping ghosts", () => {
  assert.equal(chooseParking([0, 1, 2, 3, 4], 0.99), 5);
  assert.equal(chooseParking([0, 1, 2, 3, 4, 5], 0.5), 3);
  for (const bay of PARKINGS)
    assert.equal(
      OBSTACLES.some((o) =>
        overlap(rigRects({ ...spawn(), ...bay, trailerHeading: 0 })[1], o),
      ),
      false,
    );
});
test("unauthenticated users cannot enter and remote draft contents stay private", async () => {
  const { t, alice } = setup();
  await assert.rejects(t.mutation(fn("join"), { session: "a" }));
  await assert.rejects(t.query(world, {}));
  await alice.mutation(fn("join"), { session: "a" });
  await put(t, "alice@example.com", { phase: "kiosk", driver: KIOSK });
  await alice.mutation(fn("reserve"), { session: "a", cart });
  const bob = t.withIdentity({
    subject: "bob",
    email: "bob@example.com",
    emailVerified: true,
  });
  await bob.mutation(fn("join"), { session: "b" });
  const s = await bob.query(world, {});
  assert.deepEqual(
    s.players.find((p) => p.email === "alice@example.com")!.lines,
    [],
  );
  assert.deepEqual(s.orders, []);
});
test("kiosk confirmation reserves only; collection and whole-trailer exit place exactly one priced order", async () => {
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "a" });
  await assert.rejects(
    alice.mutation(fn("reserve"), { session: "a", cart }),
    /kiosk/,
  );
  await put(t, "alice@example.com", {
    phase: "kiosk",
    driver: KIOSK,
    truck: { ...spawn(), z: 43 },
  });
  await alice.mutation(fn("reserve"), { session: "a", cart });
  let s = await alice.query(world, {});
  assert.equal(s.me.phase, "walk-truck");
  assert.equal(s.me.totalCents, 980);
  assert.equal(s.orders.length, 0);
  await alice.mutation(fn("reserve"), { session: "a", cart });
  assert.equal(
    (await alice.query(world, {})).me.parking,
    s.me.parking,
    "retry does not allocate another trailer",
  );
  await put(t, "alice@example.com", { driver: { x: -27, z: 43 } });
  await alice.mutation(fn("interact"), { session: "a" });
  s = await alice.query(world, {});
  assert.equal(s.me.phase, "pickup");
  await put(t, "alice@example.com", {
    truck: {
      ...spawn(),
      x: PARKINGS[s.me.parking!].x,
      z: PARKINGS[s.me.parking!].z,
      heading: 0,
      trailerHeading: 0,
    },
  });
  await alice.mutation(fn("interact"), { session: "a" });
  assert.equal((await alice.query(world, {})).me.phase, "exit");
  const inside = {
    ...spawn(),
    x: 60,
    z: 34,
    heading: Math.PI / 2,
    trailerHeading: Math.PI / 2,
  };
  await put(t, "alice@example.com", { truck: inside });
  await alice.mutation(fn("move"), {
    session: "a",
    truck: inside,
    driver: { x: -27, z: 43 },
  });
  assert.equal(
    (await alice.query(world, {})).orders.length,
    0,
    "cab outside is insufficient",
  );
  const outside = { ...inside, x: 68 };
  await put(t, "alice@example.com", { truck: { ...outside, x: 67 } });
  await Promise.all([
    alice.mutation(fn("move"), {
      session: "a",
      truck: outside,
      driver: { x: -27, z: 43 },
    }),
    alice.mutation(fn("move"), {
      session: "a",
      truck: outside,
      driver: { x: -27, z: 43 },
    }),
  ]);
  s = await alice.query(world, {});
  assert.equal(s.me.phase, "complete");
  assert.equal(s.orders.length, 1);
  assert.equal(s.orders[0].feeCents, 100);
  assert.equal(s.orders[0].totalCents, 980);
  assert.equal(s.me.parking, null);
  await alice.mutation(fn("join"), { session: "again" });
  assert.equal((await alice.query(world, {})).me.phase, "complete");
  await assert.rejects(alice.mutation(fn("interact"), { session: "again" }));
});
test("concurrent kiosk reservations fill six distinct slots, then overflow without blocking", async () => {
  const { t } = setup();
  const people = [];
  for (let i = 0; i < 8; i++) {
    const p = t.withIdentity({
      subject: `p${i}`,
      email: `p${i}@example.com`,
      emailVerified: true,
    });
    await p.mutation(fn("join"), { session: String(i) });
    await put(t, `p${i}@example.com`, { phase: "kiosk", driver: KIOSK });
    people.push(p);
  }
  await Promise.all(
    people
      .slice(0, 6)
      .map((p, i) => p.mutation(fn("reserve"), { session: String(i), cart })),
  );
  let rows = await t.run((ctx) => ctx.db.query("lunchPlayers").collect());
  assert.equal(
    new Set(rows.filter((p) => p.parking !== null).map((p) => p.parking)).size,
    6,
  );
  await Promise.all(
    people
      .slice(6)
      .map((p, i) =>
        p.mutation(fn("reserve"), { session: String(i + 6), cart }),
      ),
  );
  rows = await t.run((ctx) => ctx.db.query("lunchPlayers").collect());
  assert.equal(rows.filter((p) => p.parking !== null).length, 8);
});
test("recovery preserves the reserved price; leaving without a trailer cannot place an order", async () => {
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "a" });
  await put(t, "alice@example.com", { phase: "kiosk", driver: KIOSK });
  await alice.mutation(fn("reserve"), { session: "a", cart });
  await put(t, "alice@example.com", { phase: "exit" });
  await alice.mutation(fn("recover"), { session: "a" });
  const s = await alice.query(world, {});
  assert.equal(s.me.phase, "pickup");
  assert.equal(s.me.totalCents, 980);
  assert.equal(
    exited({
      ...s.me,
      truck: {
        ...s.me.truck,
        x: 68,
        z: 34,
        heading: Math.PI / 2,
        trailerHeading: Math.PI / 2,
      },
    }),
    false,
  );
  await alice.mutation(fn("join"), { session: "b" });
  await assert.rejects(
    alice.mutation(fn("interact"), { session: "a" }),
    /tabblad/,
  );
});
