# Architecture Context

Date: 2026-03-19

## Tech Stack And Versions
- Node.js `v24.14.0`
- npm `11.5.2`
- Backend scaffold: NestJS `11.x`
- Frontend scaffold: Nuxt `4.4.2` with Vue `3.5.30`
- Workspace layout: npm workspaces with `apps/api` and `apps/web`

## Service And Module Map
- `apps/api`: generated NestJS application with the default `AppModule`, controller, and service only.
- `apps/web`: generated Nuxt application with the default welcome screen only.
- `agent`: workflow folder containing plan docs, design docs, and shared implementation guidance.

## Data Flow Overview
- Current state: no application data flow is implemented.
- Planned Phase 1 data flow:
  1. User authenticates.
  2. User manages projects, tasks, agent roles, and API keys through the web UI.
  3. Web app calls the API for CRUD operations and task dispatch.
  4. API persists state in PostgreSQL and dispatches single-agent jobs through Redis/BullMQ.
  5. Agent execution stores output and task status updates for the UI to read.

## Repo Folder Structure
- `apps/api`: NestJS backend workspace.
- `apps/web`: Nuxt frontend workspace.
- `agent/contexts`: project context docs.
- `agent/docs`: high-level product and implementation docs.
- `agent/plans`: task-specific execution plans.
- `agent/scripts`: reusable helper scripts.

## Key Conventions
- Follow the shared workflow in `agent/overview.md`.
- Create or update a task plan before implementation work.
- Keep workflow helpers under `agent/scripts`.
- Keep user-facing and setup docs in Markdown inside the repo when behavior changes.
- Preserve a modular-monolith backend structure even while building Phase 1.
