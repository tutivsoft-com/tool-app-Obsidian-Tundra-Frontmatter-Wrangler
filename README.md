# Tundra Frontmatter Wrangler

Public candidate manifest: `3.6.26` (latest completed Community release: `3.6.24`; candidate is not published)

Tundra is a local-first Obsidian plugin for making recoverable frontmatter changes across notes. Deterministic operations run locally; optional AI generation and paid billing need network access. AI runs open a live queue that shows the submitted text excerpt, current target, elapsed seconds, and completion. Overlapping AI runs are serialized, and waiting runs can be cleared while the active request finishes. Before/after review is off by default and can be enabled in Settings. Tundra keeps a rollback journal.

The AI field tiers are cumulative: Bare Minimum (4), Standard (9), Advanced (21), and Huge (50); every tier includes `image`.

## MVP workflow

Open Tundra from the command palette or ribbon, or right-click a note, folder, or multi-selection in the File Explorer. Right-click in a note editor to target that note. The command palette also has direct current-note and current-folder actions.

The compact workflow is:

1. **Choose a target** — the open note is selected by default. Use Obsidian's searchable picker for another note or folder, or deliberately select the entire vault. Optional filters are collapsed until needed.
2. **Choose an operation** — generate frontmatter is the default; deterministic property, tag, and formatting operations remain available. AI tier and existing-value behavior are reusable Settings defaults.
3. **Apply** — configured-operation commands and context-menu actions run directly with stale-plan protection and per-note error handling. Turn on **Review before applying** in settings to show before/after changes and confirm the batch.
4. **Review** — see the post-run summary, open the local operation log, or roll back the most recent batch.

For a one-click run after setup, choose a **Default operation** and its values in settings, then use **Apply configured operation to current note** or **Apply configured operation to current folder**. Before/after review is off by default and can be enabled in settings.

## Billing

Tundra provides five lifetime free non-empty apply batches per account, verified
by Constance; the allowance does not refill daily. After that allowance,
server-authorized purchased credits are required. Preview, no-op planning, and
rollback do not consume credits. A failed local write does not claim a free use;
an uncertain outcome retains its event for reconciliation.

Purchases use Constance's authenticated V11 catalog with app ID
`tundra-frontmatter-wrangler` and a random per-install identifier linked to the
account. Prices and pack details appear only when the server returns a
configured active price and product; unavailable rows disable checkout. A
read-only check on 2026-10-02 found all four Tundra V11 pack rows unavailable
(`Pack price not provisioned`). Existing legacy Paddle offers are separate and
are not automatically reused by V11. No current price or pack amount is
asserted until approved catalog mapping is complete.

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
- Generate or update selected top-level properties with TutivSoft's managed AI service. Existing values are kept by default, or can be replaced explicitly. The operation requires full-result authorization before applying and can be rolled back; no personal provider key is required or accepted.

The MVP is limited to top-level properties. Nested schema paths, conditional transforms, and scheduling are future work. AI generation is an optional proposal step with four cumulative tiers: Bare Minimum (4 fields), Standard (9, default), Advanced (21), and Huge (50). Each tier includes `image`. AI requests run through TutivSoft's managed service; Tundra does not require or accept a personal provider key. When `tags` is selected, Tundra asks for up to 20 relevant standard lowercase Obsidian tags, returns fewer when appropriate, normalizes and de-duplicates them, and omits an empty tag list. Suggested `image` values are accepted only when the image reference appears in the note or its existing properties. The planning, preview, apply journal, and rollback run locally; Constance provides managed AI, account authorization, balance synchronization, and configured checkout when V11 catalog mappings are available.

## Diagnostics

Tundra keeps the latest 250 diagnostic events in memory, including operation stages, counts, AI request outcomes, billing authorization outcomes, apply/rollback summaries, and runtime error types. Use **Settings → Tundra Frontmatter Wrangler → Copy full debug log** or the matching command palette command when reporting an issue. The copied log omits note paths, note contents, API keys, tokens, and raw error messages. Logs reset when Tundra reloads.

## Safety model

Tundra parses frontmatter before planning. Malformed frontmatter is skipped and never partially rewritten. Operations that edit existing properties skip notes without frontmatter; tag addition and AI generation can create a frontmatter block. The body is carried through unchanged. Before every successful write, the plugin checks that the note still matches the preview, stores the exact original content in the most recent undo journal, and writes the note independently of other notes. Rollback only restores a note when its current content still matches the batch output, so later edits are not overwritten.

Comments, nested YAML, and other constructs outside the conservative top-level parser are skipped rather than risking lost user formatting.

Notes with a leading UTF-8 BOM and frontmatter the parser cannot safely represent are skipped. YAML closing markers must occupy a complete line; delimiter-like text in the note body is preserved. Prototype-named properties such as `__proto__` are retained as ordinary frontmatter keys.

The journal and the last 20 operation summaries are stored in the plugin's local Obsidian data. Billing stores the device ID, checkout email, lifetime free-use balance, purchased-credit mirror, account session, and pending operation identifiers needed for recovery.

## Development

```bash
npm install
npm run check
npm run build
```

The root TypeScript tree is the source of truth and `publish/` is private build staging. The mapped TutivSoft repository is a separate curated release surface. Obsidian installs `publish/main.js`, `publish/manifest.json`, and `publish/styles.css`.

## License

MIT. See [LICENSE](LICENSE).

## Managed AI

AI generation runs through TutivSoft's managed service. Tundra does not require
or accept a personal OpenRouter key.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.6.28)

Tundra runs the configured operation directly from its note and folder commands. AI requests are serialized in the request queue; choose **Show AI request queue** in the command palette or Settings to inspect or clear waiting runs. Review is optional and off by default.
<!-- one-click-workflow:end -->

## Account, billing, and credit feedback

Account and billing controls appear at the top of settings. Register with an email and password, confirm the link sent by email, then return and sign in. The settings page shows the current balance and provides balance refresh, sign-out, and purchase controls. Metered actions show the available balance and report the amount used with the remaining balance when the action completes.

Current private-source version is `3.6.28`; the public candidate manifest remains `3.6.26` until the approved billing mapping and canonical release gates are complete.
