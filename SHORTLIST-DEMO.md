# The iMessage shortlist walkthrough

> **Updated form flow:** `FairRoom start` now sends `/shortlist?survey=1`. Each roommate fills out their own form, taps **Send to group**, chooses Messages and the existing FairRoom conversation, then sends. This explicitly shares the answers with the group; it is not an automatic server submission. Once both replies arrive, the agent sends **Preparing your shortlist from our saved Cambridge listings…**, waits briefly, then sends five options. The typed preference lines below remain a fallback. Redeploy the rebuilt `shortlist-dist` site and restart the listener before testing this update. The static site cannot notify the Mac without the user's share/send step.


This is a working local messaging transport with a preset public Zillow catalog. It does not demonstrate a live Zillow search, AI inference, hosted Photon group support, Chalk or Factory execution. The existing full application and its integrations remain separate.

## What runs

- `src/demo/shortlist.ts`: ten real Cambridge Zillow building links, recorded advertised rents, preference parsing, five-result selection and message copy. Recorded prices are not current quotes. Room/bath/size/amenity constraints are collected but not verified against these buildings. Results are ordered by recorded rent, not claimed to satisfy every preference.
- `local-bridge/watch-listing-suggestions.ts`: reads new commands in one exact named iMessage group and sends through this Mac's Messages identity. Old messages, other conversations and repeated message IDs are ignored. A failed/unconfirmed send pauses handling. No automated application-level retries.
- `src/components/ShortlistDemo.tsx` and `shortlist.css`: warm mobile-friendly preference form, five cards, external Zillow links and device-local bookmarks. Chat links carry only listing slugs, not roommate identities or budgets. Web preferences and chat preferences are separate in-memory sessions.
- `local-bridge/send-listing-suggestion.ts`: existing manual sender, now with warmer copy and Church Corner by default.

## Run the recording

From the git root, the folder named `current code`:

```sh
npm install
npm --prefix local-bridge install
```

Close any previous FairRoom messaging listener first; do not run two listeners for the same group. Keep the web app in demo mode to avoid also running its legacy local bridge. The standalone listener does not load `.env` or need a key.

Use a group containing only the consenting demo participants, named **FairRoom Home Search**. For two human respondents:

```sh
node --import tsx local-bridge/watch-listing-suggestions.ts "FairRoom Home Search" --roommates 2 --site https://your-public-site.example
```

Replace the example site with the deployed page's HTTPS origin (or your existing working tunnel). Use `--roommates 3` if three humans will reply. The agent identity does not count unless the Mac owner also submits a preference message as a roommate. An existing group works. Keep the Mac awake and this terminal running.

1. Send `FairRoom start` in the group.
2. Each roommate replies from their own identity with their edited version of:

```text
FairRoom preferences: room=own; bathroom=shared; sqft=900; amenities=laundry, parking; budget=1800
```

3. The last reply triggers a message with five Zillow links and a website link to those same five buildings.
4. Open that link for the five-card view. Save a home or open its photos on Zillow.
5. Text `send new postings` to cycle one at a time through the ten saved properties. The eleventh repeats the first. Restarting the listener resets both preferences and the rotation.

Use sample budgets: group-chat messages are visible to everyone in that conversation. The app does not treat these as private survey responses.

A distinct agent email/number requires a distinct iMessage identity signed into the sending Mac. This helper cannot create an Apple identity or send as somebody else's number. With the current Mac configuration, it sends as the Mac owner. macOS may require Full Disk Access and permission for Terminal/Node to control Messages, as with the existing helper.

## Web preview and deployment

The full local app serves `/shortlist` after restarting it from this git root. To preview only the new static demo:

```sh
npx vite --config vite.shortlist.config.ts --host 127.0.0.1 --port 4315
```

Open `http://127.0.0.1:4315/shortlist.html`.

Build an isolated public deployment:

```sh
node scripts/package-shortlist.mjs
cd shortlist-dist
npx vercel --prod
```

Complete Vercel sign-in if prompted. Deploy this generated directory only; it contains a static site, not server code, private app data or `.env`. Open the returned public URL. Use its origin with `--site` above. This deployment includes only the shortlist experience, not the full authenticated FairRoom backend or Messages worker.

## Verification

```sh
node --import tsx scripts/test-shortlist-demo.ts
npx tsc --noEmit
npx vite build
npm test
npm run test:api
npm run test:provider
```

The new test uses fake chat IDs and mocked events. It checks rotation, parsing, individual responses, wrong-chat/old-event rejection, duplicate commands, five-result handoff and outgoing-reply loop prevention. It sends nothing. Actual incoming-to-outgoing delivery of this new listener still requires a consenting phone test.

## One-respondent conference demo

Use `--roommates 1` when only your brother will submit. Start the conversation, let him share his form answers, and the five-listing reply follows immediately. No sister response is needed. This uses the first respondent’s preferences, not combined preferences from the whole group. Restarting clears the in-memory responses.
