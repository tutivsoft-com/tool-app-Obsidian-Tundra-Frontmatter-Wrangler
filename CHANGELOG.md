# Changelog

## 3.4.10 - 2026-09-22

- Migrated authenticated checkout to the Contract v9 plan-code endpoint with idempotency and settlement polling.

## 3.4.9 - 2026-09-21

- Incremented release metadata without rebuilding the plugin.

## 3.4.6 - 2026-09-20

- Prepared the next patch version across source, publish, and public metadata.
- No runtime behavior changed in this documentation and version bump.

## 3.4.5 - 2026-09-20

- Synchronized the Tundra source and publish version surfaces and prepared the
  next source-inclusive TutivSoft release.

## 3.4.4 - 2026-09-12

- Incremented and synchronized the canonical, package, manifest, and publish version surfaces after the billing rollout. No runtime behavior changed in this metadata release.


## 3.4.2 — 2026-09-11 — Tundra release

- Promoted the live Tundra billing catalog into the final 3.4.2 source and publish release surfaces.

## 3.4.1 — 2026-09-11 — Billing live catalog

- Activated the provisioned Tundra Paddle price IDs for the $1/100 and $10/1,000 one-time credit packs across source and publish artifacts.

## 3.4.0 — Billing

- Added three free, non-empty apply batches per local calendar day.
- Added one purchased credit per authorized non-empty apply batch, with local credit mirroring and unsigned Constance browser-relay sync/spend.
- Added persisted install billing identity, checkout buttons for the $1/100 and $10/1,000 one-time packs, and settings balance sync.
- Kept preview, no-op, and rollback flows free; wired checkout to the provisioned live price IDs.

## 3.3.0 — MVP

- Added the Select → Inspect → Configure → Preview → Apply → Review workflow.
- Added safe top-level property rename/removal, tag operations, schema ordering, and format-only reordering.
- Added dry-run inventories, representative diffs, backups, cancellation, independent failures, logs, and guarded rollback.
