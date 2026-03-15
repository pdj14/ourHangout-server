# ourHangout Guardian Console

Static web console for parent-role operators to inspect and manage key `ourHangout-server` data.

## Routes

- Web UI: `/guardian`
- API: `/v1/guardian/*`

## Included features

- DB summary overview
- User listing and profile/role updates
- Parent-child relationship overview
- Room/message browsing with single-message deletion
- Keyword-based bulk cleanup for `test` messages
- Storage overview, unreferenced asset review, orphan-file cleanup

## Authentication

- Uses the existing `/v1/auth/login` flow.
- Only `role=parent` accounts can access Guardian APIs.
