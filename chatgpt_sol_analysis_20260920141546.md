# Tundra implementation analysis

## Reviewed code map

Reviewed `main.ts`, `billing.ts`, `billing-model.ts`, frontmatter wizard/rule application, settings, account/support modules, and publish output.

## Changes and safeguards

- Frontmatter edits use account-scoped free usage and authenticated paid spending with stable event IDs and fail-closed billing.
- Defaults provide a safe inspect/preview path before any batch write; destructive application remains explicit.
- Wizard scope and preview commands come first, followed by rules, limits, audit, and advanced billing settings.
- Removed unnecessary startup messaging while retaining action completion and error notices.

## Threat model and migration

Bearer sessions are linked to the installation and invalid sessions are cleared. Passwords, frontmatter values, and note contents never enter support logs. Reinstalling cannot reset server-side free usage.

## Documentation and logging

Help describes wizard flow, defaults, preview/apply safeguards, account/billing, privacy, troubleshooting, and rollback/audit behavior. Logs cover lifecycle, scans, batch cancellation, billing, writes, and errors without sensitive content.

## Validation

Run `npm run check` (including its test/build path) and `git diff --check`; mirror validated public files only.

## Remaining limitation

Live account service and representative vault fixture coverage remain external validation concerns.
