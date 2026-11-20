import { isMap, isScalar, isSeq, parseDocument } from "yaml";

export type Scalar = string | number | boolean | null;
export type FrontmatterValue = Scalar | Scalar[] | Record<string, unknown>;
export type Frontmatter = Record<string, FrontmatterValue>;

interface SourceValue { value: FrontmatterValue; spelling: string | string[]; }
export interface ParsedNote { sourceValues?: Map<string, SourceValue>; frontmatter: Frontmatter; body: string; hasFrontmatter: boolean; safe: boolean; error?: string; newline: string; }
export interface Operation { kind: "rename" | "remove" | "add-tags" | "remove-tags" | "replace-tag" | "normalize-tags" | "reorder" | "format" | "ai-frontmatter"; oldKey?: string; newKey?: string; tags?: string[]; fromTag?: string; toTag?: string; namespace?: string; rules?: string; order?: string[]; unknownPosition?: "before" | "after"; collision?: "keep" | "replace" | "merge" | "skip"; aiTier?: "bare-minimum" | "standard" | "advanced" | "huge"; aiFields?: string[]; aiConflict?: "keep" | "replace"; }
export interface ChangePlan { path: string; status: "changed" | "unchanged" | "skipped" | "failed"; reason?: string; before: string; after?: string; conversion?: string; }

function readScalar(node: unknown): { value: Scalar; spelling: string } | undefined {
  if (!isScalar(node) || node.tag || node.anchor || node.comment || node.commentBefore ||
      node.type === "BLOCK_LITERAL" || node.type === "BLOCK_FOLDED") return undefined;
  const value = node.value;
  if (value !== null && typeof value !== "string" && typeof value !== "boolean" &&
      !(typeof value === "number" && Number.isFinite(value) &&
        (!Number.isInteger(value) || Number.isSafeInteger(value)))) return undefined;
  if (value === null && node.source === "") return { value, spelling: "" };
  // Preserve the spelling of plain dates and numbers even across YAML schemas.
  const spelling = node.type === "PLAIN" && node.source && /^[\w./+-]+$/.test(node.source) ? node.source :
    typeof value === "string" ? quote(value) : String(value);
  return { value, spelling };
}

export function parseFrontmatter(content: string): ParsedNote {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const normalized = content.replace(/\r\n/g, "\n");
  if (normalized.startsWith("\uFEFF")) return { frontmatter: {}, body: content, hasFrontmatter: normalized.startsWith("\uFEFF---\n"), safe: false, error: "This note has an unsupported text format before its frontmatter.", newline };
  if (!normalized.startsWith("---\n") && normalized !== "---") return { frontmatter: {}, body: content, hasFrontmatter: false, safe: true, newline };
  const closingDelimiter = /\n---[ \t]*(?:\n|$)/g;
  closingDelimiter.lastIndex = 3;
  const closingMatch = closingDelimiter.exec(normalized);
  if (!closingMatch) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Frontmatter opening delimiter has no closing delimiter.", newline };
  const header = normalized.slice(4, closingMatch.index);
  const normalizedBody = normalized.slice(closingMatch.index + closingMatch[0].length);
  const body = newline === "\r\n" ? normalizedBody.replace(/\n/g, "\r\n") : normalizedBody;
  const result: Frontmatter = {};
  const sourceValues = new Map<string, SourceValue>();
  const unsafe = (error: string): ParsedNote => ({ frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error, newline });
  if (header.split("\n").some(line => line.trimStart().startsWith("#"))) return unsafe("Frontmatter with comments cannot be updated.");
  const doc = parseDocument(header, { stringKeys: true });
  if (doc.errors.length || doc.warnings.length) return unsafe("Cannot safely parse frontmatter: " + (doc.errors[0] ?? doc.warnings[0]).message);
  const map = doc.contents;
  if (map !== null && header.trim()) {
    if (!isMap(map) || map.tag || map.anchor || map.comment || map.commentBefore || doc.comment || doc.commentBefore || doc.directives.docStart || doc.directives.docEnd) return unsafe("Unsupported YAML structure or comment.");
    for (const pair of map.items) {
      const key = readScalar(pair.key);
      if (!key || typeof key.value !== "string") return unsafe("Unsupported property key.");
      if (isMap(pair.value)) return unsafe(pair.value.flow ? "Unsupported inline object" : "Unsupported nested YAML structure.");
      let field: SourceValue;
      if (isSeq(pair.value)) {
        if (pair.value.tag || pair.value.anchor || pair.value.comment || pair.value.commentBefore) return unsafe("Unsupported list structure or comment.");
        const values: Scalar[] = [];
        const spellings: string[] = [];
        for (const item of pair.value.items) {
          const scalar = readScalar(item);
          if (!scalar) return unsafe("Unsupported list item.");
          values.push(scalar.value);
          spellings.push(scalar.spelling);
        }
        field = { value: values, spelling: spellings };
      } else {
        const scalar = readScalar(pair.value);
        if (!scalar) return unsafe("Unsupported property value.");
        field = scalar;
      }
      Object.defineProperty(result, key.value, { value: field.value, writable: true, enumerable: true, configurable: true });
      sourceValues.set(key.value, field);
    }
  }
  return { frontmatter: result, sourceValues, body, hasFrontmatter: true, safe: true, newline };
}

function quote(value: string): string {
  // Keep simple words readable. Quote strings that a YAML reader can resolve
  // as a number, date, boolean, null or document indicator.
  return /^[A-Za-z_][A-Za-z0-9_./-]*$/.test(value) && !/^(?:true|false|null|yes|no|on|off|y|n)$/i.test(value)
    ? value : JSON.stringify(value);
}
export function stringifyFrontmatter(frontmatter: Frontmatter, body: string, newline = "\n", sourceValues?: Map<string, SourceValue>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    const field = sourceValues?.get(key);
    const original = field && JSON.stringify(field.value) === JSON.stringify(value) ? field.spelling : undefined;
    const name = quote(key);
    if (Array.isArray(value)) {
      lines.push(value.length ? `${name}:` : `${name}: []`);
      for (const [index, item] of value.entries()) {
        const spelling = Array.isArray(original) ? original[index] : typeof item === "string" ? quote(item) : String(item);
        lines.push(`  - ${spelling}`);
      }
    } else {
      const spelling = typeof original === "string" ? original : typeof value === "string" ? quote(value) : JSON.stringify(value);
      lines.push(spelling ? `${name}: ${spelling}` : `${name}:`);
    }
  }
  lines.push("---");
  const normalizedBody = body.replace(/\r\n/g, "\n");
  const output = lines.join("\n") + (normalizedBody ? "\n" + normalizedBody : "");
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
  if (!note.safe) return { note, changed: false, reason: note.error ?? "Unsupported frontmatter" };
  const fm = structuredClone(note.frontmatter) as Frontmatter;
  let conversion: string | undefined;
  if (operation.kind === "rename" && operation.oldKey && operation.newKey && Object.prototype.hasOwnProperty.call(fm, operation.oldKey)) {
    if (operation.oldKey === operation.newKey) return { note, changed: false };
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
    const tags = operation.tags?.map(tag => tag.trim()).filter(Boolean) ?? [];
    if (!tags.length) return { note, changed: false, reason: "Enter at least one tag." };
    const blank = fm.tags === null && note.sourceValues?.get("tags")?.spelling === "";
    const current = normalizeTags(blank ? undefined : fm.tags);
    if (current.malformed) return { note, changed: false, reason: "Malformed tags value" };
    fm.tags = unique([...current.tags, ...tags]);
  } else if (operation.kind === "remove-tags" || operation.kind === "replace-tag" || operation.kind === "normalize-tags") {
    if (operation.kind === "replace-tag" && (!operation.fromTag?.trim() || !operation.toTag?.trim())) {
      return { note, changed: false, reason: "Enter both the original tag and its replacement." };
    }
    if (fm.tags === undefined) return { note, changed: false };
    const current = normalizeTags(fm.tags); if (current.malformed) return { note, changed: false, reason: "Malformed tags value" }; let tags = current.tags;
    if (operation.kind === "remove-tags") tags = tags.filter(tag => !(operation.tags ?? []).includes(tag));
    if (operation.kind === "replace-tag" && operation.fromTag) tags = tags.map(tag => tag === operation.fromTag ? `${operation.namespace ?? ""}${operation.toTag ?? ""}` : tag);
    if (operation.kind === "normalize-tags") {
      if (!operation.rules) return { note, changed: false, reason: "Exact normalization rule is required" };
      const rules = operation.rules.toLowerCase().split(",").map(rule => rule.trim()).filter(Boolean);
      const supported = new Set(["lowercase", "spaces to hyphens", "slash separators"]);
      if (!rules.every(rule => supported.has(rule))) return { note, changed: false, reason: "Unknown normalization rule; use lowercase, spaces to hyphens, or slash separators" };
      const prefix = operation.namespace ?? "";
      tags = tags.map(tag => {
        let next = tag.startsWith(prefix) ? tag.slice(prefix.length) : tag;
        if (rules.includes("lowercase")) next = next.toLowerCase();
        if (rules.includes("spaces to hyphens")) next = next.replace(/\s+/g, "-");
        if (rules.includes("slash separators")) next = next.replace(/\\/g, "/");
        return next.startsWith(prefix) ? next : prefix + next;
      });
    }
    fm.tags = unique(tags);
  } else if (operation.kind === "reorder" && operation.order?.length) {
    const preferred: Frontmatter = {}; for (const key of operation.order) if (key in fm) preferred[key] = fm[key]; const unknown: Frontmatter = {}; for (const [key, value] of Object.entries(fm)) if (!(key in preferred)) unknown[key] = value; const ordered: Frontmatter = operation.unknownPosition === "before" ? { ...unknown, ...preferred } : { ...preferred, ...unknown }; Object.keys(fm).forEach(key => delete fm[key]); Object.assign(fm, ordered);
  }
  return { note: { ...note, frontmatter: fm }, changed: JSON.stringify(fm) !== JSON.stringify(note.frontmatter), conversion };
}

export function planOperation(notes: Array<{ path: string; content: string }>, operation: Operation, aiUpdates: Record<string, Frontmatter> = {}, aiErrors: Record<string, string> = {}): ChangePlan[] {
  return notes.map(({ path, content }) => {
    const parsed = parseFrontmatter(content);
    if (operation.kind === "format") {
      if (!parsed.safe) return { path, status: "skipped", reason: parsed.error ?? "Unsupported frontmatter", before: content };
      if (!parsed.hasFrontmatter) return { path, status: "skipped", reason: "No frontmatter", before: content };
      const after = stringifyFrontmatter(parsed.frontmatter, parsed.body, parsed.newline, parsed.sourceValues);
      return after === content ? { path, status: "unchanged", before: content } : { path, status: "changed", before: content, after };
    }
    if (operation.kind === "ai-frontmatter") {
      if (!parsed.safe) return { path, status: "skipped", reason: parsed.error ?? "Unsupported frontmatter", before: content };
      if (aiErrors[path]) return { path, status: "failed", reason: aiErrors[path], before: content };
      const updates = aiUpdates[path];
      if (!updates || Object.keys(updates).length === 0) return { path, status: "skipped", reason: "AI returned no supported properties", before: content };
      const frontmatter = structuredClone(parsed.frontmatter) as Frontmatter;
      for (const [key, value] of Object.entries(updates)) {
        if (Object.prototype.hasOwnProperty.call(frontmatter, key) && operation.aiConflict !== "replace") continue;
        frontmatter[key] = value;
      }
      if (JSON.stringify(frontmatter) === JSON.stringify(parsed.frontmatter)) return { path, status: "unchanged", before: content };
      const after = stringifyFrontmatter(frontmatter, parsed.body, parsed.newline, parsed.sourceValues);
      return after === content
        ? { path, status: "unchanged", before: content }
        : { path, status: "changed", before: content, after };
    }
    if (!parsed.hasFrontmatter && operation.kind !== "add-tags") return { path, status: "skipped", reason: "No frontmatter", before: content };
    const result = applyOperation(parsed, operation);
    return { path, status: result.changed ? "changed" : result.reason ? "skipped" : "unchanged", reason: result.reason, conversion: result.conversion, before: content, after: result.changed ? stringifyFrontmatter(result.note.frontmatter, result.note.body, result.note.newline, parsed.sourceValues) : undefined };
  });
}
