# Current scope update

Factory and Chalk only, alongside existing Photon. Daytona was explicitly removed by the user. The optional concepts below are historical planning, not completed integrations. See FACTORY-CHALK-SETUP.md and HANDOFF.md for the current implementation and verification status.

# FairRoom submission plan

## Recommended track: Digital Trust
Pitch: “Find a home together without exposing everyone's private limits or making someone silently overpay.” Demonstrate declared hard constraints, transparent room-based prices, exact totals, versioned agreement, and confirmation before preference changes. Show unknown facts as unknown. Privacy claims must match the actual access control; a polished sample alone is not production security.

HackHarvard lists Tracks and Challenges separately. Sponsor challenges add technology-specific requirements; the public page does not establish how many categories one entry may select or whether multiple prizes may be won. Check the Devpost form/organizer rules. Do not assume all submissions are permitted. Source: https://hhuh.io/

## Priority / meaningful implementation
1. Photon: strongest product fit. Show actual hosted private iMessage plus transparently identified local Mac demo. Requirement is Photon 2.0 on at least one channel, not every channel. Current free local path alone is not evidence of hosted 2.0 group support. Detailed Notion guideline could not be retrieved by the research tool; review it manually before final submission.
2. Chalk: optional gateway now in code. Activate with real credentials, demonstrate natural language -> typed intent -> deterministic housing tools, and retain a real trace. For stronger judging, run dataset-driven evals covering impossible budgets, missing room data, changing preference confirmation, and duplicate delivery. Local mock tests are not hosted eval results. https://docs.chalk.ai/docs/model-gateway and https://docs.chalk.ai/docs/evaluations/quick-start
3. Factory: add a “check this listing” runtime operation. Droid reads a public listing snapshot in an isolated directory, builds/runs an extraction check, and returns cited fields, missing facts and discrepancies for review. Never give it app secrets or the roommates' database. This directly improves housing data quality; using Droid only to build FairRoom does not satisfy the challenge. SDK requires authenticated Droid CLI too. https://docs.factory.com/sdk/typescript
4. Daytona: host the preceding extraction/test task in a disposable sandbox, run real code and retain actual execution logs. No need to train a model. A model-training story without training is not an integration. https://www.daytona.io/docs/
5. Nessie: optional “can we afford move-in?” scenario with explicitly simulated balances and deposits. Must actually call Nessie and label simulated banking. It adds scope and is lower priority than a reliable messaging demo. https://nessieisreal.com/
6. Cursor/SpaceXAI: poor immediate fit. Requirements include real space data AND development with Cursor AND Grok Imagine or Voice. A possible later module compares satellite-derived heat exposure by neighborhood and narrates source-backed differences, but this needs authentic data, geographic resolution checks and genuine Cursor work. Do not submit simply because Cursor was opened or Grok generated decoration.

Clinical Trials is not a fit. Sustainability could fit a genuine transit/energy comparison but requires meaningful environmental evidence; don't claim emissions savings from roommates sharing an apartment without measurement. ASUS content challenge requires Sustainability-track content plus specific public tags and proof form. Prioritize Digital Trust rather than diluting the project.

## Demo story
“We already coordinate our lives in Messages. FairRoom turns that conversation into a shortlist everyone can afford, with clear room prices and an explicit choice.” Show find homes -> compare C1 room prices -> like C1 -> saved. Explain the chosen constraints and sample data. Show one hosted Photon exchange separately if the main demo uses the local adapter. Do not imply a third bot identity exists in the two-person Mac workaround.

## Accounts needed for optional work
Chalk: hackathon access, environment, provider connection, gateway key and model identifier. Factory: account/hackathon credits, FACTORY_API_KEY, Droid CLI + SDK. Daytona: account/hackathon credits and sandbox API key. None of these optional services has been live-integrated or purchased on your behalf. Add one at a time after the messaging rehearsal passes.
