# S11 hero branding (#233)

Uses the existing OCLR vector identity and a subordinate S11 label with the original sunset artwork. The organizer should review the full before/after hero before approval.

## Local verification — 2026-10-25

- Production build, lint/type checks and i18n extraction passed on the combined verification branch. No new interface copy was introduced.
- Combined unit/integration run: 848 passed, 1 skipped. The subsequent S10 MP evidence tests passed separately (7 adapter tests).
- All 22 targeted desktop/mobile checks passed after correcting two stale test assumptions and waiting for bracket geometry; dedicated issue checks passed using installed Google Chrome and the isolated `oclr_thread_ui_test` PostgreSQL database. Screenshots use synthetic configuration and archived competition evidence, not production state.
- Production dependency audit: zero vulnerabilities. No deployment or production data write.
- Remote CI and organizer visual acceptance are separate from these local checks.

## Screenshots

- [desktop-hero-before](desktop-hero-before.png)
- [desktop-hero-default-dark](desktop-hero-default-dark.png)
- [mobile-hero-before](mobile-hero-before.png)
- [mobile-hero-default-dark](mobile-hero-default-dark.png)
