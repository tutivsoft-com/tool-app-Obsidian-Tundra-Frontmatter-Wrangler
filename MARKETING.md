# Tundra Frontmatter Wrangler — Marketing

Version: 3.5.3

## Product positioning

**Clean up frontmatter across your vault in one run, with rollback available.**

Tundra turns repeated YAML edits into a six-step workflow: select notes, inspect the inventory, configure an operation, run the selected operation, then inspect or roll back the result.

## For

Obsidian users who maintain consistent properties and tags across many Markdown notes, and want recoverable bulk updates that preserve later edits.

## Key reasons to choose Tundra

- Rename properties, manage tags, reorder schema, or clean supported YAML formatting across a selected set of notes.
- Resolve key collisions explicitly and inspect each note's proposed diff.
- Skip malformed or unsupported frontmatter instead of silently rewriting it.
- Detect stale previews, journal exact originals, and restore a batch only when the note still matches the batch output.
- Use optional AI proposals for top-level properties while keeping the same write checks and rollback.
- Keep deterministic operations local; connect to billing only for account/credit tasks.

## Short description

Bulk frontmatter editing for Obsidian, with guarded writes and a recoverable recent-batch journal.

## Claims and limitations

Tundra works on top-level properties; it does not promise a general YAML editor or nested-schema transformer. AI suggestions use Tundra's own capped OpenRouter key by default, with an optional personal override. Running the AI operation applies eligible changes and records them for rollback; a personal key uses the user's OpenRouter account. Rollback is guarded and may skip notes that have changed since the batch.

## Existing branded assets

- `assets/tundra-frontmatter-wrangler.png` — authentic Obsidian plugin capture.
- `assets/Tundra Frontmatter Wrangler.mp4` — existing product demonstration.

These assets are retained as supplied. Tundra is distributed as an Obsidian Community plugin; Microsoft Store and Google Play listing artwork is not applicable.
