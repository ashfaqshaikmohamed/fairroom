# Free iMessage group demo on a Mac

This optional bridge uses Photon's open-source Spectrum local adapter, separately from the Photon 2.0 Beta cloud API. It supports existing iMessage groups, using the Apple identity signed into Messages on the Mac. It does not give you a new phone number. No provider subscription is needed for this local bridge; your Mac must remain awake and online.

## Identity

For a distinct FairRoom participant, use a spare Mac or a separate macOS user signed into Messages with a separate Apple Account. Invite that account's iMessage email address to the test group. Do not sign out of your main Apple account merely to try the demo. If you use your personal Messages account, agent replies appear as you; a second person must send commands because outgoing messages are ignored.

## Permissions and group selection

1. Open Messages in the Mac user that will host the agent and confirm manual send/receive works.
2. Manually create the test group with the agent account and two human testers. The local adapter cannot create groups.
3. Grant the terminal you will run the app from Full Disk Access in System Settings → Privacy & Security. Quit/reopen that terminal after changing access. macOS may also prompt for permission to control Messages when sending; approve it for this demo if desired.
4. From fairroom-final, run `node --import tsx local-bridge/list-groups.ts`. This explicitly reads group titles/IDs, not message bodies, and sends nothing. Copy only the intended group's ID.
5. The SDK's access is broader than the app's chat filter: it can access the Messages database. A dedicated account avoids exposing personal conversations. FairRoom discards other chats before its agent handler and has telemetry disabled.

## Configure .env

Append these values, replacing the placeholders:

```dotenv
FAIRROOM_LOCAL_IMESSAGE_ENABLED=true
FAIRROOM_LOCAL_CHAT_ID=iMessage;+;YOUR_ACTUAL_GROUP_ID
FAIRROOM_LOCAL_GROUP_ID=group-elm-trio
FAIRROOM_LOCAL_MEMBER_MAP={"+1FIRST_TESTER_NUMBER":"member-maya","+1SECOND_TESTER_NUMBER":"member-sam"}
```

Use the exact ID printed by the helper; do not construct it yourself. Use the sender's iMessage identity in the mapping (phone number or email). Mapping to a sample member authorizes use of that fictional profile, not impersonation of a real roommate. Leave the existing Photon cloud settings intact.

Stop the running FairRoom server and run `npm run dev`. Do not run two FairRoom processes against the same SQLite file. This bridge runs inside the same server as the website so changes share one database connection.

## Demo

Complete the sample group's preferences on the website first; the sample fixture starts with one pending roommate. From a mapped human tester's phone, send these to the group:

- FairRoom start
- FairRoom find homes
- FairRoom split C1
- FairRoom like C1
- FairRoom pass G1

This is currently a sample-only bridge with fictional profiles. It reuses matching, split calculations, preference-change confirmation and decisions. It does not yet collect a full preference survey through texts or implement saved-home retrieval. The website stores the sample decisions. It does not emit local messages as Photon-cloud delivery records. Incoming commands are deduplicated; uncertain sends are not automatically retried.

Do not add other people to the test chat while recording. Local membership-change events are unsupported. The bridge is intentionally not enabled for private real-group data until live roster checks are implemented.

## Turn off

Set FAIRROOM_LOCAL_IMESSAGE_ENABLED=false and restart. Revoke Full Disk Access afterward if no longer needed.

## Accurate challenge explanation

“Photon 2.0 Beta handles our hosted private iMessages. The free group demonstration uses Photon's open-source Spectrum local iMessage adapter on a Mac. FairRoom provides matching, proposed rent splits and preference logic.”

This distinction is material: using the local adapter is not proof that group messages passed through Photon 2.0, and prize eligibility is not confirmed. Do not represent this demo as a hosted dedicated-number service.

Official capabilities: https://photon.codes/docs/spectrum-ts/providers/imessage
