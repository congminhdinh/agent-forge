# Phase 2 Multi-Agent + Review Plan

## Goal
- Implement the second roadmap phase from `agent/docs/agent-orchestration-platform-plan.md`: multi-agent handoffs, human review flows, quota enforcement, real-time task updates, GitHub handoff metadata, and sandbox-aware run tracking.

## Steps
- [x] Gather the remaining Phase 2 gaps from the current API and Nuxt app, then lock the contract changes for tasks, runs, messages, reviews, and usage.
- [x] Extend the backend data model and serializers for task transitions, agent messages, review events, subscription state, quota usage, and run metadata.
- [x] Implement backend orchestration for structured handoffs, multi-agent chaining, review gating, quota enforcement, and live event emission.
- [x] Add backend endpoints for reviews, usage, and real-time task updates, plus GitHub integration status metadata for review decisions.
- [x] Upgrade the Nuxt workspace to show the review panel, agent timeline, message thread, quota dashboard, and live task refresh.
- [x] Update repo documentation and `agent/lessons.md`, then run targeted build and test verification for the affected surfaces.

## Notes
- This phase is being implemented on top of the existing Phase 1 mock-capable agent execution path, so external integrations must keep a graceful local fallback when credentials or infrastructure are missing.
- Docker and live GitHub app verification remain environment-dependent in this execution environment, so those flows need code-level fallbacks plus explicit documentation.
- Phase 2 state is stored partly in `TaskItem` JSON fields to keep the sql.js fallback and the Postgres path aligned without adding migration-only blockers in this environment.
- Real-time task updates are implemented with authenticated Server-Sent Events instead of Socket.IO to avoid adding more runtime dependencies to the current stack.

## Verification
- `npm run build -w apps/api`
- `npm run test -w apps/api -- --runInBand`
- `npm run test:e2e -w apps/api -- --runInBand`
- `npm run build -w apps/web`
- The web build required an unsandboxed rerun because the Nuxt cache path hit the known `EPERM` unlink error inside the sandbox.
