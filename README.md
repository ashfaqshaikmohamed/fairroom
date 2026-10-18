# FairRoom

A roommate group's housing search, in one conversation. Hackathon demo with optional messaging integrations.

FairRoom helps roommate groups find a home together: each person enters private preferences (budget, cities, move-in dates, must-haves), the app ranks saved listings against the whole group's requirements, and proposes a fair room-by-room rent split. The default submission demo runs in the web interface. Real iMessage requires a separately configured transport and device verification.

## Tech stack

- **Runtime:** Node.js 24+, TypeScript (ES modules)
- **Server:** Express + tsx
- **Frontend:** React 19 + Vite + Tailwind CSS + Lucide React + Motion
- **Database:** sql.js (SQLite, persisted to `data/fairroom.sqlite`)
- **Messaging:** `@photon-ai/api` (Photon 2.0 Beta) for hosted iMessage; Photon Spectrum local iMessage adapter for the free Mac demo bridge
- **Matching / rent split:** deterministic TypeScript engines (no model required for core logic)
- **Optional AI:** OpenAI Responses API or Chalk Model Gateway for intent classification only

## Quick start — demo mode (no keys required)

Demo mode seeds the database with three fake roommates (Alex, Sam, Jordan), fake phone numbers, sample survey responses, and the tested sample listings. Alex and Jordan are ready; complete Sam’s survey to generate the shortlist. It disables hosted messaging, the local bridge and the scheduler; no tunnel is needed.

```sh
# From this folder
npm install
cp -n .env.example .env   # DEMO_MODE=true is already the default
npm run dev
```

Open http://localhost:3000. If port 3000 is occupied: `PORT=4200 npm run dev`.

No accounts, API keys, or phone numbers are needed. Copy `.env.example` before starting; an omitted `.env` does not enable demo mode automatically. Click **Meet FairRoom**, complete Sam’s preferences, then explore Homes, Review split, and Conversation.

## Run locally — real iMessage mode

For live iMessage messaging, you need a Photon 2.0 Beta project with a dedicated group-capable iMessage line.

1. Create a Photon project at https://app.beta.photon.codes and obtain your API key and project ID.
2. Ask Photon for a dedicated group-capable iMessage line.
3. Copy `.env.example` to `.env` and set:
   - `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `PHOTON_AGENT_HANDLE`, `PUBLIC_APP_URL`
   - `DEMO_MODE=false`, `PHOTON_ENABLED=true`
4. `npm install && npm run dev`

The separate Mac bridge sends from the signed-in Mac’s Messages identity, not a new agent number. Install its dependencies with `npm install --prefix local-bridge`. See `LOCAL-IMESSAGE-SETUP.md`. Live transport setup is outside the keyless submission demo.

## Features

- Private roommate invitations, budgets, locations, dates, amenities, bedroom-size and whole-home-size minimums, private-bath preferences
- Group-ranked listings: requirements enforced before ranking; missing facts stay unknown
- Joint room assignment and budget-constrained rent split; prices sum exactly to the household total
- Versioned rent-split proposals with acceptance tracking; editing invalidates prior approvals
- iMessage integration: chat-first enrollment, private invitations, roster verification, command replies, duplicate suppression, delivery receipts
- Optional OpenAI or Chalk intent classification (quick commands work without a key)
- Deterministic matching, rent math, consent, and state changes — no model required for core logic
- Before-you-commit panel: deterministic checks for missing room dimensions, estimated/unknown costs, upfront fees, availability
- Factory Droid SDK independent listing reviews (requires credentials, opt-in)
- Warm responsive interface, reduced-motion support, desktop/mobile layouts

## Data and demo boundaries

The catalog contains saved broker snapshots plus fictional demo fixtures. Snapshot availability is not live. Sample photography, room dimensions, and amenities are illustrative. No fabricated real-room sizes or broker contacts are added to missing fields.

Real groups exclude fictional listings. Most real snapshots lack detailed floor plans and may need verification before a budget-feasible room split can be proposed. Users can enter confirmed room details in the calculator.

The rent split is a transparent proposal — not a mathematical envy-free guarantee, a charge, or a lease. Budgets constrain feasible proposals rather than determine each room's starting price. A stricter bedroom/bath requirement is never silently relaxed.

## Commands

```sh
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Build for production
NODE_ENV=production npm start  # Serve dist after npm run build
npm run lint       # TypeScript type check (tsc --noEmit)
npm test           # Run engine tests (matching, messaging, rent split, group plan)
npm run test:api   # Run API tests
npm run test:provider  # Run Photon provider tests (mocks)
npm run clean      # Remove dist and server.js
```

## Verification

```sh
npm run lint
npm run build
npm test
npm run test:api
npm run test:provider
```

Includes matching, room allocation, exact cents, privacy, acceptance revisions, API authorization, Photon identity checks, enrollment, deduplication, and delivery reconciliation. Provider tests use mocks; an actual phone receipt still needs your Photon account.

## Security

- Never commit `.env` or runtime databases (`.gitignore` covers them)
- Never use `VITE_` prefixes for secrets — that would embed them in the browser bundle
- Never paste keys, phone numbers, or invite tokens into chat, GitHub, or screenshots
- Build a clean archive excluding `.env`, databases, receipts, `node_modules`, `dist`, and caches

### Saved Zillow / iMessage walkthrough

For the standalone recording flow (`FairRoom start` → each roommate's preference reply → five Zillow links and a mobile shortlist), see [SHORTLIST-DEMO.md](SHORTLIST-DEMO.md). The `/shortlist` page also accepts preferences locally and saves bookmarks on that device. This optional walkthrough uses ten recorded public Zillow building pages, not live scraping or verified survey matches. Its Mac listener sends through the signed-in Messages identity, independently of the hosted Photon adapter. The guide includes the static-only Vercel package command and the exact boundaries of this demo.
