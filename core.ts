export type Scalar = string | number | boolean | null;
export type FrontmatterValue = Scalar | Scalar[] | Record<string, unknown>;
export type Frontmatter = Record<string, FrontmatterValue>;

export interface ParsedNote { frontmatter: Frontmatter; body: string; hasFrontmatter: boolean; safe: boolean; error?: string; newline: string; }
export interface Operation { kind: "rename" | "remove" | "add-tags" | "remove-tags" | "replace-tag" | "normalize-tags" | "reorder" | "format" | "ai-frontmatter"; oldKey?: string; newKey?: string; tags?: string[]; fromTag?: string; toTag?: string; namespace?: string; rules?: string; order?: string[]; unknownPosition?: "before" | "after"; collision?: "keep" | "replace" | "merge" | "skip"; aiFields?: string[]; aiConflict?: "keep" | "replace"; }
export interface ChangePlan { path: string; status: "changed" | "unchanged" | "skipped" | "failed"; reason?: string; before: string; after?: string; conversion?: string; }

const scalar = (value: string): Scalar => {
  const t = value.trim();
  if (!t) return "";
  if ((t.startsWith("\"") && t.endsWith("\"")) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1).replace(/\\([\\"'])/g, "$1");
  if (t === "true" || t === "false") return t === "true";
  if (t === "null" || t === "~") return null;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(t)) return Number(t);
  return t;
};

export function parseFrontmatter(content: string): ParsedNote {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const normalized = content.replace(/\r\n/g, "\n");
  if (normalized.startsWith("\uFEFF")) return { frontmatter: {}, body: content, hasFrontmatter: normalized.startsWith("\uFEFF---\n"), safe: false, error: "A UTF-8 BOM at the start of the note is not supported safely by this parser.", newline };
  if (!normalized.startsWith("---\n") && normalized !== "---") return { frontmatter: {}, body: content, hasFrontmatter: false, safe: true, newline };
  const closingDelimiter = /\n---[ \t]*(?:\n|$)/g;
  closingDelimiter.lastIndex = 3;
  const closingMatch = closingDelimiter.exec(normalized);
  if (!closingMatch) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Frontmatter opening delimiter has no closing delimiter.", newline };
  const header = normalized.slice(4, closingMatch.index);
  const body = normalized.slice(closingMatch.index + closingMatch[0].length);
  const result: Frontmatter = {};
  const lines = header.split("\n");
  let listKey: string | undefined;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.trim().startsWith("#") || /\s+#/.test(line)) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Comments in frontmatter are not supported safely by this parser.", newline };
    if (/^\s+-\s+/.test(line)) {
      if (!listKey || !Array.isArray(result[listKey])) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Unsupported nested YAML structure.", newline };
      (result[listKey] as Scalar[]).push(scalar(line.replace(/^\s+-\s+/, "")));
      continue;
    }
    const match = /^(?!\s)([^:#][^:]*):(?:\s*(.*))?$/.exec(line);
    if (!match) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Cannot safely parse line: ${line}`, newline };
    const key = match[1].trim();
    if (Object.prototype.hasOwnProperty.call(result, key)) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Duplicate property: ${key}`, newline };
    const raw = match[2] ?? "";
    if (!raw) { Object.defineProperty(result, key, { value: [], writable: true, enumerable: true, configurable: true }); listKey = key; continue; }
    if (raw.startsWith("{") || raw.endsWith("}")) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Unsupported inline object for property: ${key}`, newline };
    if (raw.startsWith("[") && raw.endsWith("]")) Object.defineProperty(result, key, { value: raw.slice(1, -1).split(",").filter(Boolean).map(scalar), writable: true, enumerable: true, configurable: true });
    else { Object.defineProperty(result, key, { value: scalar(raw), writable: true, enumerable: true, configurable: true }); listKey = undefined; }
  }
  return { frontmatter: result, body, hasFrontmatter: true, safe: true, newline };
}

function quote(value: string): string { return /^[A-Za-z0-9_./-]+$/.test(value) ? value : JSON.stringify(value); }
export function stringifyFrontmatter(frontmatter: Frontmatter, body: string, newline = "\n"): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) { lines.push(`${key}:`); for (const item of value) lines.push(`  - ${typeof item === "string" ? quote(item) : String(item)}`); }
    else if (value !== null && typeof value === "object") lines.push(`${key}: ${JSON.stringify(value)}`);
    else lines.push(`${key}: ${typeof value === "string" ? quote(value) : String(value)}`);
  }
  lines.push("---");
  const output = lines.join(newline) + (body ? newline + body : "");
  return newline === "\r\n" ? output.replace(/\n/g, "\r\n") : output;
}

export function normalizeTags(value: FrontmatterValue | undefined): { tags: string[]; malformed: boolean } {
  if (value === undefined) return { tags: [], malformed: false };
  if (typeof value === "string") return { tags: value.split(/[\s,]+/).map(s => s.trim()).filter(Boolean), malformed: false };
  if (Array.isArray(value) && value.every(item => typeof item === "string")) return { tags: value.map(String), malformed: false };
  return { tags: [], malformed: true };
}
const unique = (values: string[]) => [...new Set(values.map(v => v.trim()).filter(Boolean))];

export function applyOperation(note: ParsedNote, operation: Operation): { note: ParsedNote; changed: boolean; reason?: string; conversion?: string } {
  if (!note.safe) return { note, changed: false, reason: note.error ?? "Unsafe frontmatter" };
  const fm = structuredClone(note.frontmatter) as Frontmatter;
  let conversion: string | undefined;
  if (operation.kind === "rename" && operation.oldKey && operation.newKey && Object.prototype.hasOwnProperty.call(fm, operation.oldKey)) {
    if (Object.prototype.hasOwnProperty.call(fm, operation.newKey)) {
      if (operation.collision === "skip") return { note, changed: false, reason: "Collision skipped" };
      if (operation.collision === "keep") delete fm[operation.oldKey];
      else if (operation.collision === "replace") { fm[operation.newKey] = fm[operation.oldKey]; delete fm[operation.oldKey]; }
      else { const a = fm[operation.newKey]; const b = fm[operation.oldKey]; fm[operation.newKey] = Array.isArray(a) || Array.isArray(b) ? unique([...(Array.isArray(a) ? a : [a]), ...(Array.isArray(b) ? b : [b])].map(String)) : `${String(a)}; ${String(b)}`; delete fm[operation.oldKey]; conversion = "Merged values were converted to a combined value."; }
    } else { fm[operation.newKey] = fm[operation.oldKey]; delete fm[operation.oldKey]; }
  } else if (operation.kind === "remove" && operation.oldKey) {
    if (!Object.prototype.hasOwnProperty.call(fm, operation.oldKey)) return { note, changed: false, reason: "Property not present" };
    delete fm[operation.oldKey];
  } else if (operation.kind === "add-tags") {
    const current = normalizeTags(fm.tags); if (current.malformed) return { note, changed: false, reason: "Malformed tags value" }; fm.tags = unique([...current.tags, ...(operation.tags ?? [])]);
  } else if (operation.kind === "remove-tags" || operation.kind === "replace-tag" || operation.kind === "normalize-tags") {
    const current = normalizeTags(fm.tags); if (current.malformed) return { note, changed: false, reason: "Malformed tags value" }; let tags = current.tags;
    if (operation.kind === "remove-tags") tags = tags.filter(tag => !(operation.tags ?? []).includes(tag));
    if (operation.kind === "replace-tag" && operation.fromTag) tags = tags.map(tag => tag === operation.fromTag ? `${operation.namespace ?? ""}${operation.toTag ?? ""}` : tag);
    if (operation.kind === "normalize-tags") {
      if (!operation.rules) return { note, changed: false, reason: "Exact normalization rule is required" };
      const rules = operation.rules.toLowerCase().split(",").map(rule => rule.trim()).filter(Boolean);
      const supported = new Set(["lowercase", "spaces to hyphens", "slash separators"]);
      if (!rules.every(rule => supported.has(rule))) return { note, changed: false, reason: "Unknown normalization rule; use lowercase, spaces to hyphens, or slash separators" };
      tags = tags.map(tag => { let next = tag; if (rules.includes("lowercase")) next = next.toLowerCase(); if (rules.includes("spaces to hyphens")) next = next.replace(/\s+/g, "-"); if (rules.includes("slash separators")) next = next.replace(/\\/g, "/"); return operation.namespace ? `${operation.namespace}${next}` : next; });
    }
    fm.tags = unique(tags);
  } else if (operation.kind === "reorder" && operation.order?.length) {
    const preferred: Frontmatter = {}; for (const key of operation.order) if (key in fm) preferred[key] = fm[key]; const unknown: Frontmatter = {}; for (const [key, value] of Object.entries(fm)) if (!(key in preferred)) unknown[key] = value; const ordered: Frontmatter = operation.unknownPosition === "before" ? { ...unknown, ...preferred } : { ...preferred, ...unknown }; Object.keys(fm).forEach(key => delete fm[key]); Object.assign(fm, ordered);
  }
  const after = stringifyFrontmatter(fm, note.body, note.newline);
  const before = stringifyFrontmatter(note.frontmatter, note.body, note.newline);
  return { note: { ...note, frontmatter: fm }, changed: after !== before, conversion };
}

export function planOperation(notes: Array<{ path: string; content: string }>, operation: Operation, aiUpdates: Record<string, Frontmatter> = {}, aiErrors: Record<string, string> = {}): ChangePlan[] {
  return notes.map(({ path, content }) => {
    const parsed = parseFrontmatter(content);
    if (operation.kind === "format") {
      if (!parsed.safe) return { path, status: "skipped", reason: parsed.error ?? "Unsafe frontmatter", before: content };
      if (!parsed.hasFrontmatter) return { path, status: "skipped", reason: "No frontmatter", before: content };
      const after = stringifyFrontmatter(parsed.frontmatter, parsed.body, parsed.newline);
      return after === content ? { path, status: "unchanged", before: content } : { path, status: "changed", before: content, after };
    }
    if (operation.kind === "ai-frontmatter") {
      if (!parsed.safe) return { path, status: "skipped", reason: parsed.error ?? "Unsafe frontmatter", before: content };
      if (aiErrors[path]) return { path, status: "failed", reason: aiErrors[path], before: content };
      const updates = aiUpdates[path];
      if (!updates || Object.keys(updates).length === 0) return { path, status: "skipped", reason: "AI returned no supported properties", before: content };
      const frontmatter = structuredClone(parsed.frontmatter) as Frontmatter;
      for (const [key, value] of Object.entries(updates)) {
        if (Object.prototype.hasOwnProperty.call(frontmatter, key) && operation.aiConflict !== "replace") continue;
        frontmatter[key] = value;
      }
      const after = stringifyFrontmatter(frontmatter, parsed.body, parsed.newline);
      return after === content
        ? { path, status: "unchanged", before: content }
        : { path, status: "changed", before: content, after };
    }
    if (!parsed.hasFrontmatter && operation.kind !== "add-tags") return { path, status: "skipped", reason: "No frontmatter", before: content };
    const result = applyOperation(parsed, operation);
    return { path, status: result.changed ? "changed" : result.reason ? "skipped" : "unchanged", reason: result.reason, conversion: result.conversion, before: content, after: result.changed ? stringifyFrontmatter(result.note.frontmatter, result.note.body, result.note.newline) : undefined };
  });
}
