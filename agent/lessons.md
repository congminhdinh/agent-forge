# Lessons

### 2026-03-19
- Task reference: `phase-1-mvp`
- Category: blocker
- Current execution environment does not expose Docker on PATH, so Postgres and Redis runtime verification must be documented separately from code changes.

### 2026-03-19
- Task reference: `phase-1-mvp`
- Category: bug fix
- TypeORM `sql.js` rejected nullable string fields inferred as `Object`; explicit column types were required for `externalId`, `githubRepo`, and `modelOverride` to make the e2e app boot.

### 2026-03-19
- Task reference: `phase-1-mvp`
- Category: feedback
- The Nuxt production build hit sandbox `spawn EPERM`; rerunning the build outside the sandbox verified the frontend successfully and confirmed the issue was environmental rather than application-level.

### 2026-03-19
- Task reference: `phase-1-mvp`
- Category: feedback
- Phase 1 is now implemented in-source: API modules, Nuxt dashboard, env files, Docker Compose, cleanup tooling, and verification docs are all in place.

### 2026-03-20
- Task reference: `phase-1-mvp`
- Category: bug fix
- The Nuxt app shell returned a plain object full of refs from `useAgentForge()` and passed nested ref values into child props during SSR. Wrapping the shell state with `reactive(useAgentForge())` in `apps/web/app/app.vue` restored ref unwrapping and fixed the `project.tasks.length` crash in `ProjectSidebar.vue`.

### 2026-03-25
- Task reference: `phase-2-multi-agent-review`
- Category: feedback
- Phase 2 is now implemented in-source: multi-agent handoffs, human review actions, quota visibility, SSE-based live updates, and GitHub handoff metadata are wired into the API and Nuxt workspace.

### 2026-03-25
- Task reference: `phase-2-multi-agent-review`
- Category: bug fix
- The e2e app bootstrap initially failed because `RealtimeController` could not resolve `JwtService` from `AuthModule`. Exporting `JwtModule` from `apps/api/src/auth/auth.module.ts` fixed the Phase 2 test container wiring.

### 2026-03-25
- Task reference: `phase-2-multi-agent-review`
- Category: blocker
- The Nuxt production build still hits the known sandbox cache `EPERM` unlink issue. The frontend was verified by rerunning the same build outside the sandbox.

### 2026-03-25
- Task reference: `manual-test-scenario`
- Category: feedback
- Added a dedicated manual QA document at `agent/docs/phase-2-manual-test-scenario.md` so the current Phase 2 flow can be validated consistently in local development.

### 2026-03-25
- Task reference: `mojibake-fix`
- Category: bug fix
- `apps/web/app/components/TaskOutputViewer.vue` contained mojibake from mis-encoded separator and arrow glyphs. Replacing them with ASCII-safe text fixed the corrupted view rendering.
