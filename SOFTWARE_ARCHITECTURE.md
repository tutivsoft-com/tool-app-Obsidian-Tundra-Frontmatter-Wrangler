# Tundra Frontmatter Wrangler — Software Architecture

Version: 3.5.3

## Runtime boundaries

Tundra is an Obsidian plugin for local Markdown vaults. Deterministic selection, parsing, operation planning, preview, apply, journaling, and rollback run in the plugin. Optional OpenRouter requests are made only after the user chooses AI generation and confirms the data scope. Billing requests are independent of note content.

## Runtime flow

1. `main.ts` registers the command, ribbon action, settings, wizard, operation state, and plugin-data persistence.
2. Selection reads candidate notes from the active vault and applies folder, subfolder, property, and text/path filters.
3. `core.ts` parses only the supported frontmatter shape and builds deterministic plans for the selected operation. Unsafe inputs and malformed YAML become explicit skipped results.
4. Preview presents each proposed change and requires review before apply. Optional AI generation produces top-level-value proposals that enter this same plan/preview flow.
5. Before each write, the current note is compared with the preview snapshot. The exact original is added to the batch journal before the note is changed.
6. The summary and latest journal are persisted in local plugin data. Rollback compares current note text with the recorded batch output before restoring the original.

## Module responsibilities

- `main.ts`: Obsidian lifecycle, wizard UI, selection/configuration, OpenRouter proposal flow, apply orchestration, logs, and rollback.
- `core.ts`: conservative frontmatter parsing, supported transforms, stable plans, review summaries, and unsafe-input reporting.
- `billing-model.ts`: local free-use accounting, non-empty batch policy, idempotent spend state, and checkout state logic.
- `billing.ts` and `constance-account.ts`: account linking, authenticated checkout, usage authorization, and balance reconciliation. No shared signing or AI credential is embedded.
- `plugin-support.ts`: local help, diagnostics, and support actions.
- `styles.css`: plugin-specific wizard and state presentation.

## Persistence and network data

Settings, user-supplied OpenRouter configuration, recent operation summaries, and the latest recovery journal live in Obsidian plugin data. Tundra keeps a local purchased-credit mirror and install identity for billing reconciliation. OpenRouter receives only the confirmed note body excerpt and current top-level properties; the billing service receives account, installation, checkout, and usage data, not the note contents.

## Build and release shape

The root TypeScript files are the source of truth. `npm run build` type-checks and emits the production bundle under `publish/`, along with mirrored source, manifest, styles, and public documentation. The branded TutivSoft repository carries the complete reviewable TypeScript snapshot and root plugin files. GitHub release assets are `main.js`, `manifest.json`, and `styles.css`.

## Quality checks

The existing automated tests cover deterministic parsing, transformations, operation planning, and billing policy. Release checks are `npm run build`, `npm test`, `node --check publish/main.js`, version/manifest parity inspection, and `git diff --check`.
