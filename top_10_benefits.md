# Top 10 Benefits of Tundra Frontmatter Wrangler

1. **Use a guided six-step workflow** — Select a working set, configure an operation, run it, then inspect the result.
2. **Edit properties across selected notes** — Rename or remove top-level keys with explicit collision handling and rollback for removal.
3. **Manage tags safely** — Add, remove, replace, or normalize tags using the supported exact rules while avoiding duplicates.
4. **Keep a preferred property order** — Reorder chosen keys and decide whether unknown keys stay before or after them.
5. **Inspect each affected note** — Inspect the completed batch and roll it back if needed.
6. **Keep unsupported YAML safe** — Malformed frontmatter and structures the parser cannot preserve are skipped for manual review.
7. **Avoid overwriting later edits** — Compare each note with its preview immediately before writing.
8. **Keep recovery information** — Journal original note text and roll back only when the note still matches the batch output.
9. **Add optional AI proposals** — Use Tundra's built-in capped OpenRouter key or an optional personal override, choose a metadata tier, and request up to 20 relevant normalized tags; inspect results after the run.
10. **Keep routine work local** — Deterministic planning and writes run in Obsidian. Three non-empty apply batches are free each local calendar day; preview, no-op apply, and rollback are free.

AI requests run only when the user selects an AI operation; a personal key override may incur OpenRouter charges. Tundra edits top-level properties only; it is not a general YAML or nested-schema editor.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.6.7)

Tundra runs the configured operation directly from its note and folder commands. Choose the default operation in Settings; review is optional and off by default.
<!-- one-click-workflow:end -->
