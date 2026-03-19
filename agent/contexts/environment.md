# Environment Context

Date: 2026-03-19

## Required Tools And Runtime Versions
- Node.js `v24.14.0`
- npm `11.5.2`
- Docker: not available in the current execution environment, but required by the target Phase 1 stack for PostgreSQL and Redis.

## Environment Variables
- Planned API variables:
  - `PORT_API`
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET`
  - `SESSION_SECRET`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_CALLBACK_URL`
- Planned web variables:
  - `NUXT_PUBLIC_API_BASE_URL`

## Local Setup Notes
- Root workspace uses npm workspaces via `package.json`.
- Current install state is partial:
  - root dependencies exist
  - `apps/api` is only the Nest starter scaffold
  - `apps/web` is only the Nuxt starter scaffold
- Additional packages must be installed before Phase 1 implementation can run.

## Optional But Recommended Tools
- Git for commit checkpoints required by the workflow.
- Docker Desktop or Docker Engine for Postgres/Redis containers.

## Known Platform Quirks
- The current shell environment exposes only a reduced set of commands.
- `docker` is not available in this runtime, so compose verification will be configuration-only unless the user runs it elsewhere.
- `git` is not on the default PATH in this runtime, so commit steps may need an absolute binary path if used later.
