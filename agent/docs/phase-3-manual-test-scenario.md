# Phase 3 Manual Test Scenario

Date: 2026-03-25

## Purpose
Use this scenario to validate the Phase 3 operations slice:
- starter-project onboarding
- role template import and export
- token and cost visibility
- task retry and blocked-state recovery controls
- in-app notifications and notification preferences
- admin quota management and system stats

## Preconditions
- Dependencies are installed with `npm install`.
- API is running with `npm run dev:api`.
- Web app is running with `npm run dev:web`.
- The app is opened at `http://localhost:3000`.
- Use the local development sign-in unless GitHub OAuth is explicitly being tested.

## Scenario 1: Onboarding Bootstrap
1. Sign in with a fresh local development email.
Expected result: the workspace shows the onboarding card instead of an empty board.

2. Click `Create Starter Project`.
Expected result: a starter project is created with seeded roles and three backlog tasks.

## Scenario 2: Role Marketplace
1. Open the `Role Templates` panel.
2. Click `Export Project`.
Expected result: the export textarea fills with a JSON bundle containing the current project roles.

3. Click `Stage Import` on a template such as `Delivery Manager`.
4. Click `Import Templates`.
Expected result: the selected template is imported into the current project and appears in Role Studio.

## Scenario 3: Cost Tracking + Review Gate
1. Dispatch one of the starter tasks.
Expected result:
the task reaches `Needs Review`;
the review panel shows token and cost metadata for the latest run;
the usage panel shows weekly cost, weekly tokens, and at least one recent session.

## Scenario 4: Notifications
1. Open the `Alerts` panel after the dispatch completes.
Expected result: a `review_requested` notification appears and the unread count increases.

2. Mark the notification as read.
Expected result: the unread count decreases and the notification remains visible in history.

3. Enable webhook notifications and save preferences with a test webhook URL if available.
Expected result: preference changes are persisted; webhook delivery succeeds or records a failure reason without breaking the in-app notification.

## Scenario 5: Retry Path
1. Open a task in `Needs Review`.
2. Reject it with a comment such as `Rejecting to validate retry.`
Expected result: the task moves to `Failed` and the recovery card records the failure reason.

3. Click `Retry`.
Expected result: the task re-enters the workflow and returns to `Needs Review`.

## Scenario 6: Admin Desk
1. Open the `Operations Desk` panel as the initial local admin user.
Expected result: system stats, queue mode, and the current user list are visible.

2. Change the current user’s session limit or weekly task limit.
Expected result: the user row refreshes with the updated quota.

3. Review the dead-letter section.
Expected result: it is empty in the happy path, or shows tasks that exhausted retries if a failure scenario was forced.

## Current-State Caveats
- Local development still uses authenticated Server-Sent Events rather than Socket.IO.
- Email notification delivery is represented as stored notification records in this environment; webhook delivery can execute when a valid destination is configured.
- In local fallback mode, run history is mirrored into task JSON to keep review and usage views stable even when the SQL.js relation path is minimal.
