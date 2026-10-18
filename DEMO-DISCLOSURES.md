# Demo disclosure locations

Stable file/function references for the current source (line numbers change as code is edited):

- `src/server/db.ts`, `seedDemoModeData`: fake names/numbers applied to the routable sample household; fixture room facts remain illustrative.
- `src/components/LandingView.tsx` and `ProductPreview.tsx`: sample/illustrative product-preview copy.
- `src/components/ListingCheckPanel.tsx`: Sample review label and no-model-call caption.
- `src/server/listingCheck.ts`, `sampleListingReview`: prepared output separate from real provider receipts.
- `src/server/routes.ts`, `/check/sample`: sample-only endpoint without a Factory cache write.
- `src/server/agent.ts`, `interpret`: deterministic fallback when model credentials are unavailable.
- `src/server/photon.ts`, `photonEnabled`: demo mode prevents hosted sends.
- `server.ts`: demo mode skips local/hosted messaging workers and the scheduler.
- `src/components/PublicListingView.tsx` and `CatalogView.tsx`: saved-listing availability disclosures.
- `local-bridge/bridge.ts`: local transport uses the Mac’s Messages identity.
- `README.md`, `HANDOFF.md` and `DEMO-AND-SPONSOR-TALKING-POINTS.md`: demo-first workflow and unverified optional service boundaries.

No sample review, web message or mocked test is evidence of live sponsor service use. Public listing snapshots do not prove current availability.
