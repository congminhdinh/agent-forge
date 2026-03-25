# Phase 3 Polish + Operationalize Plan

## Goal
- Implement the third roadmap phase from `agent/docs/agent-orchestration-platform-plan.md`: admin management, cost tracking, role import/export, task error recovery, notifications, observability, and onboarding on top of the current Phase 2 workspace.

## Steps
- [x] Lock the Phase 3 contract changes for users, runs, tasks, role templates, notifications, admin stats, and onboarding state.
- [x] Extend the backend persistence model and serializers for admin metadata, per-run token and cost data, retry and dead-letter state, notifications, and observability payloads.
- [x] Implement backend endpoints and orchestration for admin controls, role template export/import, task retry or resume recovery, notification feeds, onboarding state, and observability summaries.
- [x] Upgrade the Nuxt workspace with onboarding guidance, admin and operations panels, role template import/export controls, notification visibility, and richer cost and recovery surfaces.
- [x] Update repo docs and `agent/lessons.md`, then run targeted build and test verification for the Phase 3 changes.

## Notes
- Phase 3 should remain compatible with the current local fallback mode: SQL.js storage, optional Redis queue, mockable agent execution, and metadata-first GitHub integration.
- Admin features will use the current single-user development model unless explicit team or tenant isolation is already present in source.
- Observability should stay lightweight in this environment: structured payloads, queue snapshots, and operator-facing summaries without introducing infrastructure-only blockers.
- Notification delivery should degrade gracefully to in-app records when outbound email or webhook configuration is not present.
- Local fallback mode mirrors run telemetry into task JSON history so cost and run data still appear in review and usage views during SQL.js-based verification.

## Verification
- `npm run build -w apps/api`
- `npm run test -w apps/api -- --runInBand`
- `npm run test:e2e -w apps/api -- --runInBand`
- `npm run build -w apps/web`
