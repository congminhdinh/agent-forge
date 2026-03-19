# AgentForge: Self-Hosted AI Agent Orchestration Platform

## Technical Plan — March 2026

---

## 1. Tech Stack Decision

### Backend API Framework → **NestJS (Node.js + TypeScript)**

NestJS is the most natural transition from .NET Core: it uses decorators, dependency injection, modules, guards, interceptors, and pipes — patterns you already think in. It has first-class support for BullMQ (`@nestjs/bullmq`), WebSockets (`@nestjs/websockets`), TypeORM/Prisma, and Swagger generation out of the box. The module system enforces clean boundaries in a monolith, and if you ever need to extract a microservice, NestJS supports that natively with its transport layer. It's the most popular structured Node.js framework by a wide margin.

### Job Queue / Task Runner → **BullMQ (Redis-backed)**

BullMQ is the de facto standard for Node.js job queues: it supports delayed jobs, retries with backoff, rate limiting, job priorities, and named queues — all backed by Redis. NestJS has an official integration (`@nestjs/bullmq`) that lets you define processors as injectable services with decorators. You'll run separate queues per agent role (e.g., `queue:architect`, `queue:developer`), with concurrency controls that map directly to your session limits. The BullMQ Dashboard (Bull Board) gives you free observability.

### Database → **PostgreSQL (primary) + Redis (cache + queue backend)**

PostgreSQL handles relational data (users, projects, tasks, audit logs) with JSONB columns for flexible schema evolution on agent messages and context objects. You already know SQL Server well — Postgres is close enough conceptually but has a richer open-source ecosystem. Redis serves double duty: BullMQ's backing store and a fast cache layer for session counts, quota snapshots, and real-time presence.

### Frontend Framework → **Vue 3 + Nuxt 3**

Vue 3 with Nuxt 3 is the direct upgrade path from your Hubly Vue 2/Nuxt 2 work — you already know the mental model (Composition API extends Options API naturally). Nuxt 3 gives you SSR, file-based routing, auto-imports, and server routes (as a lightweight BFF if needed). The Vue ecosystem has excellent kanban libraries (e.g., `vuedraggable` with SortableJS), and Pinia for state management is simpler than Vuex. You stay in one framework family across your day job and side project, which compounds your learning.

### Real-Time Communication → **Socket.IO (via @nestjs/websockets)**

Socket.IO handles WebSocket connections with automatic fallback, rooms (one per project or task), and namespace isolation. NestJS has a first-class WebSocket gateway module (`@nestjs/websockets` + `@nestjs/platform-socket.io`) where you define gateways as decorated classes — the same DI-driven pattern as controllers. You'll push agent status changes, inter-agent messages, and task transitions in real time. On the Vue side, `socket.io-client` with a Pinia plugin keeps state synced.

### LLM Client / Model Router → **Vercel AI SDK (`ai` package)**

The Vercel AI SDK provides a unified interface across OpenAI, Anthropic, Google, and local models with streaming support, tool calling, and structured output parsing. It handles BYOK natively (just pass the API key per request). The model router is custom logic on top: a `Map<AgentRole, ModelConfig>` that resolves which provider + model + API key to use per task dispatch.

### Authentication → **Passport.js (via @nestjs/passport) + GitHub OAuth**

NestJS has an official Passport integration (`@nestjs/passport`) that wraps strategies as injectable guards — you decorate routes with `@UseGuards(AuthGuard('github'))` just like .NET's `[Authorize]` attribute. Use `passport-github2` for OAuth and `passport-jwt` for API token auth. Sessions are stored in Postgres via `connect-pg-simple`. This is the most documented auth path in the NestJS ecosystem and gives you full control.

### GitHub Integration → **Octokit + GitHub Apps**

Octokit is GitHub's official SDK. Register a GitHub App (not a personal token) so you get per-repo installations, fine-grained permissions, and webhook delivery for PR events. The app creates branches, commits agent output, opens PRs, and listens for review webhooks to close the loop.

### VM / Sandbox per Agent Session → **Docker containers via Dockerode**

Each agent session that needs code execution gets a short-lived Docker container with a timeout and resource limits (`--memory=512m --cpus=0.5`). Dockerode is the Node.js Docker API client. Containers mount a workspace volume, run the agent's commands, and are destroyed on completion. This is simpler and cheaper than Firecracker or E2B for a solo-dev setup.

---

## 2. Data Model

### User / Subscription / QuotaLedger

```typescript
// ── User ──
interface User {
  id: string;                   // ULID
  email: string;
  github_id: string | null;
  display_name: string;
  team_id: string | null;
  created_at: Date;
}

// ── Subscription ──
interface Subscription {
  id: string;
  user_id: string;              // or team_id for team plans
  tier: 'free' | 'pro' | 'team';
  max_concurrent_sessions: number;  // e.g. 3, 5, 10
  max_weekly_tasks: number;         // e.g. 20, 50, 200
  llm_api_keys: Record<string, string>;  // encrypted: { anthropic: "sk-...", openai: "sk-..." }
  current_period_start: Date;
  status: 'active' | 'paused' | 'cancelled';
}

// ── QuotaLedger ──
// Append-only log of usage events for auditability
interface QuotaLedger {
  id: string;
  user_id: string;
  event_type: 'session_start' | 'session_end' | 'task_dispatched';
  task_id: string | null;
  session_id: string | null;
  week_bucket: string;          // ISO week: "2026-W12"
  recorded_at: Date;
}
```

### Project / Task / TaskTransition

```typescript
// ── Project ──
interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string;
  github_repo: string | null;      // "owner/repo"
  github_branch_prefix: string;    // e.g. "agentforge/"
  settings: Record<string, any>;   // JSONB: model defaults, tool policies
  created_at: Date;
}

// ── Task ──
interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;             // Markdown
  status: 'backlog' | 'in_progress' | 'needs_review' | 'changes_requested' | 'done' | 'failed';
  assigned_role: string;           // FK to AgentRole.slug
  model_override: string | null;   // Override the role's default model
  priority: number;                // 0 = highest
  parent_task_id: string | null;   // For subtask decomposition
  github_branch: string | null;
  github_pr_number: number | null;
  created_at: Date;
  updated_at: Date;
}

// ── TaskTransition ──
// Immutable audit log of every status change
interface TaskTransition {
  id: string;
  task_id: string;
  from_status: string;
  to_status: string;
  triggered_by: 'agent' | 'human' | 'system';
  actor_id: string;                // user_id or agent_session_id
  reason: string | null;
  created_at: Date;
}
```

### AgentRole / AgentSession

```typescript
// ── AgentRole ──
interface AgentRole {
  id: string;
  project_id: string;
  slug: string;                    // "architect", "developer", "reviewer", etc.
  display_name: string;
  system_prompt_template: string;  // Handlebars/Mustache template
  model_preference: string;        // "claude-opus-4-20250514", "claude-haiku-4-5-20251001"
  tool_access_policy: string[];    // ["code_execution", "github_write", "web_search"]
  max_iterations: number;          // Safety limit per dispatch (e.g. 20)
  created_at: Date;
}

// ── AgentSession ──
interface AgentSession {
  id: string;
  task_id: string;
  role_id: string;
  user_id: string;                 // Owner (for quota tracking)
  status: 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';
  model_used: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  container_id: string | null;     // Docker container if code execution
  started_at: Date;
  ended_at: Date | null;
  error: string | null;
}
```

### AgentMessage / ReviewEvent

```typescript
// ── AgentMessage ──
// The structured inter-agent communication protocol
interface AgentMessage {
  id: string;
  task_id: string;
  from_role: string;              // slug of sending role
  to_role: string;                // slug of target role
  message_type: 'handoff' | 'help_request' | 'resolution' | 'status_update';
  payload: {
    output: string;               // What the agent produced
    blockers: string[];           // What's preventing progress
    next_action: string;          // Suggested next step
    files_changed: string[];      // Paths modified
    error_context: any | null;    // Stack traces, logs, etc.
    metadata: Record<string, any>;
  };
  created_at: Date;
}

// ── ReviewEvent ──
interface ReviewEvent {
  id: string;
  task_id: string;
  reviewer_id: string;            // User ID
  action: 'approve' | 'request_changes' | 'reject';
  target_role: string | null;     // Which role to re-queue to (for request_changes)
  comment: string;
  diff_snapshot: string | null;   // Stored diff at review time
  created_at: Date;
}
```

### SQL Migration Summary

```sql
-- Core tables
CREATE TABLE users (...);
CREATE TABLE subscriptions (...);
CREATE TABLE quota_ledger (...);
CREATE TABLE projects (...);
CREATE TABLE tasks (...);
CREATE TABLE task_transitions (...);
CREATE TABLE agent_roles (...);
CREATE TABLE agent_sessions (...);
CREATE TABLE agent_messages (...);
CREATE TABLE review_events (...);

-- Key indexes
CREATE INDEX idx_quota_ledger_user_week ON quota_ledger (user_id, week_bucket);
CREATE INDEX idx_tasks_project_status ON tasks (project_id, status);
CREATE INDEX idx_agent_sessions_user_status ON agent_sessions (user_id, status);
CREATE INDEX idx_agent_messages_task ON agent_messages (task_id, created_at);
```

---

## 3. System Architecture

### Recommendation: Modular Monolith

Start with a single NestJS process that is internally organized as encapsulated modules (`@Module({})`). This avoids the operational overhead of microservices while maintaining clean boundaries for future extraction. You're one developer — a monolith lets you deploy, debug, and iterate 5× faster.

### Component Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Nuxt 3 Frontend (Vue 3)                         │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌───────────────────┐  │
│  │ Kanban   │  │ Review   │  │ Agent Logs │  │ Subscription Mgmt │  │
│  │ Board    │  │ Panel    │  │ Viewer     │  │ Dashboard         │  │
│  └────┬─────┘  └────┬─────┘  └────┬───────┘  └────┬──────────────┘  │
│       └──────────────┴─────────────┴───────────────┘                 │
│                         │ REST + Socket.IO                           │
└─────────────────────────┼────────────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    NestJS Monolith (Node.js)                         │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────────────────┐ │
│  │ AuthModule    │  │ ProjectModule │  │ SubscriptionModule        │ │
│  │ (Passport)    │  │ (CRUD, Kanban)│  │ (Quotas, BYOK keys)      │ │
│  └──────────────┘  └───────────────┘  └───────────────────────────┘ │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │                    OrchestratorModule                             ││
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ ││
│  │  │ Dispatcher  │  │ ModelRouter  │  │ AgentProtocol            │ ││
│  │  │ Service     │  │ Service      │  │ Service                  │ ││
│  │  │ (BullMQ)    │  │ (AI SDK)     │  │ (Message Bus)            │ ││
│  │  └────────────┘  └──────────────┘  └──────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ GitHubModule  │  │ SandboxModule │  │ ReviewModule             │  │
│  │ (Octokit)     │  │ (Dockerode)   │  │ (Diffs, approval flow)  │  │
│  └──────────────┘  └───────────────┘  └──────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ AgentGateway (Socket.IO WebSocket Gateway)                       ││
│  │ Pushes: task transitions, agent status, inter-agent messages     ││
│  └──────────────────────────────────────────────────────────────────┘│
└───────────────────────────┬──────────────────────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
         ┌────────┐   ┌─────────┐   ┌──────────┐
         │Postgres│   │  Redis  │   │  Docker  │
         │        │   │(BullMQ +│   │ (Agent   │
         │        │   │ Cache)  │   │ Sandboxes│
         └────────┘   └─────────┘   └──────────┘
```

### Module Boundaries

Each NestJS module (`@Module({})`) encapsulates its own controllers, services, and repository classes. Modules communicate via injected services — NestJS's DI container handles the wiring, exactly like .NET Core's `IServiceCollection`. The `OrchestratorModule` imports `SubscriptionModule` (for quota checks) and `GitHubModule` (for PR operations), and exports `DispatcherService` for use by the `ProjectModule`'s task controllers.

### Deployment

A single Docker Compose file runs four containers: the NestJS app, Nuxt 3 frontend (or served as static from the NestJS app via `@nestjs/serve-static`), Postgres, and Redis. Agent sandbox containers are spawned dynamically by the app and cleaned up automatically.

---

## 4. Agent Orchestration Design

### Task Lifecycle: Creation → Completion

**Step 1: Task Creation**
User creates a task via the UI or API, assigning it to a role (e.g., "developer") and setting status to `backlog`. The task includes a title, description, and optionally a model override.

**Step 2: Dispatch (Backlog → In Progress)**
When the user moves a task to `in_progress` (or it's auto-promoted from a pipeline), the Orchestrator's **Dispatcher** runs:

```typescript
async function dispatchTask(taskId: string): Promise<void> {
  const task = await db.tasks.findById(taskId);
  const user = await db.users.findById(task.userId);

  // ── Quota Gate ──
  const activeSessions = await redis.get(`sessions:active:${user.id}`);
  const weeklyTasks = await db.quotaLedger.countWeek(user.id, currentWeek());
  const sub = await db.subscriptions.findByUser(user.id);

  if (Number(activeSessions) >= sub.maxConcurrentSessions) {
    throw new QuotaExceededError('concurrent_sessions');
  }
  if (weeklyTasks >= sub.maxWeeklyTasks) {
    throw new QuotaExceededError('weekly_tasks');
  }

  // ── Resolve Agent Config ──
  const role = await db.agentRoles.findBySlug(task.projectId, task.assignedRole);
  const modelConfig = resolveModel(role, task.modelOverride, sub.llmApiKeys);

  // ── Enqueue ──
  await agentQueue.add(`role:${role.slug}`, {
    taskId: task.id,
    roleId: role.id,
    modelConfig,
    systemPrompt: renderTemplate(role.systemPromptTemplate, { task, project }),
    tools: role.toolAccessPolicy,
  });

  // ── Track ──
  await redis.incr(`sessions:active:${user.id}`);
  await db.quotaLedger.insert({ userId: user.id, eventType: 'task_dispatched', taskId: task.id });
  await db.tasks.updateStatus(task.id, 'in_progress');
}
```

**Step 3: Agent Execution**
A BullMQ worker picks up the job. It:
1. Creates an `AgentSession` record.
2. Optionally spins up a Docker sandbox (if code execution is in the tool policy).
3. Calls the LLM with the system prompt, task context, and prior `AgentMessage` history for this task.
4. Executes in a loop (up to `max_iterations`): LLM responds → tool calls are executed → results fed back.
5. On completion, the agent writes a structured `AgentMessage` with its output.

**Step 4: Inter-Agent Handoff (if needed)**
If the agent's output includes a `next_action` targeting another role (e.g., Developer → Reviewer), the Orchestrator:
1. Writes the `AgentMessage` to the database.
2. Updates the task's `assigned_role` to the target role.
3. Re-dispatches through the same quota-checked pipeline.
4. Emits a Socket.IO event so the UI updates in real time.

**Step 5: Review Gate**
When the final agent in the chain (typically Reviewer or Tester) marks the task complete, the Orchestrator transitions the task to `needs_review`. No further agent work happens until a human acts.

**Step 6: Human Decision**
The reviewer approves (→ `done`), requests changes (→ re-dispatch to specified role with `changes_requested` status), or rejects (→ `failed`).

### Error Handling

When an agent errors or times out, the session is marked `failed`, `sessions:active` counter is decremented, and the task moves to `failed` with the error logged. The user can retry from the UI, which creates a fresh dispatch.

When an agent reports a blocker (via the structured protocol), the session is marked `blocked`, a notification is sent via Socket.IO, and the task stays `in_progress` until the user intervenes or routes to another agent.

---

## 5. Inter-Agent Communication Protocol

### Schema Definition

Every inter-agent communication is an `AgentMessage` with a typed `payload`. Agents are instructed (via system prompt) to output a JSON block conforming to this schema at the end of their work.

```typescript
interface HandoffPayload {
  task_id: string;
  from_role: string;
  to_role: string;
  message_type: 'handoff' | 'help_request' | 'resolution' | 'status_update';
  output: string;              // Summary of work done
  files_changed: string[];     // Paths of modified files
  blockers: string[];          // Empty if no blockers
  next_action: string;         // What the target role should do
  error_context?: {
    error_message: string;
    stack_trace: string;
    reproduction_steps: string;
  };
  test_results?: {
    passed: number;
    failed: number;
    log: string;
  };
}
```

### Example: Developer → Debugger (help_request)

```json
{
  "task_id": "task_01JQ7X...",
  "from_role": "developer",
  "to_role": "debugger",
  "message_type": "help_request",
  "output": "Implemented the payment webhook handler in src/webhooks/stripe.ts. All unit tests pass except the idempotency test.",
  "files_changed": [
    "src/webhooks/stripe.ts",
    "src/webhooks/__tests__/stripe.test.ts"
  ],
  "blockers": [
    "Test 'should reject duplicate webhook events' fails with: AssertionError: expected 409 but got 200"
  ],
  "next_action": "Investigate why the idempotency key check in processWebhookEvent() is not detecting duplicate event IDs. The Redis SETNX call on line 47 may have a TTL issue.",
  "error_context": {
    "error_message": "AssertionError: expected 409 but got 200",
    "stack_trace": "at Object.<anonymous> (stripe.test.ts:89:5)\n  at processTicksAndRejections (node:internal/process/task_queues:95:5)",
    "reproduction_steps": "Run: npm test -- --grep 'duplicate webhook'"
  }
}
```

### Example: Debugger → Developer (resolution)

```json
{
  "task_id": "task_01JQ7X...",
  "from_role": "debugger",
  "to_role": "developer",
  "message_type": "resolution",
  "output": "Root cause identified and fixed. The Redis SETNX was using the raw event object as the key instead of event.id. Also, the TTL was set to 60s which is too short for Stripe's retry window (72h). Changed to event.id with 259200s TTL.",
  "files_changed": [
    "src/webhooks/stripe.ts"
  ],
  "blockers": [],
  "next_action": "Verify the fix by running the full webhook test suite. If all tests pass, proceed to integration testing and then hand off to the reviewer role.",
  "test_results": {
    "passed": 12,
    "failed": 0,
    "log": "Test Suites: 1 passed, 1 total\nTests: 12 passed, 12 total\nTime: 3.241s"
  }
}
```

### How Agents Learn the Protocol

Each agent role's `system_prompt_template` includes an immutable protocol section injected by the Orchestrator:

```
## Communication Protocol

When you complete your work or encounter a blocker, you MUST output a JSON block
wrapped in ```agentmessage``` fences. This is how you communicate with other agents.

Schema:
- task_id: "{{task_id}}" (already set — do not change)
- from_role: "{{current_role}}"
- to_role: The role slug you are handing off to (e.g., "reviewer", "debugger")
- message_type: One of "handoff", "help_request", "resolution", "status_update"
- output: A clear summary of what you did
- files_changed: Array of file paths you modified
- blockers: Array of strings describing what is blocking you (empty if none)
- next_action: What the receiving agent should do next

If you need help from another agent, set message_type to "help_request" and
include error_context with the error message, stack trace, and reproduction steps.

Previous messages from other agents on this task:
{{#each prior_messages}}
[{{this.from_role}} → {{this.to_role}}] ({{this.message_type}})
{{this.output}}
{{/each}}
```

The Orchestrator parses the fenced JSON block from the LLM output, validates it against the schema, and routes accordingly.

---

## 6. Subscription & Quota System

### Enforcement Architecture

Quotas are enforced at two levels: a **fast path** (Redis) for real-time session counts, and a **durable path** (Postgres `quota_ledger`) for weekly task counts.

### Redis Keys

```
sessions:active:{user_id}        → integer (current concurrent sessions)
quota:weekly:{user_id}:{week}    → integer (tasks dispatched this week)
```

### Enforcement Flow

```typescript
// This runs as a pre-dispatch hook in the Orchestrator Module

async function enforceQuotas(userId: string): Promise<void> {
  const sub = await getSubscriptionCached(userId); // Redis-cached, 60s TTL

  // ── Concurrent Session Check (Redis — fast) ──
  const activeSessions = parseInt(await redis.get(`sessions:active:${userId}`) || '0');
  if (activeSessions >= sub.maxConcurrentSessions) {
    throw new QuotaExceededError(
      'concurrent_sessions',
      `Limit: ${sub.maxConcurrentSessions}, Active: ${activeSessions}`
    );
  }

  // ── Weekly Task Check (Redis counter, reconciled from Postgres nightly) ──
  const weekKey = `quota:weekly:${userId}:${currentISOWeek()}`;
  const weeklyCount = parseInt(await redis.get(weekKey) || '0');
  if (weeklyCount >= sub.maxWeeklyTasks) {
    throw new QuotaExceededError(
      'weekly_tasks',
      `Limit: ${sub.maxWeeklyTasks}, Used: ${weeklyCount}`
    );
  }
}

// On successful dispatch:
await redis.incr(`sessions:active:${userId}`);
await redis.incr(`quota:weekly:${userId}:${currentISOWeek()}`);
await redis.expire(`quota:weekly:${userId}:${currentISOWeek()}`, 8 * 24 * 3600); // auto-expire

// On session completion or failure:
await redis.decr(`sessions:active:${userId}`);
```

### Limit Exceeded Behavior

When a quota is exceeded, the system **rejects with a clear error** (not silently queued). The UI shows which limit was hit and when it resets. Reasoning: silent queueing creates confusion about when work will happen. A solo dev platform should be explicit.

The frontend shows a quota dashboard:

```
Sessions: 3 / 5 active
Weekly tasks: 42 / 50 used (resets Monday)
```

### Admin API

```
PATCH /api/admin/subscriptions/:userId
Body: { maxConcurrentSessions: 10, maxWeeklyTasks: 100 }
```

This updates both Postgres and invalidates the Redis cache.

---

## 7. Human Review Workflow

### Diff Generation

When a task enters `needs_review`, the system:

1. Fetches the GitHub PR diff via Octokit (`octokit.pulls.get({ mediaType: { format: 'diff' } })`).
2. Parses the unified diff and stores a snapshot in `review_events.diff_snapshot` (so the review is reproducible even if the branch changes later).
3. If no GitHub integration, diffs are generated from the agent's `files_changed` list against the workspace baseline using `diff2html`.

### Review Panel Data

The review panel shows four sections:

1. **Diff View** — Split or unified diff rendered with `diff2html` (framework-agnostic, works perfectly in Vue). Files are collapsible, syntax-highlighted.

2. **Agent Reasoning Log** — A chronological timeline of all `AgentSession` entries for this task, showing: which role ran, which model was used, token counts, duration, and the raw LLM conversation (collapsible). This is the full audit trail.

3. **Inter-Agent Messages** — All `AgentMessage` records for this task, rendered as a threaded conversation view. Each message shows from_role → to_role, the output summary, blockers, and files changed.

4. **Test Results** — If the Tester role ran, its `test_results` from the final `AgentMessage` are displayed: pass/fail counts, failing test names, and the raw log output.

### Review Actions

```typescript
// POST /api/tasks/:taskId/review — ReviewController in ReviewModule
interface ReviewRequest {
  action: 'approve' | 'request_changes' | 'reject';
  comment: string;
  target_role?: string;  // Required for request_changes
}

@Post(':taskId/review')
@UseGuards(AuthGuard('jwt'))
async handleReview(
  @Param('taskId') taskId: string,
  @Body() review: ReviewRequest,
  @CurrentUser() reviewer: User,
) {
  const task = await this.taskService.findById(taskId);

  await this.reviewService.create({
    taskId,
    reviewerId: reviewer.id,
    action: review.action,
    targetRole: review.target_role,
    comment: review.comment,
    diffSnapshot: await this.githubService.getCurrentDiff(task),
  });

  switch (review.action) {
    case 'approve':
      await this.taskService.updateStatus(taskId, 'done');
      if (task.githubPrNumber) {
        await this.githubService.mergePR(task);
      }
      break;

    case 'request_changes':
      await this.taskService.update(taskId, {
        status: 'changes_requested',
        assignedRole: review.target_role,
      });
      // Inject the reviewer's feedback into the next agent dispatch context
      await this.dispatcherService.dispatch(taskId, { reviewFeedback: review.comment });
      break;

    case 'reject':
      await this.taskService.updateStatus(taskId, 'failed');
      if (task.githubPrNumber) {
        await this.githubService.closePR(task);
      }
      break;
  }

  this.agentGateway.server.to(`task:${taskId}`).emit('review_completed', { action: review.action });
}
```

---

## 8. Phased Implementation Roadmap

### Phase 1 — Working MVP (4–6 weeks)

| Feature | Complexity | Description |
|---------|-----------|-------------|
| Project CRUD + Kanban UI | M | Nuxt 3 frontend with drag-and-drop kanban (`vuedraggable` + SortableJS) |
| Task creation and assignment | S | Create tasks, assign to roles, basic form |
| Agent role config | S | CRUD for roles with system prompt templates and model preference |
| Single-agent dispatch | L | BullMQ queue via `@nestjs/bullmq`, Vercel AI SDK integration, basic agent loop |
| BYOK key management | S | Encrypted storage of API keys per user, key selection at dispatch |
| Basic auth | S | Passport.js + GitHub OAuth via `@nestjs/passport`, JWT sessions |
| Agent output viewer | M | Display agent's raw output and files changed per task |
| Postgres + Redis setup | S | Docker Compose with TypeORM migrations |

**MVP outcome:** You can create a project, define agent roles, dispatch a single task to an agent, view its output, and manually move tasks across the board.

### Phase 2 — Multi-Agent + Review (4–6 weeks)

| Feature | Complexity | Description |
|---------|-----------|-------------|
| Inter-agent protocol | L | Structured message parsing, handoff routing, message history injection |
| Multi-agent chains | L | Automatic dispatch to next role based on agent output |
| Human review panel | L | Diff view, agent log, message thread, approve/reject/request-changes |
| GitHub integration | M | Branch creation, commits, PR opening, merge on approval |
| Subscription + quota system | M | Tier config, Redis counters, enforcement hooks, quota dashboard |
| Real-time updates | M | Socket.IO rooms per project/task, live status changes |
| Docker sandboxing | M | Spawn containers for code execution, resource limits, auto-cleanup |

**Phase 2 outcome:** Full multi-agent workflows with structured handoffs, human approval gate, GitHub PR integration, and quota enforcement.

### Phase 3 — Polish + Operationalize (3–4 weeks)

| Feature | Complexity | Description |
|---------|-----------|-------------|
| Admin dashboard | M | User management, quota adjustment, system-wide usage stats |
| Cost tracking | S | Per-session token/cost tracking, weekly reports |
| Agent role marketplace | S | Export/import role configurations as JSON templates |
| Error recovery | M | Retry failed tasks, resume blocked sessions, dead letter queue |
| Notification system | S | Email/webhook notifications for review requests, failures |
| Observability | M | Structured logging (Pino), BullMQ dashboard, basic metrics |
| Onboarding flow | S | First-project wizard, sample role templates |

**Phase 3 outcome:** Production-ready for personal/small-team use with cost visibility, reliable error handling, and operational tooling.

---

## 9. Open Questions

**1. Single-Tenant vs. Multi-Tenant?**
The data model supports multi-tenant (user_id on everything), but the deployment model matters. If this is just for you, skip team/org features in Phase 1. If you plan to offer it to others, you'll need tenant isolation for Docker sandboxes (network namespacing) and API key separation. **Recommendation:** Build single-user first, add multi-tenant in Phase 3 if needed.

**2. BYOK-Only vs. Proxied Keys?**
Current design is BYOK-only (users provide their own LLM API keys). An alternative is proxying through your own keys with usage-based billing. BYOK is simpler (no billing integration, no cost risk to you), but proxied keys lower the onboarding barrier. **Decision needed:** BYOK is recommended for Phase 1, but do you want to support a "hosted keys" tier later?

**3. Agent Workspace: Git-Based or Ephemeral?**
Should each agent session work on a persistent Git worktree (preserving history across retries) or a fresh ephemeral sandbox each time? Git-based is more robust for multi-step tasks but adds complexity. Ephemeral is simpler but loses context on retry. **Recommendation:** Git worktrees per task (not per session), so retries start from the last committed state.

**4. Model Routing Granularity: Per-Role or Per-Step?**
Currently, model preference is set per agent role. But within a role's execution loop, some steps (e.g., planning) might benefit from a stronger model while routine steps use a cheaper one. Do you want intra-session model switching? **Recommendation:** Per-role for now, add per-step routing in Phase 3 if cost optimization becomes important.

**5. Deployment Target: Local Docker Compose or VPS?**
The architecture assumes a single machine with Docker. Are you targeting a local dev machine, a dedicated VPS (Hetzner/DigitalOcean), or both? This affects resource limits for agent sandboxes and whether you need remote access to the UI. **Recommendation:** Develop locally, deploy to a €10/month Hetzner VPS with Caddy for HTTPS.

---
---

# Part II — Post-Build Documentation

Everything below assumes AgentForge is built and running. This is the documentation you (and any future users) will reference when operating the platform.

---

## 10. Deployment & Self-Hosting Guide

### Prerequisites

- A Linux machine (Ubuntu 22.04+ recommended) with Docker and Docker Compose installed
- At least 4GB RAM and 2 vCPUs (agent sandboxes need headroom)
- A domain name (optional, for HTTPS)
- At least one LLM API key (Anthropic or OpenAI)

### Quick Start (Local Development)

```bash
# 1. Clone the repo
git clone https://github.com/youruser/agentforge.git
cd agentforge

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env — set JWT_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

# 3. Start infrastructure
docker compose up -d    # Postgres + Redis

# 4. Run database migrations
cd apps/api
npm run migration:run
cd ../..

# 5. Start backend (dev mode)
cd apps/api && npm run start:dev &

# 6. Start frontend (dev mode)
cd apps/web && npm run dev &

# 7. Open http://localhost:3000
```

### Production Deployment (VPS with Docker Compose)

```bash
# On your VPS (e.g. Hetzner €10/month CX22)

# 1. Clone and configure
git clone https://github.com/youruser/agentforge.git
cd agentforge
cp .env.example .env
# Edit .env with production values:
#   - Strong JWT_SECRET (generate: openssl rand -hex 32)
#   - Real GitHub OAuth credentials (callback URL = https://yourdomain.com/auth/github/callback)
#   - DATABASE_URL with a strong Postgres password

# 2. Build and start everything
docker compose -f docker-compose.prod.yml up -d --build

# 3. Run migrations
docker compose exec api npm run migration:run
```

### `docker-compose.prod.yml`

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: agentforge
      POSTGRES_USER: agentforge
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    depends_on: [postgres, redis]
    environment:
      - DATABASE_URL=postgresql://agentforge:${POSTGRES_PASSWORD}@postgres:5432/agentforge
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # For agent sandboxes
      - workspaces:/app/workspaces
    ports:
      - "127.0.0.1:3001:3001"

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    restart: unless-stopped
    depends_on: [api]
    ports:
      - "127.0.0.1:3000:3000"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data

volumes:
  pgdata:
  workspaces:
  caddy_data:
```

### `Caddyfile` (Automatic HTTPS)

```
yourdomain.com {
    handle /api/* {
        reverse_proxy api:3001
    }
    handle /socket.io/* {
        reverse_proxy api:3001
    }
    handle {
        reverse_proxy web:3000
    }
}
```

### Maintenance Commands

```bash
# View logs
docker compose logs -f api
docker compose logs -f --tail=50 api

# Restart after config change
docker compose restart api

# Run a new migration
docker compose exec api npm run migration:generate -- -n MigrationName
docker compose exec api npm run migration:run

# Backup database
docker compose exec postgres pg_dump -U agentforge agentforge > backup_$(date +%Y%m%d).sql

# Restore database
cat backup_20260319.sql | docker compose exec -T postgres psql -U agentforge agentforge

# Clean up old agent sandbox containers
docker container prune -f --filter "label=agentforge.sandbox=true"

# Check Redis memory usage
docker compose exec redis redis-cli INFO memory
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWT tokens (min 32 chars) |
| `GITHUB_CLIENT_ID` | Yes | — | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | Yes | — | GitHub OAuth App client secret |
| `GITHUB_APP_ID` | No | — | GitHub App ID (for repo integration) |
| `GITHUB_APP_PRIVATE_KEY` | No | — | GitHub App private key (PEM) |
| `SANDBOX_MEMORY_LIMIT` | No | `512m` | Docker memory limit per agent sandbox |
| `SANDBOX_CPU_LIMIT` | No | `0.5` | Docker CPU limit per agent sandbox |
| `SANDBOX_TIMEOUT_SEC` | No | `300` | Max seconds before an agent sandbox is killed |
| `LOG_LEVEL` | No | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `PORT_API` | No | `3001` | NestJS API server port |
| `PORT_WEB` | No | `3000` | Nuxt frontend port |

---

## 11. User Guide — How to Use AgentForge

### 11.1 First-Time Setup

**Step 1: Sign In**
Click "Sign in with GitHub" on the login page. AgentForge uses GitHub OAuth — no passwords to manage.

**Step 2: Add Your LLM API Keys**
Navigate to **Settings → API Keys**. Add at least one key:
- **Anthropic** — for Claude models (recommended for Architect and Reviewer roles)
- **OpenAI** — for GPT models (good for Developer and Tester roles)

Keys are encrypted at rest. AgentForge never proxies through its own keys — you always use your own.

**Step 3: Connect a GitHub Repository (Optional)**
Go to **Settings → GitHub** and install the AgentForge GitHub App on the repositories you want agents to work on. This enables automatic branch creation, commits, and pull requests.

### 11.2 Creating a Project

1. Click **"New Project"** from the dashboard.
2. Give it a name and description (e.g., "E-commerce API — build the payment module").
3. Optionally link a GitHub repo (`owner/repo` format).
4. Set a branch prefix (default: `agentforge/`) — all agent branches will start with this.
5. Click **Create**. The project opens with an empty kanban board.

### 11.3 Configuring Agent Roles

Every new project comes with 5 default roles. You can customize or add more.

**Default Roles:**

| Role | Default Model | Purpose |
|------|--------------|---------|
| Architect | Claude Opus | System design, architecture decisions, task decomposition |
| Developer | Claude Sonnet | Implementation, writing code, fixing bugs |
| Reviewer | Claude Sonnet | Code review, quality checks, best practices |
| Tester | Claude Haiku | Writing and running tests, coverage analysis |
| Debugger | Claude Sonnet | Investigating errors, root cause analysis |

**To customize a role:**
1. Go to **Project → Settings → Agent Roles**
2. Click on a role to edit:
   - **System Prompt** — the template that shapes the agent's behavior (supports `{{task}}`, `{{project}}`, `{{prior_messages}}` variables)
   - **Model Preference** — which LLM to use (picks from your configured API keys)
   - **Tool Access** — what the agent can do: `code_execution`, `github_write`, `web_search`
   - **Max Iterations** — safety limit on how many LLM calls per dispatch (default: 20)

**To add a custom role:**
Click **"Add Role"**, give it a slug (e.g., `security-auditor`), and configure it the same way.

### 11.4 Creating and Managing Tasks

**Create a task:**
1. Click **"+ New Task"** in any kanban column (usually Backlog).
2. Fill in: title, description (Markdown supported), assigned role, and priority.
3. The task appears in the Backlog column.

**Task statuses and what they mean:**

| Status | Meaning |
|--------|---------|
| **Backlog** | Defined but not started. No agent has touched it. |
| **In Progress** | An agent is actively working on it (or queued for processing). |
| **Needs Review** | All agent work is done. Waiting for your approval. |
| **Changes Requested** | You reviewed and sent it back to an agent with feedback. |
| **Done** | You approved it. If GitHub is connected, the PR is merged. |
| **Failed** | An agent errored out or you rejected the work. |

**Dispatch a task to an agent:**
Drag the task from **Backlog** to **In Progress**, or click the task and hit **"Dispatch"**. The system checks your quota, resolves the agent role's model config, and enqueues the job.

### 11.5 Understanding Agent Execution

When a task is dispatched, here's what happens behind the scenes:

1. **Quota check** — are you within your concurrent session and weekly task limits?
2. **Context assembly** — the system builds a prompt from the role's template, injecting the task description, project context, and any prior agent messages on this task.
3. **LLM execution** — the agent runs in a loop: generate response → execute tool calls (if any) → feed results back → repeat until done or max iterations hit.
4. **Output** — the agent produces a structured message (you'll see this in the task detail view) with: what it did, what files it changed, any blockers, and what should happen next.
5. **Handoff or review** — if the agent's output targets another role, it auto-dispatches. If it's the final step, the task moves to **Needs Review**.

You can watch this in real time — the task detail page updates live via WebSocket.

### 11.6 Reviewing Agent Work

When a task reaches **Needs Review**, open it to see the review panel:

**What you see:**
- **Diff View** — all file changes the agents made, with syntax highlighting. Toggle between split and unified view.
- **Agent Log** — chronological timeline of every agent session: which role ran, which model, how many tokens, how long it took, and the full LLM conversation (click to expand).
- **Agent Messages** — the structured handoff messages between agents, rendered as a threaded conversation.
- **Test Results** — if the Tester role ran: pass/fail counts and log output.

**What you can do:**
- **Approve** — marks the task as Done. If a GitHub PR exists, it's merged automatically.
- **Request Changes** — select which role should fix it (e.g., send back to Developer), add your feedback as a comment. The task re-enters the agent pipeline with your feedback injected into the prompt context.
- **Reject** — marks the task as Failed. If a GitHub PR exists, it's closed.

No code is ever merged or finalized without your explicit approval.

### 11.7 Multi-Agent Workflows

For complex tasks, agents hand off to each other automatically:

**Example flow for "Implement user authentication":**
1. You assign to **Architect** → it produces a design doc and decomposes into subtasks
2. Architect hands off to **Developer** → it implements the code
3. Developer hands off to **Tester** → it writes and runs tests
4. If tests fail, Tester hands off to **Debugger** → it investigates and fixes
5. Debugger hands off back to **Developer** → it verifies the fix
6. Developer hands off to **Reviewer** → it does a code review
7. Reviewer completes → task moves to **Needs Review** for you

Each handoff is visible in the Agent Messages panel. You can intervene at any point by clicking **"Pause"** on an in-progress task.

### 11.8 Quota Dashboard

Navigate to **Settings → Usage** to see:

```
Current Period: Mar 17 – Mar 23, 2026

Sessions:    2 / 5  active
Weekly tasks: 34 / 50 used (resets Monday 00:00 UTC)

Recent Activity:
  task-042  Developer  claude-sonnet-4  1,247 tokens  $0.003  12s ago
  task-041  Tester     claude-haiku-4   892 tokens    $0.001  4m ago
  task-040  Architect  claude-opus-4    3,891 tokens  $0.12   1h ago
```

If you hit a limit, the UI shows which limit was reached and when it resets. Tasks are rejected (not silently queued) so you always know what's happening.

---

## 12. API Reference

### Authentication

All API endpoints (except auth routes) require a JWT token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

### Auth Endpoints

```
GET  /auth/github              → Redirects to GitHub OAuth
GET  /auth/github/callback     → Handles OAuth callback, returns JWT
GET  /auth/me                  → Returns current user profile
```

### Projects

```
POST   /projects                          → Create project
GET    /projects                          → List user's projects
GET    /projects/:id                      → Get project (includes task count per status)
PATCH  /projects/:id                      → Update project
DELETE /projects/:id                      → Soft-delete project
```

**Create Project — Request Body:**
```json
{
  "name": "Payment Service",
  "description": "Stripe integration for the e-commerce platform",
  "github_repo": "myorg/payment-service",
  "github_branch_prefix": "agentforge/"
}
```

### Tasks

```
POST   /projects/:projectId/tasks        → Create task
GET    /projects/:projectId/tasks         → List tasks (query: ?status=backlog,in_progress)
GET    /tasks/:id                         → Get task (includes transitions, messages, sessions)
PATCH  /tasks/:id                         → Update task fields
POST   /tasks/:id/transition              → Change task status
POST   /tasks/:id/dispatch                → Dispatch task to agent (shortcut for transition to in_progress)
```

**Create Task — Request Body:**
```json
{
  "title": "Implement webhook signature verification",
  "description": "Add HMAC-SHA256 verification for all incoming Stripe webhooks...",
  "assigned_role": "developer",
  "priority": 1,
  "model_override": null
}
```

**Transition Task — Request Body:**
```json
{
  "status": "in_progress",
  "reason": "Ready for development"
}
```

**Allowed Transitions:**

| From | To |
|------|----|
| `backlog` | `in_progress` |
| `in_progress` | `needs_review`, `failed` |
| `needs_review` | `done`, `changes_requested`, `failed` |
| `changes_requested` | `in_progress` |
| `failed` | `backlog` (retry) |

### Agent Roles

```
POST   /projects/:projectId/roles        → Create role
GET    /projects/:projectId/roles         → List project roles
PATCH  /roles/:id                         → Update role
DELETE /roles/:id                         → Delete role
```

**Create Role — Request Body:**
```json
{
  "slug": "security-auditor",
  "display_name": "Security Auditor",
  "system_prompt_template": "You are a security expert. Review the code for vulnerabilities...",
  "model_preference": "claude-sonnet-4-20250514",
  "tool_access_policy": ["code_execution"],
  "max_iterations": 15
}
```

### Reviews

```
POST   /tasks/:taskId/review             → Submit review decision
GET    /tasks/:taskId/reviews             → List review events for task
```

**Submit Review — Request Body:**
```json
{
  "action": "request_changes",
  "comment": "The error handling in processPayment() swallows exceptions silently. Add proper error propagation.",
  "target_role": "developer"
}
```

### Subscriptions & Quotas

```
GET    /subscriptions/me                  → Get current subscription + usage
PATCH  /subscriptions/me/keys             → Update LLM API keys
GET    /subscriptions/me/usage            → Get detailed usage for current period
```

**Update API Keys — Request Body:**
```json
{
  "anthropic": "sk-ant-...",
  "openai": "sk-..."
}
```

**Usage Response:**
```json
{
  "tier": "pro",
  "sessions": { "active": 2, "limit": 5 },
  "weekly_tasks": { "used": 34, "limit": 50, "resets_at": "2026-03-23T00:00:00Z" },
  "cost_this_week_usd": 4.82,
  "recent_sessions": [
    {
      "task_id": "task_01JQ...",
      "role": "developer",
      "model": "claude-sonnet-4",
      "tokens_in": 1024,
      "tokens_out": 2048,
      "cost_usd": 0.012,
      "duration_sec": 18,
      "status": "completed"
    }
  ]
}
```

### Admin Endpoints

```
PATCH  /admin/subscriptions/:userId       → Adjust user quotas
GET    /admin/users                        → List all users with usage stats
GET    /admin/system/stats                 → System-wide stats (active sessions, queue depth)
```

### WebSocket Events (Socket.IO)

**Client → Server:**
```
join_project   { project_id }       → Subscribe to project events
join_task      { task_id }          → Subscribe to task events
leave_project  { project_id }       → Unsubscribe
```

**Server → Client:**
```
task_status_changed    { task_id, from_status, to_status, triggered_by }
agent_session_started  { task_id, session_id, role, model }
agent_session_ended    { task_id, session_id, status, tokens, cost }
agent_message_created  { task_id, message }
review_completed       { task_id, action }
quota_updated          { sessions_active, weekly_tasks_used }
```

---

## 13. Configuration Reference

### Agent Role System Prompt Templates

Templates use Handlebars syntax. The Orchestrator injects these variables at dispatch time:

| Variable | Type | Description |
|----------|------|-------------|
| `{{task.title}}` | string | Task title |
| `{{task.description}}` | string | Task description (Markdown) |
| `{{task.status}}` | string | Current task status |
| `{{project.name}}` | string | Project name |
| `{{project.description}}` | string | Project description |
| `{{project.github_repo}}` | string | GitHub repo (if connected) |
| `{{current_role}}` | string | This agent's role slug |
| `{{task_id}}` | string | Task ID (for the communication protocol) |
| `{{prior_messages}}` | array | Previous AgentMessage objects on this task |
| `{{review_feedback}}` | string | Human reviewer's comment (if re-queued after review) |
| `{{files_in_workspace}}` | array | List of files in the task's workspace |

**Example system prompt template for a Developer role:**

```handlebars
You are a senior software developer working on the project "{{project.name}}".

## Your Task
Title: {{task.title}}
Description: {{task.description}}

{{#if review_feedback}}
## Reviewer Feedback (address this)
{{review_feedback}}
{{/if}}

{{#if prior_messages.length}}
## Previous Agent Activity on This Task
{{#each prior_messages}}
**[{{this.from_role}} → {{this.to_role}}]** ({{this.message_type}})
{{this.payload.output}}
{{#if this.payload.blockers.length}}
Blockers: {{#each this.payload.blockers}}- {{this}}{{/each}}
{{/if}}
---
{{/each}}
{{/if}}

## Instructions
1. Read the task description and any prior agent messages carefully.
2. Write clean, well-documented code that follows the project's existing patterns.
3. If you need to run code, use the code_execution tool.
4. If you encounter an error you can't resolve, hand off to the debugger role.
5. When finished, hand off to the reviewer role.

## Communication Protocol
When you complete your work or encounter a blocker, output a JSON block wrapped
in ```agentmessage``` fences with the following schema:
{
  "task_id": "{{task_id}}",
  "from_role": "{{current_role}}",
  "to_role": "<target role slug>",
  "message_type": "<handoff|help_request|resolution|status_update>",
  "output": "<summary of what you did>",
  "files_changed": ["<file paths>"],
  "blockers": [],
  "next_action": "<what the next agent should do>"
}
```

### Tool Access Policies

Each role can be granted access to specific tools. Available tools:

| Tool | Slug | Description |
|------|------|-------------|
| Code Execution | `code_execution` | Run commands in a Docker sandbox |
| GitHub Write | `github_write` | Create branches, commit files, open PRs |
| GitHub Read | `github_read` | Read repo files, list PRs, get diff |
| Web Search | `web_search` | Search the web for documentation, examples |
| File System | `file_system` | Read/write files in the task workspace |

**Default policies per role:**

| Role | Tools |
|------|-------|
| Architect | `github_read`, `web_search` |
| Developer | `code_execution`, `github_write`, `github_read`, `file_system` |
| Reviewer | `github_read`, `code_execution` (for running tests) |
| Tester | `code_execution`, `github_read`, `file_system` |
| Debugger | `code_execution`, `github_read`, `file_system`, `web_search` |

### Subscription Tiers

| Tier | Concurrent Sessions | Weekly Tasks | Price |
|------|-------------------|--------------|-------|
| Free | 3 | 20 | $0 |
| Pro | 5 | 50 | self-hosted (no cost) |
| Team | 10 | 200 | self-hosted (no cost) |

Since this is self-hosted, tiers are just quota presets. Adjust them freely via the admin API.

---

## 14. Troubleshooting & Operations

### Common Issues

**"QuotaExceededError: concurrent_sessions"**
You have too many agent sessions running at once. Wait for one to finish or increase your limit via admin API:
```bash
curl -X PATCH http://localhost:3001/admin/subscriptions/YOUR_USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxConcurrentSessions": 10}'
```

**Agent session stuck in "running" state**
If an agent sandbox crashed without cleanup, the Redis counter may be off:
```bash
# Check actual running containers
docker ps --filter "label=agentforge.sandbox=true"

# Reset the counter manually
docker compose exec redis redis-cli SET sessions:active:YOUR_USER_ID 0
```

**"No API key configured for provider: anthropic"**
You need to add your API key in Settings → API Keys, or via the API:
```bash
curl -X PATCH http://localhost:3001/subscriptions/me/keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"anthropic": "sk-ant-..."}'
```

**Database migrations fail**
```bash
# Check migration status
cd apps/api && npm run migration:show

# Revert last migration
npm run migration:revert

# Re-run
npm run migration:run
```

**Agent produces garbled output / doesn't follow the protocol**
Usually a model quality issue. Try upgrading the role's model (e.g., from Haiku to Sonnet). Check the raw LLM conversation in the Agent Log to see what went wrong. If the agent consistently fails to produce the `agentmessage` JSON block, the system prompt template may need adjustment.

**WebSocket disconnections / UI not updating**
Check that the Socket.IO path is correctly proxied in your Caddy/nginx config. The path must be `/socket.io/` (with trailing slash). Verify:
```bash
curl -i http://localhost:3001/socket.io/?EIO=4&transport=polling
# Should return 200 with a session ID
```

### Health Checks

```bash
# API health
curl http://localhost:3001/health
# Expected: { "status": "ok", "db": "connected", "redis": "connected" }

# Queue depth
curl http://localhost:3001/admin/system/stats -H "Authorization: Bearer $TOKEN"
# Shows: active sessions, queue depth per role, failed jobs count

# Redis memory
docker compose exec redis redis-cli INFO memory | grep used_memory_human
```

### Backup Strategy

```bash
# Daily database backup (add to crontab)
0 3 * * * docker compose exec -T postgres pg_dump -U agentforge agentforge | gzip > /backups/agentforge_$(date +\%Y\%m\%d).sql.gz

# Keep 30 days of backups
find /backups -name "agentforge_*.sql.gz" -mtime +30 -delete

# Redis is ephemeral (quota counters + cache) — no backup needed.
# If Redis restarts, counters are reconciled from Postgres on next access.
```

### Log Analysis

```bash
# NestJS logs are structured JSON (via Pino)
docker compose logs api | jq '.msg'

# Filter for errors
docker compose logs api | jq 'select(.level >= 50)'

# Filter for a specific task
docker compose logs api | jq 'select(.taskId == "task_01JQ...")'

# BullMQ failed jobs
docker compose logs api | jq 'select(.msg | contains("failed"))'
```
