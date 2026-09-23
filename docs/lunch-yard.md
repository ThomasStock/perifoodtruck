# The Lunch Yard

The live app starts in `src/food/main.ts`. It reuses the original tractor/trailer GLBs, articulated driving integrator, steering animation, and wheel animation. The original yard app remains in source for reference; it is no longer the HTML entry point.

## Game

- Google sign-in supplies each driver's verified email. It appears above their truck.
- Start with a tractor. Five numbered, colored bays hold Dish 1–5 trailers.
- Face north at a bay's HITCH ring, reverse into position, stop, and press E.
- Claiming a trailer atomically starts a shared 5.5-second replenishment cycle. The hatch opens and its replacement rises.
- Drive the entire trailer into the marked order area. Stop and press E to drop it off and add its dish to your basket.
- Collect more trailers, remove basket items, or confirm from anywhere. Repeated dishes become quantities on the shared order board.
- Confirmation is final and idempotent. Your truck becomes translucent, remains visible to others, and can drive but cannot collect or change an order.
- Signing in again restores your basket or confirmed order. One active driving tab per Google account; joining in a second tab takes over control.
- The order board lists confirmed quantities and emails, highlighting your own email. Draft baskets stay out of the shared order totals.

Controls: WASD/arrows, Space brake, Shift precision, E couple/drop off, C camera. Wheel zooms. Touch buttons appear on touch devices. Reset truck returns to the starting point and releases any attached trailer; delivered basket items remain.

## New Convex project

Created for this game:

- Project: [perifoodtruck-lunch](https://dashboard.convex.dev/t/thomasstock1985/perifoodtruck-lunch)
- Development deployment: `tangible-goat-574` (EU West)
- Production deployment: `tacit-robin-849` (EU West)
- Production frontend: https://foodtruck.placeholder.app (Vercel project `perifoodtruck`)
- Local deployment settings: ignored `.env.local`

Backend functions and schema are deployed. The supplied Google client ID is configured in the development frontend, Vercel production environment, and both Convex deployments. All verified Google email domains are allowed; `ALLOWED_EMAIL_DOMAIN` is unset. Google Cloud audience settings still control which accounts Google permits to sign in.

## Finish Google SSO

1. Create a Google OAuth **Web application** client. Configure your consent screen and testing users as needed. Add `http://127.0.0.1:5173`, `http://localhost:5173`, and your eventual production origin as authorized JavaScript origins.
2. Add the public client ID to `.env.local`:

   ```dotenv
   VITE_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   ```

3. Replace the backend audience with the identical ID and redeploy:

   ```sh
   npx convex env set GOOGLE_CLIENT_ID YOUR_CLIENT_ID.apps.googleusercontent.com
   npx convex dev --once
   ```

4. Recommended for colleagues-only access: set your actual company email domain on the server:

   ```sh
   npx convex env set ALLOWED_EMAIL_DOMAIN your-company.example
   ```

5. Restart Vite. Sign in using two Google accounts in separate browsers to verify live movement and shared order updates. Google JWT signature, issuer, audience and expiration are validated by Convex; the server also requires a verified email and enforces the optional domain restriction. No client secret is needed for this GIS ID-token flow. Expired sessions return to sign-in without losing the saved basket/order.

References: [Google button setup](https://developers.google.com/identity/gsi/web/guides/display-button), [Convex authentication](https://docs.convex.dev/auth/advanced/custom-auth).

## Run and verify

```sh
npm ci
npm run dev
npm run build
node --import tsx --test tests/*.test.ts
npx tsc --noEmit -p convex/tsconfig.json
```

The local preview explicitly uses an isolated localStorage backend (`foodtruck-preview`). It never writes real shared orders. Development exposes this preview automatically; production exposes it only with the explicit `VITE_ENABLE_PREVIEW=true` setting. Preview orders persist locally; clear that storage key to start a fresh preview.

Tests exercise the original driving integrator, trailer geometry, authentication/domain checks, concurrent claims and replenishment, drop-off, basket quantities/removal, confirmation away from the zone, duplicate confirmation, returning ghosts, and invalid movement/delivery. The authenticated two-browser test requires the real Google client ID.

## Deployment and scope

For a production frontend, set `VITE_GOOGLE_CLIENT_ID` and the production `VITE_CONVEX_URL`; configure `GOOGLE_CLIENT_ID` and `ALLOWED_EMAIL_DOMAIN` on the **production** Convex deployment too. Vercel currently runs `npm run build`; deploy backend changes separately with `npx convex deploy` before pushing frontend changes. The optional `build:vercel` script can deploy both during a build if a matching production Convex deploy key is configured. Add `https://foodtruck.placeholder.app` to the Google client's authorized JavaScript origins for live sign-in.

This is one lunch event per deployment. There is no ordering deadline, admin cancellation, event rotation, or checkout/payment integration yet. All authenticated allowed colleagues can see confirmed order emails, as requested.

Trucks simulate locally at 60 Hz and broadcast changed positions at approximately 8 Hz, with 3-second idle heartbeats and interpolation for remote vehicles. Stale drivers disappear after 15 seconds. This is client-authoritative movement with server bounds/speed sanity checks, not a competitive anti-cheat simulation. Players do not collide with each other; shared trailer claims and ordering are server-authoritative Convex transactions. Querying the roster currently targets team-sized sessions; larger deployments should separate presence partitions from durable orders.
