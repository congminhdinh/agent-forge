# AgentForge Phase 3 Workspace

AgentForge now includes the Phase 3 workflow slice:
- NestJS API for project/task/role management, multi-agent dispatch, review decisions, quota usage, task recovery, notifications, role-template import/export, and admin operations
- Nuxt dashboard for kanban orchestration, review gating, onboarding, role marketplace actions, quota visibility, cost telemetry, notification settings, and operator controls
- Postgres + Redis target runtime support, with `sql.js` fallback still available for local API verification when Docker is unavailable

## What Is Implemented
- Development login flow with JWT auth
- Optional GitHub OAuth route when credentials are configured
- Project CRUD with seeded default agent roles
- Task creation, assignment, manual status updates, and multi-agent dispatch chains
- Human review actions: approve, request changes, reject
- Task timeline, inter-agent message history, and GitHub handoff metadata
- Quota dashboard with concurrent session and weekly task usage
- Per-run token and cost tracking with weekly usage rollups
- Retry and resume controls with dead-letter visibility
- Role template library plus project import/export flow
- Notification preferences with in-app records and optional webhook delivery
- Admin dashboard for user quotas and system-wide stats
- First-project onboarding with a seeded starter workspace
- Authenticated Server-Sent Events for live project/task/usage refresh
- Authenticated Server-Sent Events for notification refresh
- BYOK provider storage for OpenAI and Anthropic
- Agent output storage and reviewer-facing output viewer
- Postgres and Redis container definitions for the target runtime

## Local Development
1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start the API with `npm run dev:api`.
4. Start the web app with `npm run dev:web`.
5. Open `http://localhost:3000`.

## Docker Development
1. Copy `.env.example` to `.env`.
2. Run `docker compose up --build`.
3. Open `http://localhost:3000`.

## Verification Commands
- `npm run build -w apps/api`
- `npm run test -w apps/api -- --runInBand`
- `npm run test:e2e -w apps/api -- --runInBand`
- `npm run build -w apps/web`

## Manual Testing
- See `agent/docs/phase-3-manual-test-scenario.md` for the current end-to-end manual QA flow.

## Notes
- In this repo, the API uses `sql.js` when `DATABASE_URL` is not set so the backend can still build and test without Docker.
- Agent dispatch uses a live provider when a matching BYOK key exists. Otherwise it falls back to a structured Phase 3 workflow output so the review and handoff flow still remains usable.
- In local fallback mode, task run telemetry is also mirrored into task JSON history so Phase 3 usage and review surfaces remain available even when the lightweight runtime does not materialize every relational edge consistently.
