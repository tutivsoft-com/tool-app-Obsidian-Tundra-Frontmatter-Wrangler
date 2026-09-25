# Tundra Frontmatter Wrangler

**Version 3.6.19** · A local-first Obsidian plugin for safe, recoverable frontmatter changes.

## Install

Install **Tundra Frontmatter Wrangler** from Obsidian Community Plugins. For a manual install, download `main.js`, `manifest.json`, and `styles.css` from the [latest GitHub release](https://github.com/tutivsoft-com/tool-app-Obsidian-Tundra-Frontmatter-Wrangler/releases/latest) into `.obsidian/plugins/tundra-frontmatter-wrangler/`, then enable it in **Settings → Community plugins**. The [Community listing](https://community.obsidian.md/plugins/tundra-frontmatter-wrangler) has the current listing and installation status.

## Features

- Preview and apply frontmatter changes to the current note, selected notes, a folder, or the entire vault.
- Rename or remove properties; add, remove, replace, and normalize tags; reorder or clean up properties.
- Optionally generate frontmatter suggestions with AI.
- Review changes before writing when enabled, keep a recovery journal, and roll back eligible batches.
- Skip malformed or unsafe frontmatter rather than partially rewriting it.

## Privacy and network use

Deterministic frontmatter operations run locally in your vault. When you choose and confirm AI generation, the selected note text and existing top-level frontmatter are sent to OpenRouter. Tundra uses its capped service key unless you enter your own OpenRouter key in Settings; provider terms and charges may apply when you use your own key. The plugin checks account usage eligibility before an AI request, and applying a non-empty batch may use an available free allowance or purchased credit. Previewing, a no-op, and rollback do not consume a credit. Optional account linking, balance synchronization, and purchase authorization use TutivSoft's Constance service; vault note contents are not sent to that billing service.

## Diagnostics

Use **Settings → Tundra Frontmatter Wrangler → Copy full debug log** or the matching command palette command. The log contains up to 250 recent in-memory events and omits note paths, note contents, API keys, tokens, and raw error messages. It resets when the plugin reloads.

## License

MIT. See [LICENSE](LICENSE).
