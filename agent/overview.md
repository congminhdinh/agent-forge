# Shared Agent Workflow Overview

Date: 2026-03-19

## Purpose
This folder stores working context, task plans, lessons learned, and helper scripts used during implementation and verification.

This workflow is agent neutral. Replace agent with the shared workflow folder used by the current repo, for example agents, workflow, or codex.

## Folder Conventions
- plans: one markdown file per task using the naming pattern `YYYY-MM-DD-task-name.md` with checkbox steps.
- lessons: a single rolling `lessons.md` file with dated entries recording user feedback, implementation outcomes, and blockers.
- scripts: reusable helper scripts used for refactor, migration, verification, patching, or content updates across frameworks.
- contexts: project context docs following the minimum templates below (architecture, environment, integration, workflow notes).
- templates: plan templates, context doc skeletons, and PR description templates for consistent structure across tasks.
- designs: UI reference assets.
- SP: SQL or stored procedure input files for implementation tasks when needed.

## Bootstrap (First Run)
When starting a new project, create these minimum context files before any implementation:

1. `agent/contexts/architecture.md` — tech stack, key services, data flow, repo structure, and major dependencies.
2. `agent/contexts/environment.md` — required tools and versions, env vars, local setup steps, external service dependencies.
3. `agent/contexts/integration.md` — third party APIs, internal service contracts, auth flows, and endpoint inventory (create when the project has integrations).
4. `agent/lessons.md` — empty file with a dated header, ready to receive entries.
5. `agent/templates/plan-template.md` — a skeleton plan with standard sections (goal, steps, verification, blockers).

## Context Doc Minimum Structure
Each context doc should contain at least these sections:

**architecture.md**: tech stack and versions, service or module map, data flow overview, repo folder structure, key conventions.

**environment.md**: required tools and runtime versions, env vars with example values (no secrets), local setup steps, optional but recommended tools, known platform quirks.

**integration.md**: external API inventory with base URLs, auth method per service, request and response shape summaries, rate limits or quotas, error handling conventions.

## Standard Execution Flow
1. Read current context docs in agent/contexts and related project files.
2. Verify the environment before implementation. Confirm tooling, credentials, runtime assumptions, external services, and any local prerequisites needed to build, run, or verify the task.
3. Inspect active configuration layers and run profiles before implementation. Review base config plus any local, development, environment, launch, task runner, container, or profile specific overrides that may change runtime behavior.
4. Create a plan in agent/plans using the naming pattern `YYYY-MM-DD-task-name.md` with checkbox items before implementation.
5. Do not implement unplanned changes. If new work surfaces, update the plan or create a follow up plan before writing code.
6. Implement changes in the codebase following existing conventions. Commit at each completed plan step or logical checkpoint.
7. Update the same plan file by checking completed items as work progresses.
8. If API behavior, contracts, setup steps, or user workflows change, create or update Markdown documentation in the repo before closing the task.
9. Log feedback and outcomes in agent/lessons.md with a dated entry.
10. Before committing, run a cleanup pass to remove all temporary files, scratch outputs, agent generated drafts, debug logs, and any artifacts not meant for the repo. Use or extend the cleanup script in agent/scripts if one exists, or create one if repeated cleanup patterns emerge.
11. Run build or verification and document blockers if verification is not possible.

## Pre-Commit Cleanup
- Before every commit, scan the working tree for temporary files that should not be tracked. Common culprits include: agent scratch files, temp outputs from Codex or other AI tools, `.tmp`, `.bak`, `.patch`, debug logs, leftover test fixtures, and any file not referenced by the codebase.
- If a cleanup script exists in agent/scripts (for example `cleanup.sh` or `cleanup.py`), run it before staging. If repeated temp file patterns appear across tasks, create or extend a cleanup script rather than deleting manually each time.
- The cleanup script should be parameterized with a dry run mode that lists files to be deleted without removing them, and a confirm mode that actually deletes. This prevents accidental removal of wanted files.
- After cleanup, run `git status` or equivalent and review the staged diff. Do not commit files that are not part of the task deliverable.
- If the project uses `.gitignore`, ensure common temp patterns are covered. When a new temp pattern is discovered, add it to `.gitignore` as part of the current task.

## Error Handling and Rollback
- Commit working checkpoints before risky or wide reaching changes.
- If the build breaks after changes, revert to the last working state before debugging.
- Do not stack further changes on top of a broken build.
- When reverting, record the failure in the plan file with a `BLOCKED:` prefix and the root cause.
- If a rollback is not clean, document exactly what was reverted and what remains dirty.

## Scope Control
- Do not implement work that is not in the current plan.
- If a task expands materially, stop implementation and update the current plan immediately or create a clearly linked follow up plan before continuing.
- Treat unplanned scope as a new task, not an extension of the current one, unless the addition is trivially small (under 5 minutes of work).

## Communication Conventions
- When blocked, update the plan step with a `BLOCKED: reason` prefix and surface it immediately.
- When making a non obvious decision (choosing between approaches, skipping a step, deviating from conventions), add a brief note in the plan explaining the reasoning.
- When asking for clarification, be specific: state what is ambiguous, what options exist, and what the default assumption would be if no answer is given.
- When reporting completion, include what was done, what was verified, and what was not verified.

## Plan Rules
- Name files using the pattern `YYYY-MM-DD-task-name.md`.
- Keep one checklist item per atomic step.
- Do not mark a step complete unless code or docs are actually updated.
- If a task expands materially, update the current plan immediately or create a clearly linked follow up plan before continuing with the added scope.
- Include a verification section at the bottom of each plan listing the commands or checks to confirm the task is done.

## Environment Rules
- Verify both required and optional dependencies for the task, and note which ones are necessary to run, test, or hand off the change.
- For local or multi environment work, inspect both config layers and launch or run profiles, not just one config file.
- For multi service or integrated systems, verify actual reachable endpoints, ports, hosts, service discovery, and routing behavior before debugging higher level failures.

## Documentation Rules
- If API contracts, endpoint sequences, request or response shapes, setup steps, or user facing workflows change, update or add a Markdown document in the repo.
- Keep documentation focused on how to use or verify the changed behavior, not just on internal implementation details.

## Lessons Rules
- Use a single rolling `agent/lessons.md` file.
- Format each entry with a date header (`### YYYY-MM-DD`), task reference, and categorize as feedback, bug fix, or blocker.
- When user gives feedback, add a new entry immediately.
- Record root cause and applied fix when resolving bugs.
- If verification is blocked, record the blocker and reason.

## Script Rules
- Put helper scripts in agent/scripts, not in the workflow root.
- Reuse or extend an existing script before creating a new one when the workflow is already covered.
- Prefer small, single purpose, parameterized scripts with descriptive names.
- Use scripts when they reduce repeated manual steps, gather environment facts, normalize multi file changes, or automate verification.
- Choose the script language or tool that best fits the repo and environment. Keep placement and naming framework agnostic.
- Add a short usage note in the script or companion doc when inputs, outputs, or side effects are not obvious.
- Keep temporary outputs in script specific temp locations and clean them up, or promote the script into a documented reusable tool if it becomes part of the normal workflow.
- Remove one off temporary scripts when they are no longer needed.

## Git Conventions
- Write commit messages in imperative mood: `add user auth endpoint`, not `added user auth endpoint`.
- Commit at each completed plan step to keep changes atomic and reviewable.
- Use branch naming pattern: `type/YYYY-MM-DD-short-description` where type is one of feat, fix, refactor, docs, chore.
- Do not bundle unrelated changes in a single commit.
- If working on a long running task, push at least once per session to avoid losing work.

## Handoff Checklist
- Plan file updated with all steps checked or marked as blocked.
- Lessons file updated with dated entry covering outcome.
- Scripts stored under agent/scripts, documented if reusable, or removed if temporary.
- Required and optional dependencies noted for the task or handoff.
- API or workflow documentation updated when behavior or setup changed.
- Verification result reported with the actual commands run and their output.
- Git history is clean with atomic commits per plan step.
