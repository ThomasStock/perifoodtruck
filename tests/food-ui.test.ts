import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { preview } from "../src/food/backend";

async function game() {
  const dom = new JSDOM('<main id="app"></main>', {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  Object.defineProperty(globalThis, "localStorage", {
    value: window.localStorage,
    configurable: true,
  });
  window.HTMLCanvasElement.prototype.getContext = (() =>
    new Proxy({}, { get: () => () => {} })) as never;
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const require = createRequire(
    new URL("../src/food/main.ts", import.meta.url),
  );
  const context = createContext({
    window,
    document: window.document,
    performance,
    console,
    structuredClone,
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => 0,
    importMeta: { env: { DEV: true } },
    exports: {},
    require: (id: string) => {
      if (id.endsWith(".css")) return {};
      if (id === "./scene")
        return {
          FoodScene: class {
            mode = "yard";
            async load() {}
            render() {}
          },
        };
      if (id === "./backend") return { preview };
      return require(id);
    },
  });
  const source = readFileSync(
    new URL("../src/food/main.ts", import.meta.url),
    "utf8",
  );
  runInContext(
    ts.transpileModule(source.replaceAll("import.meta", "importMeta"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    context,
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  const run = (code: string) => runInContext(code, context);
  await run("start()");
  return { dom, run, doc: window.document };
}
test("UI: hook, deliver, leave the zone, confirm, and return as a ghost", async () => {
  const { dom, run, doc } = await game();
  assert.equal((doc.getElementById("login") as HTMLElement).hidden, true);
  run("Object.assign(state.me.truck, {x:0, z:-42}); paint()");
  assert.match(
    doc.getElementById("action-text")!.textContent!,
    /Hook up Dish 3/,
  );
  await run("action('pickup', 3)");
  assert.match(doc.getElementById("objective")!.textContent!, /Dish 3/);
  run("Object.assign(state.me.truck, {x:0, z:40}); paint()");
  assert.match(doc.getElementById("zone-status")!.textContent!, /ready to add/);
  await run("action('dropoff')");
  assert.match(doc.getElementById("basket-content")!.textContent!, /Dish 3/);
  run("Object.assign(state.me.truck, {x:-36, z:40}); paint()");
  assert.equal(
    (doc.getElementById("confirm") as HTMLButtonElement).disabled,
    false,
  );
  (doc.getElementById("confirm") as HTMLButtonElement).click();
  assert.equal(
    doc.getElementById("confirm-dialog")!.hasAttribute("open"),
    true,
  );
  await run("action('confirm')");
  assert.equal(
    doc.getElementById("confirm-dialog")!.hasAttribute("open"),
    false,
  );
  assert.match(doc.getElementById("objective")!.textContent!, /scenic route/);
  assert.match(
    doc.querySelector(".order-person.you")!.textContent!,
    /you@preview.local/,
  );
  assert.equal(doc.getElementById("order-count")!.textContent, "1");
  run("signout()");
  await run("start()");
  assert.match(doc.getElementById("basket-count")!.textContent!, /Confirmed/);
  assert.equal((doc.getElementById("action-wrap") as HTMLElement).hidden, true);
  dom.window.close();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
test("UI: basket removal disables confirmation when the basket becomes empty", async () => {
  const { dom, run, doc } = await game();
  run("Object.assign(state.me.truck, {x:0, z:-42}); paint()");
  await run("action('pickup', 3)");
  run("Object.assign(state.me.truck, {x:0, z:40}); paint()");
  await run("action('dropoff')");
  await run("action('removeItem', 0)");
  assert.equal(
    (doc.getElementById("confirm") as HTMLButtonElement).disabled,
    true,
  );
  assert.equal(doc.getElementById("basket-count")!.textContent, "0 dishes");
  dom.window.close();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
