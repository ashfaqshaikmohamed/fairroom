> Historical notes for earlier builds, not the current verification report. See HANDOFF.md for the demo-mode workflow and rerun its checks for current results. Archive packaging and browser/device claims below have not been reverified in this audit.

# Review notes — October 16, 2026

## Automated

- TypeScript check and production build passed.
- Matching, message formatting, exact-cent rent split and vacation tests passed.
- Room planner covers individual caps, bedroom and home size, private-bath constraints, missing room facts, input-order determinism and calculator agreement. An additional 995 allocations check exact totals and bounds.
- Photon provider, worker and chat-first enrollment tests passed with mocked SDK responses, including outsider rejection, roster changes, shared-line rejection, deduplication and delivery receipts.
- 34 isolated HTTP API checks passed with external sending disabled.

## Browser

Reviewed the actual app through the in-app browser at desktop 1440 × 1000 and mobile 390 × 844:

- Landing page and sample-group entry.
- Sam’s preferences, including a 120 sq ft bedroom minimum; final submission.
- Five qualifying homes with calculated prices.
- Rent drawer, saved acceptance and sharing to the web group.
- `split C1` response: $1,520 / $1,280 / $1,040, total $3,840.
- Recommended-mode room assignment controls are disabled; manual modes remain available.
- Closing the rent drawer now closes the overlay instead of unexpectedly opening another modal.
- Mobile homes and chat have no horizontal overflow (document width = viewport width = 390).
- No browser error logs in the inspected session.

## Visual comparison

Compared the generated design reference and rendered screenshots:

1. Paper/walnut/terracotta palette follows the concept; the previous green theme is removed from the primary UI.
2. The horizontal wordmark/navigation hierarchy replaces the sidebar.
3. The ranked list/detail layout follows the concept, with actual computed order and prices rather than fixed screenshot text.
4. Photography and three simple member rows provide the focal point. Initials replace invented avatar portraits.
5. Thin borders, generous spacing, restrained buttons and a single-column mobile layout preserve the reference’s simplicity.

Copy differences are deliberate: the app identifies sample homes and estimated costs, includes verification categories, uses actual fixture addresses, and says “Share matches to chat” because that action shares the set of new matches. The reference image’s fixed prices/order do not override calculations.

## Live checks still needed

No real Photon number or OpenAI credentials were available to validate external delivery/model calls. Before submitting to the Photon challenge, configure the dedicated line and verify receipt on real phones. This is explicitly distinguished from the functioning web preview and mocked provider tests throughout the setup and recording guides.
