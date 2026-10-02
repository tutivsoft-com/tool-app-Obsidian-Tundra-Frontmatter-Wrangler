# Tundra Frontmatter Wrangler

Version: 3.6.33 — validated locally for publication; release pending.

## Current purchase behavior

Purchase settings load the app's current offer configuration and Paddle prices from Constance. Offer quantities use the app's native billing unit from that configuration; displayed amounts and descriptions come from the current provider price. The client matches offers by exact configured price ID and enables purchase only when Constance reports `checkout_available`. Checkout sends that exact price ID through the authenticated billing route. Prices and pack quantities are not fixed in the plugin. Existing account balances and granted credits remain associated with the account.

<!-- SETTINGS-CURRENT-2026-09-30 -->
## Current settings

Settings default to **Simple** and remember the selected mode. Simple contains everyday controls and account/billing. **Advanced** contains specialist parameters, diagnostics, and less frequent preferences. Inline help explains choices.

AI requests go directly to OpenRouter using TutivSoft's existing managed-key resolver. Constance handles account credits and Paddle purchases; a credit is committed only after a note write is verified. Current product details, price and quantity load from the Paddle catalog through Constance.
<!-- SETTINGS-CURRENT-2026-09-30:END -->

<!-- BILLING-CURRENT-2026-09-30 -->
## Current local account and billing behavior

Use **Connect** with your email and password. A new account is registered; an existing account is authenticated. New users must follow the emailed verification link and Connect again. Incorrect passwords offer password recovery; passwords are never saved. Paid purchases and free allowances belong to the authenticated account, not a locally entered email or an editable cached balance. Reinstalling does not replenish the same account's allowance.

Constance is the billing authority. Credit units remain app-specific: characters, OCR pages, searches, conversions, repair/protection batches, or captures. Checkout return URLs and cached balances never grant credits. Payment fulfillment comes from the server’s verified Paddle webhook, and balances refresh from authenticated entitlements. Unknown usage or checkout results reuse the persisted operation ID; they must not create a new debit or alternative checkout.


<!-- BILLING-CURRENT-2026-09-30:END -->


Tundra is a local-first Obsidian plugin for making recoverable frontmatter changes across notes. Deterministic operations run locally; optional AI generation and paid billing need network access. AI runs open a live queue that shows the submitted text excerpt, current target, elapsed seconds, and completion. Overlapping AI runs are serialized, and waiting runs can be cleared while the active request finishes. Before/after review is enabled by default for new installations. Tundra keeps a rollback journal.


## MVP workflow

Open Tundra from the command palette or ribbon, or right-click a note, folder, or multi-selection in the File Explorer. Right-click in a note editor to target that note. The command palette also has direct current-note and current-folder actions.

The compact workflow is:

1. **Choose a target** — the open note is selected by default. Use Obsidian's searchable picker for another note or folder, or deliberately select the entire vault. Optional filters are collapsed until needed.
2. **Choose an operation** — generate frontmatter is the default; deterministic property, tag, and formatting operations remain available. AI tier and existing-value behavior are reusable Settings defaults.
3. **Apply** — configured-operation commands and context-menu actions run directly with stale-plan protection and per-note error handling. **Review before applying** is enabled for new installations; keep it enabled to inspect changes before confirmation.
4. **Review** — see the post-run summary, open the local operation log, or roll back the most recent batch.

For a configured run after setup, choose a **Default operation** and its values in Advanced settings, then use **Apply configured operation to current note** or **Apply configured operation to current folder**. Before/after review is enabled by default for new installations.

## Billing

Tundra provides five lifetime free non-empty apply batches per account. Constance verifies the account allowance and purchased credits. AI is generated directly through OpenRouter; the same normal write flow applies the validated proposal, and billing is committed only after a changed note is read back and verified. No-op planning and rollback are free. The existing event ID is reused when a credit spend must be retried.

New offers cover 50, 150, 450, or 1,200 apply batches. Product names, offer descriptions, native quantities, Paddle prices, and availability load from Constance; checkout submits the selected configured price ID, and the plugin does not hard-code prices. Offers are joined by exact price ID; purchase is enabled only when Constance reports it available. Authenticated checkout uses the exact current price ID, and retries recover the same checkout and usage event. Existing paid rights remain available.

## Supported operations

- Rename a top-level key. If both keys exist, choose keep existing, replace, merge, or skip. Array and object merges are deterministic; mixed scalar values are reported.
- Remove a top-level key with the selected operation; the batch journal supports rollback.
- Add, remove, or replace tags while preserving existing tags and de-duplicating them. String and list forms are supported; malformed tag values are reported and left untouched.
- Normalize tags only with an exact supported rule selected by the user: `lowercase`, `spaces to hyphens`, or `slash separators`. Unknown rules are rejected; there is no hidden spelling conversion.
- Reorder a preferred top-level schema with move-up/move-down controls. Unknown keys retain their existing relative order and can be placed before or after the preferred keys.
- Format-only cleanup canonicalizes supported YAML formatting without changing values.
- Generate or update selected top-level properties directly through OpenRouter with TutivSoft's existing managed key. Existing values are kept by default, or can be replaced explicitly. Results are parsed and sanitized in the plugin, reviewed, and can be rolled back.

AI generation runs directly through OpenRouter with the existing managed-key resolver and configured model. Constance handles account credits, balances and Paddle checkout only. AI output is validated in the plugin; a credit is charged after a successful, read-back-verified note write.

## Diagnostics

Tundra keeps the latest 250 diagnostic events in memory, including operation stages, counts, AI request outcomes, billing authorization outcomes, apply/rollback summaries, and runtime error types. Use **Settings → Tundra Frontmatter Wrangler → Copy full debug log** or the matching command palette command when reporting an issue. The copied log omits note paths, note contents, API keys, tokens, and raw error messages. Logs reset when Tundra reloads.

## Safety model

Tundra parses frontmatter before planning. Malformed frontmatter is skipped and never partially rewritten. Operations that edit existing properties skip notes without frontmatter; tag addition and AI generation can create a frontmatter block. The body is carried through unchanged. Before every successful write, the plugin checks that the note still matches the preview, stores the exact original content in the most recent undo journal, and writes the note independently of other notes. Rollback only restores a note when its current content still matches the batch output, so later edits are not overwritten.

Comments, nested YAML, and other constructs outside the conservative top-level parser are skipped rather than risking lost user formatting.

Notes with a leading UTF-8 BOM and frontmatter the parser cannot safely represent are skipped. YAML closing markers must occupy a complete line; delimiter-like text in the note body is preserved. Prototype-named properties such as `__proto__` are retained as ordinary frontmatter keys.

The journal and the last 20 operation summaries are stored in the plugin's local Obsidian data. Billing stores installation ID, billing email, rotating account tokens, cached allowance/balance, and durable pending checkout/usage identifiers in local plugin data.

## License

MIT. See [LICENSE](LICENSE).

## Direct OpenRouter AI

AI requests go directly to OpenRouter through the existing managed-key resolver. The model can be changed in Advanced settings. Constance handles credit accounts, Paddle price lookup, and checkout.

<!-- one-click-workflow:start -->
## Workflow defaults (v3.6.33)

Tundra runs the configured operation directly from note and folder commands. AI requests are serialized in the request queue; choose **Show AI request queue** in the command palette or Settings to inspect or clear waiting runs. Before/after review is enabled for new installations and follows the saved preference; account authorization is required for billable writes.
<!-- one-click-workflow:end -->

## Account, billing, and credit feedback

Account and billing controls appear at the top of settings. Select Connect with your email and password; verify the emailed link if requested, then Connect again. The settings page shows the current balance and provides balance refresh, sign-out, and purchase controls. Metered actions show the available balance and report the amount used with the remaining balance when the action completes.


## Settings modes

Simple mode contains the AI field tier, existing-value behavior, review preference, and default operation. Advanced adds execution details, relevant operation parameters, and diagnostics. Before/after review is enabled for new installations; existing preferences are preserved. AI calls OpenRouter directly with the existing managed key and model setting. Account, purchases, and balance refresh use Constance in both modes. Settings save immediately; the selected mode persists.

## AI and billing flow
The plugin sends selected note text directly to OpenRouter through the existing managed-key resolver. It validates JSON and filters suggestions to the requested frontmatter fields. Constance handles account credits and Paddle purchases only. The plugin checks the account allowance before AI generation and commits one existing idempotent credit event after each non-empty batch has been written and verified.


## Manual installation

Download `main.js`, `manifest.json`, and `styles.css` from the matching published release and place them in `.obsidian/plugins/tundra-frontmatter-wrangler/`, then enable the plugin in Obsidian.
