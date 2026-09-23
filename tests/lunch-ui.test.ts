import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { preview } from "../src/lunch/backend";

async function game() {
  const dom = new JSDOM('<main id="app"></main>', {
    url: "http://localhost/?preview=kiosk",
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
    new URL("../src/lunch/main.ts", import.meta.url),
  );
  const context = createContext({
    window,
    document: window.document,
    performance,
    URLSearchParams,
    localStorage: window.localStorage,
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
          LunchScene: class {
            mode = "yard";
            async load() {}
            render() {}
            project() {
              return { visible: false, x: 0, y: 0 };
            }
          },
        };
      if (id === "./backend") return { preview };
      return require(id);
    },
  });
  const source = readFileSync(
    new URL("../src/lunch/main.ts", import.meta.url),
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
test("UI: kiosk totals include one fee, reservation closes kiosk without placing order", async () => {
  const { dom, run, doc } = await game();
  assert.equal(doc.getElementById("kiosk-dialog")!.hasAttribute("open"), true);
  assert.equal(doc.querySelectorAll(".product").length, 7);
  assert.doesNotMatch(doc.getElementById("products")!.textContent!, /maison/);
  (doc.querySelector('[data-plus="kleine-puntzak"]') as HTMLElement).click();
  assert.match(doc.getElementById("cart-totals")!.textContent!, /5,00/);
  (doc.querySelector('[data-category="Burgers"]') as HTMLElement).click();
  assert.equal(doc.querySelectorAll(".product").length, 13);
  (doc.querySelector('[data-plus="bicky-burger"]') as HTMLElement).click();
  assert.match(doc.getElementById("cart-totals")!.textContent!, /9,80/);
  (doc.querySelector('[data-category="Sauzen"]') as HTMLElement).click();
  assert.equal(doc.querySelectorAll(".product").length, 21);
  (
    doc.querySelector('[data-plus="speciaal-curryketchup"]') as HTMLElement
  ).click();
  assert.match(doc.getElementById("cart-totals")!.textContent!, /12,00/);
  await run("action('reserve')");
  assert.equal(doc.getElementById("kiosk-dialog")!.hasAttribute("open"), false);
  assert.equal(doc.getElementById("order-count")!.textContent, "0");
  assert.match(doc.getElementById("receipt-total")!.textContent!, /12,00/);
  assert.equal(run("state.me.phase"), "walk-truck");
  assert.match(doc.getElementById("pickup-location")!.textContent!, /L0/);
  dom.window.close();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});
