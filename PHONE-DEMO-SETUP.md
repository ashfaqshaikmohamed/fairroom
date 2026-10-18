# Three-person iMessage demo

1. With your sister’s agreement, set `FAIRROOM_SISTER_PHONE=+1...` in `.env`. Keep your existing owner and brother numbers.
2. In Messages, create a blue-bubble group with you, your brother and sister. Name it **FairRoom Home Search** and send one ordinary message so it syncs to the Mac.
3. From this project folder run `node --import tsx local-bridge/configure-phone-group.ts`. It selects that exact named conversation without sending a message.
4. Restart the running FairRoom server. Open `data/phone-survey-links.txt` locally. Send each person only their own invitation privately. Do not record the invitation tokens.
5. Each person completes their own survey and enables phone alerts. In the selected group send **FairRoom start**. Once all three are ready, the agent sends one real saved listing, or explains that nothing meets the requirements. Unknown facts are called out.
6. Reply using the reference in the message: **FairRoom like H…**, **FairRoom saved**, **FairRoom check H…**, or **FairRoom find homes**.

The Mac must stay awake with Messages, the server and ngrok running. Replies use the Mac owner’s Messages identity. There is no additional agent identity created by adding a third roommate. A separate agent number requires a supported dedicated messaging line.

## On the website
`/homes` browses all 209 broker records. Filter by city, bedrooms, neighborhood and maximum base rent; open a home for its source, published contact number, date and shareable link. A link to a group match now opens that exact home even when it needs verification.

203 source pages were refreshed during this update; six retained previous snapshots. Check `data/catalog-refresh-report.json`. Coverage: Cambridge 91, Somerville 78, Medford 31, Arlington 9. Street addresses are not always published: neighborhood and listing number are shown instead. Contacts are published brokerage numbers, not invented individual agents. No catalog can satisfy every combination of budget and requirements.

## Demo distinctions
The landing preview and sample household use fictional homes and profiles; real phone households exclude those homes. The optional sample review is prepared output. Real listing cards say saved listing / confirm availability. The Mac bridge is a local transport, not Photon-hosted group messaging. See DEMO-DISCLOSURES.md for exact code references.
