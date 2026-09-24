# Tundra Frontmatter Wrangler — Features

Version: 3.5.3

Tundra helps Obsidian users make recoverable changes to top-level frontmatter across selected Markdown notes.

## Guided bulk workflow

1. **Select** notes by folder, subfolder choice, a top-level property filter, or a path/body query.
2. **Inventory** counts and representative property values are available to inspect. Malformed frontmatter is skipped.
3. **Configure** a deterministic operation or request an optional AI proposal.
4. **Run** the selected operation; Tundra builds a plan and applies eligible changes without another approval step.
5. **Apply** the batch with progress, cancellation, stale-plan checks, and independent per-note error handling.
6. **Review** the summary, open the local operation log, or roll back the latest batch when it is still safe to do so.

## Supported operations

- Rename or remove a top-level property. Key collisions have explicit keep, replace, merge, or skip choices; property removal is journaled for rollback.
- Add, remove, or replace tags while preserving supported string/list forms and avoiding duplicates.
- Normalize tags only with an explicit supported rule: lowercase, spaces to hyphens, or slash separators.
- Reorder preferred top-level properties while choosing where unknown keys remain.
- Canonicalize supported YAML formatting without changing semantic values.
- Generate or update requested top-level properties with OpenRouter AI. AI results are proposals, not direct writes.

## Data safety and privacy

- Deterministic planning, preview, apply, journaling, and rollback run locally in Obsidian.
- Tundra skips malformed frontmatter, BOM-prefixed notes, and YAML structures the conservative top-level parser cannot safely preserve.
- The note body is carried through unchanged. Each note is re-read before writing so a change made after preview is not overwritten.
- A recovery journal stores exact originals. Rollback restores a note only while its current content still matches that batch's output.
- An AI request is optional and uses Tundra's own capped OpenRouter key by default, with an optional personal override. It sends up to 12,000 body characters and existing top-level properties per selected note, without file paths; applied changes can be inspected and rolled back.
- No plaintext key is bundled. A personal override uses the user's OpenRouter account; Tundra's built-in key has a $2 cap.

## Optional billing

- Three non-empty applied batches are free per local calendar day.
- After the daily allowance, one purchased credit authorizes each non-empty apply batch. Preview, no-op apply, and rollback do not consume a credit.
- Account linking, checkout, usage authorization, and balance refresh require network access; vault note contents are not sent to the billing service.

## Scope and limits

Tundra edits top-level properties only. Nested schema transforms, scheduled changes, and background AI writes are outside the current product scope. YAML comments and nested constructs that the parser cannot safely retain are skipped rather than silently rewritten.
