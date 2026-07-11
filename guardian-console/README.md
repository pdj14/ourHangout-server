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

- Uses `/v1/guardian/auth/login`.
- Guardian Console login is disabled until both `GUARDIAN_CONSOLE_LOGIN_ID` and
  `GUARDIAN_CONSOLE_PASSWORD` are configured.
- Production passwords must be at least 16 characters. Never commit credentials to this repository.
- Only a Guardian Console token can access Guardian APIs and the global report queue.
