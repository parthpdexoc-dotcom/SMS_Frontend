---
name: scrum-944-refresh-access-token
branch: scrum-944-refresh-access-token
status: completed
priority: Medium
scope: Small
epic: NA
created: 2026-07-15
issue: NA
jira: SCRUM-944
---

# SCRUM-944 — Replace Access Token from Response Headers

## Goal

Keep authenticated sessions current by centrally applying JWT replacements supplied by the backend on normal authenticated API responses.

## Backend Contract

An authenticated response may include:

- `X-New-Access-Token`
- `X-New-Access-Token-Expires-At`

The normal response status and body remain unchanged. Header lookup must be case-insensitive.

## Implementation

- Reuse `src/utils/apiClient.ts` as the single interception point for all feature services.
- Reuse the session-storage helpers in `src/utils/token.ts`.
- Read renewal headers immediately after each shared-client response.
- Store the replacement token and optional expiration before returning the response.
- Notify Redux through a registered callback, keeping the API utility independent of the store.
- Rebuild Redux user claims from the renewed JWT while preserving the current frontend user type.
- Continue reading the latest stored token when constructing every `Authorization` header.
- On an authenticated `401` without a replacement token, clear token storage and invoke the existing logout/login transition once per failed token.
- Preserve anonymous login handling, explicit logout, impersonation behavior, `403` handling, and normal response bodies.

## Verification

- [x] Response without renewal headers leaves token, Redux state, and body unchanged.
- [x] Response with renewal headers updates token, expiration, and Redux state.
- [x] The next request sends `Authorization: Bearer <renewed-token>`.
- [x] Concurrent `401` responses clear the session and trigger logout/login handling once.
- [x] `npm run build` passes.
- [x] Changed files have no new lint diagnostics.

Automated test files and Vitest were removed at the user's request.

## Risk

For cross-origin deployments, the backend must expose both custom headers through CORS `Access-Control-Expose-Headers`; otherwise browser JavaScript cannot read them.
