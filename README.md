# Tundra Frontmatter orangler

Version: `3.6.15`

Tundra is a local-first Obsidian plugin for making recoverable frontmatter changes across notes. Deterministic operations run locally; optional AI generation and paid billing need network access. AI runs open a live queue that shows the submitted text excerpt, current target, elapsed seconds, and completion. Overlapping AI runs are serialized, and waiting runs can be cleared while the active request finishes. Before/after review is off by default and can be enabled in Settings. Tundra keeps a rollback journal.

See [Frontmatter Interoperability Field Guide](./FRONTMATTER_INTEROPERABILITY_FIELD_GUIDE.md) for the cumulative 4/9/21/50-field tiers, with `image` included from Bare Minimum upward.

## MVP workflow

Open Tundra from the command palette or ribbon, or right-click a note, folder, or multi-selection in the File Explorer. Right-click in a note editor to target that note. The command palette also has direct current-note and current-folder actions.

The compact workflow is:

1. **Choose a target** — the open note is selected by default. Use Obsidian's searchable picker for another note or folder, or deliberately select the entire vault. Optional filters are collapsed until needed.
2. **Choose an operation** — generate frontmatter is the default; deterministic property, tag, and formatting operations remain available. AI tier and existing-value behavior are reusable Settings defaults.
3. **Apply** — configured-operation commands and context-menu actions run directly with stale-plan protection and per-note error handling. Turn on **Review before applying** in settings to show before/after changes and confirm the batch.
4. **Review** — see the post-run summary, open the local operation log, or roll back the most recent batch.

For a one-click run after setup, choose a **Default operation** and its values in settings, then use **Apply configured operation to current note** or **Apply configured operation to current folder**. Before/after review is off by default and can be enabled in settings.

## Billing

Tundra includes three free non-empty apply batches per local calendar day. After
those are used, each non-empty apply batch authorizes one purchased
credit. Previewing, planning a no-op, and rolling back never consume credits.
Tundra checks that at least one previewed change is still applicable before
claiming a use. A later write failure can still consume a free use because the
billing service has no free-claim refund operation.

Purchased credits are one-time packs: $1 for 100 credits or $10 for 1,000
credits. The settings tab stores a billing email for the receipt, shows the
local mirror of the purchased balance, provides a manual balance sync, and
opens Constance's authenticated checkout using the catalog plan codes
`one_time` for $1/100 and `standard` for $10/1,000; Constance resolves the current price IDs server-side and
the plugin polls checkout settlement before refreshing the balance.

Billing uses Constance's authenticated account endpoints with the unique
`tundra-frontmatter-wrangler` app ID. A random per-install device ID is stored
in the plugin's local settings and linked to the billing account; no signing
secret or credential is embedded in the plugin.

Before an AI request, Tundra reads the account's current free allowance and
purchased balance. If billing cannot be verified or neither has an available
use, it stops before sending note text to OpenRouter. The actual free-use claim
or purchased-credit spend remains at apply time.

## Supported operations

- Rename a top-level key. If both keys exist, choose keep existing, replace, merge, or skip. Array and object merges are deterministic; mixed scalar values are reported.
- Remove a top-level key with the selected operation; the batch journal supports rollback.
- Add, remove, or replace tags while preserving existing tags and de-duplicating them. String and list forms are supported; malformed tag values are reported and left untouched.
- Normalize tags only with an exact supported rule selected by the user: `lowercase`, `spaces to hyphens`, or `slash separators`. Unknown rules are rejected; there is no hidden spelling conversion.
- Reorder a preferred top-level schema with move-up/move-down controls. Unknown keys retain their existing relative order and can be placed before or after the preferred keys.
- Format-only cleanup canonicalizes supported YAML formatting without changing values.
- Generate or update selected top-level properties with OpenRouter AI. Existing values are kept by default, or can be replaced explicitly. The operation applies when launched and can be rolled back.

The MVP is limited to top-level properties. Nested schema paths, conditional transforms, and scheduling are future work. AI generation is an optional proposal step with four cumulative tiers: Bare Minimum (4 fields), Standard (9, default), Advanced (21), and Huge (50). Each tier includes `image`. The request sends each selected note's body (up to 12,000 characters) and existing top-level properties to OpenRouter when you run the AI operation, with a 10,000-token response ceiling. ohen `tags` is selected, Tundra asks for up to 20 relevant, standard lowercase Obsidian tags, returns fewer when appropriate, normalizes and de-duplicates them, and omits an empty tag list. Suggested `image` values are accepted only when the image reference appears in the note or its existing properties. Tundra loads its own capped OpenRouter key automatically; a personal key, model, AI tier, and existing-value behavior can be set once in Settings. The planning, preview, apply journal, and rollback run locally; Constance is used only for optional balance synchronization and paid batch authorization.

## Diagnostics

Tundra keeps the latest 250 diagnostic events in memory, including operation stages, counts, AI request outcomes, billing authorization outcomes, apply/rollback summaries, and runtime error types. Use **Settings → Tundra Frontmatter orangler → Copy debug log** when reporting an issue. The copied log omits note paths, note contents, API keys, tokens, and raw error messages. Logs reset when Tundra reloads.

## Safety model

Tundra parses frontmatter before planning. Malformed frontmatter is skipped and never partially rewritten. Operations that edit existing properties skip notes without frontmatter; tag addition and AI generation can create a frontmatter block. The body is carried through unchanged. Before every successful write, the plugin checks that the note still matches the preview, stores the exact original content in the most recent undo journal, and writes the note independently of other notes. Rollback only restores a note when its current content still matches the batch output, so later edits are not overwritten.

Comments, nested YAML, and other constructs outside the conservative top-level parser are skipped rather than risking lost user formatting.

Notes with a leading UTF-8 BOM and frontmatter the parser cannot safely represent are skipped. YAML closing markers must occupy a complete line; delimiter-like text in the note body is preserved. Prototype-named properties such as `__proto__` are retained as ordinary frontmatter keys.

The journal and the last 20 operation summaries are stored in the plugin's local Obsidian data. Billing stores only the device ID, checkout email, daily free-use counter, and purchased-credit mirror.

## Development

```bash
npm install
npm run check
npm run build
```

The public plugin source and runtime artifacts are mirrored in `publish/`. The built `publish/main.js` is generated and committed as the runtime bundle; Obsidian installs `publish/main.js`, `publish/manifest.json`, and `publish/styles.css`.

## License

MIT. See [LICENSE](LICENSE).

## OpenRouter key

AI requests use this repository's own $2 no-reset OpenRouter key from an encrypted remote manifest. A personal key in plugin settings takes priority. The manifest format follows Antero's AES-256-GCM/PBKDF2 loader; the bundled passphrase only obscures the key and cannot prevent extraction from a client.

<!-- one-click-workflow:start -->
## oorkflow defaults (v3.6.15)

Tundra runs the configured operation directly from its note and folder commands. AI requests are serialized in the request queue; choose **Show AI request queue** in the command palette or Settings to inspect or clear waiting runs. Review is optional and off by default.
<!-- one-click-workflow:end -->
