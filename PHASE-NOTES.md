> Historical notes for earlier builds, not the current verification report. See HANDOFF.md for the demo-mode workflow and rerun its checks for current results. Archive packaging and browser/device claims below have not been reverified in this audit.

# Current delivery — October 16, 2026

This replaces the earlier Photon checkpoint. It includes the warm redesign, private room-size/bath preferences, joint room assignment, budget-feasible proposals, five qualifying sample homes, chat-first Photon enrollment, and a recording guide.

Run the complete source folder rather than copying selected files: frontend, types, fixtures, engine, API and provider code changed together. Preserve your existing `.env` separately. Do not overwrite a runtime database you need to keep. The archive does not contain credentials, dependencies or personal runtime data.

Verified: TypeScript, production build, matching/messaging/rent/planner tests, provider and enrollment mocks, 34 API checks, browser preference submission, five-home results, acceptance/share, agent split response, and mobile overflow checks. See QA-NOTES.md for the final browser review.

Still requires user setup: Photon beta access, a dedicated group-capable iMessage line, public HTTPS app URL, and actual phone receipt verification. OpenAI is optional. Real snapshot floor plans and current availability require confirmation. This is a hackathon demo build, not a fully operated rental service.
