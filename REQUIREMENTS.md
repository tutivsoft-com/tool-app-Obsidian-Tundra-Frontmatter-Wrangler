# Tundra Frontmatter Wrangler — Product Requirements

Status: implemented — 3.6.4.

## Product promise

Tundra lets users normalize metadata across hundreds of notes through a recoverable run workflow that preserves values, note bodies, and recoverability.

## Product principles

- Bulk changes must be understandable before they are applied.
- Deterministic operations must not depend on AI.
- Preserve user data and make collisions explicit.
- Keep the common path simple: choose notes, choose an operation, run it.
- Every bulk write needs recovery information.

## MVP note selection

1. Default the target to the currently open note; provide searchable Obsidian pickers for another note or a folder.
2. Offer the entire vault only as an explicit target choice.
3. Include folder descendants by default, with an optional direct-folder-only choice.
4. Keep path/body and property filters available in a collapsed optional section.
5. Show affected-note counts and proposed diffs in the preview instead of forcing a separate selection or inventory screen.

## MVP metadata operations

### Property keys

8. Rename a top-level property key across the selected notes.
9. Detect when both the old and new keys exist in one note.
10. Offer explicit collision choices: keep existing new key, replace it, merge values, or skip that note.
11. Preserve the original value type where possible and report conversions that need review.
12. Support removing an explicitly selected property with a recoverable journal entry.

### Tags

13. Add one or more tags to selected notes while preserving existing tags and removing duplicates.
14. Remove selected tags only from the selected notes after showing the count affected.
15. Replace a tag with another tag, including an optional namespace/prefix transformation.
16. Normalize tag spelling and separators only when the user provides the exact rule.
17. Treat string and list tag forms safely and report malformed tag values instead of silently discarding them.

### Schema and formatting

18. Show the current top-level YAML/property order and a live proposed order.
19. Let the user create a preferred schema by drag-and-drop or move-up/move-down controls.
20. Reorder only keys present in each note; choose explicitly where unknown keys should remain.
21. Preserve scalar values, lists, nested values, comments where the parser supports them, and the Markdown body.
22. Provide a format-only operation separate from semantic value changes.
23. Limit the MVP to top-level properties; clearly identify nested-schema support as a later enhancement.

## Planning, safety, and execution

24. Calculate aggregate counts and a plan for the selected operation.
25. Provide a post-run summary and optional inspection of affected notes.
26. Create backups or an undo journal containing original content for every changed note.
27. Apply changes per note with progress, cancellation, and independent error handling.
28. Never partially rewrite a note if its frontmatter cannot be parsed safely. Match the complete YAML closing delimiter, preserve delimiter-like body text and unusual property names, and skip BOM-prefixed notes when safe preservation is not supported.
29. Provide a post-run summary with changed, skipped, failed, and unchanged notes.
30. Provide one-click rollback for the most recent batch and a way to open the operation log.
31. Show operation progress and the changed, skipped, and failed counts.

## UX requirements

32. Provide a command-palette command and a ribbon or settings entry to open the wrangler.
33. Put target and operation selection in one compact setup view, followed by preview and results.
34. Keep optional filters collapsed until needed; keep the open note as the default target.
35. Keep reusable AI choices in Settings and provide sensible defaults.
36. Never make the user edit raw YAML just to perform a standard operation.

## AI decision and credit model

AI is optional. When selected, it may generate or update only the user-requested top-level properties from note content and existing metadata.

- generate or update the requested top-level property values per selected note;
- preserve existing values by default, with a deliberate replace option;
- return scalar or flat list values only; nested objects are rejected;
- surface malformed notes and failed provider responses without writing them.

AI generates proposals for the selected operation and applies eligible changes in the same run, with rollback available. Send no more than 12,000 body characters per note, exclude file paths, treat note text as untrusted input, filter suggestions to the requested keys, reject nested values, and cap provider responses at 10,000 tokens. Offer cumulative AI field tiers of 4, 9, 21, and 50 properties, with Standard (9) selected by default and `image` included in every tier. When tags are requested, ask for up to 20 relevant standard Obsidian tags, allow fewer when fewer are relevant, normalize and de-duplicate them, and omit the property when none are relevant. Accept an AI `image` only if its reference is already in the note body or existing image value. Tundra loads its own capped key from an encrypted remote manifest, with an optional personal key override; no plaintext key is bundled. Document the selected model, note count, sent-data scope, and response token ceiling. A personal key override may charge the user's OpenRouter account. AI suggestions use Tundra's capped key by default; a personal override uses the user's account. A Tundra credit applies only to a non-empty write batch.

## Billing model

- Each local calendar day includes 3 free non-empty applied write batches.
- After the daily free allowance, each successfully authorized non-empty write batch costs 1 purchased credit.
- A no-op plan, failed authorization, or rollback never consumes a credit.
- Purchased credits are sold as one-time packs: $1/100 and $10/1,000.
- The install device ID is generated once and persisted in local plugin data.
- The local purchased-credit mirror is checked and reserved before a remote spend; the unsigned Constance browser relay is the authoritative debit and sync source.
- Checkout and balance sync are available in settings using the provisioned live catalog price IDs.

## Useful post-MVP features

- Nested property path operations with explicit safeguards.
- Conditional transformations based on value type or regular expressions.
- Import/export of schema and operation presets.
- Scheduled normalization with a review queue.
- Property usage analytics and migration reports.
- Local-only AI model support.

## Out of scope for the MVP

- Background mutation of notes without a user-initiated operation.
- Full Markdown body transformations.
- Automatic deletion or merging of notes.
- AI-generated metadata changes outside a user-initiated operation.

## Acceptance criteria

- A user can rename a property across hundreds of notes without hand-editing files.
- Key collisions, malformed YAML, and mixed value types are reported in the run summary.
- Tags are added idempotently and existing tags are preserved unless removal is explicit.
- Schema reorder changes key order without changing values or note bodies.
- Every changed note has recovery data and the most recent batch can be rolled back.
- Deterministic planning works offline. AI generation uses the built-in OpenRouter key when the user runs it; paid apply authorization uses optional network access after the daily free allowance.
- Billing never runs during rollback and does not charge a no-op apply.
- A paid apply batch is charged at most once, during the user-initiated run.
