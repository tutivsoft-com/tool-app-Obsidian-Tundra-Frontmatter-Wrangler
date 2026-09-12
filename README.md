# Tundra Frontmatter Wrangler

Tundra is an offline-first Obsidian plugin for making reviewed, recoverable frontmatter changes across a large collection of Markdown notes. It keeps the common path simple: select notes, inspect the inventory, configure one deterministic operation, preview it, apply it, and review the result.

## MVP workflow

The command `Tundra: Open frontmatter wrangler` and the ribbon wrench open six steps:

1. **Select** — choose a folder, include or exclude subfolders, filter by a top-level property, and search note paths/bodies.
2. **Inspect** — review inventory counts and manually check the exact included note list. Malformed frontmatter is surfaced, never silently rewritten.
3. **Configure** — choose a property rename, explicitly confirmed property removal, tag operation, schema reorder, or format-only reorder.
4. **Preview** — inspect representative diffs and aggregate changed/unchanged/skipped/failed counts. Every affected note must be marked reviewed, and each can be included or excluded from the apply batch.
5. **Apply** — process notes independently with progress, cancellation, stale-preview protection, and per-note error handling.
6. **Review** — see the post-run summary, open the local operation log, or rollback the most recent batch.

## Billing

Tundra includes three free non-empty apply batches per local calendar day. After
those are used, each non-empty, reviewed apply batch authorizes one purchased
credit. Previewing, planning a no-op, and rolling back never consume credits.

Purchased credits are one-time packs: $1 for 100 credits or $10 for 1,000
credits. The settings tab stores a billing email for the receipt, shows the
local mirror of the purchased balance, provides a manual balance sync, and
opens the live Constance checkout using the provisioned Tundra price IDs.

Billing uses Constance's unsigned browser-relay endpoints with the unique
`tundra-frontmatter-wrangler` app ID. A random per-install device ID is stored
in the plugin's local settings and sent as both `external_customer_id` and
`machine_id`; no secret or credential is embedded in the plugin.

## Supported operations

- Rename a top-level key. If both keys exist, choose keep existing, replace, merge, or skip. Array and object merges are deterministic; mixed scalar values are reported.
- Remove a top-level key only after the separate confirmation checkbox is enabled.
- Add, remove, or replace tags while preserving existing tags and de-duplicating them. String and list forms are supported; malformed tag values are reported and left untouched.
- Normalize tags only with an exact supported rule selected by the user: `lowercase`, `spaces to hyphens`, or `slash separators`. Unknown rules are rejected; there is no hidden spelling conversion.
- Reorder a preferred top-level schema with move-up/move-down controls. Unknown keys retain their existing relative order and can be placed before or after the preferred keys.
- Format-only reorder is intentionally separate from semantic operations.

The MVP is limited to top-level properties. Nested schema paths, conditional transforms, scheduling, and AI suggestions are future work. Deterministic planning and preview remain local; network access is used only for optional Constance balance synchronization and paid batch authorization.

## Safety model

Tundra parses frontmatter before planning. A missing or malformed frontmatter block is skipped and is never partially rewritten. The body is carried through unchanged. Before every successful write, the plugin checks that the note still matches the preview, stores the exact original content in the most recent undo journal, and writes the note independently of other notes. Rollback only restores a note when its current content still matches the batch output, so later edits are not overwritten.

Comments, nested YAML, and other constructs outside the conservative top-level parser are skipped rather than risking lost user formatting.

The journal and the last 20 operation summaries are stored in the plugin's local Obsidian data. Representative inventory values are truncated to avoid exposing unnecessary note content. Billing stores only the device ID, checkout email, daily free-use counter, and purchased-credit mirror.

## Development

```bash
npm install
npm run check
npm run build
```

The public plugin source and runtime artifacts are in `publish/`. The built `publish/main.js` is generated and is not committed by default; Obsidian installs `publish/main.js`, `publish/manifest.json`, and `publish/styles.css`.

## License

MIT. See [LICENSE](LICENSE).
