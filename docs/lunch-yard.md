# The Lunch Yard

The app interface, instructions and sign-in button are English-only. Menu item names and descriptions preserve the original supplied Dutch menu. A rotating low-poly hamburger on the kiosk building’s roof marks the lunch stop. Ground arrows and the original pulsing destination marker guide the current objective; floating yard signs are removed. Original branded food names are retained where appropriate.

Entry point: `src/lunch/main.ts`. The game reuses the original yard, truck models, articulated driving physics, walking controls, and camera. `yard-lunch.glb` adds an exit in the east fence. Generate it with Blender: `blender --background --python scripts/build_models.py -- yard-lunch`.

## Lunch run

1. Sign in with Google. Your verified email appears on your truck and trailer.
2. Start without a trailer. Park on P02, stop, press E, and walk to the kiosk.
3. Click anywhere on a menu card to add an item. Choose from Fries, Burgers, Snacks, and Sauces. The menu includes 75 items, excludes Friet maison, and charges €1.50 per order. Sauces and toppings cost €1.20 per pot, except the two speciaal combinations at €2.20. Frikandel and Kipkorn have 1 + 1 gratis: each basket increment buys a duo for one unit price. Stored lines keep paid quantity and optional free quantity separately; old orders retain their original quantities. The order board shows total portions and the paid/free split.
4. Confirm at the kiosk to reserve a named trailer. This does **not** place the order. Walk back to the truck, press E, and follow the pickup marker.
5. The gate is already open. Docks are closed for lunch. No PIN or yard assistant.
6. Reverse gently towards your trailer’s front and press E while moving slowly. Angled approaches up to roughly 60 degrees are accepted; the trailer body blocks penetration. Three pickup bays P01–P03 sit between the existing docks, with wall-mounted signs and no original dock numbers or guide lines. Parking is allocated randomly among free spaces, with overlaps only once all three spaces are occupied.
7. Drive into the large outlined and tinted area at the east exit. The entire attached trailer must clear the fence before the server records the order, exactly once.
8. Continue exploring as a ghost. Rejoining restores progress or the placed order.

Other players, walkers, and trailers are translucent and nonblocking. The shared board lists placed quantities, per-person items, fees, and totals; your email is highlighted. Unplaced menu contents are private. One active driving tab per Google account; another tab takes over control.

Controls: WASD/arrows, Space brake, Shift precision, E interact, C camera; wheel zoom. Touch driving buttons and a walking joystick are included. Recovering the truck preserves a reserved order and respawns its trailer at the assigned parking.

## Configuration

- Repository: `ThomasStock/perifoodtruck`
- Convex project: `perifoodtruck-lunch`, team `thomasstock1985`
- Development: `tangible-goat-574` (EU West)
- Production: `tacit-robin-849` (EU West)
- Frontend: https://foodtruck.placeholder.app (Vercel project `perifoodtruck`)
- Ignored local settings: `.env.local`

Set `VITE_GOOGLE_CLIENT_ID` and `VITE_CONVEX_URL` on the frontend. Set the identical `GOOGLE_CLIENT_ID` on Convex. The Google OAuth web client needs the frontend origins (`http://127.0.0.1:5173`, `http://localhost:5173`, and `https://foodtruck.placeholder.app`). All verified email domains are allowed; `ALLOWED_EMAIL_DOMAIN` is unset. No client secret is used in this GIS ID-token flow. Google audience/test-user settings still control access.

Convex validates the Google token's signature, issuer, audience, and expiry. Application functions require verified email and check the active session. Prices, quantities, parking allocation, and final order creation are server-controlled transactions. Movement is simulated locally with server bounds and distance sanity checks, suitable for cooperative play rather than competitive anti-cheat.

## Verify and deploy

```sh
npm ci
npm run dev
npm run build
node --import tsx --test tests/*.test.ts
npx tsc --noEmit -p convex/tsconfig.json
npx convex dev --once
npx convex deploy --yes
```

Deploy production Convex before pushing the frontend to main; Vercel builds automatically. Its environment uses the production Convex URL.

Local preview uses isolated localStorage key `lunch-kiosk-preview` and never writes shared orders. Development exposes it automatically; production only exposes it with `VITE_ENABLE_PREVIEW=true`. For menu visual checks, open `/?preview=kiosk` in development and click Local preview. This fixture starts a fresh preview at the kiosk; the query is ignored in production. Cart drafts use `lunch-draft:<email>`.

Tests cover original driving, kiosk interaction, authoritative prices, the fee, empty-first allocation and overflow, private drafts, reservation versus placement, full-trailer exit, idempotency, rejoining, recovery, and menu UI. Real Google authentication and two-browser visual synchronization require signed-in accounts.

Menu photographs use the supplied screenshots unchanged as CSS image sprites in `public/menu`. Names and prices are transcribed in `src/lunch/menu.ts`. Original `src/food` code and its Convex tables remain for historical data; the new flow uses `lunchPlayers` and `lunchOrders`.

This supports one lunch event per deployment. No payment, restaurant submission, deadline, or event rotation is implemented. Players can cancel their own reserved or placed order after confirmation; cancellation removes it from shared totals, releases the trailer and resets the lunch run. The order board is the list to order from the restaurant. Position broadcasts run around 8 Hz, with 3-second idle heartbeats; remote movement is interpolated and stale drivers disappear after 15 seconds. Intended for team-sized sessions.

While walking outside the kiosk, click the ground to throw a burger towards the pointer (maximum 9 metres). The mobile Throw burger button uses the last walking direction. Burgers arc down over 700 ms and persist in the shared Convex yard. Clean up / R removes the closest landed burger within 3 metres, regardless of who threw it. The server validates walking state and session, limits repeat throws to one per 800 ms, and caps the yard at 100 burgers. Rendering uses five instanced meshes.
