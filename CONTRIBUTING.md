# Contributing to LEMON

Thank you for helping improve LEMON. Keep changes focused on student safety, correctness, accessibility, and maintainability.

## Before submitting a change

1. Create a focused branch and avoid unrelated formatting or redesign work.
2. Never commit credentials, real student data, browser exports, worker configuration, logs, or deployment artifacts.
3. Preserve guest data compatibility and do not enable account sync or external polling by default.
4. Add or update tests for behavior changes.
5. Run:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Document any check that cannot be run. Course-data changes must preserve attribution, freshness warnings, validation, atomic publication, and last-known-good rollback behavior.

## Pull requests

Explain the problem, the smallest effective change, verification performed, and any privacy or data-source impact. Do not include secrets or personal records in screenshots, logs, fixtures, or issue text.

Security vulnerabilities must be reported privately as described in [SECURITY.md](SECURITY.md), not through a public issue.

