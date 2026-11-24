# Tundra 3.6.75 public desktop acceptance

**24 November 2026.** Tested the published Tundra AI Frontmatter Wrangler bundle in Obsidian 1.15.1 on Windows 11. The core workflows applied and restored the expected YAML. Four release defects reproduced in the isolated vault. Account, checkout, and AI used local fixture responses.

## Build and test setup

- Public main at the start of the check was 9deda6f2d22a446dc1f87e2cd06616f5fd25c135. Release tag 3.6.75 points to e376cd14af1a221a566082c7535e25d433e93af9. The three files copied to the isolated plugin folder matched the SHA-256 values for the published assets. [GitHub release](https://github.com/tutivsoft-com/tool-app-Obsidian-Tundra-Frontmatter-Wrangler/releases/tag/3.6.75).
- A separate desktop profile contained five synthetic Markdown notes and one text attachment. All five notes matched their original test bytes after the checks. Orchard had ordinary YAML, duplicate tags, and an existing summary. Meadow had an inactive status. A nested note had an active status. The unsupported note had a duplicate YAML key. Plain had no frontmatter. A mixed-LF/CRLF copy of Orchard covered body preservation.
- The plugin ran in desktop Obsidian. The checks used the visible palette, menus, settings, modals, and ribbon and verified file contents through the isolated vault. A controllable pause held the first write for the cancel check. Clipboard writes, OpenRouter, Constance, and checkout handoff were intercepted locally. The checkout fixture used a synthetic account, a sample USD offer, and an example domain.

| Loaded release asset | SHA-256 |
| --- | --- |
| main.js | 5c623471ffea67b8edf8b1186c472f25483880d1567123293e3f8c7d34609e68 |
| manifest.json | fce662363ced5b1688385239a607e51e76416296117ad41b2b1e5008dfcd918e |
| styles.css | 8c90fcac92d87eb9d1d68256f76b369c6289585998f117012769aa87eaa49b76 |

## Release defects

| Case | Expected | Actual |
| --- | --- | --- |
| R01. Open-note filters | A nonmatching path or text query or property filter excludes the open note. | Tested each mismatch independently. Both showed one change for Orchard. Applying the nonmatching query wrote the tag. Rollback restored the original note. The matching query and property also previewed one change. [Filter input](screens/02-open-note-filter-input.jpg), [resulting preview](screens/03-open-note-filter-preview.jpg). |
| R02. Cancel after current note | The button can stop later writes while an earlier write is in flight. | The button stayed disabled during the held write. Clicking it had no effect. All three eligible notes changed after the hold was released. Rollback restored all three. [Apply progress](screens/05-disabled-cancellation.jpg). |
| R03. Saved AI preferences | After switching Standard and Keep to Essential and Replace, the next run uses four fields and can replace the existing summary. | The configured current-note command and ribbon each requested nine fields and retained the existing summary. The ribbon displayed Essential. The two previews left the source unchanged. Selecting Generate frontmatter again after saving Essential and Replace produced the expected four-field preview in A10. |
| R04. Mixed line endings | Applying a frontmatter edit preserves body bytes. | Clean formatting converted body LF to CRLF in a mixed-line-ending note. The decoded body lines were the same. Rollback restored the exact mixed-line-ending file. The ordinary LF fixture passed byte-for-byte body checks for all eight local operations. |

## Passed cases

| Case | Actions and verification |
| --- | --- |
| A01. Wrangler entry and scope | Opened the main wrangler and the current-note and current-folder variants from the palette. Checked note, folder, and vault targets. The note picker switched from Orchard to Meadow. Change folder switched from Fixtures to Other and previewed only Plain. The Settings Open button and ribbon opened the wrangler. [Command palette](screens/01-command-palette.jpg). |
| A02. Eight local operations | Clean formatting fixed spacing. Add tags added a synthetic tag. Remove tags removed work/old. Replace used a namespace with work/current. Normalize applied lowercasing, spaces to hyphens, and slash normalization with a namespace. Rename moved legacy_status to lifecycle. Remove deleted legacy_status. Reorder put summary and tags first. Each preview left the LF note intact. Each apply matched the expected YAML and preserved the body bytes. Each result rollback restored the full original file. |
| A03. Option choices | Previewed all four rename collision policies. Skip reported a collision, Keep retained active, Replace took draft, and Merge combined the values. Reorder put unspecified fields before or after the requested order as selected. Option previews left the note intact. |
| A04. Folder and vault preview | The active-status folder filter selected Orchard without subfolders and Orchard plus Seedling with subfolders. The vault preview planned four changes, including Plain, and skipped the duplicate-key note. The text attachment stayed outside the operation. No preview wrote a file. [Recursive folder preview](screens/04-recursive-folder-preview.jpg). |
| A05. Review, stale plan, and operation log | Back returned to setup or the previous preview. A synthetic edit after preview made the plan stale. Apply preserved the edit and spent no fixture credit. The operation log displayed the rename action, affected fixture path, and result. [Operation log](screens/06-operation-log.jpg). |
| A06. Context actions | The editor and individual File Explorer note actions reached the one-note preview. The folder action reached the recursive preview. Selecting the folder plus its child produced four unique Markdown targets, three changes, and one duplicate-key skip. [File Explorer selection](screens/07-overlapping-selection-menu.jpg). |
| A07. Configured commands and rollback | With review off, the configured current-note command wrote only Orchard. The current-folder command wrote Orchard, Meadow, and Seedling. The Most recent batch control in Settings restored each batch. Review was turned on again for the AI check. |
| A08. Settings fields | Simple showed the common controls, USD offer, and fixture balance. Refresh balance made a new entitlement request. Advanced exposed nine default operations and their fields, four AI property tiers, both existing-value policies, four rename collision settings, seven tag-rule choices, and two reorder placements. The AI model row displayed automatic selection. The Settings footer showed 3.6.75. [Simple settings](screens/08-simple-settings.jpg), [Advanced settings](screens/09-advanced-settings.jpg). |
| A09. Support and diagnostics | Opened Help from Settings and the palette. Expanded all five Help sections and used Open account to return to Settings. Verified the password-reset link target. Used the palette and Settings debug toggles and both diagnostic copy actions with a local clipboard stub. Opened and closed the idle queue from Settings. |
| A10. Tiny AI run and queue | Set Essential and Replace, then reselected Generate frontmatter to refresh the saved operation. The ribbon sent one intercepted provider request with four fields and an 80-character synthetic body. Cleared a second waiting job through the visible queue. The first job previewed the synthetic orchard summary, applied it after review, and rolled back exactly. Used the palette to reopen the idle queue and restored the automatic-window setting. [AI request queue](screens/10-ai-request-queue.jpg). |
| A11. Account and checkout fixture | Sign out exposed the signed-out controls. Password reset and verification resend emitted the expected fixture requests. Connect linked the synthetic installation. The USD offer created a fixture purchase, Check payment read its status, and Cancel current purchase cleared its journal on fixture confirmation without granting credits. The browser handoff was captured locally. |

## Gates

The public release status is 3.6.75. The source candidate is 3.6.77, with source-side fixes for the four release defects above. Community publication requires separate candidate validation and publication verification. This acceptance report and its ten screenshots are the public repository changes from this check.

Live OpenRouter, Constance, email delivery, payment, and fulfillment remain unverified in this session. No approved live test account or provider route was available for the AI case. Local fixture results cover the desktop controls and the plugin's handling of the supplied responses.
