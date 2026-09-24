# Tundra Frontmatter Wrangler release notes

## 3.6.5 - 2026-09-24

Added direct context-menu entry points for notes, folders, and File Explorer multi-selections, plus command-palette actions for the current note and folder. Right-clicking inside an editor opens Tundra for that note.

## 3.6.4 - 2026-09-24

Tundra now opens on the current note and puts target selection and operation setup in one compact view. Searchable pickers handle alternate notes and folders, and optional filters stay collapsed. AI tier and existing-value behavior can be set once in Settings. Preview, write authorization, per-note stale checks, cancellation, recovery journal, and rollback remain in place. This update also fixes CRLF line endings when writing frontmatter to Windows-formatted notes.

## 3.6.0 - 2026-09-24

AI frontmatter generation now offers four cumulative field tiers (4, 9, 21, and 50 fields), with Standard (9) as the default and `image` in every tier. Tag requests ask for up to 20 relevant standard tags and normalize/deduplicate suggestions. Responses are capped at 10,000 tokens; proposed image references must occur in the note body or existing `image` property. Every suggestion remains in the normal review flow.

## 3.5.5 - 2026-09-24

Documentation-only update: aligned the interoperability guide with the cumulative field tiers. `image` is included in Bare Minimum and carried through all tiers. Runtime behavior is unchanged.

## 3.5.4 - 2026-09-24

Documentation-only update: added a 50-property interoperability guide for consistent frontmatter across Obsidian and other Markdown tools. Runtime behavior is unchanged.

## 3.5.3 - 2026-09-24

Documentation and release metadata update. The 3.5.2 runtime is unchanged; the release adds clear feature, requirements, architecture, and marketing references.

## 3.5.2 - 2026-09-23

The $1 and $10 checkout buttons now select the matching live credit packs. Tundra reconciles pending charges and refreshes purchased credit balances before applying changes. Reviewing a diff immediately updates the apply button. Billing is skipped when no previewed changes remain applicable.

## 3.5.1 - 2026-09-23

AI-assisted frontmatter proposals are available inside the existing reviewed bulk workflow.

## 3.5.0 - 2026-09-23

Added optional AI-assisted proposals for selected top-level properties. Suggestions remain subject to the normal per-note review and apply flow.

## 3.4.10 - 2026-09-22

- Updated Constance checkout to use the authenticated plan-code flow, stable idempotency, and webhook-authoritative settlement polling.

## 3.4.6 - 2026-09-20

Metadata-only patch preparation: synchronized source, publish, and current
release documentation. No runtime behavior changed.

## 3.4.5 - 2026-09-20

Metadata-only release: synchronized the source and public bundle version
surfaces for the next Obsidian Community release.

## 3.4.4 - 2026-09-12

Metadata-only release bump: canonical, package, manifest, and publish version surfaces are synchronized. No runtime behavior changed.


## 2026-09-11 — Tundra release and live billing

This release carries the synchronized Tundra source, publish, and public-repository surfaces at 3.4.4. The live Paddle catalog IDs for the $1/100 and $10/1,000 one-time packs remain configured; preview, no-op, and rollback operations remain free.

## 2026-09-11 — Billing live catalog

The live Tundra Paddle price IDs are now configured for the $1/100 and $10/1,000 one-time credit packs. Checkout is ready for the provisioned catalog; no billing placeholders remain.

This release finalizes billing for reviewed write batches. Each local calendar day includes three free non-empty apply batches; subsequent non-empty apply batches authorize one purchased credit. The settings tab includes the persisted billing identity, email, balance sync, and one-time $1/100 and $10/1,000 pack buttons backed by the provisioned live Constance price IDs.

Preview, no-op, and rollback operations do not consume credits.

The 3.3.0 MVP remains intact: reviewed note selection, property inventory, deterministic key/tag/schema operations, diffs, dry-run counts, cancellation, per-note error isolation, undo journals, rollback, and a local operation log.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.6.7)

Tundra runs the configured operation directly from its note and folder commands. Choose the default operation in Settings; review is optional and off by default.
<!-- one-click-workflow:end -->
