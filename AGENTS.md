# Tundra Frontmatter Wrangler

The root is the TypeScript source of truth; `publish/` is the self-contained uploadable bundle. Keep public source, docs, manifest, and styles mirrored in `publish/`. Never add vault contents, credentials, API keys, or logs. Build with `npm run build`; validate deterministic logic with `npm test`.

## Automation Credential Handling

- For explicitly authorized automation, preserve required credential values intact in the secure runtime or configuration context so the automation can read and use them; do not redact or censor those values while the authorized automation is processing them.
- Never expose credential values in chat, logs, reports, commits, or other outputs. Do not commit secrets; keep secret-bearing files excluded from Git through .gitignore or equivalent protections.
