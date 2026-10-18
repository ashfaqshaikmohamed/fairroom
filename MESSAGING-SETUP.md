# Photon 2.0 setup

FairRoom uses only the official Photon beta SDK for messaging. No live Photon account has been tested in this review.

1. Open https://app.beta.photon.codes and create/select a project. Obtain its `pho_prj_` ID and server-side project API key.
2. Ask Photon for a dedicated, group-capable iMessage line. Shared lines cannot support this group workflow. Confirm hackathon access/credits with the sponsor.
3. Copy `.env.example` to `.env`. Set `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `PHOTON_AGENT_HANDLE`, and `PUBLIC_APP_URL` to your HTTPS app. Set `PHOTON_ENABLED=true`, restart the server and keep it running.
4. The server polls Photon’s authenticated API every four seconds. This implementation needs no public inbound webhook. The public HTTPS URL is needed for mobile preference forms and listing links.

## Start from iMessage

1. Create a group with 2–4 roommates and the agent’s dedicated number. Use phone-number iMessage send-from identities for this demo.
2. Say **FairRoom start**. FairRoom checks the live roster, creates the group and responds with a join code. It does not fabricate preferences or opt anyone into alerts.
3. Each person sends the agent a **private** message: `join CODE Your name`. Codes expire after 24 hours; repeating `FairRoom start` renews the group’s enrollment window.
4. FairRoom checks that the sender is in the original group and that the group roster still matches. It replies privately with that person’s unguessable form link. An outsider possessing the group code cannot retrieve another person’s invitation.
5. Open the form, enter preferences, and explicitly opt into phone alerts. Once every roommate is ready, the app evaluates the saved catalog. Phone sends require every participant’s consent and an exact matching roster.
6. Use `FairRoom find homes`, `split REF`, `like REF`, `I need parking`, `pause`, or `resume` in the group. Preference changes ask for a member-specific confirmation code. To accept a saved proposal, say `accept REF vVERSION` with the actual reference/version from the reply.

**Form behavior:** the agent sends a tappable HTTPS link to a mobile form. It does not force a native iMessage popup. That beta capability has not been established in the inspected SDK.

## Use the prepared sample group for recording

The sample group has Maya, Leo and Sam and fictional matching homes. It is web-only by default.

1. Use **Try the sample group** and complete Sam’s preferences.
2. Have three consenting test participants use the demo member switcher in their respective browsers, save their actual phone numbers and explicitly opt into phone alerts.
3. Add those exact three numbers and the agent to an iMessage group, then send a message so Photon has a space for it.
4. In Conversation, switch to Maya (organizer), expand **Connect your chat**, load spaces, select the matching conversation and connect it.
5. Explicitly enable phone sending for the demo group. Resetting the demo disables sending and removes the binding.
6. Send `split C1` from a real phone. The expected sample result is Maya $1,520, Leo $1,280, Sam $1,040, total $3,840. Verify receipt on the other phones.

A real group excludes sample listings. Existing broker snapshots often lack room details; the agent will not invent a verified split to fill a shortlist. For a reliable live challenge demonstration, connect the explicitly labeled sample group above.

## Delivery and recovery

- Provider acceptance, reported delivery, and receipt observed on phones are different stages.
- Accepted-message receipts are reconciled every 30 seconds.
- Stable send keys and a persisted inbound log prevent ordinary replay duplicates.
- Uncertain or interrupted sends are retained for inspection and never blindly retried.
- If a participant joins/leaves or opts out, roster verification blocks sending until the configuration and consent match again.
- `stop` removes the sender’s opt-in and suppresses a follow-up group message.
- Claimed private invitations are tied to the original browser session. Account recovery is not implemented; use the original browser for subsequent edits.

## Optional language model

Set `OPENAI_API_KEY` and an available strict-JSON Responses model in `OPENAI_MODEL`. The model sees only the current message and allowed amenity vocabulary. Server code handles the actual search, rent math, consent, identity and revisions. Without the key, use the demonstrated quick commands. No live model call has been verified.

Official contracts: https://photon.codes/docs/beta/get-started/imessage and https://photon.codes/docs/beta/get-started/project. Integration is pinned to `@photon-ai/api` 0.5.0.


## First message to your own phone

Set `FAIRROOM_TEST_RECIPIENT` in `.env` to your own number with country code. Configure the project/key/agent line and enable sending. From your phone, iMessage the agent number with “hello” to create a private conversation. In the project directory run:

```sh
node --import tsx scripts/send-imessage-test.ts
node --import tsx scripts/send-imessage-test.ts --send
```

The first command verifies the recipient and previews a fictional home with calculated rent shares. The second sends exactly one message. This diagnostic does not enroll a group or replace the group workflow. A local receipt in `data/imessage-test-receipt.json` prevents accidental repeat attempts. Check the phone and provider history before retrying an uncertain request. API acceptance is not proof of phone receipt.

## Scheduled updates

The organizer can save a daily time in Conversation → Home updates (default 9 AM Eastern), and opt in to standout finds. Set `SCOUT_SCHEDULER_ENABLED=true` and keep the server running. Checks occur every minute. The daily run has a 15-minute catch-up window, excludes sample groups and avoids previously recommended listing revisions. Standout alerts require a fresh matching listing at least 15% below the median of five comparable homes, and are limited to one every six hours between 9 AM and 9 PM. These are comparison-based signals, not verified bargains.

The saved catalog does **not** refresh itself. New-listing alerts require newly imported, verified listing data; existing historical snapshots will not produce fresh alerts. Run a single server instance for the demo scheduler.


## Group capability diagnostic

Run `node --import tsx scripts/check-group-messaging.ts` after creating a group with two people and the configured agent number and sending `FairRoom start`. It reads line identity and visible group spaces without sending messages or printing keys. If no group appears, confirm inbound routing and dedicated-line access with the Photon team for this Beta project. Being on Beta alone is not evidence that a shared line supports groups. Do not remove roster or consent checks to work around provider restrictions.

## Home cards in Messages

Public `/listing/:id` pages now serve listing-specific Open Graph titles, descriptions, image URLs and canonical URLs before JavaScript runs. This supports rich link previews; iOS chooses the presentation. Only public listing facts appear in metadata, never private budgets or group invitation links. Fictional homes remain labeled. Test on a phone: ngrok’s visitor interstitial may interfere with link-preview fetches, so a stable public host is preferable for the recording. A branded verified business header or native interactive mini-app card is a separate provider/platform capability, not implemented by these tags.
