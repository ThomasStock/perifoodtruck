import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  canConfirm,
  DISHES,
  inOrderArea,
  pickupReady,
  RESPAWN_MS,
  spawn,
  type Snapshot,
  type Truck,
} from "./model";
export interface Backend {
  move(truck: Truck): Promise<void>;
  action(
    name:
      "pickup" | "dropoff" | "release" | "confirm" | "recover" | "removeItem",
    value?: number,
  ): Promise<void>;
  close(): void;
}
const world = makeFunctionReference<"query", Record<string, never>, Snapshot>(
  "food:world",
);
const mutation = (name: string) =>
  makeFunctionReference<"mutation">(`food:${name}`);
export async function connect(
  url: string,
  token: string,
  onChange: (s: Snapshot) => void,
  onError: (error: Error) => void,
): Promise<Backend> {
  const client = new ConvexClient(url);
  const session = crypto.randomUUID();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Sign-in timed out. Please try again.")),
        15000,
      );
      client.setAuth(
        async () => token,
        (authenticated) => {
          clearTimeout(timeout);
          if (authenticated) resolve();
          else {
            const error = new Error(
              "Google sign-in expired. Sign in again to continue.",
            );
            reject(error);
            onError(error);
          }
        },
      );
    });
    await client.mutation(mutation("join"), { session });
    const unsubscribe = client.onUpdate(world, {}, onChange, onError);
    return {
      async move(truck) {
        await client.mutation(mutation("move"), { session, truck });
      },
      async action(name, value) {
        await client.mutation(mutation(name), {
          session,
          ...(name === "pickup"
            ? { dish: value }
            : name === "removeItem"
              ? { index: value }
              : {}),
        });
      },
      close() {
        unsubscribe();
        void client.close();
      },
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
// Explicit local preview, isolated from production and from shared orders.
export function preview(onChange: (s: Snapshot) => void): Backend {
  let state: Snapshot = {
    me: {
      email: "you@preview.local",
      truck: spawn(),
      dish: null,
      basket: [],
      confirmed: null,
      updatedAt: Date.now(),
    },
    players: [],
    bays: DISHES.map((d) => ({ dish: d.id, readyAt: 0 })),
    orders: [],
  };
  try {
    const saved = JSON.parse(
      localStorage.getItem("foodtruck-preview") ?? "null",
    );
    if (saved?.version === 1) state = saved.state;
  } catch {
    /* A fresh preview also works without storage. */
  }
  function publish() {
    try {
      localStorage.setItem(
        "foodtruck-preview",
        JSON.stringify({ version: 1, state }),
      );
    } catch {
      /* optional */
    }
    onChange(structuredClone(state));
  }
  publish();
  return {
    async move(truck) {
      state.me.truck = { ...truck };
      state.me.updatedAt = Date.now();
    },
    async action(name, value) {
      const p = state.me;
      if (name === "recover") {
        p.truck = spawn();
        p.dish = null;
      } else if (p.confirmed !== null) {
        if (name !== "confirm")
          throw new Error("Your order is already confirmed.");
      } else if (name === "pickup") {
        const bay = state.bays.find((b) => b.dish === value);
        if (
          !bay ||
          bay.readyAt > Date.now() ||
          p.dish !== null ||
          !pickupReady(p.truck, value!)
        )
          throw new Error("Line up your hitch and stop.");
        p.dish = value!;
        p.truck.trailerHeading = Math.PI;
        bay.readyAt = Date.now() + RESPAWN_MS;
      } else if (name === "dropoff") {
        if (
          p.dish === null ||
          !inOrderArea(p.truck) ||
          Math.abs(p.truck.speed) >= 0.35
        )
          throw new Error("Stop with the whole trailer inside the order area.");
        if (p.basket.length >= 20) throw new Error("Your basket is full.");
        p.basket.push(p.dish);
        p.dish = null;
      } else if (name === "release") {
        if (Math.abs(p.truck.speed) >= 0.35) throw new Error("Stop first.");
        p.dish = null;
      } else if (name === "removeItem")
        p.basket = p.basket.filter((_, i) => i !== value);
      else if (name === "confirm") {
        if (!canConfirm(p)) throw new Error("Your basket is empty.");
        p.confirmed = [...p.basket];
        state.orders = [{ email: p.email, dishes: [...p.basket] }];
        p.basket = [];
        p.dish = null;
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
  prompt(): void;
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
      script.src = "https://accounts.google.com/gsi/client";
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
    theme: "outline",
    size: "large",
    shape: "pill",
    width: 300,
  });
}
