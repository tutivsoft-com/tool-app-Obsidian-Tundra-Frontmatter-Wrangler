# Tundra Frontmatter Wrangler — Product Requirements

Status: implemented — 3.4.6 billing live-catalog release

## Product promise

Tundra lets users normalize metadata across hundreds of notes through a safe preview-and-apply workflow that preserves values, note bodies, and recoverability.

## Product principles

- Bulk changes must be understandable before they are applied.
- Deterministic operations must not depend on AI.
- Preserve user data and make collisions explicit.
- Keep the common path simple: choose notes, choose an operation, preview, apply.
- Every bulk write needs recovery information.

## MVP note selection

1. Select notes by folder, including optional subfolders.
2. Select notes by a frontmatter/property filter.
3. Select notes using a text or path query.
4. Allow a manually reviewed checklist of included and excluded notes.
5. Show total selected notes, notes with frontmatter, notes without frontmatter, and notes that will be skipped.
6. Support a dry-run inventory before any operation.

## MVP metadata operations

### Property keys

7. Display a property inventory with key names, occurrence counts, sample types, and representative values without exposing more content than necessary.
8. Rename a top-level property key across the selected notes.
9. Detect when both the old and new keys exist in one note.
10. Offer explicit collision choices: keep existing new key, replace it, merge values, or skip that note.
11. Preserve the original value type where possible and report conversions that need review.
12. Support removing an explicitly selected property only through a separate, strongly confirmed action.

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

## Preview, safety, and execution

24. Show a representative diff and aggregate counts before applying any operation.
25. Allow the user to inspect every affected note before confirmation.
26. Create backups or an undo journal containing original content for every changed note.
27. Apply changes per note with progress, cancellation, and independent error handling.
28. Never partially rewrite a note if its frontmatter cannot be parsed safely.
29. Provide a post-run summary with changed, skipped, failed, and unchanged notes.
30. Provide one-click rollback for the most recent batch and a way to open the operation log.
31. Use a confirmation message that states the exact operation, selection count, and irreversible consequences.

## UX requirements

32. Provide a command-palette command and a ribbon or settings entry to open the wrangler.
33. Use a step-based interface: Select, Inspect, Configure, Preview, Apply, Review.
34. Keep advanced collision and parser options hidden until needed.
35. Allow saving and reusing named operation presets after the MVP if it does not complicate the first-run flow.
36. Never make the user edit raw YAML just to perform a standard operation.

## AI decision and credit model

AI is optional, not required for the MVP. A paid assistant may later:

- suggest old-to-new key mappings from a property inventory;
- propose a schema from representative metadata;
- suggest tag normalization or related tags;
- classify ambiguous values for user review.

AI must generate a proposed plan, never apply changes directly. The user must approve the plan and preview. Charge credits only for an explicit AI request, show estimated cost before sending data, minimize the sample sent, and disclose that note metadata leaves the vault. Deterministic planning and preview remain local; applied write batches use the billing model below.

## Billing model

- Each local calendar day includes 3 free non-empty applied write batches.
- After the daily free allowance, each successfully authorized non-empty write batch costs 1 purchased credit.
- A preview, no-op plan, failed authorization, or rollback never consumes a credit.
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

- Silent background mutation of notes.
- Full Markdown body transformations.
- Automatic deletion or merging of notes.
- Unreviewed AI-generated metadata changes.

## Acceptance criteria

- A user can rename a property across hundreds of notes without hand-editing files.
- Key collisions, malformed YAML, and mixed value types are visible before apply.
- Tags are added idempotently and existing tags are preserved unless removal is explicit.
- Schema reorder changes key order without changing values or note bodies.
- Every changed note has recovery data and the most recent batch can be rolled back.
- Core planning operations work offline and with AI disabled; paid apply authorization uses optional network access after the daily free allowance.
- Billing never runs during preview or rollback and does not charge a no-op apply.
- A paid apply batch is charged at most once, after the user reviews the preview and confirms apply.
