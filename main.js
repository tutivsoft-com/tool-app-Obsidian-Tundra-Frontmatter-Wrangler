"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TundraPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// core.ts
var scalar = (value) => {
  const t = value.trim();
  if (!t) return "";
  if (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/\\([\\"'])/g, "$1");
  if (t === "true" || t === "false") return t === "true";
  if (t === "null" || t === "~") return null;
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(t)) return Number(t);
  return t;
};
function parseFrontmatter(content) {
  var _a;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n") && normalized !== "---") return { frontmatter: {}, body: content, hasFrontmatter: false, safe: true, newline };
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Frontmatter opening delimiter has no closing delimiter.", newline };
  const header = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  const result = {};
  const lines = header.split("\n");
  let listKey;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.trim().startsWith("#") || /\s+#/.test(line)) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Comments in frontmatter are not supported safely by this parser.", newline };
    if (/^\s+-\s+/.test(line)) {
      if (!listKey || !Array.isArray(result[listKey])) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Unsupported nested YAML structure.", newline };
      result[listKey].push(scalar(line.replace(/^\s+-\s+/, "")));
      continue;
    }
    const match = /^(?!\s)([^:#][^:]*):(?:\s*(.*))?$/.exec(line);
    if (!match) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Cannot safely parse line: ${line}`, newline };
    const key = match[1].trim();
    if (result[key] !== void 0) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Duplicate property: ${key}`, newline };
    const raw = (_a = match[2]) != null ? _a : "";
    if (!raw) {
      result[key] = [];
      listKey = key;
      continue;
    }
    if (raw.startsWith("{") || raw.endsWith("}")) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Unsupported inline object for property: ${key}`, newline };
    if (raw.startsWith("[") && raw.endsWith("]")) result[key] = raw.slice(1, -1).split(",").filter(Boolean).map(scalar);
    else {
      result[key] = scalar(raw);
      listKey = void 0;
    }
  }
  return { frontmatter: result, body, hasFrontmatter: true, safe: true, newline };
}
function quote(value) {
  return /^[A-Za-z0-9_./-]+$/.test(value) ? value : JSON.stringify(value);
}
function stringifyFrontmatter(frontmatter, body, newline = "\n") {
  const lines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${typeof item === "string" ? quote(item) : String(item)}`);
    } else if (value !== null && typeof value === "object") lines.push(`${key}: ${JSON.stringify(value)}`);
    else lines.push(`${key}: ${typeof value === "string" ? quote(value) : String(value)}`);
  }
  lines.push("---");
  const output = lines.join(newline) + (body ? newline + body : "");
  return newline === "\r\n" ? output.replace(/\n/g, "\r\n") : output;
}
function normalizeTags(value) {
  if (value === void 0) return { tags: [], malformed: false };
  if (typeof value === "string") return { tags: value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean), malformed: false };
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return { tags: value.map(String), malformed: false };
  return { tags: [], malformed: true };
}
var unique = (values) => [...new Set(values.map((v) => v.trim()).filter(Boolean))];
function applyOperation(note, operation) {
  var _a, _b, _c;
  if (!note.safe) return { note, changed: false, reason: (_a = note.error) != null ? _a : "Unsafe frontmatter" };
  const fm = structuredClone(note.frontmatter);
  let conversion;
  if (operation.kind === "rename" && operation.oldKey && operation.newKey && Object.prototype.hasOwnProperty.call(fm, operation.oldKey)) {
    if (Object.prototype.hasOwnProperty.call(fm, operation.newKey)) {
      if (operation.collision === "skip") return { note, changed: false, reason: "Collision skipped" };
      if (operation.collision === "keep") delete fm[operation.oldKey];
      else if (operation.collision === "replace") {
        fm[operation.newKey] = fm[operation.oldKey];
        delete fm[operation.oldKey];
      } else {
        const a = fm[operation.newKey];
        const b = fm[operation.oldKey];
        fm[operation.newKey] = Array.isArray(a) || Array.isArray(b) ? unique([...Array.isArray(a) ? a : [a], ...Array.isArray(b) ? b : [b]].map(String)) : `${String(a)}; ${String(b)}`;
        delete fm[operation.oldKey];
        conversion = "Merged values were converted to a combined value.";
      }
    } else {
      fm[operation.newKey] = fm[operation.oldKey];
      delete fm[operation.oldKey];
    }
  } else if (operation.kind === "remove" && operation.oldKey) {
    if (!Object.prototype.hasOwnProperty.call(fm, operation.oldKey)) return { note, changed: false, reason: "Property not present" };
    delete fm[operation.oldKey];
  } else if (operation.kind === "add-tags") {
    const current = normalizeTags(fm.tags);
    if (current.malformed) return { note, changed: false, reason: "Malformed tags value" };
    fm.tags = unique([...current.tags, ...(_b = operation.tags) != null ? _b : []]);
  } else if (operation.kind === "remove-tags" || operation.kind === "replace-tag" || operation.kind === "normalize-tags") {
    const current = normalizeTags(fm.tags);
    if (current.malformed) return { note, changed: false, reason: "Malformed tags value" };
    let tags = current.tags;
    if (operation.kind === "remove-tags") tags = tags.filter((tag) => {
      var _a2;
      return !((_a2 = operation.tags) != null ? _a2 : []).includes(tag);
    });
    if (operation.kind === "replace-tag" && operation.fromTag) tags = tags.map((tag) => {
      var _a2, _b2;
      return tag === operation.fromTag ? `${(_a2 = operation.namespace) != null ? _a2 : ""}${(_b2 = operation.toTag) != null ? _b2 : ""}` : tag;
    });
    if (operation.kind === "normalize-tags") {
      if (!operation.rules) return { note, changed: false, reason: "Exact normalization rule is required" };
      const rules = operation.rules.toLowerCase().split(",").map((rule) => rule.trim()).filter(Boolean);
      const supported = /* @__PURE__ */ new Set(["lowercase", "spaces to hyphens", "slash separators"]);
      if (!rules.every((rule) => supported.has(rule))) return { note, changed: false, reason: "Unknown normalization rule; use lowercase, spaces to hyphens, or slash separators" };
      tags = tags.map((tag) => {
        let next = tag;
        if (rules.includes("lowercase")) next = next.toLowerCase();
        if (rules.includes("spaces to hyphens")) next = next.replace(/\s+/g, "-");
        if (rules.includes("slash separators")) next = next.replace(/\\/g, "/");
        return operation.namespace ? `${operation.namespace}${next}` : next;
      });
    }
    fm.tags = unique(tags);
  } else if (operation.kind === "reorder" && ((_c = operation.order) == null ? void 0 : _c.length)) {
    const preferred = {};
    for (const key of operation.order) if (key in fm) preferred[key] = fm[key];
    const unknown = {};
    for (const [key, value] of Object.entries(fm)) if (!(key in preferred)) unknown[key] = value;
    const ordered = operation.unknownPosition === "before" ? { ...unknown, ...preferred } : { ...preferred, ...unknown };
    Object.keys(fm).forEach((key) => delete fm[key]);
    Object.assign(fm, ordered);
  }
  const after = stringifyFrontmatter(fm, note.body, note.newline);
  const before = stringifyFrontmatter(note.frontmatter, note.body, note.newline);
  return { note: { ...note, frontmatter: fm }, changed: after !== before, conversion };
}
function planOperation(notes, operation) {
  return notes.map(({ path, content }) => {
    const parsed = parseFrontmatter(content);
    if (!parsed.hasFrontmatter && operation.kind !== "add-tags") return { path, status: "skipped", reason: "No frontmatter", before: content };
    const result = applyOperation(parsed, operation);
    return { path, status: result.changed ? "changed" : result.reason ? "skipped" : "unchanged", reason: result.reason, conversion: result.conversion, before: content, after: result.changed ? stringifyFrontmatter(result.note.frontmatter, result.note.body, result.note.newline) : void 0 };
  });
}

// billing.ts
var import_obsidian2 = require("obsidian");

// billing-model.ts
var FREE_USES_PER_DAY = 3;
function localCalendarDate(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function defaultBillingState() {
  return {
    deviceId: "",
    billingEmail: "",
    billingAccessToken: "",
    billingAccountLinked: false,
    purchasedCredits: 0,
    freeUsageDate: "",
    freeUsesRemaining: FREE_USES_PER_DAY,
    pendingCreditSpends: [],
    pendingCheckout: null
  };
}
function normalizeBillingState(state, today) {
  var _a;
  const next = { ...defaultBillingState(), ...state != null ? state : {} };
  if (next.freeUsageDate !== today) {
    next.freeUsageDate = today;
    next.freeUsesRemaining = FREE_USES_PER_DAY;
  }
  next.purchasedCredits = Math.max(0, Math.floor(Number(next.purchasedCredits) || 0));
  next.billingAccessToken = typeof next.billingAccessToken === "string" ? next.billingAccessToken : "";
  next.billingAccountLinked = next.billingAccountLinked === true && Boolean(next.billingAccessToken);
  next.freeUsesRemaining = Math.max(0, Math.min(FREE_USES_PER_DAY, Math.floor(Number(next.freeUsesRemaining) || 0)));
  next.pendingCreditSpends = [...new Set(((_a = next.pendingCreditSpends) != null ? _a : []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
  if (!next.pendingCheckout || typeof next.pendingCheckout.idempotencyKey !== "string" || typeof next.pendingCheckout.planCode !== "string") next.pendingCheckout = null;
  return next;
}
function claimLocalAllowance(state, today) {
  const next = normalizeBillingState(state, today);
  if (next.freeUsesRemaining > 0) {
    next.freeUsesRemaining--;
    return { state: next, source: "free" };
  }
  if (next.purchasedCredits > 0) {
    next.purchasedCredits--;
    return { state: next, source: "purchased" };
  }
  return { state: next, source: "remote" };
}
function restorePurchasedAllowance(state) {
  return { ...state, purchasedCredits: Math.max(0, Math.floor(Number(state.purchasedCredits) || 0) + 1) };
}
function isBillableWriteBatch(changedCount) {
  return Number.isFinite(changedCount) && changedCount > 0;
}

// constance-account.ts
var import_obsidian = require("obsidian");
var CONSTANCE_ACCOUNT_BASE_URL = "https://app.tutivsoft.com";
function errorDetail(response, fallback) {
  var _a, _b;
  return String(((_a = response.json) == null ? void 0 : _a.detail) || ((_b = response.json) == null ? void 0 : _b.message) || response.text || fallback);
}
async function authenticate(mode, email, password, installationId) {
  var _a;
  const body = mode === "register" ? { email, password, external_customer_id: installationId } : { email, password };
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/${mode}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Billing ${mode} failed (HTTP ${response.status})`));
  }
  const token = String(((_a = response.json) == null ? void 0 : _a.access_token) || "");
  if (!token) throw new Error("Constance did not return an account token.");
  return token;
}
async function linkInstallation(adapter, token) {
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/installations/link`,
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      app_id: adapter.appId,
      installation_id: adapter.installationId,
      legacy_external_customer_id: adapter.installationId,
      platform: "obsidian",
      app_version: adapter.appVersion || void 0
    }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Installation link failed (HTTP ${response.status})`));
  }
}
async function signInBillingAccount(adapter, password, mode) {
  const email = adapter.state.billingEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid billing email.");
  if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
  if (!adapter.installationId) throw new Error("The plugin installation ID is not ready.");
  const token = await authenticate(mode, email, password, adapter.installationId);
  await linkInstallation(adapter, token);
  adapter.state.billingEmail = email;
  adapter.state.billingAccessToken = token;
  adapter.state.billingAccountLinked = true;
  await adapter.persist();
  await adapter.syncBalance();
}
async function claimAccountFreeUsage(state, appId, installationId, eventId, amount) {
  var _a, _b;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await (0, import_obsidian.requestUrl)({
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/free-usage/claim`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.billingAccessToken}` },
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount }),
      throw: false
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    return { kind: "ok", remaining: Math.max(0, Number((_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.remaining) || 0) };
  } catch (error) {
    console.error("Constance account free-usage claim failed", error);
    return { kind: "error" };
  }
}
async function spendAccountCredits(state, appId, installationId, eventId, amount) {
  var _a, _b, _c;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await (0, import_obsidian.requestUrl)({
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/credits/spend`,
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.billingAccessToken}` },
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount }),
      throw: false
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance);
    return Number.isFinite(balance) ? { kind: "ok", balance: Math.max(0, balance) } : { kind: "error" };
  } catch (error) {
    console.error("Constance authenticated credit spend failed", error);
    return { kind: "error" };
  }
}
function addBillingAccountSettings(containerEl, adapter) {
  let password = "";
  new import_obsidian.Setting(containerEl).setName("Billing account email").setDesc("Used for sign-in, purchase restore, and checkout. Reinstalling no longer creates a new free allowance.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).onChange(async (value) => {
    adapter.state.billingEmail = value.trim();
    await adapter.persist();
  }));
  new import_obsidian.Setting(containerEl).setName("Billing account password").setDesc("Used only for this sign-in request. The password is never saved by the plugin.").addText((text) => {
    text.inputEl.type = "password";
    text.setPlaceholder("At least 8 characters").onChange((value) => {
      password = value;
    });
  });
  const status = adapter.state.billingAccountLinked ? "Signed in and linked" : "Not signed in";
  new import_obsidian.Setting(containerEl).setName("Billing account").setDesc(`${status}. The saved bearer session can restore purchases; your password is not stored.`).addButton((button) => button.setButtonText("Sign in").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "login");
      new import_obsidian.Notice("Billing account signed in and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : "Billing sign-in failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Create account").onClick(async () => {
    var _a;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password, "register");
      new import_obsidian.Notice("Billing account created and this installation was linked.");
      (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : "Billing account creation failed.");
    } finally {
      button.setDisabled(false);
    }
  })).addButton((button) => button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken).onClick(async () => {
    var _a;
    adapter.state.billingAccessToken = "";
    adapter.state.billingAccountLinked = false;
    await adapter.persist();
    new import_obsidian.Notice("Billing account signed out on this installation.");
    (_a = adapter.refresh) == null ? void 0 : _a.call(adapter);
  }));
}

// billing.ts
var CONSTANCE_BASE_URL = "https://app.tutivsoft.com";
var CONSTANCE_APP_ID = "tundra-frontmatter-wrangler";
var TUNDRA_PLAN_CODES = {
  usd001: "standard",
  usd010: "pro"
};
function makeDeviceId() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return `tundra-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function ensureBillingState(state, now = /* @__PURE__ */ new Date()) {
  const next = normalizeBillingState(state, localCalendarDate(now));
  if (!next.deviceId) next.deviceId = makeDeviceId();
  return next;
}
function generateEventId() {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
function generateIdempotencyKey() {
  return `checkout_${generateEventId()}`;
}
function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
function readBalance(response) {
  var _a, _b, _c;
  return Math.max(0, Number((_c = (_b = (_a = response.json) == null ? void 0 : _a.data) == null ? void 0 : _b.credits) == null ? void 0 : _c.balance) || 0);
}
async function spendConstanceCredit(plugin, stableEventId) {
  const state = plugin.settings.billing;
  const result = await spendAccountCredits(state, CONSTANCE_APP_ID, state.deviceId, stableEventId, 1);
  if (result.kind === "auth-required") {
    state.billingAccessToken = "";
    state.billingAccountLinked = false;
    await plugin.saveSettings();
    new import_obsidian2.Notice("Tundra: your billing session expired. Sign in again.", 5e3);
    return { kind: "error" };
  }
  if (result.kind === "insufficient") return result;
  if (result.kind === "ok") return result;
  return { kind: "error" };
}
async function retryPendingCreditSpends(plugin) {
  for (const stableEventId of [...plugin.settings.billing.pendingCreditSpends]) {
    const result = await spendConstanceCredit(plugin, stableEventId);
    if (result.kind === "error") break;
    plugin.settings.billing.pendingCreditSpends = plugin.settings.billing.pendingCreditSpends.filter((id) => id !== stableEventId);
    plugin.settings.billing.purchasedCredits = result.kind === "insufficient" ? 0 : result.balance;
    await plugin.saveSettings();
  }
}
async function pollCheckoutSettlement(plugin, checkoutId) {
  var _a;
  for (let attempt = 0; attempt < 12; attempt++) {
    await wait(5e3);
    const state = plugin.settings.billing;
    if (!state.pendingCheckout || state.pendingCheckout.checkoutId !== checkoutId || !state.billingAccessToken) return;
    try {
      const response = await (0, import_obsidian2.requestUrl)({
        url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(checkoutId)}`,
        method: "GET",
        headers: { Authorization: `Bearer ${state.billingAccessToken}` },
        throw: false
      });
      if (response.status === 401 || response.status === 403) {
        state.billingAccessToken = "";
        state.billingAccountLinked = false;
        state.pendingCheckout = null;
        await plugin.saveSettings();
        return;
      }
      if (response.status < 200 || response.status >= 300) continue;
      const data = (_a = response.json) == null ? void 0 : _a.data;
      if ((data == null ? void 0 : data.settled) === true) {
        state.pendingCheckout = null;
        await plugin.saveSettings();
        await syncBalance(plugin);
        new import_obsidian2.Notice("Tundra: payment settled and your credit balance was refreshed.", 5e3);
        return;
      }
    } catch (error) {
      console.warn("Tundra: checkout settlement poll failed", error);
    }
  }
}
async function startCheckout(plugin, planCode) {
  var _a, _b;
  const state = plugin.settings.billing;
  if (!state.billingAccessToken || !state.billingAccountLinked) {
    new import_obsidian2.Notice("Tundra: sign in or create a billing account in plugin settings before buying credits.", 5e3);
    return;
  }
  const pending = ((_a = state.pendingCheckout) == null ? void 0 : _a.planCode) === planCode ? state.pendingCheckout : { idempotencyKey: generateIdempotencyKey(), planCode };
  state.pendingCheckout = pending;
  await plugin.saveSettings();
  const response = await (0, import_obsidian2.requestUrl)({
    url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkout`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.billingAccessToken}`,
      "Idempotency-Key": pending.idempotencyKey
    },
    body: JSON.stringify({ app_id: CONSTANCE_APP_ID, plan_code: planCode, installation_id: state.deviceId, quantity: 1 }),
    throw: false
  });
  if (response.status === 401 || response.status === 403) {
    state.billingAccessToken = "";
    state.billingAccountLinked = false;
    state.pendingCheckout = null;
    await plugin.saveSettings();
    new import_obsidian2.Notice("Tundra: your billing session expired. Sign in again.", 5e3);
    return;
  }
  if (response.status < 200 || response.status >= 300) {
    new import_obsidian2.Notice(`Tundra: checkout could not be created (HTTP ${response.status}).`, 5e3);
    return;
  }
  const data = (_b = response.json) == null ? void 0 : _b.data;
  const checkoutId = String((data == null ? void 0 : data.checkout_id) || (data == null ? void 0 : data.id) || "");
  const checkoutUrl = String((data == null ? void 0 : data.checkout_url) || "");
  if (!checkoutId || !checkoutUrl) {
    new import_obsidian2.Notice("Tundra: Constance returned an incomplete checkout response.", 5e3);
    return;
  }
  state.pendingCheckout = { ...pending, checkoutId };
  await plugin.saveSettings();
  window.open(checkoutUrl, "_blank");
  void pollCheckoutSettlement(plugin, checkoutId);
}
function resumePendingCheckout(plugin) {
  const pending = plugin.settings.billing.pendingCheckout;
  if (!pending) return;
  if (pending.checkoutId) void pollCheckoutSettlement(plugin, pending.checkoutId);
  else void startCheckout(plugin, pending.planCode);
}
async function reserveUse(plugin) {
  if (!plugin.settings.billing.billingAccessToken || !plugin.settings.billing.billingAccountLinked) {
    new import_obsidian2.Notice("Tundra: sign in or create a billing account in plugin settings before applying changes.", 5e3);
    return null;
  }
  const today = localCalendarDate();
  const current = ensureBillingState(plugin.settings.billing);
  const claim = claimLocalAllowance(current, today);
  plugin.settings.billing = claim.state;
  if (claim.source === "free") {
    const free = await claimAccountFreeUsage(current, CONSTANCE_APP_ID, current.deviceId, `free_${generateEventId()}`, 1);
    if (free.kind !== "ok") {
      plugin.settings.billing = current;
      if (free.kind === "auth-required") {
        plugin.settings.billing.billingAccessToken = "";
        plugin.settings.billing.billingAccountLinked = false;
      }
      await plugin.saveSettings();
      new import_obsidian2.Notice(free.kind === "insufficient" ? "Tundra: today's account free allowance is exhausted." : "Tundra: the account allowance could not be verified.", 5e3);
      return null;
    }
    plugin.settings.billing.freeUsesRemaining = free.remaining;
    await plugin.saveSettings();
    return { source: "free", commit: async () => ({ kind: "committed" }), rollback: async () => void 0 };
  }
  if (claim.source === "remote") {
    const sync = await syncBalance(plugin);
    if (sync.kind !== "ok" || sync.balance < 1) {
      new import_obsidian2.Notice("Tundra: your free uses are exhausted and no purchased credits remain.", 5e3);
      return null;
    }
    const refreshed = claimLocalAllowance(plugin.settings.billing, today);
    plugin.settings.billing = refreshed.state;
    if (refreshed.source !== "purchased") {
      new import_obsidian2.Notice("Tundra: your free uses are exhausted and no purchased credits remain.", 5e3);
      return null;
    }
  }
  const stableEventId = generateEventId();
  plugin.settings.billing.pendingCreditSpends.push(stableEventId);
  await plugin.saveSettings();
  let settled = false;
  return {
    source: "purchased",
    commit: async () => {
      if (settled) return { kind: "committed" };
      const result = await spendConstanceCredit(plugin, stableEventId);
      if (result.kind === "error") return { kind: "pending" };
      settled = true;
      plugin.settings.billing.pendingCreditSpends = plugin.settings.billing.pendingCreditSpends.filter((id) => id !== stableEventId);
      if (result.kind === "insufficient") plugin.settings.billing.purchasedCredits = 0;
      else plugin.settings.billing.purchasedCredits = result.balance;
      await plugin.saveSettings();
      return result.kind === "insufficient" ? { kind: "insufficient" } : { kind: "committed" };
    },
    rollback: async () => {
      if (settled) return;
      plugin.settings.billing.pendingCreditSpends = plugin.settings.billing.pendingCreditSpends.filter((id) => id !== stableEventId);
      plugin.settings.billing = restorePurchasedAllowance(plugin.settings.billing);
      await plugin.saveSettings();
    }
  };
}
function isBillableApply(changedCount) {
  return isBillableWriteBatch(changedCount);
}
async function syncBalance(plugin) {
  plugin.settings.billing = ensureBillingState(plugin.settings.billing);
  const state = plugin.settings.billing;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "error" };
  try {
    const response = await (0, import_obsidian2.requestUrl)({
      url: `${CONSTANCE_BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: CONSTANCE_APP_ID, installation_id: state.deviceId }).toString()}`,
      method: "GET",
      throw: false,
      headers: { Authorization: `Bearer ${state.billingAccessToken}` }
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      state.billingAccessToken = "";
      state.billingAccountLinked = false;
      await plugin.saveSettings();
      return { kind: "error" };
    }
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = readBalance(response);
    plugin.settings.billing.purchasedCredits = balance;
    await plugin.saveSettings();
    return { kind: "ok", balance };
  } catch (error) {
    console.warn("Tundra: Constance balance sync failed", error);
    return { kind: "error" };
  }
}
function openCheckout(plugin, tier) {
  void startCheckout(plugin, TUNDRA_PLAN_CODES[tier]).catch((error) => {
    console.error("Tundra: authenticated checkout failed", error);
    new import_obsidian2.Notice("Tundra: checkout could not be started. Retry from settings.", 5e3);
  });
}

// plugin-support.ts
var import_obsidian3 = require("obsidian");
function safeDetail(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}
var DocumentationModal = class extends import_obsidian3.Modal {
  constructor(app, docs) {
    super(app);
    this.docs = docs;
  }
  onOpen() {
    this.titleEl.setText(`${this.docs.name} documentation`);
    this.contentEl.createEl("p", { text: this.docs.summary });
    const addSection = (title, items) => {
      this.contentEl.createEl("h3", { text: title });
      const list = this.contentEl.createEl("ol");
      for (const item of items) list.createEl("li", { text: item });
    };
    addSection("Quick start", this.docs.quickStart);
    addSection("Useful commands", this.docs.commands);
    addSection("Troubleshooting", this.docs.troubleshooting);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PluginSupport = class {
  constructor(plugin, docs) {
    this.plugin = plugin;
    this.docs = docs;
    this.entries = [];
    this.maxEntries = 250;
  }
  start() {
    this.info("plugin.loaded", `version=${this.plugin.manifest.version}`);
    this.plugin.registerDomEvent(window, "error", (event) => {
      this.error("runtime.error", event.error || event.message);
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event) => {
      this.error("runtime.unhandled_rejection", event.reason);
    });
    this.plugin.addCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs).open()
    });
    this.plugin.addCommand({
      id: "copy-debug-log",
      name: "Copy debug log",
      callback: () => {
        void this.copyDiagnostics();
      }
    });
    this.plugin.addCommand({
      id: "open-plugin-settings",
      name: "Open plugin settings",
      callback: () => {
        const setting = this.plugin.app.setting;
        setting == null ? void 0 : setting.open();
        setting == null ? void 0 : setting.openTabById(this.plugin.manifest.id);
      }
    });
  }
  info(event, detail) {
    this.record("info", event, detail);
  }
  warn(event, detail) {
    this.record("warn", event, detail);
  }
  error(event, detail) {
    this.record("error", event, detail);
  }
  record(level, event, detail) {
    const entry = { at: (/* @__PURE__ */ new Date()).toISOString(), level, event };
    if (detail !== void 0) entry.detail = safeDetail(detail).slice(0, 4e3);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    method.call(console, `[${this.docs.name}] ${event}`, detail != null ? detail : "");
  }
  async copyDiagnostics() {
    const header = [
      `Plugin: ${this.docs.name}`,
      `Plugin ID: ${this.plugin.manifest.id}`,
      `Version: ${this.plugin.manifest.version}`,
      `Captured: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `User agent: ${navigator.userAgent}`,
      ""
    ];
    try {
      await navigator.clipboard.writeText(header.concat(this.entries.map(
        (entry) => `${entry.at} [${entry.level.toUpperCase()}] ${entry.event}${entry.detail ? ` \u2014 ${entry.detail}` : ""}`
      )).join("\n"));
      new import_obsidian3.Notice(`${this.docs.name}: debug log copied. Secrets and note contents are not included.`);
    } catch (error) {
      this.error("diagnostics.copy_failed", error);
      new import_obsidian3.Notice(`${this.docs.name}: could not copy the debug log.`);
    }
  }
};

// main.ts
var DEFAULT_SETTINGS = { billing: defaultBillingState() };
var TundraPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { billing: defaultBillingState() };
  }
  async onload() {
    this.support = new PluginSupport(this, { name: "Tundra Frontmatter Wrangler", summary: "Preview, apply, audit, and roll back bulk frontmatter changes.", quickStart: ["Open the wrangler.", "Choose a scope and operation.", "Review the diff before applying the batch."], commands: ["Open frontmatter wrangler", "Open documentation", "Copy debug log"], troubleshooting: ["Use Copy debug log before reporting a problem.", "Reopen the wizard if notes changed after preview."] });
    this.support.start();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.billing = ensureBillingState(this.settings.billing);
    await this.saveSettings();
    void retryPendingCreditSpends(this);
    resumePendingCheckout(this);
    this.addCommand({ id: "open-wrangler", name: "Open frontmatter wrangler", callback: () => new WranglerModal(this.app, this).open() });
    this.addRibbonIcon("wrench", "Open frontmatter wrangler", () => new WranglerModal(this.app, this).open());
    this.addSettingTab(new TundraSettingTab(this.app, this));
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var TundraSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Tundra Frontmatter Wrangler" });
    containerEl.createEl("p", { text: "Offline-first metadata operations. Every write is journaled for rollback." });
    new import_obsidian4.Setting(containerEl).setName("Open wrangler").setDesc("Review and apply a bulk operation").addButton((b) => b.setButtonText("Open").setCta().onClick(() => new WranglerModal(this.app, this.plugin).open()));
    const billing = this.plugin.settings.billing;
    addBillingAccountSettings(containerEl, { state: billing, appId: "tundra-frontmatter-wrangler", installationId: billing.deviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: async () => {
      await syncBalance(this.plugin);
    }, refresh: () => this.display() });
    new import_obsidian4.Setting(containerEl).setName("Credits").setDesc(`${billing.freeUsesRemaining} of ${FREE_USES_PER_DAY} free apply batches remain today \xB7 ${billing.purchasedCredits} purchased credits in the local mirror.`).addButton((button) => button.setButtonText("Sync balance").onClick(async () => {
      button.setDisabled(true);
      const result = await syncBalance(this.plugin);
      new import_obsidian4.Notice(result.kind === "ok" ? `Tundra: synced ${result.balance} purchased credits.` : "Tundra: could not sync the purchased-credit balance.", result.kind === "ok" ? 3e3 : 5e3);
      this.display();
    }));
    const packs = new import_obsidian4.Setting(containerEl).setName("Buy credits").setDesc("One-time packs. Credits are used for one non-empty apply batch after the daily free allowance.");
    packs.addButton((button) => button.setButtonText("Buy $1 (100 credits)").onClick(() => openCheckout(this.plugin, "usd001")));
    packs.addButton((button) => button.setButtonText("Buy $10 (1,000 credits)").setCta().onClick(() => openCheckout(this.plugin, "usd010")));
    containerEl.createEl("p", { cls: "tundra-note", text: `This install's billing device ID is saved locally and is not editable: ${billing.deviceId.slice(0, 18)}\u2026` });
    if (this.plugin.settings.lastBatch) new import_obsidian4.Setting(containerEl).setName("Most recent batch").setDesc(`${this.plugin.settings.lastBatch.summary.changed} changed \xB7 ${this.plugin.settings.lastBatch.createdAt}`).addButton((b) => b.setButtonText("Rollback").onClick(() => rollback(this.app, this.plugin)));
  }
};
var WranglerModal = class extends import_obsidian4.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.step = 0;
    this.files = [];
    this.included = /* @__PURE__ */ new Set();
    this.plans = [];
    this.reviewed = /* @__PURE__ */ new Set();
    this.operation = { kind: "rename", oldKey: "", newKey: "", collision: "skip" };
    this.cancelled = false;
    this.query = "";
    this.folder = "";
    this.recursive = true;
    this.filterKey = "";
    this.filterValue = "";
    this.selectionStats = { withFrontmatter: 0, withoutFrontmatter: 0, skipped: 0 };
    this.steps = ["Select", "Inspect", "Configure", "Preview", "Apply", "Review"];
    this.modalEl.addClass("tundra-modal");
  }
  onOpen() {
    this.render();
  }
  onClose() {
    this.contentEl.empty();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.createEl("div", { cls: "tundra-header", text: "Tundra Frontmatter Wrangler" });
    const nav = c.createDiv("tundra-steps");
    this.steps.forEach((s, i) => {
      const b = nav.createEl("button", { text: `${i + 1}. ${s}`, cls: i === this.step ? "is-active" : "" });
      b.setAttribute("aria-current", i === this.step ? "step" : "false");
      b.onclick = () => {
        if (i <= this.step || i === 1 && this.files.length) {
          this.step = i;
          this.render();
        }
      };
    });
    const body = c.createDiv("tundra-body");
    if (this.step === 0) this.renderSelect(body);
    if (this.step === 1) this.renderInspect(body);
    if (this.step === 2) this.renderConfigure(body);
    if (this.step === 3) this.renderPreview(body);
    if (this.step === 4) this.renderApply(body);
    if (this.step === 5) this.renderReview(body);
  }
  footer(parent, next, action, back = true) {
    const f = parent.createDiv("tundra-footer");
    if (back) new import_obsidian4.ButtonComponent(f).setButtonText("Back").onClick(() => {
      this.step--;
      this.render();
    });
    new import_obsidian4.ButtonComponent(f).setButtonText(next).setCta().onClick(action);
  }
  renderSelect(parent) {
    parent.createEl("p", { text: "Choose a safe working set. Selection stays local to this vault." });
    new import_obsidian4.Setting(parent).setName("Folder").setDesc("Leave blank for the whole vault").addText((t) => t.setPlaceholder("Projects/2026").setValue(this.folder).onChange((v) => {
      this.folder = v.trim();
    }));
    new import_obsidian4.Setting(parent).setName("Include subfolders").addToggle((t) => t.setValue(this.recursive).onChange((v) => this.recursive = v));
    new import_obsidian4.Setting(parent).setName("Path or text query").setDesc("Matches the note path or its body").addText((t) => t.setPlaceholder("meeting").setValue(this.query).onChange((v) => this.query = v));
    new import_obsidian4.Setting(parent).setName("Property filter").setDesc("Exact top-level property value").addText((t) => t.setPlaceholder("status").setValue(this.filterKey).onChange((v) => this.filterKey = v)).addText((t) => t.setPlaceholder("active").setValue(this.filterValue).onChange((v) => this.filterValue = v));
    const run = parent.createDiv("tundra-actions");
    new import_obsidian4.ButtonComponent(run).setButtonText("Build inventory").setCta().onClick(async () => {
      await this.selectFiles();
      this.step = 1;
      this.render();
    });
  }
  async selectFiles() {
    var _a;
    const all = this.app.vault.getMarkdownFiles();
    this.files = [];
    this.selectionStats = { withFrontmatter: 0, withoutFrontmatter: 0, skipped: 0 };
    for (const file of all) {
      if (this.folder) {
        const prefix = this.folder.replace(/\\/g, "/").replace(/\/$/, "") + "/";
        const path = file.path.replace(/\\/g, "/");
        if (!(path === this.folder || (this.recursive ? path.startsWith(prefix) : path.slice(0, -file.name.length - 1) === this.folder))) continue;
      }
      const content = await this.app.vault.read(file);
      const parsed = parseFrontmatter(content);
      if (this.query && !file.path.toLowerCase().includes(this.query.toLowerCase()) && !content.toLowerCase().includes(this.query.toLowerCase())) continue;
      if (this.filterKey && String((_a = parsed.frontmatter[this.filterKey]) != null ? _a : "") !== this.filterValue) continue;
      this.files.push(file);
      if (parsed.hasFrontmatter && parsed.safe) this.selectionStats.withFrontmatter++;
      else if (!parsed.hasFrontmatter) this.selectionStats.withoutFrontmatter++;
      else this.selectionStats.skipped++;
    }
    this.included = new Set(this.files.map((f) => f.path));
  }
  renderInspect(parent) {
    var _a, _b, _c;
    parent.createEl("h3", { text: "Review selection" });
    parent.createEl("p", { text: `${this.included.size} selected \xB7 ${this.selectionStats.withFrontmatter} with frontmatter \xB7 ${this.selectionStats.withoutFrontmatter} without frontmatter \xB7 ${this.selectionStats.skipped} will be skipped` });
    parent.createEl("p", { text: "Uncheck any note to exclude it. Unsafe or malformed frontmatter is reported during preview." });
    const inventory = /* @__PURE__ */ new Map();
    for (const file of this.files) {
      const cache = this.app.metadataCache.getFileCache(file);
      for (const [key, value] of Object.entries((_a = cache == null ? void 0 : cache.frontmatter) != null ? _a : {})) {
        const item = (_b = inventory.get(key)) != null ? _b : { count: 0, types: /* @__PURE__ */ new Set() };
        item.count++;
        item.types.add(Array.isArray(value) ? "list" : typeof value);
        if (item.sample === void 0 && value !== void 0) item.sample = String(value).slice(0, 80);
        inventory.set(key, item);
      }
    }
    if (inventory.size) {
      parent.createEl("h4", { text: "Property inventory" });
      const table = parent.createEl("table", { cls: "tundra-inventory" });
      const head = table.createEl("tr");
      ["Property", "Occurrences", "Types", "Representative value"].forEach((text) => head.createEl("th", { text }));
      for (const [key, item] of inventory) {
        const row = table.createEl("tr");
        row.createEl("td", { text: key });
        row.createEl("td", { text: String(item.count) });
        row.createEl("td", { text: [...item.types].join(", ") });
        row.createEl("td", { text: (_c = item.sample) != null ? _c : "" });
      }
    }
    const list = parent.createDiv("tundra-checklist");
    for (const file of this.files) {
      const row = list.createDiv("tundra-check-row");
      const label = row.createEl("label");
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = this.included.has(file.path);
      cb.onchange = () => cb.checked ? this.included.add(file.path) : this.included.delete(file.path);
      label.createSpan({ text: ` ${file.path}` });
    }
    this.footer(parent, "Configure", () => {
      this.step = 2;
      this.render();
    });
  }
  renderConfigure(parent) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    parent.createEl("h3", { text: "Configure operation" });
    const setting = new import_obsidian4.Setting(parent).setName("Operation").setDesc("Only top-level properties are changed");
    setting.addDropdown((d) => d.addOptions({ rename: "Rename property", remove: "Remove property (destructive)", "add-tags": "Add tags", "remove-tags": "Remove tags", "replace-tag": "Replace tag", "normalize-tags": "Normalize tags by exact rule", reorder: "Reorder schema", format: "Format only" }).setValue(this.operation.kind).onChange((v) => {
      this.operation = { kind: v, collision: "skip" };
      this.render();
    }));
    if (["rename", "remove"].includes(this.operation.kind)) {
      this.textSetting(parent, "Property key", "oldKey", (_a = this.operation.oldKey) != null ? _a : "");
      if (this.operation.kind === "rename") {
        this.textSetting(parent, "New key", "newKey", (_b = this.operation.newKey) != null ? _b : "");
        new import_obsidian4.Setting(parent).setName("Collision handling").addDropdown((d) => {
          var _a2;
          return d.addOptions({ keep: "Keep existing new key", replace: "Replace with old value", merge: "Merge values", skip: "Skip collided note" }).setValue((_a2 = this.operation.collision) != null ? _a2 : "skip").onChange((v) => this.operation.collision = v);
        });
      }
    } else if (["add-tags", "remove-tags"].includes(this.operation.kind)) this.textSetting(parent, "Tags (comma separated)", "tags", ((_c = this.operation.tags) != null ? _c : []).join(", "));
    else if (this.operation.kind === "replace-tag") {
      this.textSetting(parent, "From tag", "fromTag", (_d = this.operation.fromTag) != null ? _d : "");
      this.textSetting(parent, "To tag", "toTag", (_e = this.operation.toTag) != null ? _e : "");
      this.textSetting(parent, "Optional namespace/prefix", "namespace", (_f = this.operation.namespace) != null ? _f : "");
    } else if (this.operation.kind === "normalize-tags") {
      this.textSetting(parent, "Exact rule description", "rules", (_g = this.operation.rules) != null ? _g : "lowercase, spaces to hyphens, slash separators");
      this.textSetting(parent, "Optional namespace/prefix", "namespace", (_h = this.operation.namespace) != null ? _h : "");
    } else if (this.operation.kind === "reorder") {
      this.textSetting(parent, "Preferred keys (comma separated)", "order", ((_i = this.operation.order) != null ? _i : []).join(", "));
      new import_obsidian4.Setting(parent).setName("Unknown keys").addDropdown((d) => {
        var _a2;
        return d.addOptions({ after: "Keep after preferred keys", before: "Keep before preferred keys" }).setValue((_a2 = this.operation.unknownPosition) != null ? _a2 : "after").onChange((v) => this.operation.unknownPosition = v);
      });
    }
    if (this.operation.kind === "remove") parent.createEl("p", { cls: "tundra-warning", text: "Removing a property changes note files. A recovery journal is created, but confirm the exact key and count." });
    this.footer(parent, "Preview", () => {
      this.step = 3;
      this.buildPlan().then(() => this.render());
    });
  }
  textSetting(parent, name, key, value) {
    new import_obsidian4.Setting(parent).setName(name).addText((t) => t.setValue(value).onChange((v) => {
      if (key === "tags" || key === "order") this.operation[key] = v.split(",").map((s) => s.trim()).filter(Boolean);
      else this.operation[key] = v;
    }));
  }
  async buildPlan() {
    const notes = [];
    for (const file of this.files.filter((f) => this.included.has(f.path))) notes.push({ path: file.path, content: await this.app.vault.read(file) });
    this.plans = planOperation(notes, this.operation);
    this.reviewed.clear();
  }
  renderPreview(parent) {
    var _a;
    const changed = this.plans.filter((p) => p.status === "changed");
    const skipped = this.plans.filter((p) => p.status === "skipped");
    const unchanged = this.plans.filter((p) => p.status === "unchanged");
    parent.createEl("h3", { text: "Preview and confirmation" });
    parent.createEl("p", { text: `${changed.length} will change \xB7 ${skipped.length} skipped \xB7 ${unchanged.length} unchanged` });
    if (!changed.length) parent.createEl("p", { cls: "tundra-note", text: "Nothing will be written. Previewing a no-op does not use free or purchased credits." });
    const details = parent.createEl("details");
    details.open = true;
    details.createEl("summary", { text: "Inspect and review every affected note" });
    const affected = details.createDiv("tundra-diffs");
    for (const plan of this.plans) if (plan.status === "changed" || plan.status === "skipped") {
      const d = affected.createEl("details");
      d.createEl("summary", { text: `${plan.status === "changed" ? "Change" : "Skip"}: ${plan.path}${plan.reason ? ` \u2014 ${plan.reason}` : ""}` });
      if (plan.status === "changed") {
        const review = d.createEl("label");
        const cb = review.createEl("input", { type: "checkbox" });
        cb.checked = this.reviewed.has(plan.path);
        cb.onchange = () => cb.checked ? this.reviewed.add(plan.path) : this.reviewed.delete(plan.path);
        review.createSpan({ text: " I reviewed this diff" });
        d.createEl("pre", { text: `- before: ${plan.before.slice(0, 700)}
+ after: ${((_a = plan.after) != null ? _a : "").slice(0, 700)}` });
      }
    }
    parent.createEl("p", { cls: "tundra-note", text: "Apply writes one note at a time. One free or purchased credit is authorized only when this preview contains at least one reviewed change." });
    const f = parent.createDiv("tundra-footer");
    new import_obsidian4.ButtonComponent(f).setButtonText("Back").onClick(() => {
      this.step = 2;
      this.render();
    });
    const apply = new import_obsidian4.ButtonComponent(f).setButtonText("Confirm and apply").setCta();
    apply.setDisabled(!isBillableApply(changed.length) || !changed.every((p) => this.reviewed.has(p.path)));
    apply.onClick(() => {
      if (!isBillableApply(changed.length) || !changed.every((p) => this.reviewed.has(p.path))) return;
      if (this.operation.kind === "remove" && !window.confirm(`Remove property ${this.operation.oldKey} from ${changed.length} notes? This changes note files.`)) return;
      this.cancelled = false;
      this.step = 4;
      this.render();
    });
  }
  renderApply(parent) {
    parent.createEl("h3", { text: "Applying changes" });
    const progress = parent.createEl("progress", { attr: { max: String(this.plans.length), value: "0" } });
    const status = parent.createEl("p", { text: "Authorizing write batch\u2026", cls: "tundra-status" });
    const cancel = new import_obsidian4.ButtonComponent(parent).setButtonText("Cancel after current note");
    cancel.setDisabled(true);
    const back = new import_obsidian4.ButtonComponent(parent).setButtonText("Back to preview").onClick(() => {
      this.step = 3;
      this.render();
    });
    back.setDisabled(true);
    void (async () => {
      const reservation = await reserveUse(this.plugin);
      if (!reservation) {
        status.setText("Billing authorization failed. No notes were changed.");
        cancel.setDisabled(true);
        back.setDisabled(false);
        return;
      }
      cancel.setDisabled(false);
      const batch = { id: crypto.randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString(), operation: this.operation, files: [], summary: { changed: 0, skipped: 0, failed: 0, unchanged: 0 } };
      for (let i = 0; i < this.plans.length; i++) {
        if (this.cancelled) {
          status.setText("Cancelled. Notes already completed remain journaled.");
          break;
        }
        const p = this.plans[i];
        progress.value = i + 1;
        status.setText(`${i + 1}/${this.plans.length}: ${p.path}`);
        if (p.status !== "changed" || !p.after) {
          batch.summary[p.status]++;
          continue;
        }
        const file = this.app.vault.getAbstractFileByPath(p.path);
        if (!(file instanceof import_obsidian4.TFile)) {
          batch.summary.failed++;
          continue;
        }
        try {
          const current = await this.app.vault.read(file);
          if (current !== p.before) {
            batch.summary.skipped++;
            continue;
          }
          batch.files.push({ path: p.path, original: p.before, after: p.after });
          await this.app.vault.modify(file, p.after);
          batch.summary.changed++;
        } catch (e) {
          batch.summary.failed++;
        }
      }
      if (batch.summary.changed > 0) {
        const billingResult = await reservation.commit();
        if (billingResult.kind === "pending") new import_obsidian4.Notice("Tundra changes applied. Billing is pending and will retry automatically.", 5e3);
      } else {
        await reservation.rollback();
      }
      await this.plugin.saveData(Object.assign(this.plugin.settings, { lastBatch: batch }));
      this.step = 5;
      this.render();
    })();
    cancel.onClick(() => this.cancelled = true);
  }
  renderReview(parent) {
    const batch = this.plugin.settings.lastBatch;
    parent.createEl("h3", { text: "Run complete" });
    if (!batch) {
      parent.createEl("p", { text: "No batch was recorded." });
      return;
    }
    parent.createEl("p", { text: `${batch.summary.changed} changed \xB7 ${batch.summary.skipped} skipped \xB7 ${batch.summary.failed} failed \xB7 ${batch.summary.unchanged} unchanged` });
    new import_obsidian4.ButtonComponent(parent).setButtonText("Rollback most recent batch").onClick(async () => {
      await rollback(this.app, this.plugin);
      this.render();
    });
    new import_obsidian4.ButtonComponent(parent).setButtonText("Open operation log").onClick(() => new LogModal(this.app, batch).open());
    this.footer(parent, "Done", () => this.close(), false);
  }
};
async function rollback(app, plugin) {
  const batch = plugin.settings.lastBatch;
  if (!batch) {
    new import_obsidian4.Notice("No recovery journal is available.");
    return;
  }
  if (!window.confirm(`Restore ${batch.files.length} note(s) from the most recent journal?`)) return;
  let restored = 0;
  let skipped = 0;
  for (const entry of batch.files) {
    const file = app.vault.getAbstractFileByPath(entry.path);
    if (!(file instanceof import_obsidian4.TFile)) {
      skipped++;
      continue;
    }
    try {
      const current = await app.vault.read(file);
      if (entry.after !== void 0 && current !== entry.after) {
        skipped++;
        continue;
      }
      await app.vault.modify(file, entry.original);
      restored++;
    } catch (e) {
      skipped++;
    }
  }
  new import_obsidian4.Notice(`Restored ${restored} of ${batch.files.length} notes${skipped ? `; ${skipped} skipped because they changed or disappeared` : ""}.`);
}
var LogModal = class extends import_obsidian4.Modal {
  constructor(app, batch) {
    super(app);
    this.batch = batch;
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: "Tundra operation log" });
    this.contentEl.createEl("pre", { text: JSON.stringify(this.batch, null, 2) });
  }
  onClose() {
    this.contentEl.empty();
  }
};
