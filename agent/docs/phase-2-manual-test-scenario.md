# Phase 2 Manual Test Scenario

Date: 2026-03-25

## Purpose
Use this scenario to manually validate the current Phase 2 development state:
- multi-agent task dispatch
- human review actions
- task message and transition history
- usage and quota visibility
- live refresh behavior
- current fallback behavior when no provider keys are configured

## Preconditions
- Dependencies are installed with `npm install`.
- API is running with `npm run dev:api`.
- Web app is running with `npm run dev:web`.
- The app is opened at `http://localhost:3000`.
- Use the local development sign-in unless GitHub OAuth is explicitly being tested.

## Recommended Test Data
- Login email: `phase2.tester@agentforge.local`
- Display name: `Phase 2 Tester`
- Project name: `Manual QA Project`
- Project description: `Validate the current Phase 2 workflow`
- GitHub repo:
  Leave blank for the baseline scenario.
  Optional follow-up: set `owner/repo` to validate GitHub metadata messaging.
- First task title: `Validate fallback multi-agent workflow`
- First task description: `Confirm the task moves through agent handoffs and reaches review without BYOK keys.`
- Assigned role: `Architect`

## Scenario 1: Baseline Phase 2 Flow
1. Sign in with the local development form.
Expected result: the workspace loads, the quota dashboard is visible, and no auth errors are shown.

2. Create a new project with the recommended test data and leave `GitHub repo` empty.
Expected result: the project appears in the sidebar and includes the seeded default roles.

3. Confirm the role list contains `Architect`, `Developer`, `Reviewer`, `Tester`, and `Debugger`.
Expected result: each role is selectable in Role Studio and has a model preference plus tool policy.

4. Create a task titled `Validate fallback multi-agent workflow` and assign it to `Architect`.
Expected result: the task is created in `Backlog`.

5. Dispatch the task using the task card button or by moving it into `In Progress`.
Expected result: the task leaves `Backlog`, the usage panel updates, and the workflow starts.

6. Wait for the workflow to finish.
Expected result:
the task reaches `Needs Review`;
the latest run output is populated;
the task contains multiple agent messages;
the transition timeline includes `backlog -> in_progress -> needs_review`.

7. Open the selected task in the review panel.
Expected result:
the latest provider/model are shown;
agent messages are listed in order;
the review history is empty on first pass;
the GitHub handoff card says GitHub is not configured.

8. Read the output panel.
Expected result: when no OpenAI or Anthropic keys are configured, the output contains the Phase 2 fallback flow with an `agentmessage` block instead of failing the task.

## Scenario 2: Request Changes Loop
1. With the same task still in `Needs Review`, enter a review comment such as `Run the workflow again and hand it back for review.`
2. Set the request-changes target role to `Developer`.
3. Click `Request Changes`.
Expected result:
the review decision is recorded;
the task briefly enters `Changes Requested` and is immediately re-dispatched;
the task returns to `In Progress` and then back to `Needs Review` after the workflow completes;
the review history now contains one `request_changes` event;
the task messages and transition timeline both grow.

## Scenario 3: Approval Path
1. With the same task back in `Needs Review`, enter an approval comment such as `Approved after rerun.`
2. Click `Approve`.
Expected result:
the task moves to `Done`;
the review history contains an `approve` event;
the task is no longer awaiting review;
if a GitHub repo was configured, the GitHub handoff status changes to `approved`.

## Scenario 4: Rejection Path
1. Create a second task, assign it to `Developer`, and dispatch it.
2. Wait for it to reach `Needs Review`.
3. Enter a rejection comment such as `Rejecting to validate the failed path.`
4. Click `Reject`.
Expected result:
the task moves to `Failed`;
the review history contains a `reject` event;
the transition timeline records the review decision.

## Scenario 5: Live Refresh Check
1. Open the same project in a second browser tab while staying signed in with the same user.
2. In the first tab, dispatch a new task or submit a review action.
Expected result:
the second tab updates without a manual refresh;
project/task changes appear through the live event stream;
usage numbers also refresh after dispatch and completion.

## Scenario 6: Usage And Quota Check
1. Observe the quota dashboard before dispatching a task.
2. Dispatch a task and wait until it completes.
Expected result:
the active session count increases while the task is in progress;
the weekly task count increments when a workflow starts;
recent session entries appear with role, model, summary, and duration information.

## Optional Scenario 7: Provider Key Path
1. Add a valid OpenAI or Anthropic key in BYOK Controls.
2. Create and dispatch another task.
Expected result:
the task still reaches `Needs Review`;
the latest run shows the selected provider and model;
the output is generated by the live provider instead of the fallback text, unless the provider call fails.

## Optional Scenario 8: GitHub Metadata Path
1. Edit the project and set `GitHub repo` to a placeholder `owner/repo`.
2. Create and dispatch a new task until it reaches `Needs Review`.
Expected result:
the GitHub handoff card shows a generated branch name and compare URL;
this is metadata only in the current state, not a real PR creation flow.

## Current-State Caveats
- Real-time updates use authenticated Server-Sent Events, not Socket.IO.
- GitHub integration currently exposes handoff metadata and status messaging, not actual branch pushes or PR creation.
- Docker sandboxing is represented as run metadata only in this environment.
- If the Nuxt production build is used as part of manual validation, it may need to be run outside the sandbox because the cache path can raise `EPERM`.
