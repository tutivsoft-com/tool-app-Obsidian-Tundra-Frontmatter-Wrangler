# Tundra AI Frontmatter Wrangler

Edit YAML frontmatter and tags in Obsidian, or generate frontmatter with AI.

## Use

Install or update the plugin through Obsidian Community plugins, then enable it.

- Run **Open frontmatter wrangler** from the command palette. Choose a note, a folder, or the entire vault, then choose an operation.
- In plugin settings, choose **Advanced** and set the **Default operation** and its values. Use **Apply configured operation to current note** or **Apply configured operation to current folder**. For multiple notes, select them in the file explorer and use the Tundra action in the context menu.
- Turn on **Review before applying** in plugin settings to preview changes. Use **Rollback** under **Most recent batch** to undo the latest batch.

## Account and billing

Connect your Constance account in plugin settings. If you create an account, confirm the email link and then connect again. Authentication, current offers, free allowance, purchased balance and payment confirmation use the Constance v2 service at https://app.tutivsoft.com.

Current paid names, descriptions, prices, currencies and included units come from the payment provider through Constance. Refresh the displayed offers before buying. If current pricing cannot be verified, buying is unavailable. Only canonical payment fulfillment grants credits. A completed purchase stays saved until the refreshed balance is saved and acknowledged. Pending requests retain their original identity after a retry or restart. Account and Buy credits use separate theme-aware sections with standard Obsidian controls. Balance summaries stay with Account. Purchase progress and elapsed time appear directly below the offers. Automatic checks begin after three seconds, then every five seconds for up to five minutes. Check payment and Cancel current purchase are the only purchase-status actions. Completion requires canonical fulfillment, a saved refreshed balance and acknowledgement of the original purchase. A browser return or timer does not grant credits.

New purchases use Paddle and USD. Existing historical purchases retain their original provider. No payment credentials are bundled in the plugin.

## Privacy and recovery

Account requests send authentication and billing information to Constance. Passwords are not saved. Session credentials and recovery state are kept in local plugin settings. Billing requests do not contain note or image contents. When you choose **Generate frontmatter**, Tundra sends note content to OpenRouter. Basic usage events go to Matomo without note contents. The local diagnostic buffer is separate from automatic startup and plugin error reports sent to Datadog. Reports include the plugin version, platform, error details and recent action names. Credentials are redacted. Details from a failed operation can include file paths or content.

Uncertain older billing records are retained and are never replayed as new v2 charges. Connect the original account and contact support if an earlier operation needs recovery.

## Version 3.6.75

Preserve YAML values and protect frontmatter writes from concurrent edits.

Requires Obsidian 1.5.0 or later. [Release 3.6.75](https://github.com/tutivsoft-com/tool-app-Obsidian-Tundra-Frontmatter-Wrangler/releases/tag/3.6.75).

## Support

Click **Open Help** in plugin settings or run **Open documentation** from the command palette. For a billing problem, keep the original purchase or operation ID and open the Constance account portal. Keep passwords and session tokens private. [Constance account portal](https://app.tutivsoft.com)
