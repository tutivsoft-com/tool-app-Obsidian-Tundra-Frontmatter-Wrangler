# Tundra Frontmatter Wrangler

The root is the TypeScript source of truth; `publish/` is the self-contained uploadable bundle. Keep public source, docs, manifest, and styles mirrored in `publish/`. Never add vault contents, credentials, API keys, or logs. Build with `npm run build`; validate deterministic logic with `npm test`.
