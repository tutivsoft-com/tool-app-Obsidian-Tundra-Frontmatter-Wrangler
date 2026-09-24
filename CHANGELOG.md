# Changelog

## 3.6.6

- Added saved operation defaults and direct current-note/folder commands with optional before/after review.


## 3.6.5 - 2026-09-24

- Added note-editor, File Explorer note/folder, and multi-selection context-menu actions that launch Tundra on the clicked target.
- Added command-palette actions scoped to the current note and folder.

## 3.6.4 - 2026-09-24

- Replaced the multi-step selection and inventory wizard with a compact current-note-first workflow and searchable note/folder pickers.
- Kept optional filters collapsed, moved reusable AI tier/value behavior to Settings, and simplified batch review to one confirmation.
- Preserved preview checks, billing authorization, stale-note protection, journaling, cancellation, and rollback.

## 3.6.1 - 2026-09-24

- Loaded this repository's own $2 no-reset OpenRouter key from an encrypted manifest, with a personal key override.

## 3.6.0 - 2026-09-24

- Added four cumulative AI frontmatter tiers (4/9/21/50 fields), with Standard as the default and `image` in every tier.
- Added a 10,000-token response cap and up-to-20 relevant normalized tag suggestions; invalid or fabricated image references are filtered.
- Added automated tests using a real repository Markdown note and a mocked AI response; no note content was sent to OpenRouter.

## 3.5.5 - 2026-09-24

- Updated the frontmatter guide with cumulative 4/9/21/50-field tiers and promoted `image` to Bare Minimum; runtime behavior is unchanged.

## 3.5.4 - 2026-09-24

- Added a cross-app frontmatter interoperability guide with 50 ranked property names; runtime behavior is unchanged.

## 3.5.3 - 2026-09-24

- Added current feature, architecture, requirements, and marketing documentation.
- Clarified benefit claims and synchronized release metadata; runtime behavior is unchanged from 3.5.2.

## 3.5.2 - 2026-09-23

- Corrected the $1 and $10 credit pack checkout mapping to the live catalog.
- Check outstanding charges and the current credit balance before changing notes.
- Review checkboxes now immediately enable the apply button when all changes are reviewed.
- Skip billing authorization when every previewed note has changed or disappeared before apply.

## 3.5.1 - 2026-09-23

- Fixed format-only previews, exact YAML closing-delimiter detection, BOM safety, and preservation of prototype-named properties.

## 3.5.0 - 2026-09-23

- Added AI-assisted frontmatter proposals for review before the existing guarded apply and rollback workflow.

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
