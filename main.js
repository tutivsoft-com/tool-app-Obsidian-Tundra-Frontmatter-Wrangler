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

// preview-gateway.ts
var import_obsidian2 = require("obsidian");

// constance-account.ts
var import_obsidian = require("obsidian");
var CONSTANCE_ACCOUNT_BASE_URL = "https://app.tutivsoft.com";
function clearBillingSession(state) {
  state.billingAccessToken = "";
  state.billingRefreshToken = "";
  state.billingAccessExpiresAt = 0;
  state.billingAccountLinked = false;
}
function readTokens(json) {
  const accessToken = String((json == null ? void 0 : json.access_token) || "");
  const refreshToken = String((json == null ? void 0 : json.refresh_token) || "");
  if (!accessToken || !refreshToken) throw new Error("Constance did not return a complete account session.");
  const seconds = Number(json == null ? void 0 : json.expires_in);
  return { accessToken, refreshToken, expiresAt: Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 900) * 1e3 };
}
var billingRefreshes = /* @__PURE__ */ new WeakMap();
async function refreshBillingSession(state, persist) {
  const pending = billingRefreshes.get(state);
  if (pending) {
    const ok = await pending;
    if (ok) await (persist == null ? void 0 : persist());
    return ok;
  }
  const original = state.billingRefreshToken;
  if (!original) return false;
  const operation = (async () => {
    var _a2, _b2, _c2;
    try {
      const response = await (0, import_obsidian.requestUrl)({
        url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/refresh`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: original }),
        throw: false
      });
      if (state.billingRefreshToken !== original) return false;
      if (response.status === 401 || response.status === 403) {
        state.billingAccessToken = "";
        state.billingRefreshToken = "";
        state.billingAccountLinked = false;
        await (persist == null ? void 0 : persist());
        return false;
      }
      if (response.status < 200 || response.status >= 300) return false;
      const access = String(((_a2 = response.json) == null ? void 0 : _a2.access_token) || "");
      const refresh = String(((_b2 = response.json) == null ? void 0 : _b2.refresh_token) || "");
      if (!access || !refresh) return false;
      state.billingAccessToken = access;
      state.billingRefreshToken = refresh;
      state.billingAccessExpiresAt = Date.now() + (Number((_c2 = response.json) == null ? void 0 : _c2.expires_in) || 900) * 1e3;
      await (persist == null ? void 0 : persist());
      return true;
    } catch (e) {
      return false;
    }
  })();
  billingRefreshes.set(state, operation);
  try {
    return await operation;
  } finally {
    billingRefreshes.delete(state);
  }
}
async function requestAuthenticatedBilling(state, persist, options) {
  if (state.billingRefreshToken && (!state.billingAccessToken || state.billingAccessExpiresAt > 0 && Date.now() >= state.billingAccessExpiresAt - 6e4)) {
    if (!await refreshBillingSession(state, persist)) return { status: state.billingRefreshToken ? 503 : 401 };
  }
  const send2 = () => (0, import_obsidian.requestUrl)({ ...options, headers: { ...options.headers || {}, Authorization: `Bearer ${state.billingAccessToken}` }, throw: false });
  let response = await send2();
  if (response.status === 401 && state.billingRefreshToken) {
    if (!await refreshBillingSession(state, persist)) return { status: state.billingRefreshToken ? 503 : 401 };
    response = await send2();
  }
  return response;
}
async function signOutBillingAccount(adapter) {
  const refreshToken = adapter.state.billingRefreshToken;
  clearBillingSession(adapter.state);
  await adapter.persist();
  if (refreshToken) {
    try {
      await (0, import_obsidian.requestUrl)({
        url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/logout`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        throw: false
      });
    } catch (e) {
    }
  }
}
function errorDetail(response, fallback) {
  var _a2, _b2, _c2, _d2, _e2, _f2;
  if (((_b2 = (_a2 = response.json) == null ? void 0 : _a2.detail) == null ? void 0 : _b2.code) === "invalid_credentials") return "Incorrect password. Use Forgot password? to reset it.";
  return String(((_d2 = (_c2 = response.json) == null ? void 0 : _c2.detail) == null ? void 0 : _d2.message) || ((_e2 = response.json) == null ? void 0 : _e2.detail) || ((_f2 = response.json) == null ? void 0 : _f2.message) || fallback);
}
async function authenticate(email, password) {
  var _a2;
  const response = await (0, import_obsidian.requestUrl)({
    url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/auth/connect`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    throw: false
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorDetail(response, `Billing login failed (HTTP ${response.status})`));
  }
  if ((_a2 = response.json) == null ? void 0 : _a2.verification_required) throw Object.assign(new Error("Email verification required. Check your email, then Connect again."), { verificationRequired: true });
  return readTokens(response.json);
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
async function signInBillingAccount(adapter, password) {
  const email = adapter.state.billingEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid billing email.");
  if (Array.from(password).length < 8 || Array.from(password).length > 128) throw new Error("Password must be between 8 and 128 characters.");
  if (!adapter.installationId) throw new Error("The plugin installation ID is not ready.");
  const journalState = adapter.state;
  if (journalState.pendingBillingOwnerEmail && journalState.pendingBillingOwnerEmail !== email) throw new Error(`Connect ${journalState.pendingBillingOwnerEmail} to recover pending billing first.`);
  let tokens;
  try {
    tokens = await authenticate(email, password);
  } catch (error) {
    if (error.verificationRequired) {
      adapter.state.billingRegistrationPending = true;
      await adapter.persist();
    }
    throw error;
  }
  await completeBillingSignIn(adapter, email, tokens);
}
async function completeBillingSignIn(adapter, email, tokens) {
  await linkInstallation(adapter, tokens.accessToken);
  adapter.state.billingEmail = email;
  adapter.state.billingAccessToken = tokens.accessToken;
  adapter.state.billingRefreshToken = tokens.refreshToken;
  adapter.state.billingAccessExpiresAt = tokens.expiresAt;
  adapter.state.billingAccountLinked = true;
  adapter.state.billingRegistrationPending = false;
  await adapter.persist();
  await adapter.syncBalance();
}
async function spendAccountCredits(state, persist, appId, installationId, eventId, amount) {
  var _a2, _b2, _c2;
  if (!state.billingAccessToken && !state.billingRefreshToken || !state.billingAccountLinked) return { kind: "auth-required" };
  try {
    const response = await requestAuthenticatedBilling(state, persist, {
      url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/credits/spend`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, installation_id: installationId, event_id: eventId, amount })
    });
    if (response.status === 402) return { kind: "insufficient" };
    if (response.status === 401 || response.status === 403 || response.status === 404) return { kind: "auth-required" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = Number((_c2 = (_b2 = (_a2 = response.json) == null ? void 0 : _a2.data) == null ? void 0 : _b2.credits) == null ? void 0 : _c2.balance);
    if (!Number.isFinite(balance)) return { kind: "error" };
    const remaining = Math.max(0, balance);
    new import_obsidian.Notice(`Credit balance before this task: ${(remaining + amount).toLocaleString()} purchased credits.`);
    new import_obsidian.Notice(`Task used ${amount.toLocaleString()} credits. Balance remaining: ${remaining.toLocaleString()} purchased credits.`);
    return { kind: "ok", balance: remaining };
  } catch (error) {
    console.error("Constance authenticated credit spend failed", error);
    return { kind: "error" };
  }
}
function addBillingAccountSettings(containerEl, adapter) {
  let password = "";
  const section = containerEl.createDiv({ cls: "constance-account-billing-section" });
  section.createEl("h3", { text: "Account and billing" });
  const state = adapter.state;
  const numericBalances = Object.entries(state).filter(([key, value]) => /(?:credit|balance|remaining)/i.test(key) && typeof value === "number").map(([key, value]) => `${key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}: ${Number(value).toLocaleString()}`);
  const accountStatus = adapter.state.billingAccountLinked ? `Signed in as ${adapter.state.billingEmail || "your account"}` : state.billingRegistrationPending ? `Registered as ${adapter.state.billingEmail} but not signed in. Check your email, click the confirmation link, then sign in here.` : "Not signed in.";
  section.createEl("p", {
    cls: "constance-account-status",
    text: numericBalances.length ? `${accountStatus} Balance \u2014 ${numericBalances.join("; ")}` : accountStatus
  });
  new import_obsidian.Setting(section).setName("Email").setDesc("Used to register, sign in, restore purchases, and open checkout.").addText((text) => text.setPlaceholder("you@example.com").setValue(adapter.state.billingEmail).setDisabled(adapter.state.billingAccountLinked).onChange(async (value) => {
    var _a2;
    const journalState = adapter.state;
    const hasPending = !!journalState.pendingCheckout || !!journalState.pendingFreeUsageClaim || !!((_a2 = journalState.pendingCreditSpends) == null ? void 0 : _a2.length);
    if (hasPending && !journalState.pendingBillingOwnerEmail) journalState.pendingBillingOwnerEmail = adapter.state.billingEmail;
    if (!hasPending) journalState.pendingBillingOwnerEmail = void 0;
    adapter.state.billingEmail = value.trim();
    await adapter.persist();
  }));
  new import_obsidian.Setting(section).setName("Password").setDesc("Used only for this request. The plugin never saves your password.").addText((text) => {
    text.inputEl.type = "password";
    text.inputEl.maxLength = 256;
    text.setPlaceholder("8 to 128 characters").onChange((value) => {
      password = value;
    });
  });
  new import_obsidian.Setting(section).setName("Account").setDesc(accountStatus).addButton((button) => button.setButtonText("Connect").setDisabled(adapter.state.billingAccountLinked).onClick(async () => {
    var _a2, _b2;
    button.setDisabled(true);
    try {
      await signInBillingAccount(adapter, password);
      password = "";
      new import_obsidian.Notice(adapter.state.billingRegistrationPending ? "Check your email and follow the verification link, then Connect again." : `Connected as ${adapter.state.billingEmail}.`);
      (_a2 = adapter.refresh) == null ? void 0 : _a2.call(adapter);
    } catch (error) {
      new import_obsidian.Notice(error instanceof Error ? error.message : "Connection failed. Please try again.");
      (_b2 = adapter.refresh) == null ? void 0 : _b2.call(adapter);
    } finally {
      button.setDisabled(adapter.state.billingAccountLinked);
    }
  })).addButton((button) => button.setButtonText("Sign out").setDisabled(!adapter.state.billingAccessToken && !adapter.state.billingRefreshToken).onClick(async () => {
    var _a2;
    await signOutBillingAccount(adapter);
    state.billingRegistrationPending = false;
    await adapter.persist();
    new import_obsidian.Notice("Signed out.");
    (_a2 = adapter.refresh) == null ? void 0 : _a2.call(adapter);
  }));
  new import_obsidian.Setting(section).setName("Forgot password?").setDesc("Recover your billing account in Constance.").addButton((button) => button.setButtonText("Reset password").onClick(() => window.open(`${CONSTANCE_ACCOUNT_BASE_URL}/password-reset`, "_blank")));
  const firstHeading = containerEl.querySelector(":scope > h1, :scope > h2");
  if (firstHeading == null ? void 0 : firstHeading.nextSibling) containerEl.insertBefore(section, firstHeading.nextSibling);
  else containerEl.prepend(section);
  queueMicrotask(() => {
    const candidates = Array.from(containerEl.querySelectorAll(":scope > .setting-item"));
    for (const item of candidates) {
      const label = item.textContent || "";
      if (/buy|checkout|refresh balance|sync balance|credit pack/i.test(label)) section.appendChild(item);
    }
    for (const summary of Array.from(containerEl.querySelectorAll('[class*="credit"][class*="summary"], [class*="balance"][class*="summary"]'))) {
      if (!section.contains(summary)) section.appendChild(summary);
    }
  });
}

// preview-gateway.ts
var BASE = "https://app.tutivsoft.com/api/v1";
var codePoints = (text) => Array.from(text).length;
var hosts = /* @__PURE__ */ new WeakMap();
function configureGateway(settings, host) {
  hosts.set(settings, host);
}
function gatewayFor(settings) {
  const host = hosts.get(settings);
  if (!host) throw new Error("Managed execution is not initialized.");
  return host;
}
var digestPattern = /^[a-f0-9]{64}$/;
var previewQuoteResultPlaceholder = "0".repeat(64);
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
  return JSON.stringify(value);
}
function sameDimensions(a, b) {
  return !!a && !!b && canonical(a) === canonical(b);
}
function validateQuote(quote2, expected) {
  var _a2;
  if (!quote2 || !Number.isSafeInteger(quote2.amount) || quote2.amount < 1 || !Number.isSafeInteger(quote2.free_units) || quote2.free_units < 0 || !Number.isSafeInteger(quote2.paid_units) || quote2.paid_units < 0 || quote2.free_units + quote2.paid_units !== quote2.amount || ((_a2 = quote2.legacy_units) != null ? _a2 : 0) !== 0 || quote2.retained_access === true) throw new Error("Invalid AI allowance split; this app requires an exact free/paid quote with no legacy or retained-access units.");
  for (const key of ["event_id", "app_id", "installation_id", "source_digest", "result_digest", "amount"]) if ((expected == null ? void 0 : expected[key]) !== void 0 && quote2[key] !== expected[key]) throw new Error("Allowance quote identity conflicts with this exact operation.");
  if ((expected == null ? void 0 : expected.dimensions) && quote2.dimensions !== void 0 && !sameDimensions(expected.dimensions, quote2.dimensions)) throw new Error("Allowance quote dimensions conflict with this exact operation.");
}
function validateGenerationQuote(quote2, request, host) {
  validateQuote(quote2, { event_id: request.event_id, app_id: host.appId, installation_id: host.installationId, result_digest: previewQuoteResultPlaceholder });
  if (typeof quote2.source_digest !== "string" || !digestPattern.test(quote2.source_digest) || !quote2.dimensions || typeof quote2.dimensions !== "object" || Array.isArray(quote2.dimensions)) throw new Error("Managed quote is missing canonical source or dimensions.");
}
function validateManagedPreview(preview, request, quote2, host) {
  var _a2;
  if (!preview || preview.event_id !== request.event_id || !Number.isSafeInteger(preview.amount) || preview.amount < 1 || typeof preview.source_digest !== "string" || !digestPattern.test(preview.source_digest) || typeof preview.result_digest !== "string" || !digestPattern.test(preview.result_digest) || !preview.dimensions || typeof preview.dimensions !== "object" || Array.isArray(preview.dimensions)) throw new Error("Managed preview identity or digest is incomplete. The exact preview was not accepted.");
  if (quote2 && (preview.source_digest !== quote2.source_digest || preview.amount !== quote2.amount || !sameDimensions(preview.dimensions, quote2.dimensions))) throw new Error("Managed preview does not match the confirmed server quote. Preserve it and reconcile; no new generation was started.");
  const expectedAad = new TextEncoder().encode(`${host.appId}
${request.event_id}`), aad = decode(((_a2 = preview.envelope) == null ? void 0 : _a2.aad) || "");
  if (aad.length !== expectedAad.length || aad.some((b, i) => b !== expectedAad[i])) throw new Error("Managed preview is bound to another app or event.");
}
function validateIdentity(value, host, journal) {
  var _a2, _b2, _c2, _d2;
  const request = journal.request || {}, amount = (_a2 = journal.amount) != null ? _a2 : request.amount, free = (_b2 = journal.free_units) != null ? _b2 : request.expected_free_units, paid = (_c2 = journal.paid_units) != null ? _c2 : request.expected_paid_units, dimensions = (_d2 = journal.dimensions) != null ? _d2 : request.dimensions;
  if ((value == null ? void 0 : value.event_id) !== journal.event_id || value.app_id !== host.appId || value.installation_id !== host.installationId || value.source_digest !== journal.source_digest || value.result_digest !== journal.result_digest || value.amount !== amount || value.free_units !== free || value.paid_units !== paid || value.dimensions !== void 0 && !sameDimensions(value.dimensions, dimensions)) throw new Error("Recovery identity, split, amount, or dimensions conflict.");
}
function decode(value) {
  const raw = atob(value);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
async function digest(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function send(host, path, body, authenticated = false) {
  var _a2, _b2, _c2, _d2;
  const headers = { "Content-Type": "application/json" };
  if (authenticated && !host.state.billingAccessToken && host.state.billingRefreshToken) await refreshBillingSession(host.state, host.persist);
  if (host.state.billingAccessToken) headers.Authorization = `Bearer ${host.state.billingAccessToken}`;
  const request = () => (0, import_obsidian2.requestUrl)({ url: `${BASE}${path}`, method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : void 0, throw: false });
  let response = await request();
  if (response.status === 401 && host.state.billingRefreshToken && await refreshBillingSession(host.state, host.persist)) {
    headers.Authorization = `Bearer ${host.state.billingAccessToken}`;
    response = await request();
  }
  if (response.status < 200 || response.status >= 300) throw new Error(((_b2 = (_a2 = response.json) == null ? void 0 : _a2.detail) == null ? void 0 : _b2.message) || (typeof ((_c2 = response.json) == null ? void 0 : _c2.detail) === "string" ? response.json.detail : `Managed service unavailable (HTTP ${response.status}).`));
  return (_d2 = response.json) == null ? void 0 : _d2.data;
}
async function credential(host) {
  if (host.state.previewInstallationCredential) return host.state.previewInstallationCredential;
  const data = await send(host, "/public/installations", { app_id: host.appId, installation_id: host.installationId });
  if (!(data == null ? void 0 : data.installation_credential)) throw new Error("Installation verification unavailable.");
  host.state.previewInstallationCredential = data.installation_credential;
  await host.persist();
  return data.installation_credential;
}
var memory = /* @__PURE__ */ new WeakMap();
async function managedText(host, input, operation, dimensions = {}, image) {
  const proof = await credential(host);
  let jobs = memory.get(host.state);
  if (!jobs) {
    jobs = /* @__PURE__ */ new Map();
    memory.set(host.state, jobs);
  }
  const id = await digest(JSON.stringify({ input, operation, dimensions, image }));
  let job = jobs.get(id);
  if (job == null ? void 0 : job.validationError) throw new Error(job.validationError);
  if (!job) {
    const event_id = `preview_${crypto.randomUUID()}`;
    const request = { app_id: host.appId, installation_id: host.installationId, installation_credential: proof, event_id, input, operation, dimensions, image };
    let quote2;
    if (host.state.billingAccountLinked && (host.state.billingAccessToken || host.state.billingRefreshToken)) {
      quote2 = await send(host, "/billing/previews/quote", request, true);
      validateGenerationQuote(quote2, request, host);
      if (quote2.allowed === false) throw new Error(quote2.reason || "Allowance unavailable. Choose a smaller selection or purchase; input was not truncated.");
      if (!await new SplitModal(host, quote2).wait()) throw new Error("Generation cancelled before provider dispatch.");
      request.expected_free_units = quote2.free_units;
      request.expected_paid_units = quote2.paid_units;
    }
    const preview = await send(host, "/public/previews", request);
    job = { preview, validationError: "Managed preview identity is unverified. Keep it in memory and contact support; this result cannot be revealed or regenerated." };
    jobs.set(id, job);
    try {
      if (!(preview == null ? void 0 : preview.envelope) || !preview.job_token) throw new Error("Incomplete managed preview response.");
      validateManagedPreview(preview, request, quote2, host);
      job.validationError = void 0;
    } catch (error) {
      job.validationError = error instanceof Error ? error.message : "Managed preview identity is unverified.";
      throw error;
    }
  }
  if (job.full && job.owner === host.state.billingEmail && host.state.billingAccountLinked && host.state.billingAccessToken) return job.full;
  const full = await new PreservedPreviewModal(host, job.preview, proof, job.preview.dimensions).wait();
  job.full = full;
  job.owner = host.state.billingEmail;
  return full;
}
var PreservedPreviewModal = class extends import_obsidian2.Modal {
  constructor(host, preview, proof, dimensions) {
    super(host.app);
    this.host = host;
    this.preview = preview;
    this.proof = proof;
    this.dimensions = dimensions;
    this.settled = false;
  }
  wait() {
    const result = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
    this.open();
    return result;
  }
  onOpen() {
    const root = this.contentEl;
    root.createEl("h2", { text: "Preserved preview" });
    root.createEl("p", { text: "Keep this window and Obsidian open while registering or buying. The exact result stays only in memory. Full reveal uses allowance once; later apply or save is free." });
    const sample = root.createEl("pre", { text: Array.from(this.preview.sample).slice(0, 500).join("") });
    sample.style.whiteSpace = "pre-wrap";
    root.createEl("p", { text: `Estimated native units: ${this.preview.amount}. Constance verifies your lifetime allowance and paid balance before full reveal.` });
    const status = root.createEl("p");
    addBillingAccountSettings(root, { state: this.host.state, appId: this.host.appId, installationId: this.host.installationId, persist: this.host.persist, syncBalance: async () => {
    }, refresh: () => {
      status.setText("Account updated. Reveal the same preview when verified.");
    } });
    addLivePacks(root, this.host);
    const reveal = root.createEl("button", { text: "Authorize and reveal exact result", cls: "mod-cta" });
    let quoted = false;
    let quotedOwner = "";
    let confirmedSplit;
    reveal.onclick = async () => {
      reveal.disabled = true;
      try {
        if (!this.host.state.billingAccessToken && !this.host.state.billingRefreshToken) throw new Error("Register, verify your email, and connect here first. Your preview is preserved.");
        if (!quoted || quotedOwner !== this.host.state.billingEmail) {
          const operation = { app_id: this.host.appId, installation_id: this.host.installationId, installation_credential: this.proof, event_id: this.preview.event_id, amount: this.preview.amount, source_digest: this.preview.source_digest, result_digest: this.preview.result_digest, dimensions: this.dimensions };
          const quote2 = await send(this.host, "/billing/operations/quote", operation, true);
          validateQuote(quote2, operation);
          if (quote2.allowed === false) throw new Error(quote2.reason || "Allowance unavailable. The preview is preserved; choose a smaller selection or purchase.");
          status.setText(`Confirm full reveal: ${quote2.free_units} free + ${quote2.paid_units} paid ${quote2.amount} native units. This is one successful useful operation.`);
          confirmedSplit = quote2;
          quoted = true;
          quotedOwner = this.host.state.billingEmail;
          reveal.setText("Confirm split and reveal exact result");
          return;
        }
        const nonce = decode(this.preview.envelope.nonce), ciphertext = decode(this.preview.envelope.ciphertext), joined = new Uint8Array(new ArrayBuffer(nonce.length + ciphertext.length));
        joined.set(nonce);
        joined.set(ciphertext, nonce.length);
        const envelope_digest = await digest(joined);
        if (envelope_digest !== this.preview.envelope_digest) throw new Error("Preview integrity check failed.");
        if (this.preview.envelope.algorithm !== "AES-GCM" || nonce.length !== 12 || ciphertext.length < 16) throw new Error("Invalid preview encryption metadata.");
        const expected = new TextEncoder().encode(`${this.host.appId}
${this.preview.event_id}`), aad = decode(this.preview.envelope.aad);
        if (aad.length !== expected.length || aad.some((b, i) => b !== expected[i])) throw new Error("Preview belongs to another operation.");
        const result = await send(this.host, `/billing/previews/${encodeURIComponent(this.preview.job_token)}/reveal`, { app_id: this.host.appId, installation_id: this.host.installationId, installation_credential: this.proof, event_id: this.preview.event_id, envelope_digest, expected_free_units: confirmedSplit.free_units, expected_paid_units: confirmedSplit.paid_units }, true);
        if (this.preview.envelope.algorithm !== "AES-GCM") throw new Error("Unsupported preview encryption.");
        if ((result == null ? void 0 : result.event_id) && result.event_id !== this.preview.event_id) throw new Error("Preview authorization belongs to a different operation.");
        if ((result == null ? void 0 : result.state) !== "committed" || result.result_digest !== this.preview.result_digest) throw new Error("Reveal authorization is not committed.");
        const key = await crypto.subtle.importKey("raw", decode(result.key), "AES-GCM", false, ["decrypt"]);
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, key, ciphertext);
        const text = new TextDecoder("utf-8", { fatal: true }).decode(plain);
        if (await digest(text) !== this.preview.result_digest) throw new Error("Result integrity check failed.");
        this.host.state.previewCompletionJournal = { event_id: this.preview.event_id, result_digest: this.preview.result_digest, state: "committed", owner: this.host.state.billingEmail };
        await this.host.persist();
        this.settled = true;
        this.resolve(text);
        this.close();
      } catch (error) {
        quoted = false;
        reveal.setText("Refresh allowance split");
        status.setText(error instanceof Error ? error.message : "Authorization failed. Preview is preserved.");
      } finally {
        reveal.disabled = false;
      }
    };
  }
  onClose() {
    if (!this.settled) {
      this.settled = true;
      this.reject(new Error("Preview closed. No source changes were applied."));
    }
    this.contentEl.empty();
  }
};
function joinCurrentPacks(config, live, appId = config == null ? void 0 : config.app_id) {
  const configured = Array.isArray(config == null ? void 0 : config.one_time_packs) ? config.one_time_packs : [];
  const prices = Array.isArray(live == null ? void 0 : live[appId]) ? live[appId] : [];
  const unit = typeof (config == null ? void 0 : config.credit_unit_name) === "string" && config.credit_unit_name.trim() ? config.credit_unit_name.trim() : "credits";
  return configured.map((pack) => {
    const priceId = typeof pack.price_id === "string" ? pack.price_id : "";
    const price = priceId ? prices.find((item) => (item == null ? void 0 : item.price_id) === priceId && (item == null ? void 0 : item.interval) === "one_time") : void 0;
    const units = Number(pack.credits);
    const available = !!priceId && Number.isSafeInteger(units) && units > 0 && (price == null ? void 0 : price.status) === "active" && price.checkout_available === true && typeof price.amount === "string" && price.amount.length > 0 && (!pack.product_id || price.product_id === pack.product_id);
    return { pack, price, priceId, units, unit, available };
  });
}
function addLivePacks(root, host) {
  const section = root.createDiv();
  const status = section.createEl("p", { text: "Loading current Paddle prices\u2026" });
  void Promise.all([
    send(host, `/apps/${encodeURIComponent(host.appId)}/billing-config`),
    send(host, `/billing/live-prices?app_ids=${encodeURIComponent(host.appId)}`)
  ]).then(([config, live]) => {
    const offers = joinCurrentPacks(config, live, host.appId);
    if (!offers.length) throw new Error("No configured one-time offers.");
    status.setText("Current provider pricing. Final checkout calculates applicable tax.");
    for (const { pack, price, priceId, units, unit, available } of offers) {
      const description = [price == null ? void 0 : price.description, Number.isSafeInteger(units) && units > 0 ? `${units.toLocaleString()} ${unit}` : "", available ? "" : (price == null ? void 0 : price.checkout_unavailable_reason) || "Current price unavailable"].filter(Boolean).join(" \xB7 ");
      const row = new import_obsidian2.Setting(section).setName(pack.name || pack.code || "One-time offer").setDesc(description);
      row.addButton((button) => button.setButtonText(available ? `Buy ${price.amount}` : "Pricing unavailable").setDisabled(!available).onClick(async () => {
        var _a2, _b2, _c2;
        button.setDisabled(true);
        try {
          let pending = host.state.previewPendingCheckout;
          if ((pending == null ? void 0 : pending.owner) && pending.owner !== host.state.billingEmail) throw new Error("Sign in to the account owning the pending purchase.");
          if (pending == null ? void 0 : pending.checkout_id) {
            const status2 = await send(host, `/billing/checkouts/${encodeURIComponent(pending.checkout_id)}`, void 0, true);
            if (status2.settled === true || ["completed", "canceled", "cancelled", "failed", "expired"].includes(status2.status)) {
              host.state.previewPendingCheckout = void 0;
              await host.persist();
              pending = void 0;
            }
          }
          if (pending && pending.price_id && pending.price_id !== priceId) throw new Error("A purchase is pending. Resolve its status before another purchase.");
          const legacyPlan = pending && !pending.price_id ? pending.plan_code : void 0;
          const request = pending || { price_id: priceId, idempotency_key: `checkout_${crypto.randomUUID()}`, owner: host.state.billingEmail };
          host.state.previewPendingCheckout = request;
          await host.persist();
          if (!host.state.billingAccessToken) await refreshBillingSession(host.state, host.persist);
          const oldCheckout = !!legacyPlan;
          const response = await (0, import_obsidian2.requestUrl)({ url: `${BASE}/billing/${oldCheckout ? "checkout" : "checkout-price"}`, method: "POST", headers: { Authorization: `Bearer ${host.state.billingAccessToken}`, "Content-Type": "application/json", "Idempotency-Key": request.idempotency_key }, body: JSON.stringify(oldCheckout ? { app_id: host.appId, installation_id: host.installationId, plan_code: legacyPlan, quantity: 1 } : { app_id: host.appId, installation_id: host.installationId, price_id: request.price_id, quantity: 1 }), throw: false });
          if (response.status < 200 || response.status >= 300) throw new Error(((_b2 = (_a2 = response.json) == null ? void 0 : _a2.detail) == null ? void 0 : _b2.message) || "Checkout unavailable; refresh current prices.");
          const checkout = (_c2 = response.json) == null ? void 0 : _c2.data;
          if (!(checkout == null ? void 0 : checkout.checkout_id)) throw new Error("Checkout is still being confirmed; retry the same purchase to recover it safely.");
          request.checkout_id = String(checkout.checkout_id);
          await host.persist();
          if (typeof checkout.checkout_url === "string" && checkout.checkout_url) window.open(checkout.checkout_url, "_blank", "noopener");
          else new import_obsidian2.Notice("Checkout is still being confirmed. Its status will refresh when you return.");
        } catch (error) {
          new import_obsidian2.Notice(error instanceof Error ? error.message : "Checkout unavailable.");
        } finally {
          button.setDisabled(!available);
        }
      }));
    }
  }).catch(() => status.setText("Pricing temporarily unavailable. Your preview remains available; buying is disabled."));
}
async function reserveLocal(host, input, result, amount, dimensions) {
  var _a2, _b2, _c2;
  const installation_credential = await credential(host), source_digest = await digest(input), result_digest = await digest(result), owner = host.state.billingEmail.trim().toLowerCase();
  const current = host.state.previewWriteJournal, previousRequest = (current == null ? void 0 : current.request) || {}, previousAmount = (_a2 = current == null ? void 0 : current.amount) != null ? _a2 : previousRequest.amount, previousDimensions = (_b2 = current == null ? void 0 : current.dimensions) != null ? _b2 : previousRequest.dimensions;
  const sameContent = !!current && current.source_digest === source_digest && current.result_digest === result_digest && ((_c2 = current.owner) == null ? void 0 : _c2.trim().toLowerCase()) === owner;
  if (sameContent && (previousAmount !== amount || !sameDimensions(previousDimensions, dimensions) || current.app_id && current.app_id !== host.appId || current.installation_id && current.installation_id !== host.installationId)) throw new Error("The preserved result is tied to a different amount or canonical dimensions. Keep the original journal for reconciliation.");
  const same = sameContent;
  if (current && !same && (current.state !== "committed" && (current.state !== "released" || current.mutation_started !== false))) throw new Error("An earlier write requires reconciliation. The original result and journal are preserved.");
  if (same && (current.state === "write_uncertain" || current.mutation_started === true || current.state === "uncertain_released")) throw new Error("A write is uncertain. Reconcile the original journal before retrying; no alternate reservation was created.");
  if (same && current.state === "released" && current.mutation_started !== false) throw new Error("The released result is not confirmed unchanged. Reconcile the original journal before retrying.");
  let event_id = same && current.state !== "released" ? current.event_id : `operation_${crypto.randomUUID()}`;
  let body = { app_id: host.appId, installation_id: host.installationId, installation_credential, event_id, amount, source_digest, result_digest, dimensions };
  let reservation;
  if (same && current.state !== "released") {
    try {
      reservation = await send(host, `/billing/operations/${encodeURIComponent(event_id)}?app_id=${encodeURIComponent(host.appId)}&installation_id=${encodeURIComponent(host.installationId)}`, void 0, true);
      validateIdentity(reservation, host, current);
    } catch (error) {
      if (current.state !== "request_pending") throw error;
      throw new Error("Reservation receipt is pending. Retry status recovery with the original event; no new authorization was sent.");
    }
    if (reservation.state === "released") {
      if (current.mutation_started !== false) throw new Error("The server released this event after a write may have started. Preserve the result and reconcile manually; no replay was started.");
      current.state = "released";
      await host.persist();
      reservation = void 0;
      event_id = `operation_${crypto.randomUUID()}`;
      body = { app_id: host.appId, installation_id: host.installationId, installation_credential, event_id, amount, source_digest, result_digest, dimensions };
    }
  }
  if (!reservation) {
    const quote2 = await send(host, "/billing/operations/quote", body, true);
    validateQuote(quote2, body);
    if (quote2.allowed === false) throw new Error(quote2.reason || "Allowance unavailable. Choose a smaller selection or purchase; input was not truncated.");
    const confirmed = await new SplitModal(host, quote2).wait();
    if (!confirmed) throw new Error("Operation cancelled before reservation.");
    const pending = { event_id, app_id: host.appId, installation_id: host.installationId, amount, free_units: quote2.free_units, paid_units: quote2.paid_units, dimensions, source_digest, result_digest, state: "request_pending", mutation_started: false, owner, request: { ...body, expected_free_units: quote2.free_units, expected_paid_units: quote2.paid_units } };
    host.state.previewWriteJournal = pending;
    await host.persist();
    reservation = await send(host, "/billing/operations/reserve", { ...body, expected_free_units: quote2.free_units, expected_paid_units: quote2.paid_units }, true);
    validateIdentity(reservation, host, pending);
    if (reservation.state === "released") {
      pending.state = "released";
      await host.persist();
      throw new Error("The server released this operation. Nothing was written; refresh and confirm a fresh exact quote before retrying.");
    }
    if (reservation.state !== "reserved" && reservation.state !== "committed") throw new Error("Reservation is not active. The exact result is preserved; reconcile before retrying.");
  }
  const journal = host.state.previewWriteJournal;
  validateIdentity(reservation, host, journal);
  if (reservation.state !== "reserved" && reservation.state !== "committed") throw new Error("Reservation is not active. The exact result is preserved; reconcile before retrying.");
  if (reservation.state === "committed" && journal.mutation_started !== false) throw new Error("This operation already has a committed or uncertain write. Reconcile the original result instead of replaying it.");
  journal.state = reservation.state;
  journal.request = { ...body, expected_free_units: journal.free_units, expected_paid_units: journal.paid_units };
  await host.persist();
  const update = async (action) => {
    const currentJournal = host.state.previewWriteJournal;
    if ((currentJournal == null ? void 0 : currentJournal.event_id) !== event_id) throw new Error("The original operation journal is no longer active; no stale completion was sent.");
    const data = await send(host, `/billing/operations/${encodeURIComponent(event_id)}/${action}`, { app_id: host.appId, installation_id: host.installationId, result_digest }, true);
    validateIdentity(data, host, currentJournal);
    const expected = action === "commit" ? "committed" : "released";
    if (data.state !== expected) throw new Error("The server did not confirm the requested operation state; the recovery journal is unchanged.");
    currentJournal.state = data.state;
    await host.persist();
    return data;
  };
  return { eventId: event_id, source: reservation.paid_units > 0 ? "purchased" : "free", commit: async () => {
    try {
      await update("commit");
      return { kind: "committed" };
    } catch (e) {
      return { kind: "pending" };
    }
  }, rollback: async () => {
    if (host.state.previewWriteJournal.state !== "write_uncertain") await update("release");
  }, markWriteUncertain: async () => {
    const currentJournal = host.state.previewWriteJournal;
    if ((currentJournal == null ? void 0 : currentJournal.event_id) !== event_id) throw new Error("The original operation journal is no longer active; no stale write was started.");
    if (currentJournal.state !== "reserved" && currentJournal.state !== "committed" || currentJournal.mutation_started === true || currentJournal.state === "write_uncertain") throw new Error("No unused operation hold. Nothing was written.");
    currentJournal.mutation_started = true;
    currentJournal.state = "write_uncertain";
    await host.persist();
  } };
}
var SplitModal = class extends import_obsidian2.Modal {
  constructor(host, quote2) {
    super(host.app);
    this.host = host;
    this.quote = quote2;
    this.settled = false;
  }
  wait() {
    const result = new Promise((resolve) => this.resolve = resolve);
    this.open();
    return result;
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "Confirm allowance" });
    this.contentEl.createEl("p", { text: `${this.quote.free_units} free + ${this.quote.paid_units} paid native units${this.quote.legacy_units ? ` + ${this.quote.legacy_units} existing ${this.quote.legacy_unit}` : ""}. Free completion counts once toward your lifetime starter allowance; paid work preserves exhausted trial limits.` });
    this.contentEl.createEl("button", { text: "Confirm", cls: "mod-cta" }).onclick = () => {
      this.settled = true;
      this.resolve(true);
      this.close();
    };
  }
  onClose() {
    if (!this.settled) this.resolve(false);
    this.contentEl.empty();
  }
};
async function reconcileLocal(host, verify) {
  var _a2;
  const journal = host.state.previewWriteJournal;
  if (!journal) return "No pending write.";
  if (((_a2 = journal.owner) == null ? void 0 : _a2.trim().toLowerCase()) !== host.state.billingEmail.trim().toLowerCase()) throw new Error("Sign in to the account that authorized this operation.");
  const status = await send(host, `/billing/operations/${encodeURIComponent(journal.event_id)}?app_id=${encodeURIComponent(host.appId)}&installation_id=${encodeURIComponent(host.installationId)}`, void 0, true);
  validateIdentity(status, host, journal);
  if (["committed", "released"].includes(status.state)) {
    journal.state = status.state;
    await host.persist();
    return status.state;
  }
  const observation = journal.mutation_started === false ? "unchanged" : await verify();
  if (observation === "uncertain") return "Write remains uncertain. Review the preserved recovery journal; no refund or replay was made.";
  const action = observation === "written" ? "commit" : "release";
  const receipt = await send(host, `/billing/operations/${encodeURIComponent(journal.event_id)}/${action}`, { app_id: host.appId, installation_id: host.installationId, result_digest: journal.result_digest }, true);
  validateIdentity(receipt, host, journal);
  const expected = action === "commit" ? "committed" : "released";
  if (receipt.state !== expected) throw new Error("The server did not confirm the requested operation state; the recovery journal is unchanged.");
  journal.state = receipt.state;
  await host.persist();
  return receipt.state;
}

// main.ts
var import_obsidian6 = require("obsidian");

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
  var _a2;
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const normalized = content.replace(/\r\n/g, "\n");
  if (normalized.startsWith("\uFEFF")) return { frontmatter: {}, body: content, hasFrontmatter: normalized.startsWith("\uFEFF---\n"), safe: false, error: "A UTF-8 BOM at the start of the note is not supported safely by this parser.", newline };
  if (!normalized.startsWith("---\n") && normalized !== "---") return { frontmatter: {}, body: content, hasFrontmatter: false, safe: true, newline };
  const closingDelimiter = /\n---[ \t]*(?:\n|$)/g;
  closingDelimiter.lastIndex = 3;
  const closingMatch = closingDelimiter.exec(normalized);
  if (!closingMatch) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: "Frontmatter opening delimiter has no closing delimiter.", newline };
  const header = normalized.slice(4, closingMatch.index);
  const normalizedBody = normalized.slice(closingMatch.index + closingMatch[0].length);
  const body = newline === "\r\n" ? normalizedBody.replace(/\n/g, "\r\n") : normalizedBody;
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
    if (Object.prototype.hasOwnProperty.call(result, key)) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Duplicate property: ${key}`, newline };
    const raw = (_a2 = match[2]) != null ? _a2 : "";
    if (!raw) {
      Object.defineProperty(result, key, { value: [], writable: true, enumerable: true, configurable: true });
      listKey = key;
      continue;
    }
    if (raw.startsWith("{") || raw.endsWith("}")) return { frontmatter: {}, body: content, hasFrontmatter: true, safe: false, error: `Unsupported inline object for property: ${key}`, newline };
    if (raw.startsWith("[") && raw.endsWith("]")) Object.defineProperty(result, key, { value: raw.slice(1, -1).split(",").filter(Boolean).map(scalar), writable: true, enumerable: true, configurable: true });
    else {
      Object.defineProperty(result, key, { value: scalar(raw), writable: true, enumerable: true, configurable: true });
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
  const normalizedBody = body.replace(/\r\n/g, "\n");
  const output = lines.join("\n") + (normalizedBody ? "\n" + normalizedBody : "");
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
  var _a2, _b2, _c2;
  if (!note.safe) return { note, changed: false, reason: (_a2 = note.error) != null ? _a2 : "Unsafe frontmatter" };
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
    fm.tags = unique([...current.tags, ...(_b2 = operation.tags) != null ? _b2 : []]);
  } else if (operation.kind === "remove-tags" || operation.kind === "replace-tag" || operation.kind === "normalize-tags") {
    const current = normalizeTags(fm.tags);
    if (current.malformed) return { note, changed: false, reason: "Malformed tags value" };
    let tags = current.tags;
    if (operation.kind === "remove-tags") tags = tags.filter((tag) => {
      var _a3;
      return !((_a3 = operation.tags) != null ? _a3 : []).includes(tag);
    });
    if (operation.kind === "replace-tag" && operation.fromTag) tags = tags.map((tag) => {
      var _a3, _b3;
      return tag === operation.fromTag ? `${(_a3 = operation.namespace) != null ? _a3 : ""}${(_b3 = operation.toTag) != null ? _b3 : ""}` : tag;
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
  } else if (operation.kind === "reorder" && ((_c2 = operation.order) == null ? void 0 : _c2.length)) {
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
function planOperation(notes, operation, aiUpdates = {}, aiErrors = {}) {
  return notes.map(({ path, content }) => {
    var _a2, _b2;
    const parsed = parseFrontmatter(content);
    if (operation.kind === "format") {
      if (!parsed.safe) return { path, status: "skipped", reason: (_a2 = parsed.error) != null ? _a2 : "Unsafe frontmatter", before: content };
      if (!parsed.hasFrontmatter) return { path, status: "skipped", reason: "No frontmatter", before: content };
      const after = stringifyFrontmatter(parsed.frontmatter, parsed.body, parsed.newline);
      return after === content ? { path, status: "unchanged", before: content } : { path, status: "changed", before: content, after };
    }
    if (operation.kind === "ai-frontmatter") {
      if (!parsed.safe) return { path, status: "skipped", reason: (_b2 = parsed.error) != null ? _b2 : "Unsafe frontmatter", before: content };
      if (aiErrors[path]) return { path, status: "failed", reason: aiErrors[path], before: content };
      const updates = aiUpdates[path];
      if (!updates || Object.keys(updates).length === 0) return { path, status: "skipped", reason: "AI returned no supported properties", before: content };
      const frontmatter = structuredClone(parsed.frontmatter);
      for (const [key, value] of Object.entries(updates)) {
        if (Object.prototype.hasOwnProperty.call(frontmatter, key) && operation.aiConflict !== "replace") continue;
        frontmatter[key] = value;
      }
      const after = stringifyFrontmatter(frontmatter, parsed.body, parsed.newline);
      return after === content ? { path, status: "unchanged", before: content } : { path, status: "changed", before: content, after };
    }
    if (!parsed.hasFrontmatter && operation.kind !== "add-tags") return { path, status: "skipped", reason: "No frontmatter", before: content };
    const result = applyOperation(parsed, operation);
    return { path, status: result.changed ? "changed" : result.reason ? "skipped" : "unchanged", reason: result.reason, conversion: result.conversion, before: content, after: result.changed ? stringifyFrontmatter(result.note.frontmatter, result.note.body, result.note.newline) : void 0 };
  });
}

// billing.ts
var import_obsidian3 = require("obsidian");

// billing-model.ts
var FREE_USES_PER_DAY = 5;
var TUNDRA_CREDIT_PACKS = [{ planCode: "one_time" }, { planCode: "standard" }];
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
    billingRefreshToken: "",
    billingAccessExpiresAt: 0,
    billingAccountLinked: false,
    purchasedCredits: 0,
    freeUsageDate: "",
    freeUsesRemaining: 0,
    pendingCreditSpends: [],
    pendingCheckout: null
  };
}
function normalizeBillingState(state, today) {
  var _a2;
  const next = { ...defaultBillingState(), ...state != null ? state : {} };
  next.purchasedCredits = Math.max(0, Math.floor(Number(next.purchasedCredits) || 0));
  next.billingAccessToken = typeof next.billingAccessToken === "string" ? next.billingAccessToken : "";
  next.billingRefreshToken = typeof next.billingRefreshToken === "string" ? next.billingRefreshToken : "";
  next.billingAccessExpiresAt = Number.isFinite(Number(next.billingAccessExpiresAt)) ? Number(next.billingAccessExpiresAt) : 0;
  next.billingAccountLinked = next.billingAccountLinked === true && Boolean(next.billingAccessToken);
  next.freeUsesRemaining = Math.max(0, Math.min(FREE_USES_PER_DAY, Math.floor(Number(next.freeUsesRemaining) || 0)));
  next.pendingCreditSpends = [...new Set(((_a2 = next.pendingCreditSpends) != null ? _a2 : []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
  if (!next.pendingCheckout || typeof next.pendingCheckout.idempotencyKey !== "string" || typeof next.pendingCheckout.planCode !== "string") next.pendingCheckout = null;
  return next;
}
function isBillableWriteBatch(changedCount) {
  return Number.isFinite(changedCount) && changedCount > 0;
}

// billing.ts
var CONSTANCE_BASE_URL = "https://app.tutivsoft.com";
var CONSTANCE_APP_ID = "tundra-frontmatter-wrangler";
var TUNDRA_PLAN_CODES = {
  usd001: TUNDRA_CREDIT_PACKS[0].planCode,
  usd010: TUNDRA_CREDIT_PACKS[1].planCode
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
  var _a2, _b2, _c2;
  return Math.max(0, Number((_c2 = (_b2 = (_a2 = response.json) == null ? void 0 : _a2.data) == null ? void 0 : _b2.credits) == null ? void 0 : _c2.balance) || 0);
}
async function spendConstanceCredit(plugin, stableEventId) {
  const state = plugin.settings.billing;
  const result = await spendAccountCredits(state, () => plugin.saveSettings(), CONSTANCE_APP_ID, state.deviceId, stableEventId, 1);
  if (result.kind === "auth-required") {
    clearBillingSession(state);
    await plugin.saveSettings();
    new import_obsidian3.Notice("Tundra: your billing session expired. Sign in again.", 5e3);
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
  var _a2;
  for (let attempt = 0; attempt < 12; attempt++) {
    await wait(5e3);
    const state = plugin.settings.billing;
    if (!state.pendingCheckout || state.pendingCheckout.checkoutId !== checkoutId || !state.billingAccessToken && !state.billingRefreshToken) return;
    try {
      const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
        url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(checkoutId)}`,
        method: "GET"
      });
      if (response.status === 401 || response.status === 403) {
        clearBillingSession(state);
        state.pendingCheckout = null;
        await plugin.saveSettings();
        return;
      }
      if (response.status < 200 || response.status >= 300) continue;
      const data = (_a2 = response.json) == null ? void 0 : _a2.data;
      if ((data == null ? void 0 : data.settled) === true) {
        state.pendingCheckout = null;
        await plugin.saveSettings();
        await syncBalance(plugin);
        new import_obsidian3.Notice("Tundra: payment settled and your credit balance was refreshed.", 5e3);
        return;
      }
    } catch (error) {
      console.warn("Tundra: checkout settlement poll failed", error);
    }
  }
}
async function startCheckout(plugin, planCode, openBrowser = true) {
  var _a2, _b2;
  const state = plugin.settings.billing;
  if (!state.billingAccessToken && !state.billingRefreshToken || !state.billingAccountLinked) {
    new import_obsidian3.Notice("Tundra: sign in or create a billing account in plugin settings before buying credits.", 5e3);
    return;
  }
  if (state.pendingCheckout && state.pendingCheckout.planCode !== planCode) {
    new import_obsidian3.Notice("A purchase is pending. Wait for its status before starting another.");
    return;
  }
  const pending = ((_a2 = state.pendingCheckout) == null ? void 0 : _a2.planCode) === planCode ? state.pendingCheckout : { idempotencyKey: generateIdempotencyKey(), planCode };
  state.pendingCheckout = pending;
  await plugin.saveSettings();
  const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
    url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkout`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": pending.idempotencyKey
    },
    body: JSON.stringify({ app_id: CONSTANCE_APP_ID, plan_code: planCode, installation_id: state.deviceId, quantity: 1 })
  });
  if (response.status === 401 || response.status === 403) {
    clearBillingSession(state);
    await plugin.saveSettings();
    new import_obsidian3.Notice("Tundra: your billing session expired. Sign in again.", 5e3);
    return;
  }
  if (response.status < 200 || response.status >= 300) {
    new import_obsidian3.Notice(`Tundra: checkout could not be created (HTTP ${response.status}).`, 5e3);
    return;
  }
  const data = (_b2 = response.json) == null ? void 0 : _b2.data;
  const checkoutId = String((data == null ? void 0 : data.checkout_id) || (data == null ? void 0 : data.id) || "");
  const checkoutUrl = String((data == null ? void 0 : data.checkout_url) || "");
  if (!checkoutId || !checkoutUrl) {
    new import_obsidian3.Notice("Tundra: Constance returned an incomplete checkout response.", 5e3);
    return;
  }
  state.pendingCheckout = { ...pending, checkoutId };
  await plugin.saveSettings();
  if (openBrowser) window.open(checkoutUrl, "_blank", "noopener");
  void pollCheckoutSettlement(plugin, checkoutId);
}
function resumePendingCheckout(plugin) {
  const pending = plugin.settings.billing.pendingCheckout;
  if (!pending) return;
  if (pending.checkoutId) void pollCheckoutSettlement(plugin, pending.checkoutId);
  else void startCheckout(plugin, pending.planCode, false);
}
function isBillableApply(changedCount) {
  return isBillableWriteBatch(changedCount);
}
async function syncBalance(plugin) {
  plugin.settings.billing = ensureBillingState(plugin.settings.billing);
  const state = plugin.settings.billing;
  if (!state.billingAccessToken && !state.billingRefreshToken || !state.billingAccountLinked) return { kind: "error" };
  try {
    const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
      url: `${CONSTANCE_BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: CONSTANCE_APP_ID, installation_id: state.deviceId }).toString()}`,
      method: "GET"
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      clearBillingSession(state);
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

// plugin-support.ts
var import_obsidian4 = require("obsidian");
var SAFE_DETAIL_KEYS = /* @__PURE__ */ new Set([
  "version",
  "operation",
  "scope",
  "selectedCount",
  "total",
  "changed",
  "skipped",
  "failed",
  "unchanged",
  "reviewEnabled",
  "fieldCount",
  "noteChars",
  "httpStatus",
  "errorType",
  "outcome",
  "restored",
  "authorizationSource",
  "cancelled",
  "line",
  "column",
  "settingCount",
  "attempt",
  "attempts",
  "queueCount",
  "itemCount",
  "fileCount",
  "imageCount",
  "stage",
  "category",
  "status",
  "durationMs",
  "elapsedMs"
]);
function safeString(value) {
  if (value.length <= 120 && /^[A-Za-z0-9 _=.,:-]*$/.test(value) && !/(?:sk-[A-Za-z0-9]|bearer|api.?key|token|secret)/i.test(value)) {
    return value;
  }
  return "[omitted]";
}
function safeDetail(value) {
  if (value instanceof Error) return JSON.stringify({ errorType: safeString(value.name || "Error") });
  if (!value || typeof value !== "object" || Array.isArray(value)) return "[detail omitted]";
  const safe = {};
  for (const [key, item] of Object.entries(value)) {
    if (!SAFE_DETAIL_KEYS.has(key)) continue;
    if (typeof item === "string") safe[key] = safeString(item);
    else if (typeof item === "number" && Number.isFinite(item)) safe[key] = item;
    else if (typeof item === "boolean" || item === null) safe[key] = item;
  }
  return JSON.stringify(safe);
}
function safeErrorType(error) {
  if (error instanceof Error) return safeString(error.name || "Error");
  return safeString(typeof error);
}
var DocumentationModal = class extends import_obsidian4.Modal {
  constructor(app, docs) {
    super(app);
    this.docs = docs;
  }
  onOpen() {
    this.titleEl.setText(this.docs.name + " documentation");
    this.contentEl.createEl("p", { text: this.docs.summary });
    const addSection = (title, items) => {
      this.contentEl.createEl("h3", { text: title });
      const list = this.contentEl.createEl("ol");
      for (const item of items) list.createEl("li", { text: item });
    };
    addSection("Quick start", this.docs.quickStart);
    addSection("Useful commands", Array.from(/* @__PURE__ */ new Set([...this.docs.commands, "Copy full debug log"])));
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
    this.maxEntries = 1e3;
    this.droppedEntries = 0;
    this.started = false;
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.info("plugin.loaded", { version: this.plugin.manifest.version });
    this.plugin.registerDomEvent(window, "error", (event) => {
      const error = event.error;
      this.error("runtime.error", {
        errorType: error instanceof Error ? error.name : "ErrorEvent",
        line: event.lineno,
        column: event.colno
      });
    });
    this.plugin.registerDomEvent(window, "unhandledrejection", (event) => {
      this.error("runtime.unhandled_rejection", { errorType: safeErrorType(event.reason) });
    });
    const addCommand = this.plugin.addCommand.bind(this.plugin);
    const registerCommand = (command) => addCommand(this.instrumentCommand(command));
    registerCommand({
      id: "open-documentation",
      name: "Open documentation",
      callback: () => new DocumentationModal(this.plugin.app, this.docs).open()
    });
    registerCommand({
      id: "copy-debug-log",
      name: "Copy full debug log",
      callback: () => this.copyDiagnostics()
    });
    registerCommand({
      id: "open-plugin-settings",
      name: "Open plugin settings",
      callback: () => {
        const setting = this.plugin.app.setting;
        setting == null ? void 0 : setting.open();
        setting == null ? void 0 : setting.openTabById(this.plugin.manifest.id);
      }
    });
    this.instrumentFutureCommands(addCommand);
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
  addDiagnosticsSetting(containerEl) {
    new import_obsidian4.Setting(containerEl).setName("Diagnostics").setDesc("Copy up to the latest 1,000 events recorded by this plugin. Logs reset when the plugin reloads. Note contents, paths, credentials, and raw error messages are excluded.").addButton((button) => button.setButtonText("Copy full log").onClick(() => {
      void this.copyDiagnostics();
    }));
  }
  instrumentFutureCommands(addCommand) {
    const originalDescriptor = Object.getOwnPropertyDescriptor(this.plugin, "addCommand");
    Object.defineProperty(this.plugin, "addCommand", {
      configurable: true,
      writable: true,
      value: (command) => addCommand(this.instrumentCommand(command))
    });
    this.plugin.register(() => {
      if (originalDescriptor) Object.defineProperty(this.plugin, "addCommand", originalDescriptor);
      else Reflect.deleteProperty(this.plugin, "addCommand");
    });
  }
  instrumentCommand(command) {
    const instrument = (callback) => (...args) => this.trackCommand(command.id, () => callback.apply(command, args));
    return {
      ...command,
      callback: command.callback ? instrument(command.callback) : void 0,
      editorCallback: command.editorCallback ? instrument(command.editorCallback) : void 0,
      checkCallback: command.checkCallback ? (checking) => checking ? command.checkCallback(checking) : this.trackCommand(command.id, () => command.checkCallback(checking)) : void 0,
      editorCheckCallback: command.editorCheckCallback ? (checking, editor, context) => checking ? command.editorCheckCallback(checking, editor, context) : this.trackCommand(command.id, () => command.editorCheckCallback(checking, editor, context)) : void 0
    };
  }
  trackCommand(commandId, action) {
    const startedAt = Date.now();
    this.info("command.started", { operation: commandId });
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        return Promise.resolve(result).then(
          (value) => {
            this.info("command.completed", { operation: commandId, durationMs: Date.now() - startedAt });
            return value;
          },
          (error) => {
            this.error("command.failed", { operation: commandId, errorType: safeErrorType(error), durationMs: Date.now() - startedAt });
            throw error;
          }
        );
      }
      this.info("command.completed", { operation: commandId, durationMs: Date.now() - startedAt });
      return result;
    } catch (error) {
      this.error("command.failed", { operation: commandId, errorType: safeErrorType(error), durationMs: Date.now() - startedAt });
      throw error;
    }
  }
  record(level, event, detail) {
    var _a2;
    const safeEvent = /^[a-z0-9][a-z0-9._-]{0,99}$/i.test(event) ? event : "invalid_event";
    const entry = { at: (/* @__PURE__ */ new Date()).toISOString(), level, event: safeEvent };
    if (detail !== void 0) entry.detail = safeDetail(detail);
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      const removed = this.entries.length - this.maxEntries;
      this.entries.splice(0, removed);
      this.droppedEntries += removed;
    }
    const method = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
    method.call(console, "[" + this.docs.name + "] " + entry.event, (_a2 = entry.detail) != null ? _a2 : "");
  }
  async copyDiagnostics() {
    this.info("diagnostics.copy_requested", { total: this.entries.length + 1 });
    const captured = (/* @__PURE__ */ new Date()).toISOString();
    const snapshot = this.entries.slice();
    const header = [
      "Plugin debug log",
      "Log scope: this plugin, since its most recent load",
      "Plugin: " + this.docs.name,
      "Plugin ID: " + this.plugin.manifest.id,
      "Version: " + this.plugin.manifest.version,
      "Captured: " + captured,
      "User agent: " + navigator.userAgent,
      "Events included: " + snapshot.length,
      "Older events omitted: " + this.droppedEntries,
      ""
    ];
    const text = header.concat(snapshot.map(
      (entry) => entry.at + " [" + entry.level.toUpperCase() + "] " + entry.event + (entry.detail ? " \u2014 " + entry.detail : "")
    )).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      this.info("diagnostics.copy_succeeded", { total: snapshot.length });
      const omitted = this.droppedEntries ? "; " + this.droppedEntries + " older events omitted" : "";
      new import_obsidian4.Notice(this.docs.name + ": copied " + snapshot.length + " log events" + omitted + ".");
    } catch (error) {
      this.error("diagnostics.copy_failed", { errorType: safeErrorType(error) });
      new import_obsidian4.Notice(this.docs.name + ": could not copy the debug log.");
    }
  }
};

// ai-frontmatter.ts
var DEFAULT_AI_TIER = "standard";
var MAX_AI_TAGS = 20;
var AI_FIELD_TIERS = {
  "bare-minimum": ["title", "summary", "tags", "image"],
  standard: ["title", "summary", "tags", "image", "aliases", "type", "date", "status", "source"],
  advanced: [
    "title",
    "summary",
    "tags",
    "image",
    "aliases",
    "type",
    "date",
    "status",
    "source",
    "author",
    "identifier",
    "citation",
    "project",
    "people",
    "organization",
    "location",
    "start",
    "end",
    "priority",
    "language",
    "url"
  ],
  huge: [
    "title",
    "summary",
    "tags",
    "image",
    "aliases",
    "type",
    "date",
    "status",
    "source",
    "author",
    "identifier",
    "citation",
    "project",
    "people",
    "organization",
    "location",
    "start",
    "end",
    "priority",
    "language",
    "url",
    "publisher",
    "contributor",
    "rights",
    "license",
    "format",
    "relation",
    "audience",
    "confidence",
    "reviewed",
    "reviewer",
    "version",
    "publish",
    "cssclasses",
    "permalink",
    "slug",
    "edition",
    "volume",
    "issue",
    "page",
    "chapter",
    "duration",
    "transcript",
    "ocr_status",
    "page_count",
    "accessed",
    "method",
    "purpose",
    "due",
    "completed"
  ]
};
var AI_TIER_LABELS = {
  "bare-minimum": "Bare Minimum (4 properties)",
  standard: "Standard (9 properties)",
  advanced: "Advanced (21 properties)",
  huge: "Huge (50 properties)"
};
function normalizeTag(value) {
  return value.trim().replace(/^#+/, "").replace(/\\/g, "/").toLowerCase().replace(/\s+/g, "-").replace(/\/{2,}/g, "/").replace(/^\/+|\/+$/g, "").split("/").map((part) => part.replace(/-+/g, "-").replace(/^-+|-+$/g, "")).filter(Boolean).join("/");
}
function normalizeSuggestedTags(value, limit = MAX_AI_TAGS) {
  if (limit <= 0) return [];
  const candidates = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const tags = [];
  const seen = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const tag = normalizeTag(candidate);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= limit) break;
  }
  return tags;
}
function sanitizeAiFrontmatter(decoded, fields, noteBody, existingProperties) {
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
  const allowed = new Set(fields);
  const result = {};
  for (const [key, value] of Object.entries(decoded)) {
    if (!allowed.has(key)) continue;
    if (key === "tags") {
      const tags = normalizeSuggestedTags(value);
      if (tags.length) result.tags = tags;
      continue;
    }
    if (key === "image") {
      if (typeof value !== "string" || !value.trim()) continue;
      const image = value.trim();
      const existingImage = existingProperties.image;
      const hasExistingImage = typeof existingImage === "string" ? existingImage.includes(image) : Array.isArray(existingImage) && existingImage.some((item) => typeof item === "string" && item.includes(image));
      if (noteBody.includes(image) || hasExistingImage) result.image = image;
      continue;
    }
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[key] = value;
    } else if (Array.isArray(value) && value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) {
      result[key] = value;
    }
  }
  return result;
}

// ai-request-queue.ts
var import_obsidian5 = require("obsidian");
var AiRequestQueue = class extends import_obsidian5.Modal {
  constructor(app, appName) {
    super(app);
    this.appName = appName;
    this.pending = [];
    this.active = null;
    this.running = false;
    this.opened = false;
    this.nextId = 1;
    this.timer = null;
    this.lastCompletion = "";
  }
  onOpen() {
    this.opened = true;
    this.startTimer();
    this.render();
  }
  onClose() {
    this.opened = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.contentEl.empty();
  }
  enqueue(label, submittedText, run) {
    return new Promise((resolve) => {
      const job = {
        id: this.nextId++,
        label,
        submittedText,
        queuedAt: Date.now(),
        statusLabel: "Waiting",
        run,
        resolve
      };
      this.pending.push(job);
      if (!this.opened) this.open();
      this.render();
      void this.drain();
    });
  }
  startTimer() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.render(), 1e3);
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length) {
        const job = this.pending.shift();
        this.active = job;
        job.startedAt = Date.now();
        job.statusLabel = "Preparing request";
        this.render();
        const report = (update) => {
          var _a2;
          if (((_a2 = this.active) == null ? void 0 : _a2.id) !== job.id) return;
          if (update.label !== void 0) job.statusLabel = update.label;
          if (update.submittedText !== void 0) job.submittedText = update.submittedText;
          if (update.current !== void 0) job.current = update.current;
          if (update.total !== void 0) job.total = update.total;
          this.render();
        };
        try {
          const value = await job.run(report);
          const elapsed = Math.max(0, Math.floor((Date.now() - job.startedAt) / 1e3));
          this.lastCompletion = `${job.label} completed in ${elapsed} second${elapsed === 1 ? "" : "s"}.`;
          new import_obsidian5.Notice(`${this.appName}: ${this.lastCompletion}`, 4e3);
          job.resolve({ status: "completed", value });
        } catch (error) {
          const elapsed = Math.max(0, Math.floor((Date.now() - job.startedAt) / 1e3));
          const detail = error instanceof Error ? error.message : "Unknown error";
          this.lastCompletion = `${job.label} failed after ${elapsed} second${elapsed === 1 ? "" : "s"}: ${detail}`;
          new import_obsidian5.Notice(`${this.appName}: ${job.label} failed. ${detail}`, 6e3);
          job.resolve({ status: "failed", error });
        } finally {
          this.active = null;
          this.render();
        }
      }
    } finally {
      this.running = false;
    }
  }
  clearWaiting() {
    const removed = this.pending.splice(0);
    for (const job of removed) job.resolve({ status: "cleared" });
    if (removed.length) {
      this.lastCompletion = `${removed.length} waiting AI request${removed.length === 1 ? " was" : "s were"} removed.`;
      new import_obsidian5.Notice(`${this.appName}: cleared ${removed.length} waiting AI request${removed.length === 1 ? "" : "s"}.`, 4e3);
      this.render();
    }
  }
  render() {
    var _a2;
    if (!this.opened) return;
    const root = this.contentEl;
    root.empty();
    root.createEl("h2", { text: `${this.appName} AI request queue` });
    if (this.active) {
      const elapsed = Math.max(0, Math.floor((Date.now() - ((_a2 = this.active.startedAt) != null ? _a2 : Date.now())) / 1e3));
      const active = root.createDiv();
      active.createEl("h3", { text: `Processing: ${this.active.label}` });
      active.createEl("p", { text: `${this.active.statusLabel} \xB7 ${elapsed} second${elapsed === 1 ? "" : "s"} elapsed${this.active.current && this.active.total ? ` \xB7 ${this.active.current}/${this.active.total}` : ""}` });
      active.createEl("p", { text: "Text sent to AI (excerpt)" });
      const excerpt = active.createEl("pre", { text: this.active.submittedText.trim().slice(0, 320) || "Preparing the text to send\u2026" });
      excerpt.style.whiteSpace = "pre-wrap";
      excerpt.style.maxHeight = "12em";
      excerpt.style.overflow = "auto";
    } else {
      root.createEl("p", { text: "No AI request is processing." });
    }
    root.createEl("h3", { text: `Waiting (${this.pending.length})` });
    if (!this.pending.length) root.createEl("p", { text: "The waiting queue is empty." });
    for (const [index, job] of this.pending.entries()) {
      const item = root.createDiv();
      item.createEl("p", { text: `${index + 1}. ${job.label}` });
      item.createEl("pre", { text: job.submittedText.trim().slice(0, 180) || "Text will be shown when this request starts." }).style.whiteSpace = "pre-wrap";
    }
    if (this.lastCompletion) root.createEl("p", { text: this.lastCompletion });
    const footer = root.createDiv();
    new import_obsidian5.ButtonComponent(footer).setButtonText("Clear waiting requests").setWarning().setDisabled(this.pending.length === 0).onClick(() => this.clearWaiting());
    new import_obsidian5.ButtonComponent(footer).setButtonText("Close").onClick(() => this.close());
    root.createEl("p", { text: "Clearing removes waiting requests. The active request will finish." }).style.color = "var(--text-muted)";
  }
};

// main.ts
var DEFAULT_SETTINGS = { billing: defaultBillingState(), settingsMode: "simple", aiModel: "openai/gpt-5-mini", aiTier: DEFAULT_AI_TIER, aiConflict: "keep", reviewBeforeApply: true, defaultOperation: { kind: "ai-frontmatter", aiTier: DEFAULT_AI_TIER, aiFields: [...AI_FIELD_TIERS[DEFAULT_AI_TIER]], aiConflict: "keep" } };
function defaultOperation(kind, settings) {
  if (kind === "ai-frontmatter") return { kind, aiTier: settings.aiTier, aiFields: [...AI_FIELD_TIERS[settings.aiTier]], aiConflict: settings.aiConflict };
  if (kind === "rename") return { kind, oldKey: "", newKey: "", collision: "skip" };
  if (kind === "remove") return { kind, oldKey: "" };
  if (kind === "add-tags" || kind === "remove-tags") return { kind, tags: [] };
  if (kind === "replace-tag") return { kind, fromTag: "", toTag: "" };
  if (kind === "normalize-tags") return { kind, rules: "lowercase, spaces to hyphens, slash separators" };
  if (kind === "reorder") return { kind, order: [], unknownPosition: "after" };
  return { kind };
}
var TundraPlugin = class extends import_obsidian6.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_SETTINGS };
  }
  async onload() {
    this.support = new PluginSupport(this, { name: "Tundra Frontmatter Wrangler", summary: "Run configured frontmatter changes directly, with optional review and rollback.", quickStart: ["Set a default operation and its values in plugin settings.", "Choose Apply configured operation for the current note or folder.", "Review the before/after plan, then confirm the batch."], commands: ["Apply configured operation to current note", "Apply configured operation to current folder", "Open frontmatter wrangler", "Open documentation", "Copy full debug log"], troubleshooting: ["Use Copy full debug log before reporting a problem.", "Reopen the wrangler if a note changes while the operation is running."] });
    this.support.start();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.billing = ensureBillingState(this.settings.billing);
    const gatewayPlugin = this;
    configureGateway(this.settings, { app: this.app, appId: "tundra-frontmatter-wrangler", installationId: this.settings.billing.deviceId, get state() {
      return gatewayPlugin.settings.billing;
    }, persist: () => this.saveSettings() });
    delete this.settings.aiApiKey;
    this.settings.settingsMode = this.settings.settingsMode === "advanced" ? "advanced" : "simple";
    this.settings.aiModel = typeof this.settings.aiModel === "string" && this.settings.aiModel.trim() ? this.settings.aiModel : DEFAULT_SETTINGS.aiModel;
    await this.saveSettings();
    this.aiQueue = new AiRequestQueue(this.app, "Tundra");
    this.support.info("settings.loaded", { operation: this.settings.defaultOperation.kind, reviewEnabled: this.settings.reviewBeforeApply });
    void retryPendingCreditSpends(this);
    resumePendingCheckout(this);
    this.addCommand({ id: "open-wrangle", name: "Open frontmatter wrangler", callback: () => new WranglerModal(this.app, this).open() });
    this.addCommand({ id: "open-wrangle-current-note", name: "Open frontmatter wrangler for current note", checkCallback: (checking) => {
      const file = this.app.workspace.getActiveFile();
      if (checking) return !!file;
      if (file) new WranglerModal(this.app, this, { file }).open();
      return true;
    } });
    this.addCommand({ id: "open-wrangle-current-folder", name: "Open frontmatter wrangler for current folder", checkCallback: (checking) => {
      var _a2;
      const folder = (_a2 = this.app.workspace.getActiveFile()) == null ? void 0 : _a2.parent;
      if (checking) return !!(folder == null ? void 0 : folder.path);
      if (folder) new WranglerModal(this.app, this, { folder }).open();
      return true;
    } });
    this.addCommand({ id: "apply-configured-current-note", name: "Apply configured operation to current note", checkCallback: (checking) => {
      const file = this.app.workspace.getActiveFile();
      if (checking) return !!file;
      if (file) this.applyConfigured({ file });
      return true;
    } });
    this.addCommand({ id: "apply-configured-current-folder", name: "Apply configured operation to current folder", checkCallback: (checking) => {
      var _a2;
      const folder = (_a2 = this.app.workspace.getActiveFile()) == null ? void 0 : _a2.parent;
      if (checking) return !!(folder == null ? void 0 : folder.path);
      if (folder) this.applyConfigured({ folder });
      return true;
    } });
    this.addCommand({ id: "show-ai-request-queue", name: "Show AI request queue", callback: () => this.aiQueue.open() });
    this.addRibbonIcon("wrench", "Open frontmatter wrangler", () => new WranglerModal(this.app, this).open());
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => this.addFileMenuItems(menu, file)));
    this.registerEvent(this.app.workspace.on("files-menu", (menu, files) => this.addFilesMenuItems(menu, files)));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => {
      const file = info.file;
      if (file instanceof import_obsidian6.TFile && file.extension.toLowerCase() === "md") this.addNoteMenuItem(menu, file);
    }));
    this.addSettingTab(new TundraSettingTab(this.app, this));
  }
  addNoteMenuItem(menu, file) {
    if (file.extension.toLowerCase() !== "md") return;
    menu.addItem((item) => item.setTitle("Tundra: Update frontmatter for this note").setIcon("wand-sparkles").onClick(() => this.applyConfigured({ file })));
  }
  addFileMenuItems(menu, file) {
    if (file instanceof import_obsidian6.TFile) this.addNoteMenuItem(menu, file);
    else if (file instanceof import_obsidian6.TFolder && file.path) menu.addItem((item) => item.setTitle("Tundra: Update frontmatter in this folder").setIcon("folder-cog").onClick(() => this.applyConfigured({ folder: file })));
  }
  addFilesMenuItems(menu, selected) {
    const paths = /* @__PURE__ */ new Set();
    for (const entry of selected) {
      if (entry instanceof import_obsidian6.TFile && entry.extension.toLowerCase() === "md") paths.add(entry.path);
      else if (entry instanceof import_obsidian6.TFolder) {
        for (const file of this.app.vault.getMarkdownFiles()) if (file.path.startsWith(`${entry.path}/`)) paths.add(file.path);
      }
    }
    const files = [...paths].map((path) => this.app.vault.getAbstractFileByPath(path)).filter((file) => file instanceof import_obsidian6.TFile);
    if (files.length) menu.addItem((item) => item.setTitle(`Tundra: Update frontmatter for ${files.length} selected note${files.length === 1 ? "" : "s"}`).setIcon("wand-sparkles").onClick(() => this.applyConfigured({ files })));
  }
  applyConfigured(target) {
    var _a2, _b2;
    const scope = target.files ? "selection" : target.folder ? "folder" : "note";
    this.support.info("operation.requested", { operation: this.settings.defaultOperation.kind, scope, selectedCount: (_b2 = (_a2 = target.files) == null ? void 0 : _a2.length) != null ? _b2 : target.file ? 1 : 0, reviewEnabled: this.settings.reviewBeforeApply });
    const modal = new WranglerModal(this.app, this, target, true);
    if (this.settings.reviewBeforeApply) modal.open();
    else void modal.runConfiguredDirectly();
  }
  async saveSettings() {
    if (!(this.settings.aiTier in AI_FIELD_TIERS)) this.settings.aiTier = DEFAULT_AI_TIER;
    if (this.settings.aiConflict !== "replace") this.settings.aiConflict = "keep";
    await this.saveData(this.settings);
  }
};
var TundraSettingTab = class extends import_obsidian6.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Tundra Frontmatter Wrangler" });
    containerEl.createEl("p", { text: "Review deterministic or AI-assisted metadata proposals. Every write is journaled for rollback." });
    new import_obsidian6.Setting(containerEl).setName("Open wrangler").setDesc("Review and apply a bulk operation").addButton((b) => b.setButtonText("Open").setCta().onClick(() => new WranglerModal(this.app, this.plugin).open()));
    new import_obsidian6.Setting(containerEl).setName("Settings mode").setDesc("Simple shows everyday metadata preferences. Advanced adds model and operation details.").addDropdown((d) => d.addOptions({ simple: "Simple", advanced: "Advanced" }).setValue(this.plugin.settings.settingsMode).onChange(async (value) => {
      this.plugin.settings.settingsMode = value;
      await this.plugin.saveSettings();
      this.display();
    }));
    const advanced = this.plugin.settings.settingsMode === "advanced";
    if (advanced) this.plugin.support.addDiagnosticsSetting(containerEl);
    new import_obsidian6.Setting(containerEl).setName("AI request queue").setDesc("View the active request and waiting frontmatter runs, or remove waiting runs.").addButton((button) => button.setButtonText("Show queue").onClick(() => this.plugin.aiQueue.open()));
    const billing = this.plugin.settings.billing;
    addBillingAccountSettings(containerEl, { state: billing, appId: "tundra-frontmatter-wrangler", installationId: billing.deviceId, appVersion: this.plugin.manifest.version, persist: () => this.plugin.saveSettings(), syncBalance: async () => {
      await syncBalance(this.plugin);
    }, refresh: () => this.display() });
    new import_obsidian6.Setting(containerEl).setName("Credits").setDesc(`${billing.freeUsesRemaining} of ${FREE_USES_PER_DAY} lifetime free apply batches remain (server verified) \xB7 ${billing.purchasedCredits} purchased credits in the local mirror.`).addButton((button) => button.setButtonText("Sync balance").onClick(async () => {
      button.setDisabled(true);
      try {
        const result = await syncBalance(this.plugin);
        new import_obsidian6.Notice(result.kind === "ok" ? `Tundra: synced ${result.balance} purchased credits.` : "Tundra: could not sync the purchased-credit balance.", result.kind === "ok" ? 3e3 : 5e3);
        this.display();
      } catch (e) {
        new import_obsidian6.Notice("Tundra: balance refresh failed. Check your connection and retry.");
      } finally {
        button.setDisabled(false);
      }
    }));
    containerEl.createEl("h3", { text: "AI frontmatter" });
    containerEl.createEl("p", { text: "AI suggestions use OpenRouter. Note content and current frontmatter are sent only when you choose the AI operation and confirm the request. AI access is managed by TutivSoft; no personal API key is needed." });
    if (advanced) new import_obsidian6.Setting(containerEl).setName("Managed model").setDesc("Constance chooses the authorized economical model and bounded output.");
    new import_obsidian6.Setting(containerEl).setName("Default AI field tier").setDesc("Used automatically when generating frontmatter. Standard is the recommended balance.").addDropdown((dropdown) => dropdown.addOptions(AI_TIER_LABELS).setValue(this.plugin.settings.aiTier).onChange(async (value) => {
      this.plugin.settings.aiTier = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("Existing AI properties").setDesc("Keep existing values by default, or replace them with suggestions.").addDropdown((dropdown) => dropdown.addOptions({ keep: "Keep existing values", replace: "Replace with suggestions" }).setValue(this.plugin.settings.aiConflict).onChange(async (value) => {
      this.plugin.settings.aiConflict = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("Review before applying").setDesc("Recommended: inspect before/after changes and confirm each batch. Turn off only to apply configured operations immediately.").addToggle((toggle) => toggle.setValue(this.plugin.settings.reviewBeforeApply).onChange(async (value) => {
      this.plugin.settings.reviewBeforeApply = value;
      await this.plugin.saveSettings();
    }));
    const operationNames = { "ai-frontmatter": "Generate frontmatter", format: "Clean formatting", "add-tags": "Add tags", "remove-tags": "Remove tags", "replace-tag": "Replace a tag", "normalize-tags": "Normalize tags", rename: "Rename a property", remove: "Remove a property", reorder: "Reorder properties" };
    if (advanced) new import_obsidian6.Setting(containerEl).setName("Default operation").setDesc("Used by the Apply configured operation commands. Configure its values below.").addDropdown((dropdown) => dropdown.addOptions(Object.fromEntries(Object.entries(operationNames).map(([key, value]) => [key, value]))).setValue(this.plugin.settings.defaultOperation.kind).onChange(async (value) => {
      this.plugin.settings.defaultOperation = defaultOperation(value, this.plugin.settings);
      await this.plugin.saveSettings();
      this.display();
    }));
    const savedOperation = this.plugin.settings.defaultOperation;
    const saveOperationText = (key, value) => {
      if (key === "tags" || key === "order") savedOperation[key] = value.split(",").map((item) => item.trim()).filter(Boolean);
      else savedOperation[key] = value;
      void this.plugin.saveSettings();
    };
    if (advanced && ["rename", "remove"].includes(savedOperation.kind)) new import_obsidian6.Setting(containerEl).setName("Property key").setDesc("Existing property name, for example status.").addText((text) => {
      var _a2;
      return text.setValue((_a2 = savedOperation.oldKey) != null ? _a2 : "").onChange((value) => saveOperationText("oldKey", value));
    });
    if (advanced && savedOperation.kind === "rename") new import_obsidian6.Setting(containerEl).setName("New property key").setDesc("Replacement property name, for example workflow_status.").addText((text) => {
      var _a2;
      return text.setValue((_a2 = savedOperation.newKey) != null ? _a2 : "").onChange((value) => saveOperationText("newKey", value));
    });
    if (advanced && ["add-tags", "remove-tags"].includes(savedOperation.kind)) new import_obsidian6.Setting(containerEl).setName("Tags").setDesc("Comma-separated tags, for example project, meeting.").addText((text) => {
      var _a2;
      return text.setValue(((_a2 = savedOperation.tags) != null ? _a2 : []).join(", ")).onChange((value) => saveOperationText("tags", value));
    });
    if (advanced && savedOperation.kind === "replace-tag") new import_obsidian6.Setting(containerEl).setName("From tag").setDesc("Exact tag to replace, for example work/old.").addText((text) => {
      var _a2;
      return text.setValue((_a2 = savedOperation.fromTag) != null ? _a2 : "").onChange((value) => saveOperationText("fromTag", value));
    });
    if (advanced && savedOperation.kind === "replace-tag") new import_obsidian6.Setting(containerEl).setName("To tag").setDesc("Replacement tag, for example work/current.").addText((text) => {
      var _a2;
      return text.setValue((_a2 = savedOperation.toTag) != null ? _a2 : "").onChange((value) => saveOperationText("toTag", value));
    });
    if (advanced && savedOperation.kind === "normalize-tags") new import_obsidian6.Setting(containerEl).setName("Tag namespace").setDesc("Optional prefix for normalized tags, for example work.").addText((text) => {
      var _a2;
      return text.setValue((_a2 = savedOperation.namespace) != null ? _a2 : "").onChange((value) => saveOperationText("namespace", value));
    });
    if (advanced && savedOperation.kind === "normalize-tags") new import_obsidian6.Setting(containerEl).setName("Tag normalization rules").setDesc("Choose how existing tags are normalized. All rules converts Work Notes to work-notes and backslashes to slashes.").addDropdown((d) => {
      var _a2, _b2;
      return d.addOptions({ [(_a2 = savedOperation.rules) != null ? _a2 : "lowercase, spaces to hyphens, slash separators"]: "Current saved rules", "lowercase, spaces to hyphens, slash separators": "All rules (recommended)", "lowercase": "Lowercase only", "spaces to hyphens": "Spaces to hyphens only", "slash separators": "Slash separators only", "lowercase, spaces to hyphens": "Lowercase and hyphens", "lowercase, slash separators": "Lowercase and slashes", "spaces to hyphens, slash separators": "Hyphens and slashes" }).setValue((_b2 = savedOperation.rules) != null ? _b2 : "lowercase, spaces to hyphens, slash separators").onChange((value) => saveOperationText("rules", value));
    });
    if (advanced && savedOperation.kind === "reorder") new import_obsidian6.Setting(containerEl).setName("Preferred property order").setDesc("Comma-separated property names, for example title, status, tags.").addText((text) => {
      var _a2;
      return text.setValue(((_a2 = savedOperation.order) != null ? _a2 : []).join(", ")).onChange((value) => saveOperationText("order", value));
    });
    if (advanced && savedOperation.kind === "rename") new import_obsidian6.Setting(containerEl).setName("Property collision behavior").setDesc("Skip preserves notes when the destination property already exists.").addDropdown((dropdown) => {
      var _a2;
      return dropdown.addOptions({ skip: "Skip", keep: "Keep existing", replace: "Replace", merge: "Merge" }).setValue((_a2 = savedOperation.collision) != null ? _a2 : "skip").onChange(async (value) => {
        savedOperation.collision = value;
        await this.plugin.saveSettings();
      });
    });
    if (advanced && savedOperation.kind === "reorder") new import_obsidian6.Setting(containerEl).setName("Unknown property placement").setDesc("Where properties absent from your preferred order appear.").addDropdown((dropdown) => {
      var _a2;
      return dropdown.addOptions({ after: "After preferred properties", before: "Before preferred properties" }).setValue((_a2 = savedOperation.unknownPosition) != null ? _a2 : "after").onChange(async (value) => {
        savedOperation.unknownPosition = value;
        await this.plugin.saveSettings();
      });
    });
    addLivePacks(containerEl, gatewayFor(this.plugin.settings));
    new import_obsidian6.Setting(containerEl).setName("Reconcile authorized write").setDesc("Checks the saved batch against current notes. Uncertain changes keep the server hold without replay or refund.").addButton((button) => button.setButtonText("Check write status").onClick(async () => {
      try {
        new import_obsidian6.Notice(await reconcileLocal(gatewayFor(this.plugin.settings), async () => {
          const batch = this.plugin.settings.lastBatch;
          if (!(batch == null ? void 0 : batch.files.length)) return "uncertain";
          let written = 0, original = 0;
          for (const entry of batch.files) {
            const file = this.app.vault.getAbstractFileByPath(entry.path);
            if (!(file instanceof import_obsidian6.TFile)) return "uncertain";
            const text = await this.app.vault.read(file);
            if (text === entry.after) written++;
            else if (text === entry.original) original++;
            else return "uncertain";
          }
          return written > 0 ? "written" : original === batch.files.length ? "unchanged" : "uncertain";
        }));
      } catch (error) {
        new import_obsidian6.Notice(error instanceof Error ? error.message : "Reconciliation unavailable.");
      }
    }));
  }
};
var _a, _b, _c, _d, _e, _f;
var WranglerModal = class extends import_obsidian6.Modal {
  constructor(app, plugin, target, autoRun = false) {
    var _a2, _b2, _c2;
    super(app);
    this.plugin = plugin;
    this.autoRun = autoRun;
    this.step = 0;
    this.files = [];
    this.plans = [];
    this.reviewedAll = false;
    this.selectedFile = this.app.workspace.getActiveFile();
    this.targetScope = "note";
    this.folder = (_c = (_b = (_a = this.selectedFile) == null ? void 0 : _a.parent) == null ? void 0 : _b.path) != null ? _c : "";
    this.recursive = true;
    this.query = "";
    this.filterKey = "";
    this.filterValue = "";
    this.cancelled = false;
    this.opened = false;
    this.queueEnqueued = false;
    this.queueRunning = false;
    this.operation = { ...this.plugin.settings.defaultOperation, tags: [...(_d = this.plugin.settings.defaultOperation.tags) != null ? _d : []], order: [...(_e = this.plugin.settings.defaultOperation.order) != null ? _e : []], aiFields: [...(_f = this.plugin.settings.defaultOperation.aiFields) != null ? _f : []] };
    this.modalEl.addClass("tundra-modal");
    if (target == null ? void 0 : target.file) {
      this.selectedFile = target.file;
      this.targetScope = "note";
      this.folder = (_b2 = (_a2 = target.file.parent) == null ? void 0 : _a2.path) != null ? _b2 : "";
    }
    if (target == null ? void 0 : target.folder) {
      this.targetScope = "folder";
      this.folder = target.folder.path;
    }
    if ((_c2 = target == null ? void 0 : target.files) == null ? void 0 : _c2.length) {
      this.files = target.files;
      this.targetScope = "selection";
    }
  }
  onOpen() {
    this.opened = true;
    if (this.autoRun) void this.preparePreview();
    else this.render();
  }
  onClose() {
    this.opened = false;
    this.contentEl.empty();
  }
  async runConfiguredDirectly() {
    await this.preparePreview();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.createEl("div", { cls: "tundra-header", text: "Tundra Frontmatter Wrangler" });
    const body = c.createDiv("tundra-body");
    if (this.step === 0) this.renderSetup(body);
    else if (this.step === 1) this.renderPreview(body);
    else if (this.step === 2) this.renderApply(body);
    else this.renderReview(body);
  }
  renderSetup(parent) {
    var _a2, _b2, _c2, _d2;
    parent.createEl("h3", { text: "What should Tundra update?" });
    const target = new import_obsidian6.Setting(parent).setName("Target").setDesc(this.targetDescription());
    const targetOptions = { note: "Open note", folder: "Choose a folder", vault: "Entire vault", ...this.targetScope === "selection" ? { selection: "Selected notes" } : {} };
    target.addDropdown((dropdown) => dropdown.addOptions(targetOptions).setValue(this.targetScope).onChange((value) => {
      var _a3, _b3, _c3;
      this.targetScope = value;
      if (this.targetScope === "folder" && !this.folder) this.folder = (_c3 = (_b3 = (_a3 = this.selectedFile) == null ? void 0 : _a3.parent) == null ? void 0 : _b3.path) != null ? _c3 : "";
      this.render();
      if (this.targetScope === "folder") this.chooseFolder();
    }));
    if (this.targetScope === "note") new import_obsidian6.Setting(parent).setName((_b2 = (_a2 = this.selectedFile) == null ? void 0 : _a2.basename) != null ? _b2 : "No note selected").setDesc((_d2 = (_c2 = this.selectedFile) == null ? void 0 : _c2.path) != null ? _d2 : "Open a note, or choose one here.").addButton((button) => button.setButtonText("Choose note").onClick(() => this.chooseNote()));
    if (this.targetScope === "folder") new import_obsidian6.Setting(parent).setName(this.folder || "Choose a folder").setDesc("Includes notes in subfolders.").addButton((button) => button.setButtonText("Change folder").onClick(() => this.chooseFolder()));
    if (this.targetScope === "selection") new import_obsidian6.Setting(parent).setName(`${this.files.length} selected note${this.files.length === 1 ? "" : "s"}`).setDesc("The current File Explorer selection will be processed.");
    const operation = new import_obsidian6.Setting(parent).setName("Operation");
    operation.addDropdown((dropdown) => dropdown.addOptions({
      "ai-frontmatter": "Generate frontmatter",
      format: "Clean formatting",
      "add-tags": "Add tags",
      "remove-tags": "Remove tags",
      "replace-tag": "Replace a tag",
      "normalize-tags": "Normalize tags",
      rename: "Rename a property",
      remove: "Remove a property",
      reorder: "Reorder properties"
    }).setValue(this.operation.kind).onChange((value) => {
      const kind = value;
      this.operation = kind === "ai-frontmatter" ? { kind, aiTier: this.plugin.settings.aiTier, aiFields: [...AI_FIELD_TIERS[this.plugin.settings.aiTier]], aiConflict: this.plugin.settings.aiConflict } : kind === "rename" ? { kind, oldKey: "", newKey: "", collision: "skip" } : kind === "remove" ? { kind, oldKey: "" } : kind === "add-tags" || kind === "remove-tags" ? { kind, tags: [] } : kind === "replace-tag" ? { kind, fromTag: "", toTag: "" } : kind === "normalize-tags" ? { kind, rules: "lowercase, spaces to hyphens, slash separators" } : kind === "reorder" ? { kind, order: [], unknownPosition: "after" } : { kind };
      this.render();
    }));
    this.renderOperationFields(parent);
    const advanced = parent.createEl("details", { cls: "tundra-advanced" });
    advanced.createEl("summary", { text: "Optional filters" });
    new import_obsidian6.Setting(advanced).setName("Path or text contains").addText((text) => text.setPlaceholder("meeting").setValue(this.query).onChange((value) => this.query = value.trim()));
    new import_obsidian6.Setting(advanced).setName("Property equals").addText((text) => text.setPlaceholder("status").setValue(this.filterKey).onChange((value) => this.filterKey = value.trim())).addText((text) => text.setPlaceholder("active").setValue(this.filterValue).onChange((value) => this.filterValue = value));
    if (this.targetScope === "folder") new import_obsidian6.Setting(advanced).setName("Include subfolders").addToggle((toggle) => toggle.setValue(this.recursive).onChange((value) => this.recursive = value));
    if (this.operation.kind === "ai-frontmatter") parent.createEl("p", { cls: "tundra-note", text: `Uses your ${AI_TIER_LABELS[this.plugin.settings.aiTier]} defaults. AI receives note text only for this operation.` });
    if (this.operation.kind === "remove") parent.createEl("p", { cls: "tundra-warning", text: "This removes a property from matching notes. Tundra keeps a recovery journal." });
    const footer = parent.createDiv("tundra-footer");
    new import_obsidian6.ButtonComponent(footer).setButtonText(this.operation.kind === "ai-frontmatter" ? "Generate and apply" : "Apply changes").setCta().onClick(() => void this.preparePreview());
  }
  targetDescription() {
    if (this.targetScope === "note") return this.selectedFile ? "Only the open note is selected by default." : "Open a note or choose one below.";
    if (this.targetScope === "folder") return this.folder ? `Folder: ${this.folder}` : "Choose a folder to process.";
    return "Every Markdown note in this vault will be considered.";
  }
  renderOperationFields(parent) {
    var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h, _i;
    if (["rename", "remove"].includes(this.operation.kind)) {
      this.textSetting(parent, "Property key", "oldKey", (_a2 = this.operation.oldKey) != null ? _a2 : "");
      if (this.operation.kind === "rename") {
        this.textSetting(parent, "New property key", "newKey", (_b2 = this.operation.newKey) != null ? _b2 : "");
        new import_obsidian6.Setting(parent).setName("If the new key already exists").addDropdown((dropdown) => {
          var _a3;
          return dropdown.addOptions({ skip: "Skip that note", keep: "Keep its current value", replace: "Replace its value", merge: "Merge values" }).setValue((_a3 = this.operation.collision) != null ? _a3 : "skip").onChange((value) => this.operation.collision = value);
        });
      }
    } else if (["add-tags", "remove-tags"].includes(this.operation.kind)) this.textSetting(parent, "Tags", "tags", ((_c2 = this.operation.tags) != null ? _c2 : []).join(", "));
    else if (this.operation.kind === "replace-tag") {
      this.textSetting(parent, "From tag", "fromTag", (_d2 = this.operation.fromTag) != null ? _d2 : "");
      this.textSetting(parent, "To tag", "toTag", (_e2 = this.operation.toTag) != null ? _e2 : "");
      this.textSetting(parent, "Optional namespace", "namespace", (_f2 = this.operation.namespace) != null ? _f2 : "");
    } else if (this.operation.kind === "normalize-tags") {
      this.textSetting(parent, "Exact rules", "rules", (_g = this.operation.rules) != null ? _g : "lowercase, spaces to hyphens, slash separators");
      this.textSetting(parent, "Optional namespace", "namespace", (_h = this.operation.namespace) != null ? _h : "");
    } else if (this.operation.kind === "reorder") {
      this.textSetting(parent, "Preferred properties", "order", ((_i = this.operation.order) != null ? _i : []).join(", "));
      new import_obsidian6.Setting(parent).setName("Where unknown properties go").addDropdown((dropdown) => {
        var _a3;
        return dropdown.addOptions({ after: "After preferred properties", before: "Before preferred properties" }).setValue((_a3 = this.operation.unknownPosition) != null ? _a3 : "after").onChange((value) => this.operation.unknownPosition = value);
      });
    }
  }
  textSetting(parent, name, key, value) {
    new import_obsidian6.Setting(parent).setName(name).addText((text) => text.setValue(value).onChange((next) => {
      if (key === "tags" || key === "order") this.operation[key] = next.split(",").map((item) => item.trim()).filter(Boolean);
      else this.operation[key] = next;
    }));
  }
  chooseNote() {
    const wrangler = this;
    class NotePicker extends import_obsidian6.FuzzySuggestModal {
      getItems() {
        return wrangler.app.vault.getMarkdownFiles();
      }
      getItemText(file) {
        return file.path;
      }
      onChooseItem(file) {
        wrangler.selectedFile = file;
        wrangler.targetScope = "note";
        wrangler.render();
      }
    }
    new NotePicker(this.app).open();
  }
  chooseFolder() {
    const wrangler = this;
    class FolderPicker extends import_obsidian6.FuzzySuggestModal {
      getItems() {
        return wrangler.app.vault.getAllFolders().filter((folder) => folder.path);
      }
      getItemText(folder) {
        return folder.path;
      }
      onChooseItem(folder) {
        wrangler.folder = folder.path;
        wrangler.targetScope = "folder";
        wrangler.render();
      }
    }
    new FolderPicker(this.app).open();
  }
  async selectFiles() {
    var _a2;
    if (this.targetScope === "selection") return this.files;
    if (this.targetScope === "note") {
      if (!this.selectedFile) return [];
      return [this.selectedFile];
    }
    const matches = [];
    const folderPrefix = `${this.folder.replace(/\\/g, "/").replace(/\/$/, "")}/`;
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.targetScope === "folder") {
        if (!this.folder) continue;
        const path = file.path.replace(/\\/g, "/");
        if (!path.startsWith(folderPrefix)) continue;
        if (!this.recursive && path.slice(0, -file.name.length - 1) !== this.folder) continue;
      }
      const content = await this.app.vault.cachedRead(file);
      const parsed = parseFrontmatter(content);
      if (this.query && !file.path.toLowerCase().includes(this.query.toLowerCase()) && !content.toLowerCase().includes(this.query.toLowerCase())) continue;
      if (this.filterKey && String((_a2 = parsed.frontmatter[this.filterKey]) != null ? _a2 : "") !== this.filterValue) continue;
      matches.push(file);
    }
    return matches;
  }
  async preparePreview() {
    var _a2, _b2, _c2;
    if (this.operation.kind === "ai-frontmatter" && !this.queueRunning) {
      if (this.queueEnqueued) return;
      this.queueEnqueued = true;
      const targetName = this.targetScope === "note" ? (_b2 = (_a2 = this.selectedFile) == null ? void 0 : _a2.name) != null ? _b2 : "selected note" : this.targetScope === "folder" ? this.folder || "selected folder" : this.targetScope;
      void this.plugin.aiQueue.enqueue(`Frontmatter for ${targetName}`, "", async (report) => {
        this.queueEnqueued = false;
        this.queueRunning = true;
        this.queueReporter = report;
        report({ label: "Selecting and reading target notes" });
        try {
          await this.preparePreview();
        } finally {
          this.queueRunning = false;
          this.queueReporter = void 0;
        }
      }).then((result) => {
        if (result.status === "cleared") this.queueEnqueued = false;
      });
      return;
    }
    this.plugin.support.info("operation.plan.started", { operation: this.operation.kind, scope: this.targetScope, reviewEnabled: this.plugin.settings.reviewBeforeApply });
    if (this.operation.kind === "ai-frontmatter") {
      const fields = (_c2 = this.operation.aiFields) != null ? _c2 : [...AI_FIELD_TIERS[this.plugin.settings.aiTier]];
      if (!fields.length || fields.some((key) => !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) || ["__proto__", "constructor", "prototype"].includes(key))) {
        this.plugin.support.warn("operation.rejected", { operation: this.operation.kind, outcome: "invalid_fields" });
        new import_obsidian6.Notice("The configured AI property list is invalid.", 5e3);
        return;
      }
    }
    if (this.targetScope === "note" && !this.selectedFile) {
      new import_obsidian6.Notice("Choose a note or switch the target to a folder or the vault.", 5e3);
      return;
    }
    if (this.targetScope === "folder" && !this.folder) {
      new import_obsidian6.Notice("Choose a folder first.", 5e3);
      return;
    }
    this.files = await this.selectFiles();
    if (!this.files.length) {
      this.plugin.support.info("operation.plan.empty", { operation: this.operation.kind, scope: this.targetScope });
      new import_obsidian6.Notice("No Markdown notes match this target and its filters.", 5e3);
      return;
    }
    this.plugin.support.info("operation.targets.selected", { operation: this.operation.kind, scope: this.targetScope, total: this.files.length });
    await this.buildPlan();
    this.plugin.support.info("operation.plan.completed", {
      operation: this.operation.kind,
      total: this.plans.length,
      changed: this.plans.filter((plan) => plan.status === "changed").length,
      skipped: this.plans.filter((plan) => plan.status === "skipped").length,
      failed: this.plans.filter((plan) => plan.status === "failed").length,
      unchanged: this.plans.filter((plan) => plan.status === "unchanged").length
    });
    this.reviewedAll = false;
    if (this.plugin.settings.reviewBeforeApply) {
      this.step = 1;
      this.render();
      return;
    }
    const batch = await this.applyPlans();
    if (batch) {
      const { changed, skipped, failed, unchanged } = batch.summary;
      new import_obsidian6.Notice(`Tundra: ${changed} changed \xB7 ${skipped} skipped \xB7 ${failed} failed \xB7 ${unchanged} unchanged. Rollback is available in Settings.`, 5e3);
    }
    if (this.opened) this.close();
  }
  async buildPlan() {
    var _a2;
    const notes = [];
    for (const file of this.files) notes.push({ path: file.path, content: await this.app.vault.read(file) });
    if (this.operation.kind !== "ai-frontmatter") {
      this.plans = planOperation(notes, this.operation);
      return;
    }
    const updates = {};
    const errors = {};
    const fields = (_a2 = this.operation.aiFields) != null ? _a2 : [...AI_FIELD_TIERS[this.plugin.settings.aiTier]];
    const safe = notes.map((note, index) => ({ note, index, parsed: parseFrontmatter(note.content) })).filter((entry) => entry.parsed.safe && !/^\uFEFF---\r?\n/.test(entry.note.content));
    try {
      const input = { notes: safe.map((entry) => ({ id: `n${entry.index}`, existingProperties: entry.parsed.frontmatter, noteBody: entry.parsed.body })), requestedProperties: fields };
      if (safe.length) {
        const raw = await managedText(gatewayFor(this.plugin.settings), JSON.stringify(input), "frontmatter", { notes: safe.length, input_characters: safe.reduce((sum, entry) => sum + codePoints(entry.parsed.body), 0) });
        const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
        if (!Array.isArray(parsed.updates)) throw new Error("The preserved frontmatter result has an invalid batch format.");
        for (const entry of safe) {
          const update = parsed.updates.find((value) => value.id === `n${entry.index}`);
          if (!update || !update.properties) throw new Error("An expected note update is missing.");
          updates[entry.note.path] = sanitizeAiFrontmatter(update.properties, fields, entry.parsed.body, entry.parsed.frontmatter);
        }
      }
    } catch (error) {
      for (const note of notes) errors[note.path] = error instanceof Error ? error.message : "AI batch unavailable.";
    }
    this.plans = planOperation(notes, this.operation, updates, errors);
  }
  renderPreview(parent) {
    var _a2;
    const changed = this.plans.filter((plan) => plan.status === "changed");
    const skipped = this.plans.filter((plan) => plan.status === "skipped");
    const failed = this.plans.filter((plan) => plan.status === "failed");
    const unchanged = this.plans.filter((plan) => plan.status === "unchanged");
    parent.createEl("h3", { text: "Preview" });
    parent.createEl("p", { text: `${changed.length} changes \xB7 ${skipped.length} skipped \xB7 ${failed.length} failed \xB7 ${unchanged.length} unchanged` });
    if (!changed.length) parent.createEl("p", { cls: "tundra-note", text: "Nothing will be written. A no-op does not use credits." });
    const diffs = parent.createDiv("tundra-diffs");
    let firstChanged = true;
    let sampleRemaining = 500;
    for (const plan of this.plans) {
      if (!["changed", "skipped", "failed"].includes(plan.status)) continue;
      const detail = diffs.createEl("details");
      detail.open = plan.status === "changed" && (changed.length <= 4 || firstChanged);
      if (plan.status === "changed") firstChanged = false;
      detail.createEl("summary", { text: `${plan.status === "changed" ? "Change" : plan.status === "failed" ? "Failed" : "Skip"}: ${plan.path}${plan.reason ? ` \u2014 ${plan.reason}` : ""}` });
      if (plan.status === "changed" && sampleRemaining > 0) {
        const text = Array.from(`- before: ${Array.from(plan.before).slice(0, 200).join("")}
+ after: ${Array.from((_a2 = plan.after) != null ? _a2 : "").slice(0, 200).join("")}`).slice(0, sampleRemaining).join("");
        sampleRemaining -= codePoints(text);
        detail.createEl("pre", { text });
      }
    }
    if (changed.length) {
      const review = parent.createEl("label", { cls: "tundra-review-all" });
      const checkbox = review.createEl("input", { type: "checkbox" });
      checkbox.checked = this.reviewedAll;
      checkbox.onchange = () => {
        this.reviewedAll = checkbox.checked;
        this.render();
      };
      review.createSpan({ text: " I reviewed the proposed changes" });
      parent.createEl("p", { cls: "tundra-note", text: "Each note is checked against its preview before writing. The latest batch can be rolled back." });
    }
    const footer = parent.createDiv("tundra-footer");
    new import_obsidian6.ButtonComponent(footer).setButtonText("Back").onClick(() => {
      this.step = 0;
      this.render();
    });
    const apply = new import_obsidian6.ButtonComponent(footer).setButtonText("Confirm and apply").setCta();
    apply.setDisabled(!isBillableApply(changed.length) || !this.reviewedAll);
    apply.onClick(() => {
      if (!isBillableApply(changed.length) || !this.reviewedAll) return;
      this.cancelled = false;
      this.step = 2;
      this.render();
    });
  }
  renderApply(parent) {
    parent.createEl("h3", { text: "Applying changes" });
    const progress = parent.createEl("progress", { attr: { max: String(this.plans.length), value: "0" } });
    const status = parent.createEl("p", { text: "Authorizing write batch\u2026", cls: "tundra-status" });
    const cancel = new import_obsidian6.ButtonComponent(parent).setButtonText("Cancel after current note").setDisabled(true);
    const back = new import_obsidian6.ButtonComponent(parent).setButtonText("Back").onClick(() => {
      this.step = this.plugin.settings.reviewBeforeApply ? 1 : 0;
      this.render();
    }).setDisabled(true);
    void (async () => {
      const batch = await this.applyPlans((completed, total, path) => {
        progress.value = completed;
        status.setText(`${completed}/${total}: ${path}`);
      }, () => this.cancelled);
      if (!batch) {
        back.setDisabled(false);
        return;
      }
      this.step = 3;
      this.render();
    })();
    cancel.onClick(() => this.cancelled = true);
  }
  async applyPlans(onProgress, isCancelled) {
    let hasCurrentChange = false;
    for (const plan of this.plans) {
      if (plan.status !== "changed" || !plan.after) continue;
      const file = this.app.vault.getAbstractFileByPath(plan.path);
      if (!(file instanceof import_obsidian6.TFile)) continue;
      try {
        if (await this.app.vault.read(file) === plan.before) {
          hasCurrentChange = true;
          break;
        }
      } catch (e) {
      }
    }
    if (!hasCurrentChange) {
      this.plugin.support.warn("apply.skipped", { outcome: "stale_or_no_changes" });
      new import_obsidian6.Notice("No planned changes are still applicable. No credit was used.", 5e3);
      return null;
    }
    const reservation = this.operation.kind === "ai-frontmatter" ? { source: "free", commit: async () => ({ kind: "committed" }), rollback: async () => {
    }, markWriteUncertain: async () => {
    } } : await reserveLocal(gatewayFor(this.plugin.settings), JSON.stringify(this.plans.map((p) => p.before)), JSON.stringify(this.plans.map((p) => p.after)), Math.max(1, Math.ceil(this.plans.filter((p) => p.status === "changed").length / 5)), { notes: this.plans.filter((p) => p.status === "changed").length, input_characters: this.plans.reduce((sum, p) => sum + codePoints(p.before), 0) });
    if (!reservation) {
      this.plugin.support.warn("apply.authorization_failed", { outcome: "unavailable" });
      new import_obsidian6.Notice("Tundra billing authorization failed. No notes were changed.", 5e3);
      return null;
    }
    this.plugin.support.info("apply.authorized", { authorizationSource: reservation.source, total: this.plans.length });
    const batch = { id: crypto.randomUUID(), createdAt: (/* @__PURE__ */ new Date()).toISOString(), operation: this.operation, files: [], summary: { changed: 0, skipped: 0, failed: 0, unchanged: 0 } };
    for (let i = 0; i < this.plans.length; i++) {
      if (isCancelled == null ? void 0 : isCancelled()) break;
      const plan = this.plans[i];
      onProgress == null ? void 0 : onProgress(i + 1, this.plans.length, plan.path);
      if (plan.status !== "changed" || !plan.after) {
        batch.summary[plan.status]++;
        continue;
      }
      const file = this.app.vault.getAbstractFileByPath(plan.path);
      if (!(file instanceof import_obsidian6.TFile)) {
        batch.summary.failed++;
        continue;
      }
      try {
        if (await this.app.vault.read(file) !== plan.before) {
          batch.summary.skipped++;
          continue;
        }
        batch.files.push({ path: plan.path, original: plan.before, after: plan.after });
        this.plugin.settings.lastBatch = batch;
        await this.plugin.saveSettings();
        await reservation.markWriteUncertain();
        await this.app.vault.modify(file, plan.after);
        if (await this.app.vault.read(file) !== plan.after) throw new Error("Write verification failed.");
        batch.summary.changed++;
      } catch (e) {
        batch.summary.failed++;
      }
    }
    if (batch.summary.changed > 0) {
      const billingResult = await reservation.commit();
      if (billingResult.kind === "pending") new import_obsidian6.Notice("Tundra changes applied. Billing is pending and will retry automatically.", 5e3);
    } else await reservation.rollback();
    this.plugin.settings.lastBatch = batch;
    await this.plugin.saveSettings();
    this.plugin.support.info("apply.completed", { total: this.plans.length, changed: batch.summary.changed, skipped: batch.summary.skipped, failed: batch.summary.failed, unchanged: batch.summary.unchanged, cancelled: !!(isCancelled == null ? void 0 : isCancelled()) });
    return batch;
  }
  renderReview(parent) {
    const batch = this.plugin.settings.lastBatch;
    parent.createEl("h3", { text: "Run complete" });
    if (!batch) {
      parent.createEl("p", { text: "No batch was recorded." });
      return;
    }
    parent.createEl("p", { text: `${batch.summary.changed} changed \xB7 ${batch.summary.skipped} skipped \xB7 ${batch.summary.failed} failed \xB7 ${batch.summary.unchanged} unchanged` });
    new import_obsidian6.ButtonComponent(parent).setButtonText("Rollback this batch").onClick(async () => {
      await rollback(this.app, this.plugin);
      this.render();
    });
    new import_obsidian6.ButtonComponent(parent).setButtonText("Open operation log").onClick(() => new LogModal(this.app, batch).open());
    const footer = parent.createDiv("tundra-footer");
    new import_obsidian6.ButtonComponent(footer).setButtonText("Done").setCta().onClick(() => this.close());
  }
};
async function rollback(app, plugin) {
  const batch = plugin.settings.lastBatch;
  if (!batch) {
    plugin.support.warn("rollback.unavailable");
    new import_obsidian6.Notice("No recovery journal is available.");
    return;
  }
  plugin.support.info("rollback.started", { total: batch.files.length });
  let restored = 0;
  let skipped = 0;
  for (const entry of batch.files) {
    const file = app.vault.getAbstractFileByPath(entry.path);
    if (!(file instanceof import_obsidian6.TFile)) {
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
  plugin.support.info("rollback.completed", { total: batch.files.length, restored, skipped });
  new import_obsidian6.Notice(`Restored ${restored} of ${batch.files.length} notes${skipped ? `; ${skipped} skipped because they changed or disappeared` : ""}.`);
}
var LogModal = class extends import_obsidian6.Modal {
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
