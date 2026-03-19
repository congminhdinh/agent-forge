# AgentForge Phase 1 MVP

AgentForge now includes a working Phase 1 MVP:
- NestJS API for auth, project CRUD, task CRUD, role configuration, BYOK settings, and single-agent dispatch
- Nuxt dashboard for kanban management, role editing, API key management, and output review
- Postgres + Redis Docker Compose setup, with `sql.js` inline fallback for local API verification when Docker is unavailable

## What Is Implemented
- Development login flow with JWT auth
- Optional GitHub OAuth route when credentials are configured
- Project CRUD with seeded default agent roles
- Task creation, assignment, manual status updates, and single-agent dispatch
- BYOK provider storage for OpenAI and Anthropic
- Agent output storage and viewer
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

## Notes
- In this repo, the API uses `sql.js` when `DATABASE_URL` is not set so the backend can still build and test without Docker.
- Single-agent dispatch uses a live provider when a matching BYOK key exists. Otherwise it falls back to a structured mock output so the Phase 1 workflow still remains usable.
