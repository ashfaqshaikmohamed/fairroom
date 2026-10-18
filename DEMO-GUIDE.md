# FairRoom recording guide

## The story

“Three roommates can all like the same apartment and still disagree about who pays what. FairRoom lives in their group chat, learns what each person needs privately, and brings back homes with a room and a workable rent share for everyone.”

For submission rehearsal, use the keyless web conversation with DEMO_MODE=true. Real messaging is a separate optional demonstration.

## Built-in guided walkthrough

Click **tutorial** in the landing navigation or **Take the walkthrough** below the headline. Read the four short tutorial panels, then choose **Start guided demo**. The guide resets the fictional sample, opens Sam’s session, waits for all preferences, then leads through homes, the Courtyard split and the conversation. Use the chevron to collapse it while interacting, or the × to exit. You can reopen the tutorial using **Tutorial & demo** in the workspace footer.

## Web demo — no keys

1. Start the app and open the landing page at 1440 × 1000. Click **Meet FairRoom**. This preserves the sample group; use Reset demo for a fresh take. Phone sending stays off in demo mode.
2. In Conversation select **Sam**. Open **roommates**, then **Add my preferences**. Alex and Jordan are already ready in demo mode.
3. Sam’s saved budget is $1,100. Set bedroom minimum to **120 sq ft**, leave bathroom flexible, and keep the sample locations/dates. Continue through the form and choose **Find our homes**. Keep phone alerts off for the web recording.
4. Open **homes**. Show the **five matching homes** and click **142 Hampshire St, Apt 2** (the Cambridge Courtyard sample, reference C1). The proposed shares are **$1,520 / $1,280 / $1,040**. Those are computed, not screenshots or fixed response text.
5. **Review split**. Point out the private bathroom and different room sizes. Sam’s budget check is visible only in Sam’s session. Accept the current revision and share it to the group chat.
6. In **conversation**, send **split C1**. Show the calculated reply and its versioned acceptance command.
7. Send **I need parking** as Sam. FairRoom asks for confirmation. Reply with the exact displayed `confirm CODE`. The shortlist updates: the Courtyard sample disappears and the parking-compatible Garden sample remains. Do not pre-record a fake confirmation code.
8. End on the five-home screen from a fresh reset/recompleted sample or on the conversation. The footer has **Reset demo** for another take.

The source folder’s automated tests cover privacy, preference updates, exact costs, deduplication and stale-approval rejection. Do not claim web messages were delivered through iMessage.

## Photon footage — needed for the challenge

Follow MESSAGING-SETUP.md to connect a real, group-capable Photon number. Record the actual Messages app receiving a reply on at least two devices. You can connect the prepared sample group with three consenting testers; say on screen that listings/rooms are sample data.

Suggested sequence: actual group message → private form → five-home shortlist on the website → `split C1` in Messages → real agent reply → everyone reviews the proposal. This is the proof that Photon is part of the product, not a logo added to a web chat.

Do not try to show every optional feature. Keep vacation splitting, raw source audits and connection settings out of the main 90-second story.

## Suggested narration

- 0–15s: “Finding a place is a group decision. Most housing search tools still treat it like a solo search.”
- 15–35s: “FairRoom joins the conversation. Each roommate privately shares their budget, room needs and must-haves.”
- 35–55s: “It eliminates homes that cannot work, then ranks the group’s best options. It assigns rooms and calculates a proposal that fits every budget.”
- 55–75s: “A bigger room can carry a larger share. Everyone can review, adjust and accept the same version. No awkward budget disclosures.”
- 75–90s: “When someone needs parking, the group confirms the change and the shortlist changes. One conversation, one home that works for everyone.”

## What is seeded, what is live

Seeded: nine fictional homes, sample-room dimensions, illustrative photos and three fictional people; five homes initially qualify. Also included: 209 historical broker snapshots, not live availability.

Computed: constraints, ranking, room assignment, capped prices, exact cents, preference revisions, conversation persistence and approvals.

Integrated but awaiting your credentials and real-device test: Photon phone delivery and optional OpenAI language understanding. The phone form is a link, not a native popup. The recurring agent checks the saved catalog rather than claiming fresh web search.
