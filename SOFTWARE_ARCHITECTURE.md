# Tundra Frontmatter Wrangler — Software Architecture

Version: 3.6.8

## Runtime boundaries

Tundra is an Obsidian plugin for local Markdown vaults. Deterministic selection, parsing, operation planning, preview, apply, journaling, and rollback run in the plugin. Optional OpenRouter requests are made when the user runs AI generation. Billing requests are independent of note content.

## Runtime flow

1. `main.ts` registers direct configured note/folder/selection actions, the wrangler view, settings, and plugin-data persistence. With review disabled, configured actions build and apply their plan without opening a modal; review enabled opens the before/after review.
2. Selection defaults to the active note; searchable pickers support another note or folder, and the whole vault is an explicit choice. Optional property and text/path filters remain collapsed until needed.
3. `core.ts` parses only the supported frontmatter shape and builds deterministic plans for the selected operation. Unsafe inputs and malformed YAML become explicit skipped results.
4. The selected operation builds a plan and applies eligible changes. Optional AI generation produces top-level-value proposals in that same flow.
5. Before each write, the current note is compared with the plan snapshot. The exact original is added to the batch journal before the note is changed. Before/after review is optional and off by default.
6. The summary and latest journal are persisted in local plugin data. Rollback compares current note text with the recorded batch output before restoring the original.

## Module responsibilities

- `main.ts`: Obsidian lifecycle, compact target/operation UI, AI defaults, selection, OpenRouter proposal flow, apply orchestration, logs, and rollback.
- `core.ts`: conservative frontmatter parsing, supported transforms, stable plans, review summaries, and unsafe-input reporting.
- `ai-frontmatter.ts`: AI field tiers and prompt construction, tag normalization and limits, and validation of model suggestions against selected fields and note content.
- `billing-model.ts`: local free-use accounting, non-empty batch policy, idempotent spend state, and checkout state logic.
- `billing.ts` and `constance-account.ts`: account linking, authenticated checkout, usage authorization, and balance reconciliation. No shared signing or AI credential is embedded.
- `plugin-support.ts`: local help, diagnostics, and support actions.
- `styles.css`: compact setup, preview, and operation-state presentation.

## Persistence and network data

Settings, optional personal OpenRouter override, recent operation summaries, and the latest recovery journal live in Obsidian plugin data. Tundra keeps a local purchased-credit mirror and install identity for billing reconciliation. OpenRouter receives only the note body excerpt and current top-level properties when the user runs AI generation; the billing service receives account, installation, checkout, and usage data, not the note contents.

## Build and release shape

The root TypeScript files are the source of truth. `npm run build` type-checks and emits the production bundle under `publish/`, along with mirrored source, manifest, styles, and public documentation. The branded TutivSoft repository carries the complete reviewable TypeScript snapshot and root plugin files. GitHub release assets are `main.js`, `manifest.json`, and `styles.css`.

## Quality checks

The existing automated tests cover deterministic parsing, transformations, operation planning, billing policy, AI tier contents, tag normalization, output limits, and sanitizing mock AI proposals against a real repository Markdown note. AI uses a 10,000-token response ceiling; tag suggestions are limited to 20. Release checks are `npm run build`, `npm test`, `node --check publish/main.js`, version/manifest parity inspection, and `git diff --check`.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.6.7)

Tundra runs the configured operation directly from its note and folder commands. Choose the default operation in Settings; review is optional and off by default.
<!-- one-click-workflow:end -->
