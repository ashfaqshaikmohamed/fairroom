# FairRoom submission handoff

## Project and default demo
The git root is `outputs/fairroom-final/current code`; its parent is not the project. Use Node.js 24+. From the git root:

```sh
npm install
cp -n .env.example .env
npm run dev
```

Open http://localhost:3000. `PORT` overrides the application port; development hot reload uses the next port. Keep one app process per database. `npm run build` followed by `NODE_ENV=production npm start` serves the production build on the same default port.

`.env.example` defaults to `DEMO_MODE=true`. Copying it is required: the server does not implicitly enable demo mode when the variable is absent. Demo mode skips the Photon worker, local iMessage bridge and scheduler, and prevents hosted message sends. No keys or tunnel are required with the example configuration. Optional model/review services stay disabled or unconfigured by default.

## Demo flow
Click **Meet FairRoom** to open Sam’s sample session. The fixture household contains Alex, Sam and Jordan with fake phone numbers. Alex and Jordan are ready; finish Sam’s saved preferences to generate the five-home shortlist. Open **Homes → Review split**, then **Conversation** and send `split C1`, `like C1`, and `saved`. The tutorial and Reset demo recreate this same household.

The existing internal IDs (`group-elm-trio`, `member-maya`, `member-sam`, `member-leo`) are retained for compatibility; the displayed names in demo mode are Alex, Sam and Jordan. With `DEMO_MODE=false`, the original fixtures remain unchanged for the regression suite. Sample room facts and photos are illustrative; matching, budget checks, cents, proposals, saves and chat state are computed.

## Implementation
React/Vite frontend, Express/tsx server, sql.js persistence. Key files: `server.ts`, `src/server/db.ts`, `routes.ts`, `agent.ts`, `deliveryService.ts`, and `src/engine/`. `FAIRROOM_DATA_DIR` changes the runtime database location, not the bundled fixture location. Do not run multiple writers against one database.

Group APIs require member sessions and enforce group membership. Public demo-session/reset endpoints intentionally expose fictional fixtures. Public listing/catalog pages contain listing details, not private surveys. This is a hackathon authorization model, not a production identity/recovery service. Missing costs and room facts remain unknown; a rent proposal is not an envy-free guarantee or a lease.

## Optional real iMessage mode — outside the submission smoke test
Set `DEMO_MODE=false` only when intentionally configuring live services. Hosted Photon needs project credentials and a group-capable line; a shared line does not establish native group support. The Mac bridge is a separate transport using the signed-in Mac’s Messages identity, not a new agent number. Install its dependencies separately with `npm install --prefix local-bridge`.

The real local household reads `FAIRROOM_TEST_RECIPIENT`, `FAIRROOM_GROUP_TEST_MEMBER` and optional `FAIRROOM_SISTER_PHONE`. Use country-code format. It requires the selected conversation, private invitations, completed surveys, consent and a public HTTPS app URL for phone links. See `PHONE-DEMO-SETUP.md`. No current keys, private database contents, phone receipts or live device setup were inspected in the submission audit. Do not describe web delivery or mock tests as verified iMessage delivery.

The local SDK compatibility patch modifies SDK files only, not Apple’s database; reevaluate it when upgrading. Keep Messages, the local process and any required tunnel running for an intentional live demo. Local replies are not mirrored into the web thread automatically.

## Optional sponsor integrations
Factory: `src/server/integrations/factory.ts` implements runtime evidence review using three restricted tools. Requests require an organizer session and localhost access, are rate-limited and cached. Credentials and a successful real run are required; the prepared sample review is not a Factory call.

Chalk: optional structured intent routing in `src/server/agent.ts`. `npm run eval:chalk` makes live requests and records local evaluation results; it is not Chalk-hosted Agent Evals. Core commands and money calculations work without a model. No live Factory or Chalk verification is claimed. No Daytona integration is included.

## Verification
Run from the git root:

```sh
npx tsc --noEmit
npx vite build
npm test
npm run test:api
npm run test:provider
node --import tsx scripts/test-demo-mode.ts
```

The original API/provider tests select `DEMO_MODE=false` and use temporary databases/mocks. The additional demo smoke test uses `.env.example`, a temporary database and port 3000; it never loads the private `.env`. If 3000 is occupied, use `TEST_PORT=3199 node --import tsx scripts/test-demo-mode.ts`. It checks all three survey sessions, five matches, exact rent totals, scout/chat/saves, reset and disabled bridge startup.

## Boundaries and remaining verification
Do not read, print or commit `.env`, runtime data, databases or private invitation files. No commits/pushes are part of this audit. Read `DEMO-GUIDE.md` for the web demo and `DEMO-AND-SPONSOR-TALKING-POINTS.md` for accurate sponsor descriptions. A clean clone installation and browser/device rendering must be distinguished from the API-based smoke test; neither live messaging nor sponsor calls are verified by that test. Chunk-size/install-script warnings alone do not mean the demo failed.
