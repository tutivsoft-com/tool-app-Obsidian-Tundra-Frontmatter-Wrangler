# Tundra Frontmatter Wrangler 3.4.2

## 2026-09-11 — Tundra release and live billing

This patch release publishes the completed Tundra billing flow with the live Paddle catalog IDs for the $1/100 and $10/1,000 one-time packs. Source, publish, and public-repository release surfaces are synchronized at 3.4.2; preview, no-op, and rollback operations remain free.

## 2026-09-11 — Billing live catalog

The live Tundra Paddle price IDs are now configured for the $1/100 and $10/1,000 one-time credit packs. Checkout is ready for the provisioned catalog; no billing placeholders remain.

This release finalizes billing for reviewed write batches. Each local calendar day includes three free non-empty apply batches; subsequent non-empty apply batches authorize one purchased credit. The settings tab includes the persisted billing identity, email, balance sync, and one-time $1/100 and $10/1,000 pack buttons backed by the provisioned live Constance price IDs.

Preview, no-op, and rollback operations do not consume credits.

The 3.3.0 MVP remains intact: reviewed note selection, property inventory, deterministic key/tag/schema operations, diffs, dry-run counts, cancellation, per-note error isolation, undo journals, rollback, and a local operation log.
