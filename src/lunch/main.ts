import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./style.css";
import { canThrow, closestBurger } from "./burgers";
import { LunchScene } from "./scene";
import { connect, preview, googleButton, type Backend } from "./backend";
import {
  savedCredential,
  rememberCredential,
  returningUser,
  clearCredential,
  forgetSignIn,
} from "./auth-session";
import {
  CATEGORIES,
  MENU,
  euro,
  priceCart,
  type Category,
  type CartItem,
  type OrderLine,
} from "./menu";
import {
  drive,
  idleInput,
  interaction,
  objective,
  walking,
  PARKINGS,
  PARK,
  KIOSK,
  EXIT,
  type Snapshot,
} from "./model";
import { walkingJoystick } from "../walking-joystick";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
$("app").innerHTML = `<div id="world"></div>
<header><a class="brand" href="/"><img src="/brand/peripass.svg" alt="Peripass"><small>LUNCH RUN</small></a><div class="top-right"><span id="connection">Welcome to the yard</span><button id="orders-button">Orders <b id="order-count">0</b></button><button id="camera" aria-label="Switch camera" title="Camera (C)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5z"/><circle cx="12" cy="13" r="4"/></svg></button><button id="help" aria-label="How to play">?</button><details id="player-menu" hidden><summary aria-label="Player options" title="Player options">⋯</summary><div><button id="recover">Recover truck</button><button id="signout">Sign out</button></div></details></div></header>
<section id="login" class="welcome panel"><div class="eyebrow">YOUR LUNCH. YOUR DRIVE.</div><h1>Park your truck.<br><em>Pick your lunch.</em></h1><p>Order at the kiosk, collect your trailer and drive out of the yard to place your order.</p><div class="intro-steps"><span>01 · KIOSK</span><span>02 · PICKUP</span><span>03 · EXIT</span></div><div id="google-signin"></div><p id="setup-note">Loading the yard…</p><button id="preview" class="primary" hidden>Local preview ↗</button><small>Your Google email appears on your truck and trailer.</small></section>
<aside id="mission" class="panel" hidden><div id="step" class="eyebrow"></div><h2 id="objective"></h2><p id="hint"></p><ol class="progress"><li>Parking</li><li>Kiosk</li><li>Pickup</li><li>Exit</li></ol><div id="pickup-location"></div></aside>
<aside id="receipt" class="panel" hidden><button id="lunch-summary" aria-label="View your lunch details"><span>Your lunch</span><strong id="lunch-summary-total"></strong><span aria-hidden="true">⌄</span></button><div class="eyebrow">YOUR LUNCH</div><h3 id="receipt-status">Nothing ordered yet</h3><div id="receipt-lines"></div><div id="receipt-total"></div><p id="receipt-note"></p><button id="cancel-order" class="cancel-order" hidden>Cancel order</button><button id="start-over" class="cancel-order">Start over</button></aside>
<button id="map-button" class="map panel" hidden aria-label="Yard overview"><canvas id="map" width="320" height="330"></canvas></button>
<div id="target-label" hidden></div><div id="action-wrap" hidden><button id="action" class="primary"><kbd>E</kbd><span id="action-text"></span></button></div>
<div id="toast" role="status" aria-live="polite" hidden></div>
<footer id="controls" hidden><div><span><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> Drive & walk</span><span><kbd>SPACE</kbd> <span id="space-label">Turbo</span></span><span><kbd>SHIFT</kbd> Precision</span></div><strong><b id="speed">0</b><small>KM/H</small></strong></footer>
<div id="touch" hidden><div><button data-key="a" aria-label="Left">←</button><button data-key="d" aria-label="Right">→</button></div><div><button data-key="s" aria-label="Reverse">↓</button><button data-key="w" aria-label="Forward">↑</button><button id="brake-turbo" data-key=" " aria-label="Turbo" title="Hold for turbo">⚡</button></div></div>
<div id="burger-controls" hidden><button data-key=" " aria-label="Walking turbo" title="Hold for turbo">⚡ Turbo</button><button id="throw-burger">Throw burger</button><button id="clean-burger" hidden>Clean up <kbd>R</kbd></button><small>Mouse to aim · Click to throw</small></div><div id="walk-joystick" class="walking-joystick" aria-label="Walk" hidden><span class="joystick-knob"></span></div>
<dialog id="kiosk-dialog"><div class="kiosk-header"><div><div class="eyebrow">PERIPASS · LUNCH KIOSK</div><h2>What are you craving?</h2></div><button id="close-kiosk" aria-label="Close kiosk">×</button></div><div class="kiosk-layout"><section class="menu"><nav aria-label="Menu categories">${CATEGORIES.map((c) => `<button data-category="${c}" class="category">${c}</button>`).join("")}</nav><div id="products"></div></section><aside class="checkout"><div class="eyebrow">YOUR ORDER</div><h3>Good food ahead.</h3><div id="cart-lines"></div><div id="cart-totals"></div><p id="cart-error" role="alert"></p><button id="reserve" class="primary" disabled>Confirm & collect trailer ↗</button><small>Your order is only placed when you drive your trailer out of the yard.</small></aside></div></dialog>
<dialog id="lunch-details"><div class="dialog-heading"><h2>Your lunch</h2><button data-close="lunch-details" aria-label="Close lunch details">×</button></div><div id="lunch-details-content"></div><button id="details-cancel" class="cancel-order">Cancel order</button><button id="details-reset" class="cancel-order">Start over</button></dialog><dialog id="reset-dialog"><div class="dialog-heading"><h2>Start over?</h2></div><p>This clears your basket and any placed order, releases your trailer, and returns you to the starting point. You stay signed in.</p><div class="cancel-actions"><button id="confirm-reset" class="primary">Yes, start over</button><button data-close="reset-dialog">Keep playing</button></div></dialog><dialog id="cancel-dialog"><div class="dialog-heading"><h2>Cancel your order?</h2></div><p>Your lunch will be removed from the order list and your trailer released. You will return to the starting point and can order again.</p><div class="cancel-actions"><button id="confirm-cancel" class="primary">Yes, cancel order</button><button data-close="cancel-dialog">Keep my order</button></div></dialog>
<dialog id="orders-dialog"><div class="dialog-heading"><div><div class="eyebrow">LUNCH TOGETHER</div><h2>Placed orders</h2></div><button data-close="orders-dialog" aria-label="Close orders">×</button></div><p class="muted">Only trailers that have left the yard count as placed orders.</p><div id="orders-content"></div></dialog>
<dialog id="help-dialog"><div class="dialog-heading"><h2>How your lunch run works</h2><button data-close="help-dialog" aria-label="Close help">×</button></div><ol><li><b>Park in P02.</b> You start without a trailer. Stop and press E to get out.</li><li><b>Walk to the kiosk.</b> Choose fries, burgers, snacks and sauces. Your total includes a €1 order fee.</li><li><b>Collect your trailer.</b> Confirm at the kiosk, get back in and follow the marker to your name. The gate is open. Back gently towards your trailer and press E to attach. A slight angle is fine.</li><li><b>Drive through EXIT.</b> Use the opening in the right-hand fence. Your order is placed when your entire trailer is outside.</li></ol><p>Other players and their trailers are ghosts: visible, but they never block you. After placing your order, you can keep driving as a ghost. Hold Space or the mobile ⚡ button while driving for turbo.</p></dialog>`;
let scene: LunchScene,
  backend: Backend | null = null,
  state: Snapshot | null = null;
let loaded = false,
  busy = false,
  previewMode = false,
  restorePose = true,
  category: Category = "Fries",
  cart: CartItem[] = [];
let moving: Promise<void> | null = null,
  lastSend = 0,
  sentPose = "",
  lastPaint = 0,
  lastReceipt = "",
  toastTimer: ReturnType<typeof setTimeout>;
const keys = new Set<string>(),
  joystick = walkingJoystick($("walk-joystick"));
function toast(s: string) {
  $("toast").textContent = s;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 7000);
}
function message(e: unknown) {
  return e instanceof Error
    ? e.message.replace(/\[CONVEX[^\]]*\]\s*/g, "")
    : "Something went wrong. Please try again.";
}
function receive(next: Snapshot) {
  const old = state?.me.phase;
  if (state && !restorePose && next.me.phase === old) {
    next.me.truck = { ...state.me.truck };
    next.me.driver = { ...state.me.driver };
  }
  state = next;
  restorePose = false;
  if (old && old !== next.me.phase) {
    keys.clear();
    joystick.reset();
    if (next.me.phase === "walk-truck")
      toast(
        `Your trailer is ready at P0${next.me.parking! + 1}. Get back in your truck.`,
      );
    if (next.me.phase === "complete")
      toast(
        "Order placed! Your entire trailer has cleared the exit. Enjoy your lunch!",
      );
  }
  const dialog = $<HTMLDialogElement>("kiosk-dialog");
  if (next.me.phase === "kiosk" && !dialog.open) {
    renderMenu();
    dialog.showModal();
  }
  if (next.me.phase !== "kiosk" && dialog.open) dialog.close();
  $("connection").textContent = previewMode ? "● Local preview" : "● Live yard";
  paint();
}
async function start(token?: string) {
  if (!loaded || busy) return;
  busy = true;
  $("setup-note").textContent = "Signing in…";
  try {
    backend?.close();
    backend = null;
    state = null;
    restorePose = true;
    previewMode = !token;
    lastReceipt = "";
    backend = token
      ? await connect(import.meta.env.VITE_CONVEX_URL, token, receive, (e) => {
          toast(message(e));
          signout(false);
        })
      : preview(
          receive,
          import.meta.env.DEV &&
            new URLSearchParams(window.location.search).get("preview") ===
              "kiosk",
        );
    try {
      cart = JSON.parse(
        localStorage.getItem(`lunch-draft:${state!.me.email}`) ?? "[]",
      );
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
    }
    if (token) rememberCredential(token);
    $("login").hidden = true;
    for (const id of [
      "mission",
      "receipt",
      "map-button",
      "controls",
      "player-menu",
    ])
      $(id).hidden = false;
    scene.mode = "follow";
    paint();
    if ($<HTMLDialogElement>("kiosk-dialog").open) renderMenu();
  } catch (e) {
    if (token) clearCredential();
    $("setup-note").textContent = message(e);
  } finally {
    busy = false;
    if ($<HTMLDialogElement>("kiosk-dialog").open) renderCart();
  }
}
async function flush() {
  if (moving) await moving;
  if (!state || !backend) return;
  const truck = { ...state.me.truck },
    driver = { ...state.me.driver };
  moving = backend.move(truck, driver);
  try {
    await moving;
    sentPose = JSON.stringify([truck, driver]);
  } finally {
    moving = null;
    lastSend = performance.now();
  }
}
async function action(
  name: "interact" | "reserve" | "leaveKiosk" | "recover" | "cancelOrder",
) {
  if (!state || !backend || busy) return;
  busy = true;
  keys.clear();
  joystick.reset();
  paint();
  try {
    await flush();
    if (name === "recover" || name === "cancelOrder") restorePose = true;
    await backend.action(name, name === "reserve" ? cart : undefined);
    if (name === "cancelOrder") {
      cart = [];
      try {
        localStorage.removeItem(`lunch-draft:${state!.me.email}`);
      } catch {}
      $<HTMLDialogElement>("cancel-dialog").close();
      const reset = $<HTMLDialogElement>("reset-dialog");
      toast(
        reset.open
          ? "Back at the start. Ready for a new lunch run."
          : "Order cancelled. You can start a new lunch run.",
      );
      reset.close();
    }
  } catch (e) {
    restorePose = false;
    toast(message(e));
    if (name === "reserve") $("cart-error").textContent = message(e);
  } finally {
    busy = false;
    paint();
    $<HTMLButtonElement>("reserve").disabled = cart.length === 0;
  }
}
function signout(explicit = true) {
  clearCredential();
  if (explicit) forgetSignIn();
  keys.clear();
  joystick.reset();
  backend?.close();
  backend = null;
  state = null;
  if (explicit) window.google?.accounts.id.disableAutoSelect();
  for (const d of document.querySelectorAll("dialog")) d.close();
  $("login").hidden = false;
  for (const id of [
    "mission",
    "player-menu",
    "receipt",
    "map-button",
    "controls",
    "touch",
    "burger-controls",
    "walk-joystick",
    "action-wrap",
    "target-label",
  ])
    $(id).hidden = true;
  scene.mode = "yard";
  $("setup-note").textContent = "Sign in to continue.";
}
function lineHtml(lines: OrderLine[], editable = false) {
  return lines
    .map(
      (l) =>
        `<div class="order-line"><div><b>${esc(MENU.find((p) => p.id === l.productId)?.name ?? l.name)}</b><small>${euro(l.unitCents)} per ${l.freeQuantity ? "pair" : "piece"}</small>${l.freeQuantity ? `<small class="deal-detail">${l.quantity} paid + ${l.freeQuantity} free · ${l.quantity + l.freeQuantity} pieces</small>` : ""}</div>${editable ? `<div class="quantity"><button data-minus="${l.productId}" aria-label="Fewer ${esc(l.name)}">−</button><span>${l.quantity}</span><button data-plus="${l.productId}" aria-label="More ${esc(l.name)}">+</button></div>` : `<span>× ${l.quantity + (l.freeQuantity ?? 0)}</span>`}<strong>${euro(l.unitCents * l.quantity)}</strong></div>`,
    )
    .join("");
}
function totalsHtml(subtotal: number, fee: number, total: number) {
  return `<div class="totals"><div><span>Subtotal</span><b>${euro(subtotal)}</b></div><div><span>Order fee</span><b>${euro(fee)}</b></div><div class="grand-total"><span>Total</span><b>${euro(total)}</b></div></div>`;
}
function renderMenu() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-category]")
    .forEach((b) => {
      b.classList.toggle("active", b.dataset.category === category);
      b.setAttribute("aria-pressed", String(b.dataset.category === category));
    });
  const products = MENU.filter((p) => p.category === category);
  $("products").innerHTML = products.length
    ? products
        .map((p) => {
          let image = "";
          if (p.photo) {
            const {
              size: [sw, sh],
              crop: [x, y, w, h],
              source,
            } = p.photo;
            image = `<div class="menu-photo" role="img" aria-label="${esc(p.name)}" style="background-image:url('${source}');background-size:${(sw / w) * 100}% ${(sh / h) * 100}%;background-position:${(x / (sw - w)) * 100}% ${(y / (sh - h)) * 100}%"></div>`;
          }
          const quantity =
            cart.find((l) => l.productId === p.id)?.quantity ?? 0;
          return `<button type="button" class="product" data-plus="${p.id}" aria-label="Add ${esc(p.name)}"><div class="product-copy"><h3>${esc(p.name)}</h3><b>${euro(p.cents)}</b>${p.promotion ? '<span class="promotion">1 + 1 free</span><small class="deal-detail">2 pieces for this price</small>' : ""}${p.description ? `<p class="product-description">${esc(p.description)}</p>` : ""}${quantity ? `<span class="in-cart">${quantity * (p.promotion ? 2 : 1)} in your basket</span>` : ""}</div>${image}</button>`;
        })
        .join("")
    : '<div class="menu-empty"><h3>No products</h3><p>Choose another category.</p></div>';
  renderCart();
}
function renderCart() {
  let price: {
    lines: OrderLine[];
    subtotalCents: number;
    feeCents: number;
    totalCents: number;
  } = { lines: [], subtotalCents: 0, feeCents: 0, totalCents: 0 };
  try {
    if (cart.length) price = priceCart(cart);
    $("cart-error").textContent = "";
  } catch (e) {
    $("cart-error").textContent = message(e);
  }
  $("cart-lines").innerHTML = price.lines.length
    ? lineHtml(price.lines, true)
    : '<p class="empty">Your basket is empty.<br>Pick something tasty from the menu.</p>';
  $("cart-totals").innerHTML = totalsHtml(
    price.subtotalCents,
    price.feeCents,
    price.totalCents,
  );
  $<HTMLButtonElement>("reserve").disabled = busy || !price.lines.length;
}
function changeCart(id: string, delta: number) {
  if (state?.me.phase !== "kiosk" || busy || !MENU.some((p) => p.id === id))
    return;
  const next = cart.map((l) => ({ ...l })),
    line = next.find((l) => l.productId === id);
  if (line) line.quantity += delta;
  else if (delta > 0) next.push({ productId: id, quantity: 1 });
  const filtered = next.filter((l) => l.quantity > 0);
  try {
    if (filtered.length) priceCart(filtered);
    cart = filtered;
    try {
      localStorage.setItem(
        `lunch-draft:${state.me.email}`,
        JSON.stringify(cart),
      );
    } catch {}
    renderMenu();
  } catch (e) {
    $("cart-error").textContent = message(e);
  }
}
function paint() {
  if (!state) return;
  const p = state.me,
    obj = objective(p),
    prompt = interaction(p);
  $("cancel-order").hidden = !p.lines.length;
  $<HTMLButtonElement>("cancel-order").disabled = busy;
  $<HTMLButtonElement>("confirm-cancel").disabled = busy;
  $<HTMLButtonElement>("start-over").disabled = busy;
  $<HTMLButtonElement>("confirm-reset").disabled = busy;
  $("step").textContent = `0${obj.step} / LUNCH RUN`;
  $("objective").textContent = obj.title;
  $("hint").textContent = obj.detail;
  $("mission").dataset.brief = {
    arrive: "Park in P02 · Press E to get out",
    "walk-kiosk": "Follow the arrows to the kiosk",
    kiosk: "Choose your lunch",
    "walk-truck": "Return to your truck · Press E",
    pickup: `Trailer P0${(p.parking ?? 0) + 1} · Back nearby, press E`,
    exit: "Bring your trailer into the marked exit",
    complete: "Order saved · Free to explore",
  }[p.phase];
  $("lunch-summary-total").textContent = p.lines.length
    ? euro(p.totalCents)
    : "View";
  document.querySelectorAll(".progress li").forEach((li, i) => {
    li.classList.toggle("done", i < obj.step - 1 || p.phase === "complete");
    li.classList.toggle("current", i === obj.step - 1);
  });
  $("pickup-location").textContent =
    p.parking !== null
      ? `Your trailer · P0${p.parking + 1}`
      : p.phase === "complete"
        ? "✓ Order placed"
        : "Follow the ground arrows to your next stop.";
  $("action-wrap").hidden = !prompt;
  $("action-text").textContent = prompt;
  $<HTMLButtonElement>("action").disabled = busy;
  const walk = walking(p);
  $("burger-controls").hidden = !canThrow(p);
  $("world").classList.toggle("burger-aim", canThrow(p));
  $("clean-burger").hidden = !closestBurger(p.driver, state.burgers ?? []);
  $("touch").hidden = walk;
  $("walk-joystick").hidden = !walk || p.phase === "kiosk";
  $("speed").textContent = String(Math.round(Math.abs(p.truck.speed) * 3.6));
  const signature = JSON.stringify([
    p.phase,
    p.lines,
    p.totalCents,
    state.orders,
  ]);
  if (signature !== lastReceipt) {
    lastReceipt = signature;
    $("receipt-status").textContent =
      p.phase === "complete"
        ? "✓ Placed"
        : p.lines.length
          ? "Ready for pickup"
          : "Order at the kiosk";
    $("receipt-lines").innerHTML = p.lines.length
      ? lineHtml(p.lines)
      : '<p class="empty">Park and walk to the kiosk to choose your lunch.</p>';
    $("receipt-total").innerHTML = p.lines.length
      ? totalsHtml(p.subtotalCents, p.feeCents, p.totalCents)
      : "";
    $("receipt-note").textContent =
      p.phase === "complete"
        ? "Your order is saved. Enjoy your lunch!"
        : p.lines.length
          ? "Not placed yet. Drive your trailer through EXIT."
          : "Fries · Burgers · Snacks · Sauces";
    $("order-count").textContent = String(state.orders.length);
    const counts = new Map<
      string,
      { name: string; quantity: number; free: number }
    >();
    for (const o of state.orders)
      for (const l of o.lines) {
        const row = counts.get(l.productId) ?? {
          name: MENU.find((p) => p.id === l.productId)?.name ?? l.name,
          quantity: 0,
          free: 0,
        };
        row.quantity += l.quantity;
        row.free += l.freeQuantity ?? 0;
        counts.set(l.productId, row);
      }
    $("orders-content").innerHTML = state.orders.length
      ? `<section class="order-totals"><h3>Items to order</h3>${[...counts.values()].map((l) => `<div><span>${esc(l.name)}</span><b>× ${l.quantity + l.free}${l.free ? ` <small>(${l.quantity} paid + ${l.free} free)</small>` : ""}</b></div>`).join("")}<div><span>Order fee · ${state.orders.length} orders</span><b>${euro(state.orders.reduce((sum, o) => sum + o.feeCents, 0))}</b></div><div class="grand-total"><span>Total</span><b>${euro(state.orders.reduce((sum, o) => sum + o.totalCents, 0))}</b></div></section>${state.orders.map((o) => `<section class="person-order ${o.email === p.email ? "you" : ""}"><h3>${esc(o.email)} ${o.email === p.email ? "<small>YOU</small>" : ""}</h3>${lineHtml(o.lines)}${totalsHtml(o.subtotalCents, o.feeCents, o.totalCents)}</section>`).join("")}`
      : '<div class="empty">No orders placed yet.<br>Drive your trailer through the exit to add your lunch.</div>';
  }
  $("target-label").hidden = true;
  drawMap();
}
function drawMap() {
  if (!state) return;
  const c = $<HTMLCanvasElement>("map").getContext("2d")!;
  c.clearRect(0, 0, 320, 330);
  const x = (n: number) => 125 + n * 2,
    z = (n: number) => 135 + n * 2;
  c.fillStyle = "#e2ebe5";
  c.fillRect(x(-52), z(-44), 208, 250);
  c.fillStyle = "#658e85";
  c.fillRect(x(-50), z(-55), 200, 22);
  c.strokeStyle = "#a4b7ac";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x(-52), z(12));
  c.lineTo(x(12), z(12));
  c.moveTo(x(24), z(12));
  c.lineTo(x(52), z(12));
  c.stroke();
  for (const b of PARKINGS) {
    c.fillStyle = b.id === state.me.parking ? "#00a990" : "#adbbb1";
    c.fillRect(x(b.x) - 4, z(b.z - 10), 8, 22);
    c.fillStyle = "#234e44";
    c.font = "10px system-ui";
    c.textAlign = "center";
  }
  c.fillStyle = "#d0a854";
  c.fillRect(x(PARK.x) - 6, z(PARK.z) - 12, 12, 26);
  c.fillStyle = "#244e42";
  c.fillRect(x(KIOSK.x) - 3, z(KIOSK.z) - 3, 6, 6);

  c.fillStyle = "#00a990";
  c.fillRect(x(EXIT.x), z(EXIT.z) - 12, 34, 24);
  c.fillStyle = "#fff";

  for (const p of [
    ...state.players.filter(
      (p) => p.email !== state!.me.email && Date.now() - p.updatedAt < 15000,
    ),
    state.me,
  ]) {
    const actor = walking(p) ? p.driver : p.truck;
    c.beginPath();
    c.arc(x(actor.x), z(actor.z), 4, 0, Math.PI * 2);
    c.fillStyle = p === state.me ? "#154c42" : "#ffffff";
    c.strokeStyle = "#154c42";
    c.fill();
    c.stroke();
  }
}
let burgerBusy = false;
let throwDirection = { x: 0, z: -1 };
async function burgerAction(target?: { x: number; z: number }) {
  if (
    !state ||
    !backend ||
    !canThrow(state.me) ||
    burgerBusy ||
    document.querySelector("dialog[open]")
  )
    return;
  burgerBusy = true;
  try {
    await flush();
    if (target) await backend.throwBurger(target);
    else await backend.cleanBurger();
  } catch (e) {
    toast(message(e));
  } finally {
    burgerBusy = false;
  }
}
$("throw-burger").onclick = () => {
  if (state)
    void burgerAction({
      x: state.me.driver.x + throwDirection.x * 7,
      z: state.me.driver.z + throwDirection.z * 7,
    });
};
$("clean-burger").onclick = () => void burgerAction();
$("world").addEventListener("pointerdown", (event) => {
  if (
    event.pointerType !== "mouse" ||
    event.button !== 0 ||
    !state ||
    !canThrow(state.me)
  )
    return;
  const target = scene.aimAt(event.clientX, event.clientY);
  if (target) void burgerAction(target);
});
$("preview").onclick = () => void start();
$("signout").onclick = () => {
  $<HTMLDetailsElement>("player-menu").open = false;
  signout();
};
$("action").onclick = () => void action("interact");
$("lunch-summary").onclick = () => {
  keys.clear();
  joystick.reset();
  $("lunch-details-content").innerHTML =
    `<h3>${$("receipt-status").textContent}</h3>${$("receipt-lines").innerHTML}${$("receipt-total").innerHTML}<p>${$("receipt-note").textContent}</p>`;
  $("details-cancel").hidden = !state?.me.lines.length;
  $<HTMLDialogElement>("lunch-details").showModal();
};
$("details-cancel").onclick = () => {
  $<HTMLDialogElement>("lunch-details").close();
  $("cancel-order").click();
};
$("cancel-order").onclick = () => {
  keys.clear();
  $<HTMLDialogElement>("cancel-dialog").showModal();
};
$("start-over").onclick = () => {
  keys.clear();
  joystick.reset();
  $<HTMLDialogElement>("lunch-details").close();
  $<HTMLDialogElement>("reset-dialog").showModal();
};
$("details-reset").onclick = () => $("start-over").click();
$("confirm-reset").onclick = () => void action("cancelOrder");
$("confirm-cancel").onclick = () => void action("cancelOrder");
$("recover").onclick = () => {
  $<HTMLDetailsElement>("player-menu").open = false;
  void action("recover");
};
$("close-kiosk").onclick = () => void action("leaveKiosk");
$("reserve").onclick = () => void action("reserve");
$<HTMLDialogElement>("kiosk-dialog").addEventListener("cancel", (e) => {
  e.preventDefault();
  void action("leaveKiosk");
});
$("camera").onclick = () => {
  scene.mode =
    scene.mode === "follow"
      ? "overhead"
      : scene.mode === "overhead"
        ? "yard"
        : "follow";
};
$("map-button").onclick = () => {
  scene.mode = scene.mode === "yard" ? "follow" : "yard";
};
$("orders-button").onclick = () => {
  keys.clear();
  $<HTMLDialogElement>("orders-dialog").showModal();
};
$("help").onclick = () => {
  keys.clear();
  $<HTMLDialogElement>("help-dialog").showModal();
};
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("button");
  if (!b) return;
  if (b.dataset.category) {
    category = b.dataset.category as Category;
    renderMenu();
    $("products").scrollTop = 0;
  }
  if (b.dataset.plus) changeCart(b.dataset.plus, 1);
  if (b.dataset.minus) changeCart(b.dataset.minus, -1);
  if (b.dataset.close) $<HTMLDialogElement>(b.dataset.close).close();
});
const key = (e: KeyboardEvent) =>
  ({ ArrowUp: "w", ArrowDown: "s", ArrowLeft: "a", ArrowRight: "d" })[e.key] ??
  e.key.toLowerCase();
window.addEventListener("keydown", (e) => {
  if (!state || document.querySelector("dialog[open]")) return;
  const k = key(e);
  if (["w", "a", "s", "d", " ", "shift", "e", "c", "r"].includes(k))
    e.preventDefault();
  keys.add(k);
  if (!e.repeat && k === "e" && interaction(state.me)) void action("interact");
  if (!e.repeat && k === "r") void burgerAction();
  if (!e.repeat && k === "c") $("camera").click();
});
window.addEventListener("keyup", (e) => keys.delete(key(e)));
window.addEventListener("blur", () => {
  keys.clear();
  joystick.reset();
});
document.addEventListener("visibilitychange", () => {
  keys.clear();
  joystick.reset();
});
document.querySelectorAll<HTMLElement>("[data-key]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    keys.add(b.dataset.key!);
    b.setPointerCapture(e.pointerId);
  };
  b.onpointerup =
    b.onpointercancel =
    b.onlostpointercapture =
      () => keys.delete(b.dataset.key!);
});
let last = performance.now(),
  accumulator = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const input: import("./model").Input = idleInput();
  if (state && !busy) {
    if (!document.querySelector("dialog[open]")) {
      input.throttle = Number(keys.has("w")) - Number(keys.has("s"));
      input.steer = Number(keys.has("a")) - Number(keys.has("d"));
      input.turbo = keys.has(" ");
      input.precision = keys.has("shift");
      input.walkX = -input.steer;
      input.walkZ = -input.throttle;
      if (Math.hypot(joystick.value.x, joystick.value.z) > 0) {
        input.walkX = joystick.value.x;
        input.walkZ = joystick.value.z;
      }
      if (scene.mode !== "overhead") {
        const x = input.walkX,
          z = input.walkZ;
        input.walkX = x * 0.81 + z * 0.59;
        input.walkZ = -x * 0.59 + z * 0.81;
      }
      const directionLength = Math.hypot(input.walkX, input.walkZ);
      if (walking(state.me) && directionLength > 0.1)
        throwDirection = {
          x: input.walkX / directionLength,
          z: input.walkZ / directionLength,
        };
    } else input.brake = true;
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      drive(state.me, input, 1 / 60);
      accumulator -= 1 / 60;
    }
    if (
      now - lastSend > 120 &&
      !moving &&
      backend &&
      (now - lastSend > 3000 ||
        JSON.stringify([state.me.truck, state.me.driver]) !== sentPose)
    )
      void flush().catch((e) => {
        toast(message(e));
        signout(false);
      });
    if (now - lastPaint > 100) {
      paint();
      lastPaint = now;
    }
  }
  scene.setBurgers(state?.burgers ?? []);
  scene.render(state?.me ?? null, state?.players ?? [], input, dt);
  requestAnimationFrame(frame);
}
async function boot() {
  try {
    scene = new LunchScene($("world"));
    await scene.load();
    loaded = true;
    requestAnimationFrame(frame);
  } catch (e) {
    $("setup-note").textContent =
      "The 3D yard could not load. Refresh the page.";
    console.error(e);
    return;
  }
  const configured =
    !!import.meta.env.VITE_CONVEX_URL &&
    !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  $("setup-note").textContent = configured
    ? "Sign in for your lunch run."
    : "Google sign-in is not configured yet.";
  $("preview").hidden = !(
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW === "true"
  );
  if (configured) {
    const saved = savedCredential();
    if (saved) await start(saved);
    try {
      await googleButton(
        $("google-signin"),
        import.meta.env.VITE_GOOGLE_CLIENT_ID,
        (token) => void start(token),
        !$("login").hidden && returningUser(),
      );
    } catch (e) {
      if (!$("login").hidden) $("setup-note").textContent = message(e);
    }
  }
}
void boot();
