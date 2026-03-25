# AgentForge Phase 2 Workspace

AgentForge now includes the Phase 2 workflow slice:
- NestJS API for project/task/role management, multi-agent dispatch, review decisions, quota usage, and live task streams
- Nuxt dashboard for kanban orchestration, review gating, message history, quota visibility, and BYOK settings
- Postgres + Redis target runtime support, with `sql.js` fallback still available for local API verification when Docker is unavailable

## What Is Implemented
- Development login flow with JWT auth
- Optional GitHub OAuth route when credentials are configured
- Project CRUD with seeded default agent roles
- Task creation, assignment, manual status updates, and multi-agent dispatch chains
- Human review actions: approve, request changes, reject
- Task timeline, inter-agent message history, and GitHub handoff metadata
- Quota dashboard with concurrent session and weekly task usage
- Authenticated Server-Sent Events for live project/task/usage refresh
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
- See `agent/docs/phase-2-manual-test-scenario.md` for the current end-to-end manual QA flow.

## Notes
- In this repo, the API uses `sql.js` when `DATABASE_URL` is not set so the backend can still build and test without Docker.
- Agent dispatch uses a live provider when a matching BYOK key exists. Otherwise it falls back to a structured Phase 2 workflow output so the review and handoff flow still remains usable.
- The frontend build may require running outside the sandbox because Nuxt cache cleanup can raise `EPERM` in this execution environment.
