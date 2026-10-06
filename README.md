# Tundra Frontmatter Wrangler

Generate or edit top-level frontmatter and tags using a configured operation, with optional review and batch recovery.

Current version: **3.6.55**.

## First use

Enable the plugin and use its settings page. Simple is the default settings mode; Advanced exposes optional configuration. Configure an operation, then run Apply configured operation to current note or current folder. Open frontmatter wrangler exposes the operation interface.

Local operations format frontmatter, add/remove/replace/normalize tags, rename or remove properties, and reorder properties. AI frontmatter generation uses the configured property tier and keep/replace conflict choice. Standard is the default tier; review is off by default. Changes compare the original source, verify writes and retain batch recovery data.

## Account and processing

AI requests go directly to OpenRouter using the fixed request model `~openai/gpt-luna-latest`. The existing managed-key resolver supplies the connection; legacy personal-key/model preferences do not override it. Constance handles account and billing operations.

One apply-batch unit is consumed after changed notes are read back and verified. Unknown billing results retain the original event. AI calls go directly to OpenRouter; Constance remains the account and billing authority.

Connect the existing Constance account in settings; registration can require email verification before signing in again. Billing account passwords are sent for authentication and are not persisted. Access/refresh session data and a stable installation identity are saved locally. Account free usage and purchased balance are determined by Constance; cached values and checkout return URLs do not create entitlement. Catalog displays current formatted names, prices, availability and exact price IDs. Unknown usage and checkout results retain their original identities for recovery.

## Diagnostics

Help is available in settings and through Open documentation. Open plugin settings and Copy full debug log are command-palette fallbacks. Debug logging defaults off for a new installation; failures and full Error objects/stacks still appear in the local developer console. Timed information is enabled by the debug preference. The copyable diagnostic buffer keeps at most 1,000 summarized events and excludes raw error text, stacks, note text, paths and credentials. Full console exceptions can contain whatever the failed operation placed in its error. Logs are not uploaded automatically.

## Documentation


License terms are in LICENSE.
