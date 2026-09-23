# Tundra Frontmatter Wrangler

Version: `3.5.2`

Tundra is a local-first Obsidian plugin for making reviewed, recoverable frontmatter changes across a large collection of Markdown notes. Deterministic operations run locally; optional AI generation and paid billing need network access. The common path stays simple: select notes, inspect the inventory, configure an operation, preview it, apply it, and review the result.

## MVP workflow

The command `Tundra: Open frontmatter wrangler` and the ribbon wrench open six steps:

1. **Select** — choose a folder, include or exclude subfolders, filter by a top-level property, and search note paths/bodies.
2. **Inspect** — review inventory counts and manually check the exact included note list. Malformed frontmatter is surfaced, never silently rewritten.
3. **Configure** — choose a property rename or removal, tag operation, schema reorder, format-only cleanup, or AI-assisted property generation.
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
opens Constance's authenticated checkout using the catalog plan codes
`standard` and `pro`; Constance resolves the current price IDs server-side and
the plugin polls checkout settlement before refreshing the balance.

Billing uses Constance's authenticated account endpoints with the unique
`tundra-frontmatter-wrangler` app ID. A random per-install device ID is stored
in the plugin's local settings and linked to the billing account; no signing
secret or credential is embedded in the plugin.

## Supported operations

- Rename a top-level key. If both keys exist, choose keep existing, replace, merge, or skip. Array and object merges are deterministic; mixed scalar values are reported.
- Remove a top-level key only after the separate confirmation checkbox is enabled.
- Add, remove, or replace tags while preserving existing tags and de-duplicating them. String and list forms are supported; malformed tag values are reported and left untouched.
- Normalize tags only with an exact supported rule selected by the user: `lowercase`, `spaces to hyphens`, or `slash separators`. Unknown rules are rejected; there is no hidden spelling conversion.
- Reorder a preferred top-level schema with move-up/move-down controls. Unknown keys retain their existing relative order and can be placed before or after the preferred keys.
- Format-only cleanup canonicalizes supported YAML formatting without changing values.
- Generate or update selected top-level properties with OpenRouter AI. Existing values are kept by default, or can be replaced explicitly. Each result is reviewed in the ordinary diff preview before apply.

The MVP is limited to top-level properties. Nested schema paths, conditional transforms, and scheduling are future work. AI generation is an optional proposal step: it sends each selected note's body (up to 12,000 characters) and existing top-level properties to OpenRouter only after confirmation. Configure your own OpenRouter API key and model in settings; Tundra has no built-in AI key. OpenRouter may charge your account. The planning, preview, apply journal, and rollback run locally; Constance is used only for optional balance synchronization and paid batch authorization.

## Safety model

Tundra parses frontmatter before planning. Malformed frontmatter is skipped and never partially rewritten. Operations that edit existing properties skip notes without frontmatter; tag addition and AI generation can create a frontmatter block. The body is carried through unchanged. Before every successful write, the plugin checks that the note still matches the preview, stores the exact original content in the most recent undo journal, and writes the note independently of other notes. Rollback only restores a note when its current content still matches the batch output, so later edits are not overwritten.

Comments, nested YAML, and other constructs outside the conservative top-level parser are skipped rather than risking lost user formatting.

Notes with a leading UTF-8 BOM and frontmatter the parser cannot safely represent are skipped. YAML closing markers must occupy a complete line; delimiter-like text in the note body is preserved. Prototype-named properties such as `__proto__` are retained as ordinary frontmatter keys.

The journal and the last 20 operation summaries are stored in the plugin's local Obsidian data. Representative inventory values are truncated to avoid exposing unnecessary note content. Billing stores only the device ID, checkout email, daily free-use counter, and purchased-credit mirror.

## Development

```bash
npm install
npm run check
npm run build
```

The public plugin source and runtime artifacts are mirrored in `publish/`. The built `publish/main.js` is generated and committed as the runtime bundle; Obsidian installs `publish/main.js`, `publish/manifest.json`, and `publish/styles.css`.

## License

MIT. See [LICENSE](LICENSE).
