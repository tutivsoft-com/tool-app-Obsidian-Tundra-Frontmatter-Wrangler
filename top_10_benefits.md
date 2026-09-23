# Top 10 Benefits of Tundra Frontmatter Wrangler

1. **Use a guided six-step workflow** — Select, inspect, configure, preview, apply, then review the result.
2. **Edit properties across selected notes** — Rename or remove top-level keys with explicit collision handling and a separate confirmation for removal.
3. **Manage tags safely** — Add, remove, replace, or normalize tags using the supported exact rules while avoiding duplicates.
4. **Keep a preferred property order** — Reorder chosen keys and decide whether unknown keys stay before or after them.
5. **Inspect each affected note** — Review exact proposed diffs and exclude individual notes before applying a batch.
6. **Keep unsupported YAML safe** — Malformed frontmatter and structures the parser cannot preserve are skipped for manual review.
7. **Avoid overwriting later edits** — Compare each note with its preview immediately before writing.
8. **Keep recovery information** — Journal original note text and roll back only when the note still matches the batch output.
9. **Add optional AI proposals** — Use the user's own OpenRouter key to suggest top-level values, then review every result in the ordinary diff flow.
10. **Keep routine work local** — Deterministic planning and writes run in Obsidian. Three non-empty apply batches are free each local calendar day; preview, no-op apply, and rollback are free.

AI requests are optional, require confirmation, and may incur OpenRouter charges. Tundra edits top-level properties only; it is not a general YAML or nested-schema editor.
