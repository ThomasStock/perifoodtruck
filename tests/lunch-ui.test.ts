import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { preview } from "../src/lunch/backend";

async function game(auth?: {
  saved?: Record<string, string>;
  reject?: boolean;
}) {
  let autoSignIn = false;
  const dom = new JSDOM('<main id="app"></main>', {
    url: "http://localhost/?preview=kiosk",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  for (const [key, value] of Object.entries(auth?.saved ?? {}))
    window.localStorage.setItem(key, value);
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
    importMeta: {
      env: {
        DEV: true,
        ...(auth
          ? {
              VITE_CONVEX_URL: "https://test.convex.cloud",
              VITE_GOOGLE_CLIENT_ID: "test-client",
            }
          : {}),
      },
    },
    exports: {},
    require: (id: string) => {
      if (id.endsWith(".css")) return {};
      if (id === "./scene")
        return {
          LunchScene: class {
            mode = "yard";
            async load() {}
            render() {}
            setBurgers() {}
            project() {
              return { visible: false, x: 0, y: 0 };
            }
          },
        };
      if (id === "./backend")
        return {
          preview,
          connect: async (
            _url: string,
            _token: string,
            receive: Parameters<typeof preview>[0],
          ) => {
            if (auth?.reject) throw new Error("Rejected credential");
            return preview(receive);
          },
          googleButton: async (
            _element: unknown,
            _clientId: string,
            _callback: unknown,
            automatic: boolean,
          ) => {
            autoSignIn = automatic;
          },
        };
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
  if (!auth) await run("start()");
  return { dom, run, doc: window.document, autoSignIn };
}
test("UI: kiosk totals include one fee, reservation closes kiosk without placing order", async () => {
  const { dom, run, doc } = await game();
  assert.equal(doc.getElementById("kiosk-dialog")!.hasAttribute("open"), true);
  assert.equal(doc.querySelectorAll(".product").length, 7);
  assert.doesNotMatch(doc.getElementById("products")!.textContent!, /maison/);
  (doc.querySelector('[data-plus="kleine-puntzak"]') as HTMLElement).click();
  assert.match(doc.getElementById("cart-totals")!.textContent!, /5\.50/);
  (doc.querySelector('[data-category="Burgers"]') as HTMLElement).click();
  assert.equal(doc.querySelectorAll(".product").length, 13);
  (doc.querySelector('[data-plus="bicky-burger"]') as HTMLElement).click();
  assert.match(doc.getElementById("cart-totals")!.textContent!, /10\.30/);
  (doc.querySelector('[data-category="Sauces"]') as HTMLElement).click();
  assert.equal(doc.querySelectorAll(".product").length, 21);
  (
    doc.querySelector('[data-plus="speciaal-curryketchup"]') as HTMLElement
  ).click();
  assert.match(doc.getElementById("cart-totals")!.textContent!, /12\.50/);
  (doc.querySelector('[data-category="Snacks"]') as HTMLElement).click();
  assert.equal(doc.querySelectorAll(".promotion").length, 2);
  (doc.querySelector('[data-plus="frikandel"]') as HTMLElement).click();
  assert.match(
    doc.getElementById("cart-lines")!.textContent!,
    /1 paid \+ 1 free · 2 pieces/,
  );
  assert.match(doc.getElementById("cart-totals")!.textContent!, /15\.60/);
  await run("action('reserve')");
  assert.equal(doc.getElementById("kiosk-dialog")!.hasAttribute("open"), false);
  assert.equal(doc.getElementById("order-count")!.textContent, "0");
  assert.match(doc.getElementById("receipt-total")!.textContent!, /15\.60/);
  assert.equal(run("state.me.phase"), "walk-truck");
  assert.match(doc.getElementById("pickup-location")!.textContent!, /P0/);
  (doc.getElementById("cancel-order") as HTMLElement).click();
  assert.equal(doc.getElementById("cancel-dialog")!.hasAttribute("open"), true);
  assert.equal(
    run("state.me.phase"),
    "walk-truck",
    "opening confirmation does not cancel",
  );
  (doc.querySelector('[data-close="cancel-dialog"]') as HTMLElement).click();
  assert.equal(
    doc.getElementById("cancel-dialog")!.hasAttribute("open"),
    false,
  );
  assert.equal(run("state.me.lines.length"), 4);
  (doc.getElementById("cancel-order") as HTMLElement).click();
  await run("action('cancelOrder')");
  assert.equal(
    doc.getElementById("cancel-dialog")!.hasAttribute("open"),
    false,
  );
  assert.equal(run("state.me.phase"), "arrive");
  assert.equal(run("state.me.lines.length"), 0);
  assert.equal(
    (doc.getElementById("cancel-order") as HTMLElement).hidden,
    true,
  );
  dom.window.close();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

test("UI: successful Google sign-in survives reload; explicit sign-out forgets it", async () => {
  const first = await game({});
  const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
  await first.run(`start(${JSON.stringify(token)})`);
  assert.equal(first.doc.getElementById("login")!.hidden, true);
  const saved = Object.fromEntries(
    Object.entries(first.dom.window.localStorage),
  );
  const reloaded = await game({ saved });
  assert.equal(
    reloaded.doc.getElementById("login")!.hidden,
    true,
    "reload should restore sign-in",
  );
  await reloaded.run("signout()");
  const signedOut = await game({
    saved: Object.fromEntries(Object.entries(reloaded.dom.window.localStorage)),
  });
  assert.equal(signedOut.doc.getElementById("login")!.hidden, false);
  first.dom.window.close();
  reloaded.dom.window.close();
  signedOut.dom.window.close();
});

test("UI: expired credentials request returning-user sign-in instead of restoring stale auth", async () => {
  const token = `header.${Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url")}.signature`;
  const app = await game({
    saved: {
      "lunch-google-credential": token,
      "lunch-google-returning": "true",
    },
  });
  assert.equal(app.doc.getElementById("login")!.hidden, false);
  assert.equal(app.autoSignIn, true);
  assert.equal(
    app.dom.window.localStorage.getItem("lunch-google-credential"),
    null,
  );
  app.dom.window.close();
});
test("UI: rejected saved credentials leave sign-in available and clear the stale token", async () => {
  const token = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.signature`;
  const app = await game({
    reject: true,
    saved: {
      "lunch-google-credential": token,
      "lunch-google-returning": "true",
    },
  });
  assert.equal(app.doc.getElementById("login")!.hidden, false);
  assert.equal(app.autoSignIn, true);
  assert.equal(
    app.dom.window.localStorage.getItem("lunch-google-credential"),
    null,
  );
  app.dom.window.close();
});

test("UI: Space and mobile control stay turbo in both spectator and active driving", async () => {
  const { dom, run, doc } = await game();
  await run('state.me.phase = "complete"; paint()');
  assert.equal(doc.getElementById("space-label")!.textContent, "Turbo");
  assert.equal(
    doc.getElementById("brake-turbo")!.getAttribute("aria-label"),
    "Turbo",
  );
  assert.equal(
    (doc.getElementById("brake-turbo") as HTMLElement).dataset.key,
    " ",
  );
  await run('state.me.phase = "arrive"; paint()');
  assert.equal(doc.getElementById("space-label")!.textContent, "Turbo");
  assert.equal(
    doc.getElementById("brake-turbo")!.getAttribute("aria-label"),
    "Turbo",
  );
  dom.window.close();
});

test("hidden C hold starts an isolated spectator without Google or preview persistence", async () => {
  const { dom, run, doc } = await game({});
  await run(
    'window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "c" })); frame(performance.now() + 500)',
  );
  assert.equal(
    doc.getElementById("login")!.hidden,
    false,
    "short press stays on login",
  );
  await run(
    'window.dispatchEvent(new window.KeyboardEvent("keyup", { key: "c" })); frame(performance.now() + 1500)',
  );
  assert.equal(
    doc.getElementById("login")!.hidden,
    false,
    "releasing cancels the hold",
  );
  await run(
    'window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "c" })); frame(performance.now() + 1100)',
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(doc.getElementById("login")!.hidden, true);
  assert.equal(await run("state.me.phase"), "complete");
  assert.equal(doc.getElementById("receipt")!.hidden, true);
  assert.equal(dom.window.localStorage.getItem("lunch-kiosk-preview"), null);
  assert.equal(
    dom.window.localStorage.getItem("lunch-google-credential"),
    null,
  );
  await run("signout()");
  assert.equal(dom.window.localStorage.getItem("lunch-kiosk-preview"), null);
  dom.window.close();
});

test("kiosk action takes priority over burger controls", async () => {
  const { dom, run, doc } = await game();
  await run('state.me.phase = "walk-kiosk"; paint()');
  assert.equal(doc.getElementById("action-wrap")!.hidden, false);
  assert.equal(
    doc.getElementById("action-text")!.textContent,
    "Open lunch menu",
  );
  assert.equal(doc.getElementById("burger-controls")!.hidden, true);
  await run("state.me.driver = {x:0,z:0}; paint()");
  assert.equal(doc.getElementById("burger-controls")!.hidden, false);
  dom.window.close();
});
