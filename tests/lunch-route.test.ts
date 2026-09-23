import test from "node:test";
import assert from "node:assert/strict";
import { guideRoute } from "../src/lunch/route";
import { newPlayer, toggleCab } from "../src/lunch/model";

test("stepping out removes driving detours and guides back to the truck", () => {
  for (const phase of ["pickup", "exit", "complete"] as const) {
    const p = newPlayer("driver@example.com");
    p.phase = phase;
    p.truck.x = 10;
    p.truck.z = phase === "pickup" ? 35 : -15;
    if (phase !== "complete") assert.equal(guideRoute(p).length, 4);
    toggleCab(p);
    assert.deepEqual(guideRoute(p), [p.driver, p.truck]);
    toggleCab(p);
    if (phase !== "complete") assert.equal(guideRoute(p).length, 4);
  }
});
