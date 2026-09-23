import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./style.css";
import { FoodScene } from "./scene";
import { connect, googleButton, preview, type Backend } from "./backend";
import {
  DISHES,
  ORDER_AREA,
  canConfirm,
  drive,
  idleInput,
  inOrderArea,
  pickupReady,
  type Snapshot,
  type Truck,
} from "./model";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
$("app").innerHTML = `
<div id="world" aria-label="The Lunch Yard driving game"></div>
<header><a class="brand" href="/"><span class="brand-icon">P<span>↗</span></span><span>peripass<small>THE LUNCH YARD</small></span></a><div class="top-right"><span id="connection" class="connection">Welcome to the yard</span><button id="orders-button">☷ <span>Everyone’s orders</span> <b id="order-count">0</b></button><button id="camera" class="square" title="Change camera (C)" aria-label="Change camera">▣</button><button id="help" class="square" aria-label="How to play">?</button></div></header>
<section id="login" class="welcome"><div class="eyebrow">A LITTLE DRIVE. A GOOD LUNCH.</div><h1>Your lunch.<br>Your <em>delivery.</em></h1><p>Pick a dish. Hitch a trailer.<br>Bring something good to the table.</p><div class="intro-steps"><span><b>01</b> PICK UP</span><span><b>02</b> DROP OFF</span><span><b>03</b> DIG IN</span></div><div id="google-signin"></div><p id="setup-note" class="small">Loading the yard…</p><button id="preview" class="primary" hidden>Explore local preview <span>↗</span></button><small class="login-note">Your Google email is your driver name.<br>Your order stays saved when you come back.</small></section>
<section id="mission" class="mission panel" hidden><div id="step" class="eyebrow">01 / PICK YOUR DISH</div><h2 id="objective">What’s for lunch?</h2><p id="hint">Five trailers. Five possibilities. Head to the pickup bays.</p><div class="dish-list">${DISHES.map((d) => `<button class="dish-option" data-dish="${d.id}"><i style="--dish:${d.color}">${d.id}</i><span>${d.name}</span><small id="distance-${d.id}"></small></button>`).join("")}</div><div id="target-hint" class="target-hint">Reverse toward a HITCH ring. Stop, then press E.</div></section>
<section id="basket" class="basket panel" hidden><div class="basket-title"><span class="eyebrow">YOUR LUNCH</span><span id="basket-count">0 dishes</span></div><div id="basket-content"></div><button id="confirm" class="primary" disabled>Confirm order <span>↗</span></button><p id="basket-note" class="small">Drop off a trailer to add a dish.</p></section>
<button id="map-button" class="map panel" hidden aria-label="Toggle yard overview"><div><span class="eyebrow">YARD MAP</span><span>↗</span></div><canvas id="map" width="360" height="300"></canvas><small><i></i> YOU <span>○ COLLEAGUES</span></small></button>
<div id="action-wrap" hidden><div id="zone-status" role="status"></div><button id="action" class="primary"><kbd>E</kbd><span id="action-text">Hook up trailer</span></button></div>
<div id="toast" role="status" aria-live="polite" hidden></div>
<footer id="drive-controls" hidden><div class="keys"><span><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd> Drive</span><span><kbd>SPACE</kbd> Brake</span><span><kbd>SHIFT</kbd> Precision</span><button id="recover">Reset truck</button><button id="signout">Sign out</button></div><div class="speed"><b id="speed">0</b><span>KM/H</span></div></footer>
<div id="touch" hidden><div><button data-key="a" aria-label="Steer left">←</button><button data-key="d" aria-label="Steer right">→</button></div><div><button data-key="s" aria-label="Reverse">↓</button><button data-key="w" aria-label="Forward">↑</button><button data-key=" " aria-label="Brake">■</button></div></div>
<dialog id="orders-dialog"><div class="dialog-heading"><div><div class="eyebrow">THE SHARED TABLE</div><h2>Everyone’s orders</h2></div><button data-close="orders-dialog" class="square" aria-label="Close orders">×</button></div><p class="muted">Confirmed lunches, live from the yard.</p><div id="orders-content"></div></dialog>
<dialog id="confirm-dialog"><div class="eyebrow">READY FOR LUNCH?</div><h2>Make it an order.</h2><div id="confirm-content"></div><p>After confirming, your order is final. Your truck becomes a ghost — stay, drive around, and explore.</p><div class="dialog-actions"><button data-close="confirm-dialog">Keep driving</button><button id="submit-order" class="primary">Confirm my order ↗</button></div></dialog>
<dialog id="help-dialog"><div class="dialog-heading"><h2>A lunch run, in three stops.</h2><button data-close="help-dialog" class="square" aria-label="Close help">×</button></div><ol><li><b>Choose a trailer.</b> Drive around to its front (the north side). Face north, reverse toward the HITCH ring, stop and press E to couple.</li><li><b>Deliver your dish.</b> Bring the whole trailer inside the marked order area. Stop and press E to drop it off. It goes into your basket; your truck is free to collect another.</li><li><b>Confirm anywhere.</b> Review your basket and confirm when ready. You can remove dishes before confirming.</li></ol><p>WASD or arrows to drive · Space to brake · Shift for precision · C to change camera · Mouse wheel to zoom.</p><p>After ordering, explore as a transparent ghost truck. Signing back in restores your confirmed order.</p></dialog>`;
let scene: FoodScene;
let backend: Backend | null = null,
  state: Snapshot | null = null;
let busy = false,
  loaded = false,
  moving: Promise<void> | null = null,
  selected = 3,
  currentAction: "pickup" | "dropoff" | null = null;
let previewMode = false,
  restorePose = true,
  lastSend = 0,
  lastPaint = 0,
  lastSnapshot = "";
let sentPose = "";
let toastTimer: ReturnType<typeof setTimeout>;
const keys = new Set<string>();
function toast(message: string) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 5500);
}
function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/\[CONVEX[^\]]*\]\s*/g, "")
    : "Something went wrong. Please try again.";
}
function receive(next: Snapshot) {
  if (state && !restorePose)
    next.me.truck = {
      ...state.me.truck,
      trailerHeading:
        state.me.dish === null && next.me.dish !== null
          ? Math.PI
          : state.me.truck.trailerHeading,
    };
  state = next;
  restorePose = false;
  $("connection").textContent = previewMode ? "● Local preview" : "● Live yard";
  paint();
}
function entered() {
  $("login").hidden = true;
  for (const id of [
    "mission",
    "basket",
    "map-button",
    "drive-controls",
    "touch",
  ])
    $(id).hidden = false;
  scene.mode = "follow";
}
async function start(token?: string) {
  if (!loaded || busy) return;
  busy = true;
  $("setup-note").textContent = "Joining the yard…";
  try {
    backend?.close();
    backend = null;
    state = null;
    restorePose = true;
    previewMode = !token;
    backend = token
      ? await connect(
          import.meta.env.VITE_CONVEX_URL,
          token,
          receive,
          (error) => {
            toast(errorMessage(error));
            signout();
          },
        )
      : preview(receive);
    entered();
  } catch (error) {
    $("setup-note").textContent = errorMessage(error);
  } finally {
    busy = false;
  }
}
async function flush() {
  if (moving) await moving;
  if (!backend || !state) return;
  const pose = { ...state.me.truck };
  moving = backend.move(pose);
  try {
    await moving;
    sentPose = JSON.stringify(pose);
  } finally {
    moving = null;
    lastSend = performance.now();
  }
}
async function action(
  name: "pickup" | "dropoff" | "release" | "confirm" | "recover" | "removeItem",
  value?: number,
) {
  if (!backend || !state || busy) return;
  busy = true;
  keys.clear();
  paint();
  try {
    await flush();
    if (name === "recover") restorePose = true;
    await backend.action(name, value);
    if (name === "dropoff")
      toast(
        "Dish added to your basket. Drive on — confirm whenever you’re ready.",
      );
    if (name === "confirm") {
      ($("confirm-dialog") as HTMLDialogElement).close();
      toast("Lunch ordered! Enjoy exploring in your ghost truck.");
    }
  } catch (error) {
    restorePose = false;
    toast(errorMessage(error));
  } finally {
    busy = false;
    paint();
  }
}
function signout() {
  keys.clear();
  backend?.close();
  backend = null;
  state = null;
  window.google?.accounts.id.disableAutoSelect();
  for (const dialog of document.querySelectorAll("dialog")) dialog.close();
  $("login").hidden = false;
  for (const id of [
    "mission",
    "basket",
    "map-button",
    "drive-controls",
    "touch",
    "action-wrap",
  ])
    $(id).hidden = true;
  $("connection").textContent = "Signed out";
  $("setup-note").textContent = "Sign in to return to your truck.";
  scene.mode = "yard";
}
function basketMarkup(dishes: number[], removable = false) {
  return dishes.length
    ? dishes
        .map(
          (id, index) =>
            `<div class="basket-item"><i style="--dish:${DISHES[id - 1].color}">${id}</i><span>Dish ${id}</span>${removable ? `<button data-remove="${index}" aria-label="Remove Dish ${id}">×</button>` : "<b>× 1</b>"}</div>`,
        )
        .join("")
    : '<div class="empty-basket"><span>⌑</span>Your next good thing<br>starts with a trailer.</div>';
}
function paint() {
  if (!state) return;
  const p = state.me,
    ghost = p.confirmed !== null;
  const inside = p.dish !== null && inOrderArea(p.truck);
  const stopped = Math.abs(p.truck.speed) < 0.35;
  const pickup = DISHES.find(
    (d) =>
      pickupReady(p.truck, d.id) &&
      (state!.bays.find((b) => b.dish === d.id)?.readyAt ?? 0) <= Date.now(),
  );
  currentAction =
    !ghost && inside && stopped
      ? "dropoff"
      : !ghost && p.dish === null && pickup
        ? "pickup"
        : null;
  if (currentAction === "pickup") selected = pickup!.id;
  $("action-wrap").hidden = !currentAction && !inside;
  $("action").hidden = !currentAction;
  ($("action") as HTMLButtonElement).disabled = busy;
  $("action-text").textContent =
    currentAction === "dropoff"
      ? `Drop off Dish ${p.dish}`
      : `Hook up Dish ${selected}`;
  $("zone-status").textContent = inside
    ? stopped
      ? "✓ Trailer in the order area · ready to add to basket"
      : "You’re in! Brake to drop off your trailer."
    : "";
  $("step").textContent = ghost
    ? "LUNCH SORTED / FREE ROAM"
    : p.dish !== null
      ? "02 / MAKE YOUR DELIVERY"
      : p.basket.length
        ? "03 / CONFIRM ANYTIME"
        : "01 / PICK YOUR DISH";
  $("objective").textContent = ghost
    ? "Enjoy the scenic route."
    : p.dish !== null
      ? `Dish ${p.dish}, coming through.`
      : p.basket.length
        ? "Another helping?"
        : "What’s for lunch?";
  $("hint").textContent = ghost
    ? "Your order is saved. You’re a ghost now — say hello to your colleagues and explore."
    : p.dish !== null
      ? "Drive to the order area. Park the whole trailer inside the lines, then drop it off."
      : p.basket.length
        ? "Your basket is saved. Pick up another dish or confirm your order from anywhere."
        : "Find a trailer at the pickup bays. Each one is a different dish.";
  const targetHint =
    p.dish !== null && !ghost
      ? '<button id="return-trailer">Return this trailer</button>'
      : ghost
        ? "Your email stays visible to other drivers."
        : "Face north. Reverse toward a HITCH ring. Stop + E.";
  if ($("target-hint").innerHTML !== targetHint)
    $("target-hint").innerHTML = targetHint;
  document
    .querySelectorAll<HTMLButtonElement>(".dish-option")
    .forEach((button) => {
      const id = Number(button.dataset.dish);
      button.classList.toggle("selected", id === selected);
      button.disabled = ghost;
      const dish = DISHES[id - 1];
      const wait = Math.max(
        0,
        (state!.bays.find((b) => b.dish === id)?.readyAt ?? 0) - Date.now(),
      );
      $(`distance-${id}`).textContent = wait
        ? `↑ ${Math.ceil(wait / 1000)}s`
        : `${Math.round(Math.hypot(p.truck.x - dish.x, p.truck.z - dish.z))} m ↗`;
    });
  const signature = JSON.stringify([
    p.basket,
    p.confirmed,
    state.orders,
    p.email,
  ]);
  if (signature !== lastSnapshot) {
    lastSnapshot = signature;
    $("basket-content").innerHTML = basketMarkup(
      p.confirmed ?? p.basket,
      !ghost,
    );
    $("basket-count").textContent = ghost
      ? "✓ Confirmed"
      : `${p.basket.length} dish${p.basket.length === 1 ? "" : "es"}`;
    $("order-count").textContent = String(
      state.orders.reduce((sum, o) => sum + o.dishes.length, 0),
    );
    $("orders-content").innerHTML = state.orders.length
      ? DISHES.map((d) => {
          const orders = state!.orders.filter((o) => o.dishes.includes(d.id));
          const count = orders.reduce(
            (sum, o) => sum + o.dishes.filter((id) => id === d.id).length,
            0,
          );
          return `<section class="order-group"><h3><i style="--dish:${d.color}">${d.id}</i>${d.name}<b>× ${count}</b></h3>${orders.length ? orders.map((o) => `<div class="order-person ${o.email === p.email ? "you" : ""}"><span>${escape(o.email)}${o.email === p.email ? " <b>YOU</b>" : ""}</span><span>× ${o.dishes.filter((id) => id === d.id).length}</span></div>`).join("") : '<p class="muted">No orders yet.</p>'}</section>`;
        }).join("")
      : '<div class="empty-state">The table is waiting.<br>Confirmed orders will appear here.</div>';
  }
  $("confirm").hidden = ghost;
  ($("confirm") as HTMLButtonElement).disabled = busy || !canConfirm(p);
  $("basket-note").textContent = ghost
    ? "Order confirmed. Saved for your next visit."
    : p.basket.length
      ? "Confirm from anywhere in the yard."
      : "Drop off a trailer to add a dish.";
  ($("submit-order") as HTMLButtonElement).disabled = busy;
  $("speed").textContent = String(Math.round(Math.abs(p.truck.speed) * 3.6));
  drawMap();
}
function drawMap() {
  if (!state) return;
  const ctx = $("map") as HTMLCanvasElement;
  const c = ctx.getContext("2d")!;
  c.clearRect(0, 0, 360, 300);
  c.fillStyle = "#e3e4d7";
  c.fillRect(10, 8, 340, 284);
  const x = (n: number) => 180 + n * 1.9,
    z = (n: number) => 150 + n * 1.68;
  c.fillStyle = "#bbc9ab";
  c.fillRect(x(ORDER_AREA.x - 15), z(ORDER_AREA.z - 12.5), 57, 42);
  c.fillStyle = "#41674c";
  c.font = "bold 12px system-ui";
  c.textAlign = "center";
  c.fillText("ORDER", x(0), z(46));
  c.fillStyle = "#b6c1a8";
  c.fillRect(x(-17), z(-6), 64, 34);
  DISHES.forEach((d) => {
    c.fillStyle = d.color;
    c.fillRect(x(d.x) - 7, z(-40), 14, 23);
    c.fillStyle = "#254638";
    c.fillText(String(d.id), x(d.x), z(-48));
    if (d.id === selected) {
      c.strokeStyle = "#254638";
      c.lineWidth = 2;
      c.strokeRect(x(d.x) - 10, z(-40) - 3, 20, 29);
    }
  });
  for (const p of [
    ...state.players.filter(
      (p) => p.email !== state!.me.email && Date.now() - p.updatedAt < 15000,
    ),
    state.me,
  ]) {
    c.save();
    c.translate(x(p.truck.x), z(p.truck.z));
    c.rotate(-p.truck.heading);
    c.fillStyle = p.email === state.me.email ? "#154d40" : "#fffef5";
    c.strokeStyle = "#154d40";
    c.beginPath();
    c.moveTo(0, 7);
    c.lineTo(-5, -5);
    c.lineTo(5, -5);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }
}
$("preview").onclick = () => void start();
$("signout").onclick = signout;
$("recover").onclick = () => void action("recover");
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
$("help").onclick = () => {
  keys.clear();
  ($("help-dialog") as HTMLDialogElement).showModal();
};
$("orders-button").onclick = () => {
  keys.clear();
  ($("orders-dialog") as HTMLDialogElement).showModal();
};
$("confirm").onclick = () => {
  if (!state || !canConfirm(state.me)) return;
  keys.clear();
  $("confirm-content").innerHTML = basketMarkup(state.me.basket);
  ($("confirm-dialog") as HTMLDialogElement).showModal();
};
$("submit-order").onclick = () => void action("confirm");
$("action").onclick = () => {
  if (currentAction) void action(currentAction, selected);
};
document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("button");
  if (!target) return;
  if (target.dataset.close)
    ($(`${target.dataset.close}`) as HTMLDialogElement).close();
  if (target.dataset.dish) {
    selected = Number(target.dataset.dish);
    toast(
      `Dish ${selected} selected. Follow its numbered bay on the yard map.`,
    );
    paint();
  }
  if (target.dataset.remove !== undefined)
    void action("removeItem", Number(target.dataset.remove));
  if (target.id === "return-trailer") void action("release");
});
const key = (event: KeyboardEvent) =>
  ({ ArrowUp: "w", ArrowDown: "s", ArrowLeft: "a", ArrowRight: "d" })[
    event.key
  ] ?? event.key.toLowerCase();
window.addEventListener("keydown", (event) => {
  if (
    !state ||
    document.querySelector("dialog[open]") ||
    (event.target as HTMLElement).matches("input,textarea")
  )
    return;
  const k = key(event);
  if (["w", "a", "s", "d", " ", "shift", "e", "c"].includes(k))
    event.preventDefault();
  keys.add(k);
  if (!event.repeat && k === "e" && currentAction)
    void action(currentAction, selected);
  if (!event.repeat && k === "c") $("camera").click();
});
window.addEventListener("keyup", (event) => keys.delete(key(event)));
window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => keys.clear());
document.querySelectorAll<HTMLElement>("[data-key]").forEach((button) => {
  button.onpointerdown = (event) => {
    event.preventDefault();
    keys.add(button.dataset.key!);
    button.setPointerCapture(event.pointerId);
  };
  button.onpointerup =
    button.onpointercancel =
    button.onlostpointercapture =
      () => keys.delete(button.dataset.key!);
});
let last = performance.now(),
  accumulator = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state && !busy) {
    const input = idleInput();
    if (!document.querySelector("dialog[open]")) {
      input.throttle = Number(keys.has("w")) - Number(keys.has("s"));
      input.steer = Number(keys.has("a")) - Number(keys.has("d"));
      input.brake = keys.has(" ");
      input.precision = keys.has("shift");
    } else input.brake = true;
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      drive(state.me.truck, input, state.me.dish !== null, 1 / 60);
      accumulator -= 1 / 60;
    }
    if (
      now - lastSend > 120 &&
      !moving &&
      backend &&
      (now - lastSend > 3000 || JSON.stringify(state.me.truck) !== sentPose)
    )
      void flush().catch((error) => {
        toast(errorMessage(error));
        signout();
      });
    if (now - lastPaint > 120) {
      paint();
      lastPaint = now;
    }
  }
  scene.render(
    state?.me ?? null,
    state?.players ?? [],
    state?.bays ?? [],
    dt,
    !!state?.me.dish && inOrderArea(state.me.truck),
  );
  requestAnimationFrame(frame);
}
async function boot() {
  try {
    scene = new FoodScene($("world"));
    await scene.load();
    loaded = true;
    requestAnimationFrame(frame);
  } catch {
    $("setup-note").textContent =
      "The 3D yard could not load. Enable WebGL and reload to try again.";
    return;
  }
  const configured =
    !!import.meta.env.VITE_GOOGLE_CLIENT_ID &&
    !!import.meta.env.VITE_CONVEX_URL;
  $("setup-note").textContent = configured
    ? "Sign in to start your lunch run."
    : "Google sign-in is not configured yet.";
  // Production cannot bypass identity. Preview is explicitly enabled by the developer.
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
    } catch (error) {
      $("setup-note").textContent = errorMessage(error);
    }
}
void boot();
