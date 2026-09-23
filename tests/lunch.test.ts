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
  toggleCab,
  validPose,
  walking,
  attached,
  interaction,
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
  assert.equal(MENU.filter((p) => p.category === "Fries").length, 7);
  assert.equal(MENU.filter((p) => p.category === "Burgers").length, 13);
  assert.equal(MENU.filter((p) => p.category === "Snacks").length, 34);
  assert.equal(
    MENU.some((p) => /maison/i.test(p.name)),
    false,
  );
  assert.equal(new Set(MENU.map((p) => p.id)).size, MENU.length);
  assert.equal(priceCart(cart).totalCents, 1030);
  assert.equal(
    priceCart([{ productId: "friet-rombautje", quantity: 2 }]).totalCents,
    2190,
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
  p.truck.speed = 1;
  assert.throws(() => interact(p));
  p.truck.speed = 0;
  p.truck.z = 43;
  interact(p);
  assert.equal(p.phase, "walk-kiosk");
  interact(p);
  assert.equal(p.phase, "arrive", "can get back in without ordering");
  interact(p);
  assert.equal(p.phase, "walk-kiosk");
  p.driver = { ...KIOSK };
  interact(p);
  assert.equal(p.phase, "kiosk");
  p.phase = "pickup";
  p.parking = 2;
  p.truck = { ...spawn(), ...PARKINGS[2], trailerHeading: 0, speed: -0.3 };
  assert.equal(pickupReady(p), true);
  p.truck.heading = Math.PI;
  assert.equal(pickupReady(p), false);
});
test("random allocation fills free parkings before allowing overlapping ghosts", () => {
  assert.equal(chooseParking([0, 1], 0.99), 2);
  assert.equal(chooseParking([0, 1, 2], 0.5), 1);
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
    /kiosk/i,
  );
  await put(t, "alice@example.com", {
    phase: "kiosk",
    driver: KIOSK,
    truck: { ...spawn(), z: 43 },
  });
  await alice.mutation(fn("reserve"), { session: "a", cart });
  let s = await alice.query(world, {});
  assert.equal(s.me.phase, "walk-truck");
  assert.equal(s.me.totalCents, 1030);
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
      speed: -0.3,
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
  assert.equal(s.orders[0].feeCents, 150);
  assert.equal(s.orders[0].totalCents, 1030);
  assert.equal(s.me.parking, null);
  await alice.mutation(fn("join"), { session: "again" });
  assert.equal((await alice.query(world, {})).me.phase, "complete");
  await alice.mutation(fn("cab"), { session: "again" });
  assert.equal((await alice.query(world, {})).me.onFoot, true);
});
test("concurrent kiosk reservations fill three distinct slots, then overflow without blocking", async () => {
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
      .slice(0, 3)
      .map((p, i) => p.mutation(fn("reserve"), { session: String(i), cart })),
  );
  let rows = await t.run((ctx) => ctx.db.query("lunchPlayers").collect());
  assert.equal(
    new Set(rows.filter((p) => p.parking !== null).map((p) => p.parking)).size,
    3,
  );
  await Promise.all(
    people
      .slice(3)
      .map((p, i) =>
        p.mutation(fn("reserve"), { session: String(i + 3), cart }),
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
  assert.equal(s.me.totalCents, 1030);
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
    /another tab/,
  );
});

test("Frikandel and Kipkorn remain available at regular prices without free portions", () => {
  const priced = priceCart([
    { productId: "frikandel", quantity: 2 },
    { productId: "kipkorn", quantity: 1 },
    { productId: "frikandel-special", quantity: 1 },
  ]);
  assert.deepEqual(
    priced.lines.map((l) => l.freeQuantity ?? 0),
    [0, 0, 0],
  );
  assert.equal(priced.subtotalCents, 1400);
  assert.equal(priced.totalCents, 1550);
});

test("backend places regular portions without promotional extras", async () => {
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "a" });
  await put(t, "alice@example.com", { phase: "kiosk", driver: KIOSK });
  await alice.mutation(fn("reserve"), {
    session: "a",
    cart: [{ productId: "kipkorn", quantity: 2 }],
  });
  const truck = {
    ...spawn(),
    x: 68,
    z: 34,
    heading: Math.PI / 2,
    trailerHeading: Math.PI / 2,
  };
  await put(t, "alice@example.com", { phase: "exit", truck });
  await alice.mutation(fn("move"), { session: "a", truck, driver: KIOSK });
  const s = await alice.query(world, {});
  assert.equal(s.orders[0].lines[0].quantity, 2);
  assert.equal(s.orders[0].lines[0].freeQuantity, undefined);
  assert.equal(s.orders[0].totalCents, 950);
});

test("pickup accepts an angled reverse approach but rejects forward ramming and blocks trailer penetration", () => {
  const p = newPlayer("a@example.com");
  p.phase = "pickup";
  p.parking = 2;
  p.truck = {
    ...spawn(),
    x: PARKINGS[2].x + 1,
    z: PARKINGS[2].z + 1,
    heading: 0.75,
    trailerHeading: 0,
    speed: -0.3,
  };
  assert.equal(pickupReady(p), true);
  p.truck.speed = 0.3;
  assert.equal(pickupReady(p), false);
  p.truck = {
    ...spawn(),
    x: PARKINGS[2].x,
    z: PARKINGS[2].z + 4,
    heading: 0,
    trailerHeading: 0,
  };
  const input = idleInput();
  input.throttle = -1;
  for (let i = 0; i < 600; i++) drive(p, input, 1 / 60);
  assert.ok(
    p.truck.z > PARKINGS[2].z - 1,
    "own trailer blocks reversing through its body",
  );
});

test("cancellation removes only the caller's placed order, resets the run and is retry-safe", async () => {
  const { t, alice } = setup();
  await assert.rejects(t.mutation(fn("cancelOrder"), { session: "a" }));
  const bob = t.withIdentity({
    subject: "bob",
    email: "bob@example.com",
    emailVerified: true,
  });
  for (const [user, email, session] of [
    [alice, "alice@example.com", "a"],
    [bob, "bob@example.com", "b"],
  ] as const) {
    await user.mutation(fn("join"), { session });
    await put(t, email, { phase: "kiosk", driver: KIOSK });
    await user.mutation(fn("reserve"), { session, cart });
    const truck = {
      ...spawn(),
      x: 68,
      z: 34,
      heading: Math.PI / 2,
      trailerHeading: Math.PI / 2,
    };
    await put(t, email, { phase: "exit", truck });
    await user.mutation(fn("move"), { session, truck, driver: KIOSK });
  }
  await assert.rejects(alice.mutation(fn("cancelOrder"), { session: "wrong" }));
  await alice.mutation(fn("cancelOrder"), { session: "a" });
  await alice.mutation(fn("cancelOrder"), { session: "a" });
  const state = await alice.query(world, {});
  assert.deepEqual(
    state.orders.map((o) => o.email),
    ["bob@example.com"],
  );
  assert.equal(state.me.phase, "arrive");
  assert.equal(state.me.parking, null);
  assert.equal(state.me.totalCents, 0);
  assert.deepEqual(state.me.lines, []);
  await put(t, "alice@example.com", { phase: "kiosk", driver: KIOSK });
  await alice.mutation(fn("reserve"), { session: "a", cart });
  assert.equal((await alice.query(world, {})).me.phase, "walk-truck");
});

test("existing reservations in retired bays are mapped to a usable new parking", async () => {
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "a" });
  await put(t, "alice@example.com", {
    phase: "pickup",
    parking: 5,
    ...priceCart(cart),
  });
  const state = await alice.query(world, {});
  assert.equal(state.me.parking, 2);
  const bay = PARKINGS[2];
  await put(t, "alice@example.com", {
    truck: {
      ...spawn(),
      x: bay.x,
      z: bay.z,
      heading: 0,
      trailerHeading: 0,
      speed: -0.3,
    },
  });
  await alice.mutation(fn("interact"), { session: "a" });
  assert.equal((await alice.query(world, {})).me.phase, "exit");
});

test("turbo boosts active drivers and spectators; releasing restores normal speed", () => {
  for (const phase of ["arrive", "pickup", "exit", "complete"] as const) {
    const normal = newPlayer("normal@example.com");
    Object.assign(normal.truck, {
      x: 0,
      z: -25,
      heading: 0,
      trailerHeading: 0,
    });
    normal.phase = phase;
    const boosted = structuredClone(normal);
    for (let i = 0; i < 120; i++) {
      drive(normal, { ...idleInput(), throttle: 1 }, 1 / 60);
      drive(boosted, { ...idleInput(), throttle: 1, turbo: true }, 1 / 60);
    }
    assert.ok(boosted.truck.speed > normal.truck.speed * 2.5, phase);
    const top = boosted.truck.speed;
    drive(boosted, { ...idleInput(), throttle: 1 }, 1 / 60);
    assert.ok(boosted.truck.speed < top, "releasing turbo slows back down");
    const released = boosted.truck.speed;
    drive(boosted, { ...idleInput(), brake: true }, 1 / 60);
    assert.ok(boosted.truck.speed < released, "modal brake remains effective");
  }
});

test("multiplayer accepts turbo speed and travel while still rejecting excessive speed", async () => {
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "turbo" });
  const p = (await alice.query(world, {})).me;
  await put(t, p.email, { updatedAt: Date.now() - 1000 });
  const truck = { ...p.truck, z: p.truck.z - 16, speed: 16.5 };
  await alice.mutation(fn("move"), {
    session: "turbo",
    truck,
    driver: p.driver,
  });
  assert.equal((await alice.query(world, {})).me.truck.speed, 16.5);
  await assert.rejects(
    alice.mutation(fn("move"), {
      session: "turbo",
      truck: { ...truck, speed: 30 },
      driver: p.driver,
    }),
    /Invalid position/,
  );
});

test("hitching accepts a broad stopped approach without allowing ramming or remote pickup", () => {
  const p = newPlayer("pickup@example.com");
  p.phase = "pickup";
  p.parking = 0;
  p.truck = {
    ...spawn(),
    x: PARKINGS[0].x + 4,
    z: PARKINGS[0].z + 2,
    heading: 1.3,
    trailerHeading: 0,
    speed: 0,
  };
  assert.equal(
    pickupReady(p),
    true,
    "stopped, offset and angled is close enough",
  );
  p.truck.speed = 2;
  assert.equal(pickupReady(p), false, "forward ramming cannot hitch");
  p.truck.speed = 0;
  p.truck.x = PARKINGS[0].x + 7;
  assert.equal(pickupReady(p), false, "must still be near own trailer");
});

test("shared burgers require walking, reach all players, and cleanup removes only the nearest landed burger", async () => {
  const { t, alice } = setup();
  const bob = t.withIdentity({
    subject: "bob",
    email: "bob@example.com",
    emailVerified: true,
  });
  await assert.rejects(
    t.mutation(fn("throwBurger"), { session: "a", target: { x: 0, z: 0 } }),
  );
  await alice.mutation(fn("join"), { session: "a" });
  await bob.mutation(fn("join"), { session: "b" });
  await assert.rejects(
    alice.mutation(fn("throwBurger"), { session: "a", target: { x: 0, z: 0 } }),
    /Get out/,
  );
  await put(t, "alice@example.com", {
    phase: "walk-kiosk",
    driver: { x: 0, z: 0 },
  });
  await alice.mutation(fn("throwBurger"), {
    session: "a",
    target: { x: 4, z: 0 },
  });
  await alice.mutation(fn("throwBurger"), {
    session: "a",
    target: { x: 5, z: 0 },
  });
  let shared = (await bob.query(world, {})).burgers!;
  assert.equal(shared.length, 1, "rapid repeat throws are limited");
  assert.equal(shared[0].x, 4);
  await put(t, "bob@example.com", {
    phase: "walk-kiosk",
    driver: { x: 3, z: 0 },
  });
  await bob.mutation(fn("cleanBurger"), { session: "b" });
  assert.equal(
    (await bob.query(world, {})).burgers!.length,
    1,
    "cannot clean a burger in flight",
  );
  await t.run(async (ctx) => {
    for (const b of await ctx.db.query("lunchBurgers").collect())
      await ctx.db.patch(b._id, { thrownAt: Date.now() - 2000 });
  });
  await alice.mutation(fn("throwBurger"), {
    session: "a",
    target: { x: 1, z: 0 },
  });
  await t.run(async (ctx) => {
    for (const b of await ctx.db.query("lunchBurgers").collect())
      await ctx.db.patch(b._id, { thrownAt: Date.now() - 2000 });
  });
  await bob.mutation(fn("cleanBurger"), { session: "b" });
  shared = (await alice.query(world, {})).burgers!;
  assert.equal(shared.length, 1);
  assert.equal(
    shared[0].x,
    1,
    "Bob cleans Alice's nearest burger, not the farther one",
  );
  await put(t, "bob@example.com", { driver: { x: 20, z: 0 } });
  await bob.mutation(fn("cleanBurger"), { session: "b" });
  assert.equal(
    (await alice.query(world, {})).burgers!.length,
    1,
    "cleanup is local",
  );
  await assert.rejects(
    alice.mutation(fn("throwBurger"), {
      session: "stale",
      target: { x: 2, z: 0 },
    }),
    /another tab/,
  );
});

test("start over resets an empty run without signing out or affecting another player", async () => {
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "reset" });
  await put(t, "alice@example.com", {
    phase: "walk-kiosk",
    driver: { x: 10, z: 10 },
  });
  await alice.mutation(fn("cancelOrder"), { session: "reset" });
  const me = (await alice.query(world, {})).me;
  assert.equal(me.phase, "arrive");
  assert.deepEqual(me.truck, spawn());
  assert.equal(me.lines.length, 0);
  await alice.mutation(fn("recover"), { session: "reset" });
});

test("walking turbo moves three times faster and multiplayer accepts the boosted pace", async () => {
  const p = newPlayer("walker@example.com");
  p.phase = "walk-kiosk";
  p.driver = { x: 0, z: 0 };
  const boosted = structuredClone(p);
  for (let i = 0; i < 60; i++) {
    drive(p, { ...idleInput(), walkX: 1 }, 1 / 60);
    drive(boosted, { ...idleInput(), walkX: 1, turbo: true }, 1 / 60);
  }
  assert.ok(Math.abs(boosted.driver.x - p.driver.x * 3) < 0.001);
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "walk" });
  await put(t, "alice@example.com", {
    phase: "walk-kiosk",
    driver: { x: 0, z: 0 },
    updatedAt: Date.now() - 1000,
  });
  const me = (await alice.query(world, {})).me;
  await alice.mutation(fn("move"), {
    session: "walk",
    truck: me.truck,
    driver: { x: 9, z: 0 },
  });
  assert.equal((await alice.query(world, {})).me.driver.x, 9);
});

test("stopped players can leave anywhere and resume every driving stage", () => {
  for (const phase of ["arrive", "pickup", "exit", "complete"] as const) {
    const p = newPlayer("walker@example.com");
    p.phase = phase;
    p.truck = { ...spawn(), x: 15, z: 30, heading: 0, trailerHeading: 0 };
    for (const speed of [-1, 0.02, 1]) {
      p.truck.speed = speed;
      assert.throws(() => toggleCab(p));
    }
    p.truck.speed = 0;
    const truck = { ...p.truck };
    toggleCab(p);
    assert.ok(walking(p), phase);
    assert.equal(attached(p), phase === "exit");
    const input = idleInput();
    input.walkX = 1;
    input.throttle = 1;
    drive(p, input, 0.1);
    assert.deepEqual(p.truck, truck);
    p.driver = { x: 30, z: 30 };
    assert.equal(interaction(p), "");
    assert.throws(() => toggleCab(p));
    p.driver = { x: 18, z: 30 };
    toggleCab(p);
    assert.equal(p.phase, phase);
    assert.equal(walking(p), false);
  }
});

test("walking outside the exit remains valid and multiplayer persists cab transitions", async () => {
  const { t, alice } = setup();
  await alice.mutation(fn("join"), { session: "a" });
  const truck = {
    ...spawn(),
    x: 68,
    z: 34,
    heading: Math.PI / 2,
    trailerHeading: Math.PI / 2,
  };
  await put(t, "alice@example.com", { phase: "complete", truck });
  await alice.mutation(fn("cab"), { session: "a" });
  let p = (await alice.query(world, {})).me;
  assert.equal(p.onFoot, true);
  assert.ok(validPose(p.truck, p.driver));
  await alice.mutation(fn("move"), {
    session: "a",
    truck: { ...truck, heading: 0, speed: 8 },
    driver: p.driver,
  });
  p = (await alice.query(world, {})).me;
  assert.deepEqual(p.truck, truck);
  await alice.mutation(fn("cab"), { session: "a" });
  assert.equal((await alice.query(world, {})).me.onFoot, false);
});

test("E prioritizes trailer attachment over leaving a stopped truck", () => {
  const p = newPlayer("driver@example.com");
  p.phase = "pickup";
  p.parking = 2;
  p.truck = { ...spawn(), ...PARKINGS[2], trailerHeading: 0, speed: 0 };
  assert.equal(interaction(p), "Attach your lunch trailer");
  interact(p);
  assert.equal(p.phase, "exit");
  assert.equal(walking(p), false);
  assert.equal(interaction(p), "Get out of your truck");
  interact(p);
  assert.equal(walking(p), true);
  assert.equal(attached(p), true);
});
