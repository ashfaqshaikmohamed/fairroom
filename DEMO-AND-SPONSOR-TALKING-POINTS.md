# FairRoom: demo and sponsor talking points

## The product
FairRoom helps roommates find a home they can agree on, where they already talk. It combines preferences, ranks homes, proposes room-dependent rent shares, and keeps saved choices in the conversation. Its Digital Trust contribution is explicit costs, private budgets, reproducible calculations and visible uncertainty.

## A short working demo
1. Start with DEMO_MODE=true and open Meet FairRoom. Complete Sam’s saved survey.
2. In the web conversation send `find homes`.
3. Send `split C1`, then `like C1` and `saved`.
4. On the website, inspect that home and its calculated split. Expand **Before you commit**, then **Preview sample review**.
5. Show the missing-cost checks and copy the broker questions. The sample review requires no key.

Do not reset the household in the middle of the recording. The local Mac bridge sends from the Mac owner's identity; it is not a separate Photon group agent. Photon private messaging is a separate integration.

## What to say about Factory
“We built a runtime Droid SDK adapter for reviewing rental evidence. Its tools read a listing, run deterministic checks, and return broker questions. This recording uses a prepared sample review; we have not verified the adapter with live credentials.”

With access, the intended benefit is agent-driven evidence synthesis without exposing private roommate budgets. Tools are restricted, outputs validated, attempts limited, and successful reviews cached. This is not model training and not a claim of OS-level sandboxing.

## What to say about Chalk
“We implemented optional intent classification through Chalk's Model Gateway. It maps roommate messages to structured actions; our own engines enforce budgets and calculate splits. This keyless demo uses deterministic commands, so it does not demonstrate a live Chalk request.”

The intended benefit is managed model routing with observable requests. The local evaluation runner has ten cases and counts real validated model results; it does not count fallback responses as successful gateway calls. Mocked integration tests verify request formatting, not live service behavior.

## Likely questions
**Is the ranking hardcoded?** The demo homes and preferences are fixtures. Matching and split calculations run against those inputs; changes can change the results.

**Did Factory generate this review?** Not the sample review. That output is explicitly labeled and comes from saved evidence. A live review requires account access and a successful SDK run.

**Did you use Chalk-hosted Agent Evals?** No. The repository has a local evaluation runner for live gateway requests, plus isolated mocked tests.

**Why not ask an LLM to calculate rent?** The numerical engine enforces total rent and budget constraints reproducibly; language models interpret or explain, rather than decide the arithmetic.

**Does this satisfy sponsor requirements today?** The keyless demonstration alone does not. Actual meaningful use must be completed before claiming either integration was demonstrated.

## Disclosure locations
- `src/server/listingCheck.ts`: sample review type and generator, separate from Factory receipts.
- `src/server/routes.ts`: fixture-only sample endpoint; no provider cache writes.
- `src/components/ListingCheckPanel.tsx`: Sample review label and no-model-call caption.
- `src/server/agent.ts`: no-key deterministic fallback and actual-call counters.
- `scripts/test-agent-demo.ts`: mocked gateway test, explicitly no paid calls.
- `README.md`: demo quick start and optional integration boundaries.

These distinctions belong in technical documentation and the sample output label. Ordinary product copy can focus on finding a home together.
