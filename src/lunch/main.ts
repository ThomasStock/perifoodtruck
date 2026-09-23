import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./style.css";
import { LunchScene } from "./scene";
import { connect, preview, googleButton, type Backend } from "./backend";
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
<header><a class="brand" href="/"><img src="/brand/peripass.svg" alt="Peripass"><small>LUNCH RUN</small></a><div class="top-right"><span id="connection">Welkom op de yard</span><button id="orders-button">Bestellingen <b id="order-count">0</b></button><button id="camera" aria-label="Camera wisselen" title="Camera (C)">▣</button><button id="help" aria-label="Speluitleg">?</button></div></header>
<section id="login" class="welcome panel"><div class="eyebrow">JE LUNCH. JOUW RIT.</div><h1>Even parkeren.<br><em>Lekker bestellen.</em></h1><p>Bestel aan de kiosk, haal je eigen trailer op en rijd de yard uit. Dan is je lunch besteld.</p><div class="intro-steps"><span>01 · KIOSK</span><span>02 · OPHALEN</span><span>03 · UITRIJDEN</span></div><div id="google-signin"></div><p id="setup-note">De yard wordt geladen…</p><button id="preview" class="primary" hidden>Lokale preview ↗</button><small>Je Google-email verschijnt op je truck en trailer.</small></section>
<aside id="mission" class="panel" hidden><div id="step" class="eyebrow"></div><h2 id="objective"></h2><p id="hint"></p><ol class="progress"><li>Parkeren</li><li>Kiosk</li><li>Ophalen</li><li>Uitrijden</li></ol><div id="pickup-location"></div></aside>
<aside id="receipt" class="panel" hidden><div class="eyebrow">JOUW LUNCH</div><h3 id="receipt-status">Nog niets besteld</h3><div id="receipt-lines"></div><div id="receipt-total"></div><p id="receipt-note"></p></aside>
<button id="map-button" class="map panel" hidden aria-label="Yardoverzicht"><div class="eyebrow">YARDOVERZICHT ↗</div><canvas id="map" width="320" height="330"></canvas><small>● JIJ <span>○ GHOSTS</span></small></button>
<div id="target-label" hidden></div><div id="action-wrap" hidden><button id="action" class="primary"><kbd>E</kbd><span id="action-text"></span></button></div>
<div id="toast" role="status" aria-live="polite" hidden></div>
<footer id="controls" hidden><div><span><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> Rijden & lopen</span><span><kbd>SPACE</kbd> Rem</span><span><kbd>SHIFT</kbd> Precisie</span><button id="recover">Truck herstellen</button><button id="signout">Afmelden</button></div><strong><b id="speed">0</b><small>KM/H</small></strong></footer>
<div id="touch" hidden><div><button data-key="a" aria-label="Links">←</button><button data-key="d" aria-label="Rechts">→</button></div><div><button data-key="s" aria-label="Achteruit">↓</button><button data-key="w" aria-label="Vooruit">↑</button><button data-key=" " aria-label="Remmen">■</button></div></div>
<div id="walk-joystick" class="walking-joystick" aria-label="Lopen" hidden><span class="joystick-knob"></span></div>
<dialog id="kiosk-dialog"><div class="kiosk-header"><div><div class="eyebrow">PERIPASS · LUNCHKIOSK</div><h2>Waar heb je zin in?</h2></div><button id="close-kiosk" aria-label="Kiosk sluiten">×</button></div><div class="kiosk-layout"><section class="menu"><nav aria-label="Menucategorieën">${CATEGORIES.map((c) => `<button data-category="${c}" class="category">${c}</button>`).join("")}</nav><div id="products"></div></section><aside class="checkout"><div class="eyebrow">JOUW BESTELLING</div><h3>Een goede keuze.</h3><div id="cart-lines"></div><div id="cart-totals"></div><p id="cart-error" role="alert"></p><button id="reserve" class="primary" disabled>Bevestig & haal trailer op ↗</button><small>Je bestelling wordt pas geplaatst als je met je trailer de yard uitrijdt.</small></aside></div></dialog>
<dialog id="orders-dialog"><div class="dialog-heading"><div><div class="eyebrow">SAMEN AAN TAFEL</div><h2>Geplaatste bestellingen</h2></div><button data-close="orders-dialog" aria-label="Bestellingen sluiten">×</button></div><p class="muted">Alleen trailers die de yard hebben verlaten tellen mee.</p><div id="orders-content"></div></dialog>
<dialog id="help-dialog"><div class="dialog-heading"><h2>Zo werkt je lunchrit</h2><button data-close="help-dialog" aria-label="Uitleg sluiten">×</button></div><ol><li><b>Parkeer op P02.</b> Je begint zonder trailer. Stop en druk E om uit te stappen.</li><li><b>Loop naar de kiosk.</b> Kies frieten, burgers en snacks. Je ziet het totaal inclusief €1 bestelkosten.</li><li><b>Haal jouw trailer op.</b> Bevestig aan de kiosk, stap weer in en volg de markering naar je eigen naam. De slagboom is open. Richt je cabine naar het zuiden, rijd achteruit naar de trailer en druk E.</li><li><b>Rijd door UITRIT.</b> Ga door de opening in het rechterhek. Pas als je hele trailer buiten is, wordt de bestelling geplaatst.</li></ol><p>Andere spelers en hun trailers zijn ghosts: zichtbaar, maar ze blokkeren je niet. Na het plaatsen kun je zelf als ghost blijven rijden.</p></dialog>`;
let scene: LunchScene,
  backend: Backend | null = null,
  state: Snapshot | null = null;
let loaded = false,
  busy = false,
  previewMode = false,
  restorePose = true,
  category: Category = "Frieten",
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
    : "Er ging iets mis. Probeer opnieuw.";
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
        `Je trailer staat klaar bij L0${next.me.parking! + 1}. Stap weer in je truck.`,
      );
    if (next.me.phase === "complete")
      toast(
        "Bestelling geplaatst! Je hele trailer is door de uitgang. Smakelijk!",
      );
  }
  const dialog = $<HTMLDialogElement>("kiosk-dialog");
  if (next.me.phase === "kiosk" && !dialog.open) {
    renderMenu();
    dialog.showModal();
  }
  if (next.me.phase !== "kiosk" && dialog.open) dialog.close();
  $("connection").textContent = previewMode
    ? "● Lokale preview"
    : "● Live yard";
  paint();
}
async function start(token?: string) {
  if (!loaded || busy) return;
  busy = true;
  $("setup-note").textContent = "Aanmelden…";
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
          signout();
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
    $("login").hidden = true;
    for (const id of ["mission", "receipt", "map-button", "controls"])
      $(id).hidden = false;
    scene.mode = "follow";
    paint();
    if ($<HTMLDialogElement>("kiosk-dialog").open) renderMenu();
  } catch (e) {
    $("setup-note").textContent = message(e);
  } finally {
    busy = false;
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
async function action(name: "interact" | "reserve" | "leaveKiosk" | "recover") {
  if (!state || !backend || busy) return;
  busy = true;
  keys.clear();
  joystick.reset();
  paint();
  try {
    await flush();
    if (name === "recover") restorePose = true;
    await backend.action(name, name === "reserve" ? cart : undefined);
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
function signout() {
  keys.clear();
  joystick.reset();
  backend?.close();
  backend = null;
  state = null;
  window.google?.accounts.id.disableAutoSelect();
  for (const d of document.querySelectorAll("dialog")) d.close();
  $("login").hidden = false;
  for (const id of [
    "mission",
    "receipt",
    "map-button",
    "controls",
    "touch",
    "walk-joystick",
    "action-wrap",
    "target-label",
  ])
    $(id).hidden = true;
  scene.mode = "yard";
  $("setup-note").textContent = "Meld je aan om verder te gaan.";
}
function lineHtml(lines: OrderLine[], editable = false) {
  return lines
    .map(
      (l) =>
        `<div class="order-line"><div><b>${esc(l.name)}</b><small>${euro(l.unitCents)} per stuk</small></div>${editable ? `<div class="quantity"><button data-minus="${l.productId}" aria-label="Minder ${esc(l.name)}">−</button><span>${l.quantity}</span><button data-plus="${l.productId}" aria-label="Meer ${esc(l.name)}">+</button></div>` : `<span>× ${l.quantity}</span>`}<strong>${euro(l.unitCents * l.quantity)}</strong></div>`,
    )
    .join("");
}
function totalsHtml(subtotal: number, fee: number, total: number) {
  return `<div class="totals"><div><span>Subtotaal</span><b>${euro(subtotal)}</b></div><div><span>Bestelkosten</span><b>${euro(fee)}</b></div><div class="grand-total"><span>Totaal</span><b>${euro(total)}</b></div></div>`;
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
          const {
            size: [sw, sh],
            crop: [x, y, w, h],
            source,
          } = p.photo;
          const quantity =
            cart.find((l) => l.productId === p.id)?.quantity ?? 0;
          return `<article class="product"><div class="product-copy"><h3>${esc(p.name)}</h3><b>${euro(p.cents)}</b>${quantity ? `<span class="in-cart">${quantity} in je mandje</span>` : ""}</div><div class="menu-photo" role="img" aria-label="${esc(p.name)}" style="background-image:url('${source}');background-size:${(sw / w) * 100}% ${(sh / h) * 100}%;background-position:${(x / (sw - w)) * 100}% ${(y / (sh - h)) * 100}%"></div><button class="add-product" data-plus="${p.id}" aria-label="Voeg ${esc(p.name)} toe">+</button></article>`;
        })
        .join("")
    : '<div class="menu-empty"><h3>Sauzen volgen binnenkort</h3><p>Het sauzenmenu wordt nog aangevuld.</p></div>';
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
    : '<p class="empty">Je mandje is nog leeg.<br>Kies iets lekkers uit het menu.</p>';
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
  $("step").textContent = `0${obj.step} / LUNCH RUN`;
  $("objective").textContent = obj.title;
  $("hint").textContent = obj.detail;
  document.querySelectorAll(".progress li").forEach((li, i) => {
    li.classList.toggle("done", i < obj.step - 1 || p.phase === "complete");
    li.classList.toggle("current", i === obj.step - 1);
  });
  $("pickup-location").textContent =
    p.parking !== null
      ? `Jouw trailer · L0${p.parking + 1}`
      : p.phase === "complete"
        ? "✓ Bestelling geplaatst"
        : "Alle docks zijn gesloten voor lunch.";
  $("action-wrap").hidden = !prompt;
  $("action-text").textContent = prompt;
  $<HTMLButtonElement>("action").disabled = busy;
  const walk = walking(p);
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
        ? "✓ Geplaatst"
        : p.lines.length
          ? "Klaar om op te halen"
          : "Bestel aan de kiosk";
    $("receipt-lines").innerHTML = p.lines.length
      ? lineHtml(p.lines)
      : '<p class="empty">Parkeer en loop naar de kiosk om je lunch te kiezen.</p>';
    $("receipt-total").innerHTML = p.lines.length
      ? totalsHtml(p.subtotalCents, p.feeCents, p.totalCents)
      : "";
    $("receipt-note").textContent =
      p.phase === "complete"
        ? "Je bestelling is opgeslagen. Smakelijk!"
        : p.lines.length
          ? "Nog niet geplaatst. Rijd met je trailer door UITRIT."
          : "Frieten · Burgers · Snacks · Sauzen";
    $("order-count").textContent = String(state.orders.length);
    const counts = new Map<string, { name: string; quantity: number }>();
    for (const o of state.orders)
      for (const l of o.lines) {
        const row = counts.get(l.productId) ?? { name: l.name, quantity: 0 };
        row.quantity += l.quantity;
        counts.set(l.productId, row);
      }
    $("orders-content").innerHTML = state.orders.length
      ? `<section class="order-totals"><h3>Te bestellen</h3>${[...counts.values()].map((l) => `<div><span>${esc(l.name)}</span><b>× ${l.quantity}</b></div>`).join("")}<div><span>Bestelkosten · ${state.orders.length} bestellingen</span><b>${euro(state.orders.reduce((sum, o) => sum + o.feeCents, 0))}</b></div><div class="grand-total"><span>Totaal</span><b>${euro(state.orders.reduce((sum, o) => sum + o.totalCents, 0))}</b></div></section>${state.orders.map((o) => `<section class="person-order ${o.email === p.email ? "you" : ""}"><h3>${esc(o.email)} ${o.email === p.email ? "<small>JIJ</small>" : ""}</h3>${lineHtml(o.lines)}${totalsHtml(o.subtotalCents, o.feeCents, o.totalCents)}</section>`).join("")}`
      : '<div class="empty">Nog geen geplaatste bestellingen.<br>Rijd met je trailer door de uitgang om jouw lunch toe te voegen.</div>';
  }
  const pos = scene.project(obj.target);
  $("target-label").hidden =
    !pos.visible || p.phase === "kiosk" || p.phase === "complete";
  $("target-label").style.left = `${pos.x}px`;
  $("target-label").style.top = `${pos.y}px`;
  $("target-label").textContent =
    p.phase === "pickup"
      ? `JOUW TRAILER · L0${p.parking! + 1}`
      : p.phase === "exit"
        ? "UITRIT →"
        : p.phase === "arrive"
          ? "P02 · PARKEREN"
          : p.phase === "walk-truck"
            ? "JOUW TRUCK"
            : "LUNCHKIOSK";
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
    c.fillText(String(b.id + 1), x(b.x), z(b.z + 5));
  }
  c.fillStyle = "#d0a854";
  c.fillRect(x(PARK.x) - 6, z(PARK.z) - 12, 12, 26);
  c.fillStyle = "#244e42";
  c.fillRect(x(KIOSK.x) - 3, z(KIOSK.z) - 3, 6, 6);
  c.fillText("K", x(KIOSK.x) - 10, z(KIOSK.z));
  c.fillStyle = "#00a990";
  c.fillRect(x(EXIT.x), z(EXIT.z) - 12, 34, 24);
  c.fillStyle = "#fff";
  c.fillText("UIT →", x(EXIT.x) + 17, z(EXIT.z) + 3);
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
$("preview").onclick = () => void start();
$("signout").onclick = signout;
$("action").onclick = () => void action("interact");
$("recover").onclick = () => void action("recover");
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
  if (["w", "a", "s", "d", " ", "shift", "e", "c"].includes(k))
    e.preventDefault();
  keys.add(k);
  if (!e.repeat && k === "e" && interaction(state.me)) void action("interact");
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
  const input = idleInput();
  if (state && !busy) {
    if (!document.querySelector("dialog[open]")) {
      input.throttle = Number(keys.has("w")) - Number(keys.has("s"));
      input.steer = Number(keys.has("a")) - Number(keys.has("d"));
      input.brake = keys.has(" ");
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
        signout();
      });
    if (now - lastPaint > 100) {
      paint();
      lastPaint = now;
    }
  }
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
      "De 3D-yard kon niet laden. Vernieuw de pagina.";
    console.error(e);
    return;
  }
  const configured =
    !!import.meta.env.VITE_CONVEX_URL &&
    !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  $("setup-note").textContent = configured
    ? "Meld je aan voor je lunchrit."
    : "Google-aanmelding is nog niet ingesteld.";
  $("preview").hidden = !(
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_PREVIEW === "true"
  );
  if (configured)
    try {
      await googleButton(
        $("google-signin"),
        import.meta.env.VITE_GOOGLE_CLIENT_ID,
        (token) => void start(token),
      );
    } catch (e) {
      $("setup-note").textContent = message(e);
    }
}
void boot();
