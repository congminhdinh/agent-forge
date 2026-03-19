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
