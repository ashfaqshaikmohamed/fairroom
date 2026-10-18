# FairRoom: launch and recording runbook

> **Updated form flow:** `FairRoom start` now sends `/shortlist?survey=1`. Each roommate fills out their own form, taps **Send to group**, chooses Messages and the existing FairRoom conversation, then sends. This explicitly shares the answers with the group; it is not an automatic server submission. Once both replies arrive, the agent sends **Preparing your shortlist from our saved Cambridge listings…**, waits briefly, then sends five options. The typed preference lines below remain a fallback. Redeploy the rebuilt `shortlist-dist` site and restart the listener before testing this update. The static site cannot notify the Mac without the user's share/send step.


## 1. What is ready

There are two demonstrations. Keep them distinct:

1. **Phone shortlist demo (new):** local Messages listener → typed roommate preferences → five saved Zillow buildings → public mobile shortlist. Real messages, real public building links, preset catalog and simple recorded-price ordering. No model calls. The ten-building rotation resets when the listener restarts.
2. **Full FairRoom app (existing):** authenticated group workspace, private surveys, matching engine, rent proposals, evidence checks, and optional sponsor adapters. The public static shortlist deployment does not include this backend.

The new page's bookmark button saves on that browser/device, not a shared account. Website preferences do not sync back to the chat. Room/bath/size/amenity inputs are captured but are not verified against the ten saved building pages. Do not call those five results guaranteed fits or fresh inventory.

## 2. Keep the public site on Vercel

The temporary public deployment is already verified. It expires 60 minutes after creation unless claimed. Use the private claim link in this conversation, sign in to Vercel, select your account/team and complete the claim. Open the deployment afterward and confirm `/shortlist` works on your phone. Vercel describes the ownership transfer at https://vercel.com/docs/deployments/claim-deployments .

If you prefer a new permanent deployment, open VS Code → Terminal → New Terminal and paste:

```sh
cd "/Users/ashfaqsm/Documents/Codex/2026-10-10/i-have-a-hackathon-at-hackharvard-3/outputs/fairroom-final/current code"
node scripts/package-shortlist.mjs
cd shortlist-dist
npx vercel login
npx vercel --prod
```

Complete sign-in in your browser. In the deployment prompts select your account, create a project (for example `fairroom-shortlist`) or select your claimed project, and use the current folder. This is a prebuilt static site: no framework build and no server environment variables are needed. Copy the returned production URL. Open both its homepage and `/shortlist` on your phone.

Deploy only `shortlist-dist`, not the parent workspace or `.env`. Do not add Photon, Chalk or Factory keys to frontend variables. Publishing this site does not run the Mac listener.

For later updates, return to `current code`, run `node scripts/package-shortlist.mjs`, enter `shortlist-dist` and redeploy. The package rebuild may remove the local Vercel project association, so select the same project again if prompted. No new source files have been committed or pushed for you; importing the existing GitHub repo alone will not include these uncommitted changes.

## 3. Start the iMessage demo

Use your existing **FairRoom Home Search** group. The current sender is your own Messages account on your Mac. With you, your brother and sister in that chat, let your brother and sister be the two survey respondents. You can send the start command. A separate agent sender would require a separate signed-in iMessage account or supported provider line; changing a contact name does not create one.

Stop any old FairRoom messaging listener first. If the full server starts a legacy bridge, stop that server or run it with demo mode enabled. Run only one listener for this conversation.

In a new terminal:

```sh
cd "/Users/ashfaqsm/Documents/Codex/2026-10-10/i-have-a-hackathon-at-hackharvard-3/outputs/fairroom-final/current code"
node --import tsx local-bridge/watch-listing-suggestions.ts "FairRoom Home Search" --roommates 2 --site https://YOUR-SITE.vercel.app
```

Replace the example HTTPS origin with your actual deployed URL; do not append `/shortlist`. If dependencies are missing, run `npm install` and `npm --prefix local-bridge install` from this folder first.

Leave the terminal open and Mac awake. The standalone listener needs no API key or ngrok tunnel. It relies on the Mac's existing Messages/automation permissions.

Send in the group:

```text
FairRoom start
```

Your brother sends:

```text
FairRoom preferences: room=own; bathroom=shared; sqft=900; amenities=laundry, natural light; budget=2200
```

Your sister sends:

```text
FairRoom preferences: room=own; bathroom=shared; sqft=900; amenities=parking, dishwasher; budget=2400
```

These are example values for a recording, not claims about their finances. Use the exact `key=value` format; this listener is a command parser, not a free-text language model. After the second distinct sender replies, the assistant posts five Zillow links and the shared page link. If all three of you submit preferences, restart with `--roommates 3`.

Then send:

```text
send new postings
```

Each command returns the next saved building. It wraps after ten. Do not start multiple listeners or repeatedly retry an unconfirmed send.

## 4. Exact screen-recording sequence (about two minutes)

Prepare Messages on your phone and the public site in Safari. Enable a quiet notification mode if desired, keep unrelated personal chats out of frame, and run a rehearsal before recording. On iPhone use Control Center → Screen Recording. For Mac footage, Shift–Command–5 offers screen recording; select the app area. You can assemble these clips in your preferred editor. This document is a recording script, not an already-rendered video.

| Time | Action to record | Suggested narration |
| --- | --- | --- |
| 0:00–0:12 | Show the group chat before the command. | “Apartment hunting gets harder when every roommate has a different budget and idea of home. FairRoom brings the search into the conversation you already have.” |
| 0:12–0:25 | Send `FairRoom start`; show the assistant's reply. | “Start the search in iMessage. FairRoom asks everyone for their wish list.” |
| 0:25–0:45 | Show the two different people sending their prepared preference lines. | “Each person shares their room, bathroom, size, amenities and budget. The assistant waits for everyone.” |
| 0:45–1:02 | Show the five-link response. Scroll slowly enough to read two entries. | “Once everyone replies, we bring the group a shortlist to discuss. This walkthrough uses recorded Cambridge listings.” |
| 1:02–1:20 | Tap the **View your five places** link. Scroll through the cards; tap a bookmark. | “The same five places open in a clean mobile view. You can save a favorite on your device and open the actual listing.” |
| 1:20–1:32 | Tap **Explore photos & floor plans** on Church Corner. Show its Zillow page. | “These links lead to real building listings, where you can check current units and details.” |
| 1:32–1:45 | Return to Messages and send `send new postings`; show one new suggestion. | “Want another option? Ask in the chat.” |
| 1:45–2:00 | Return to the shortlist. Tap **Your preferences**, show the roommate tabs, then **Show five places**. | “There is also a web input flow. The next step is connecting verified inventory and richer matching to this messaging experience.” |

If filming the web form takes too long, make it a separate ten-second clip. Do not claim the web preference edit updates the group chat; this new demo does not sync them.

At the end or in the Devpost implementation notes include: “Demo: saved Zillow catalog; iMessage sent through a local Mac bridge.” Describe the exact role of the Mac owner account. An edited video may shorten waits, but should not imply an API ran when it did not.

### Optional Digital Trust segment (full local app, separate from public shortlist)

Open the full local app. Click **Meet FairRoom**. Complete any pending sample survey, inspect a home, show the calculated room split and open **Before you commit**. Show missing fees/evidence and broker questions. If showing a prepared review, use its **Preview sample review** label. The existing in-app **Tutorial & demo** control walks through the workspace.

Say: “Our broader app makes costs and uncertainty visible. Rent shares are calculated by code, and missing evidence stays marked as unknown.” Do not describe the current public five-card page as providing private surveys or calculated room shares; those belong to the full app.

## 5. Sponsor setup and judge explanations

The standalone chat listener and static site do not call Chalk, Factory or hosted Photon. Setting keys does not change that. Sponsor demonstrations use the full local app and existing backend adapters. Accounts, configuration and a successful live run are needed before calling those integrations demonstrated.

### Chalk

Use https://chalk.ai/hackharvard for event access. In Model Gateway, connect an available provider, test a model in Playground, and issue a gateway API key. Copy the environment and model identifiers from the dashboard's request example. Official setup: https://docs.chalk.ai/docs/model-gateway .

In the project's local `.env` add/update:

```dotenv
AI_PROVIDER=chalk
CHALK_ROUTER_API_KEY=your_gateway_key
CHALK_ENV_ID=your_environment_id
CHALK_MODEL=your_exact_available_model_id
```

Do not paste keys into chat or put them in the public deployment. Gateway requests use configured upstream credentials and may cost money; check your sponsor credits and budget first.

From the project root run:

```sh
npm run check:sponsors
npm run eval:chalk
```

The first checks configuration only. The second makes ten real gateway requests; inspect the reported successes and failures yourself. A fallback is not evidence of a successful model call. Evaluation output is local, not Chalk-hosted Agent Evals. Restart the full app after configuring keys. Send a natural-language housing request through its web conversation and show the corresponding gateway activity if available.

**After a successful live run, say:** “We use Chalk's Model Gateway to turn roommate language into structured actions. Our own code enforces the budget and calculates rent. We evaluated routing on ten cases; here's our measured result.” Give the actual result, not an assumed perfect score.

**If you did not run it, say:** “The Chalk adapter is implemented, but this recording uses deterministic commands. We haven't demonstrated the live integration.”

Code: `src/server/agent.ts` (`interpret`) and `scripts/evaluate-chalk.ts`.

### Factory Droid SDK

Sign in to Factory, obtain API access/credits and create an API key. Use https://docs.factory.com/sdk/typescript for the supported SDK setup. Set locally:

```dotenv
FACTORY_ENABLED=true
FACTORY_API_KEY=your_factory_key
```

Restart the full app. Open a home → **Before you commit** → **Get independent review**, while viewing as the organizer. Allow up to 90 seconds. If that button is unavailable, check account configuration and organizer identity. The **Preview sample review** button is different: it does not call Factory.

**After a successful live run, say:** “Droid operates inside our running product as a rental-evidence reviewer. It reads the saved listing, runs our fact checks, and submits broker questions. We limit it to three tools and keep private roommate surveys out of the review.”

Show the generated review and an actual completed SDK session if asked. Explain why this helps: vague listing text becomes specific questions about missing fees, room information and availability. It is not a property inspection or a fraud guarantee.

**If not run, say:** “The runtime SDK adapter is built; this prepared example shows the intended review output.” Installing the SDK or using a coding assistant to build the app alone does not prove runtime use.

Code: `src/server/integrations/factory.ts`, `src/components/ListingCheckPanel.tsx`.

### Photon

You previously confirmed a direct message arrived through the configured provider. The new group demonstration uses the local Messages SDK, not the hosted Photon 2.0 group transport. Show an actual supported Photon channel separately and confirm it meets the challenge's version requirement. Explain the distinction if asked; do not present local Mac delivery as proof of hosted group support. The shared-line group attempt was rejected by the provider.

## 6. Submission choice

Based on the track descriptions you supplied, **Digital Trust is the strongest fit for the full FairRoom project**: transparent costs, private survey boundaries, evidence uncertainty and auditable rent calculations. Include the full-app evidence/rent segment to support that framing. The current public shortlist alone provides weaker evidence for this track. Confirm the final category in the submission portal; I did not verify the Digital Trust label on the current public page.

The event lists tracks and sponsor challenges separately; that does not establish whether you may win multiple awards. Check the portal/organizers for stacking rules.

| Category | Recommendation |
| --- | --- |
| Chalk | Submit after a meaningful live gateway run and measured evaluation. |
| Factory | Submit after showing Droid doing the runtime review. |
| Photon | Submit with actual Photon 2.0 channel use; disclose the separate local group bridge. |
| SpaceXAI / Cursor | Skip with the current project. The stated challenge requires a space-data project plus Cursor and a specified Grok API. |
| Nessie | Skip: no demonstrated Nessie runtime use. |
| Daytona | Out of scope at your request. |
| Clinical trials / ASUS sustainability | Poor fit for the present implementation; do not invent benefits or measurements. |

Official challenge descriptions: https://hhuh.io/ . No submission has been made for you.

## 7. Questions judges may ask

**What is actually working?** “Messages are delivered through the Mac; distinct participant inputs trigger a five-link reply; those links open the same five buildings on the website. The website supports preferences, outbound listing links and local bookmarks.”

**Is it AI searching Zillow in real time?** “Not this walkthrough. It rotates a recorded ten-building catalog. Live inventory discovery and verified feature extraction are future work.”

**Why not a group chat and Zillow links?** “A group chat holds conversation but doesn't organize everyone's constraints or produce an agreed shortlist. We are testing that coordination layer. The broader app adds auditable room-dependent rent proposals.”

**What are the limitations?** “The shortlist isn't guaranteed to satisfy every constraint. Prices and availability change; the saved data needs verification. The local bridge needs an awake Mac. Web and chat preference sessions are separate in this demo.”

**Who sends the messages?** “The account signed into Messages on the demo Mac. A dedicated agent identity is a separate provisioning step.”

**Did you train a model?** “No. The current numerical engines and demo rotation are code; optional model integrations perform bounded interpretation or evidence review.”

## 8. Verification already performed

- TypeScript check: passed.
- Full Vite build: passed, existing large-chunk warning remains.
- Static shortlist package: passed and publicly deployed; direct shared-list route verified.
- Existing engine tests: passed.
- API regression suite: 40 checks passed.
- Provider/worker/enrollment tests: passed (not evidence of live provider execution).
- New shortlist tests: passed, including duplicate suppression and reply-loop prevention.
- Browser: preference submission, five cards, bookmark toggle and exact shared-link selection verified.
- Existing one-off local Messages delivery: user confirmed earlier.
- New automatic listener: code/tests verified; complete the phone rehearsal to verify real end-to-end delivery.

Do not open `.env`, private files or unrelated messages during screen recording. No commit/push was performed for these latest changes.
