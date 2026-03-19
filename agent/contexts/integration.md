# Integration Context

Date: 2026-03-19

## External API Inventory
- OpenAI API
  - Purpose: single-agent execution in Phase 1 through the AI SDK.
  - Auth: bearer API key supplied by the user.
- Anthropic API
  - Purpose: alternate model provider for role configuration in Phase 1.
  - Auth: bearer API key supplied by the user.
- GitHub OAuth
  - Purpose: basic authentication flow for the web application.
  - Auth: OAuth client ID and client secret.

## Internal Service Contracts
- Web app to API:
  - REST endpoints for auth, projects, tasks, roles, settings, and dispatch.
- API to Redis:
  - BullMQ queue and worker coordination.
- API to PostgreSQL:
  - primary persistence for projects, tasks, roles, settings, and agent outputs.

## Auth Flow Summary
- Planned primary flow:
  1. User starts GitHub OAuth from the web app.
  2. API handles callback and issues a JWT/session.
  3. Web app stores auth state for subsequent API calls.
- Planned development fallback:
  - local bootstrapped account or seed-based flow if GitHub credentials are not configured.

## Endpoint Inventory Summary
- Planned Phase 1 endpoints:
  - `/auth/*`
  - `/projects/*`
  - `/tasks/*`
  - `/roles/*`
  - `/settings/api-keys`
  - `/dispatch/*`

## Rate Limits And Error Handling Notes
- Provider rate limits depend on the user’s OpenAI/Anthropic account.
- Queue dispatch and API key selection should fail fast with actionable validation errors.
- Missing external credentials should degrade gracefully in local development.
