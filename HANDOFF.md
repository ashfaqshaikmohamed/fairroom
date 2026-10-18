# FairRoom handoff — October 17, 2026

## Current source and launch
The active code is in `outputs/fairroom-final/current code`, NOT its parent or the old Google Studio exports. The parent folder was rearranged while a server was running; that server was stopped and restarted from this folder. From this folder run `npm run dev`. Node 24 is installed. Local server uses port 4300 from .env. The user's ngrok tunnel forwards https://your-app.ngrok-free.dev to 4300. Keep both processes and the Mac awake. Do not run concurrent servers against this sql.js database.

## Latest verified outcome
The local iMessage listener received the brother's `FairRoom start`, submitted one reply, and the user confirmed that reply arrived. It runs in the existing two-person conversation, sending from the user's own Apple Messages identity. It is NOT a separate third participant or the hosted Photon number. Incoming commands must come from the brother. Replies begin `FairRoom ·`. Three fictional roommate profiles are already ready. Only the greeting has been confirmed end-to-end on the phone; the remaining commands have passed local agent tests but need a phone rehearsal.

## Why it previously failed
Photon's imessage-kit 3.0.0 queries message.ck_chat_id, absent on this Mac. The local listener crashed before processing. `local-bridge/patch-sdk.mjs` replaces that SELECT expression with NULL; routing still uses the joined chat GUID. It modifies SDK files only, never Apple's database. It is wired into local-bridge's postinstall. Reapply with `node local-bridge/patch-sdk.mjs` if reinstalling. This patch needs reevaluation when upgrading the SDK.

## Local bridge
- `local-bridge/bridge.ts`: Spectrum + localIMessage adapter; one exact chat ID, explicitly mapped senders, inbound text only, FairRoom prefix, timestamp cutoff, durable dedup, no retries after an uncertain send.
- `local-bridge/configure-demo-dm.ts`: finds the configured consenting brother's existing direct chat, writes local bridge settings to .env. Normalizes phone formatting. Does not send.
- `local-bridge/list-groups.ts`: only lists exact named groups (default FairRoom Demo), not the user's whole chat inventory.
- Local SDK dependencies are isolated in `local-bridge/package.json`; install with `npm install --prefix local-bridge`.
- Enabled in server.ts by FAIRROOM_LOCAL_IMESSAGE_ENABLED=true. To stop this bridge set false and restart.
- FAIRROOM_LOCAL_MEMBER_MAP maps the brother to fictional member-sam. This is a declared sample demo, not real onboarding or his actual housing profile.
- Native group support is implemented by the adapter but NOT live-tested with 3 participants; user has only two available. Do not call the direct-message demonstration a verified group test.
- Local scheduled messages and website mirroring of local replies are NOT implemented. No arbitrary personal conversations are authorized.

## Photon 2.0
Hosted private iMessage test previously delivered and user confirmed. @photon-ai/api 0.5.0. Existing configured line is shared. Native group creation returned HTTP422 SPACE_REQUIRES_OWNED_AGENT; SDK also defines SHARED_LINE_GROUP_UNSUPPORTED. Provisioning a paid dedicated line was not authorized. Do not bypass these restrictions or claim local sends came through hosted Photon 2.0. Accurate description: Photon 2.0 for hosted private messages, Photon Spectrum's local adapter for the Mac demo. Sponsor eligibility of the combined setup remains organizer-dependent.

## App and data
React/Vite + Express/TypeScript + sql.js. Database: data/fairroom.sqlite. Keep one writer process. The app has saved listing snapshots, fictional demonstration homes, preference forms, deterministic matching, room allocation, rent proposal revisions/acceptances, bookmarks, and optional scheduled checks of the stored catalog. It does not continuously scrape new listings. Unknown room facts are not invented. A budget-fitting proposal is not a proof of mathematical envy-freeness or universal fairness.

Key files: src/server/agent.ts, db.ts, photon.ts, photonWorker.ts, deliveryService.ts, notificationSchedule.ts; src/engine/matching.ts, groupPlan.ts, rentSplit.ts; server.ts; src/server/linkPreview.ts.

`FairRoom saved` now returns the requesting member's saved homes; `like C1` saves and `pass C1` removes from that shortlist. No new authentication or real account service was added. Existing website authorization must be audited before making production privacy claims.

## Rehearsal (brother sends, user records incoming/replies)
1. FairRoom start — sample-data disclosure.
2. FairRoom find homes — five matches, proposed shares, public listing links.
3. FairRoom split C1 — room-specific proposal, total, version.
4. FairRoom like C1 — saved for the mapped fictional member.
5. FairRoom saved — retrieve the saved home without leaving Messages.
6. Optional FairRoom I need parking — explicit confirmation code before mutation. Prefix the confirmation with FairRoom too. This changes later results, so record the baseline first.
Keep phone recording free of other people's private messages. The website and rich link preview are optional detail views. Public link metadata exists; actual rich-card appearance on iPhone remains unverified. Ngrok may show an interstitial.

## Tests run
npm run lint; npm test; npm run build passed before the final SDK compatibility patch. scripts/test-agent-demo.ts passed top-five count, split, save/retrieve/pass, mocked Chalk routing, model outage fallback. SDK query after patch succeeded; listener stayed active and live greeting arrived. These are not live Chalk or Factory tests. Build has a >500KB chunk warning, not a build failure.

## Secrets / accounts
Never print .env, commit it, or send it to another AI. Existing keys remain local. Do not distribute current code.zip: it was created outside the packaging workflow and may contain .env and private database/receipts. Build a clean archive excluding .env, databases, receipts, node_modules, .tools, dist and caches.
Photon: PHOTON_API_KEY, PHOTON_PROJECT_ID, PHOTON_AGENT_HANDLE, PHOTON_ENABLED; PUBLIC_APP_URL for links. OpenAI: OPENAI_API_KEY and OPENAI_MODEL if used. ngrok token belongs in ngrok's config, not application source. Local iMessage bridge needs no new paid API key.
Optional Chalk routing is implemented but UNCONFIGURED/UNVERIFIED live: AI_PROVIDER=chalk, CHALK_ROUTER_API_KEY, CHALK_ENV_ID, CHALK_MODEL. Gateway URL is https://api.chalk.ai/v1/router/responses; X-Chalk-Env-Id header. Uses model for intent classification only, then deterministic tools. Configure a provider connection and scoped gateway key in Chalk dashboard. Default commands continue without a model. Do not claim evaluation results from mocked tests are Chalk-hosted evals.

## Remaining work in priority order
1. Rehearse find/split/save/saved on actual phones; inspect local_imessage_inbox status without exposing message bodies. Never blindly retry an uncertain outbound send.
2. Complete handoff demo recording showing actual messages, fictional labels, and optional website details.
3. Chalk account/credits, configure gateway, run a real request and record trace; deploy a repeatable eval set for budget enforcement, unavailable facts, unauthorized updates and duplicates.
4. Optional Factory product feature: runtime listing-data audit/adapter repair in an isolated workspace; install Droid SDK AND CLI, authenticate, constrain files/tools, validate extracted facts and require review. Not implemented. No model-training claim.
5. Optional Daytona: run that parser and its tests in a disposable sandbox with no private member records/secrets. Not implemented.
6. Multi-channel: do not present Telegram/voice as working. Add only after a real configured channel can be verified end-to-end. Use one shared agent engine but platform-specific identity/consent.
7. Package source safely, update README/demo video with exact integrations and limitations. No submission sent automatically.

## Latest update — Factory/Chalk scope only
User removed Daytona. SDK removed. Factory SDK and project-local Droid 0.174.0 installed. New runtime review implementation: src/server/integrations/factory.ts, invoked via authenticated group listing-check POST, organizer-only, additionally localhost-only to prevent public fixture sessions triggering paid work. GET returns deterministic checks and saved review. Factory is off pending FACTORY_API_KEY + FACTORY_ENABLED=true; never claim live verified. Chalk credentials also still absent. evals/intent-cases.json + scripts/evaluate-chalk.ts provide ten live-gateway tests with model-success counters so fallback cannot masquerade as gateway success.

UI: ListingCheckPanel.tsx in Homes; minimal expandable evidence and broker questions. Missing listing photos use unavailable.svg rather than fabricated stock interior. Landing Meet FairRoom now preserves existing fixture state instead of resetting the live messaging demo. Rent drawer no longer initially labels base rent as complete monthly total. Keyboard focus/reduced-motion styles added. 37 isolated API checks passed, typecheck and build passed. API test subprocess explicitly disables local Messages, cloud messaging, scheduler and paid integrations. Desktop drawer and narrow evidence panel inspected through CUA; no final video exported. RECORDING-SCRIPT.md is the actual shot list, not a completed video. Complete final review/recording only after live sponsor credentials and results are available.
