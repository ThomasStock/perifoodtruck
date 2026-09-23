import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  chooseParking,
  normalizeParking,
  exited,
  interact,
  recover,
  KIOSK,
  newPlayer,
  type Snapshot,
  type Truck,
  type Point,
} from "./model";
import { priceCart, type CartItem } from "./menu";
import { distance } from "../game/simulation";
export interface Backend {
  move(truck: Truck, driver: Point): Promise<void>;
  action(
    name: "interact" | "leaveKiosk" | "reserve" | "recover" | "cancelOrder",
    cart?: CartItem[],
  ): Promise<void>;
  close(): void;
}
const world = makeFunctionReference<"query", Record<string, never>, Snapshot>(
  "lunch:world",
);
const mutation = (name: string) =>
  makeFunctionReference<"mutation">(`lunch:${name}`);
export async function connect(
  url: string,
  token: string,
  onChange: (s: Snapshot) => void,
  onError: (e: Error) => void,
): Promise<Backend> {
  const client = new ConvexClient(url),
    session = crypto.randomUUID();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Sign-in timed out. Please try again.")),
        15000,
      );
      client.setAuth(
        async () => token,
        (authenticated) => {
          clearTimeout(timer);
          if (authenticated) resolve();
          else {
            const error = new Error(
              "Your Google session expired. Please sign in again.",
            );
            reject(error);
            onError(error);
          }
        },
      );
    });
    await client.mutation(mutation("join"), { session });
    const off = client.onUpdate(world, {}, onChange, onError);
    return {
      async move(truck, driver) {
        await client.mutation(mutation("move"), { session, truck, driver });
      },
      async action(name, cart) {
        await client.mutation(mutation(name), {
          session,
          ...(name === "reserve" ? { cart } : {}),
        });
      },
      close() {
        off();
        void client.close();
      },
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
export function preview(
  onChange: (s: Snapshot) => void,
  kioskFixture = false,
): Backend {
  let state: Snapshot = {
    me: newPlayer("you@preview.local"),
    players: [],
    orders: [],
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("lunch-kiosk-preview") ?? "null",
    );
    if (saved?.version === 1) state = saved.state;
  } catch {}
  if (kioskFixture) {
    state = { me: newPlayer("you@preview.local"), players: [], orders: [] };
    state.me.phase = "kiosk";
    state.me.driver = { ...KIOSK };
    state.me.truck.z = 43;
  }
  state.me.parking = normalizeParking(state.me.parking);
  const publish = () => {
    try {
      localStorage.setItem(
        "lunch-kiosk-preview",
        JSON.stringify({ version: 1, state }),
      );
    } catch {}
    onChange(structuredClone(state));
  };
  publish();
  return {
    async move(truck, driver) {
      state.me.truck = { ...truck };
      state.me.driver = { ...driver };
      state.me.updatedAt = Date.now();
      if (exited(state.me)) {
        state.orders.push({
          email: state.me.email,
          lines: state.me.lines,
          subtotalCents: state.me.subtotalCents,
          feeCents: state.me.feeCents,
          totalCents: state.me.totalCents,
          placedAt: Date.now(),
        });
        state.me.phase = "complete";
        state.me.parking = null;
        publish();
      }
    },
    async action(name, cart) {
      const p = state.me;
      if (name === "interact") interact(p);
      if (name === "recover") recover(p);
      if (name === "cancelOrder") {
        state.orders = state.orders.filter((o) => o.email !== p.email);
        state.me = newPlayer(p.email);
      }
      if (name === "leaveKiosk" && p.phase === "kiosk") p.phase = "walk-kiosk";
      if (name === "reserve") {
        if (p.phase !== "kiosk" || distance(p.driver, KIOSK) >= 2.4)
          throw new Error("Order at the kiosk.");
        Object.assign(p, priceCart(cart ?? []), {
          parking: chooseParking([], Math.random()),
          phase: "walk-truck",
        });
      }
      publish();
    },
    close() {
      publish();
    },
  };
}
type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select: boolean;
  }): void;
  renderButton(element: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}
export async function googleButton(
  element: HTMLElement,
  clientId: string,
  callback: (token: string) => void,
) {
  if (!window.google)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=en";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            "Google sign-in could not load. Check your connection and retry.",
          ),
        );
      document.head.append(script);
    });
  window.google!.accounts.id.initialize({
    client_id: clientId,
    callback: (r) => callback(r.credential),
    auto_select: false,
  });
  window.google!.accounts.id.renderButton(element, {
    locale: "en",
    theme: "outline",
    size: "large",
    shape: "pill",
    width: 300,
  });
}
