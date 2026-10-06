import { diagnostics } from "./diagnostics";
import { resumePendingPriceCheckout } from "./billing-catalog";
import { consumeAccountUnits } from "./account-credit-client";
import { Notice, requestUrl } from "obsidian";
import type TundraPlugin from "./main";
import {
  claimLocalAllowance,
  FREE_LIFETIME_USES,
  isBillableWriteBatch,
  localCalendarDate,
  normalizeBillingState,
  TUNDRA_CREDIT_PACKS,
  type BillingState,
} from "./billing-model";
import { claimAccountFreeUsage, spendAccountCredits, requestAuthenticatedBilling, clearBillingSession, refreshBillingSession } from "./constance-account";
export { defaultBillingState, FREE_LIFETIME_USES } from "./billing-model";

export const CONSTANCE_BASE_URL = "https://app.tutivsoft.com";
export const CONSTANCE_APP_ID = "tundra-frontmatter-wrangler";

export const TUNDRA_PLAN_CODES = {
  usd001: TUNDRA_CREDIT_PACKS[0].planCode,
  usd010: TUNDRA_CREDIT_PACKS[1].planCode,
} as const;

function makeDeviceId(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return `tundra-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function ensureBillingState(state: Partial<BillingState> | undefined, now = new Date()): BillingState {
  const next = normalizeBillingState(state, localCalendarDate(now));
  if (!next.deviceId) next.deviceId = makeDeviceId();
  // Account forms and token refreshes retain this object while asynchronous work runs.
  return state ? Object.assign(state, next) as BillingState : next;
}

type SpendResult = { kind: "ok"; balance: number } | { kind: "insufficient" } | { kind: "error" };

export type SyncResult = { kind: "ok"; balance: number } | { kind: "error" };

function generateEventId(): string {
  const bytes = new Uint8Array(12);
  window.crypto.getRandomValues(bytes);
  return `evt_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function generateIdempotencyKey(): string {
  return `checkout_${generateEventId()}`;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(diagnostics.wrap("billing.timer_1", resolve), milliseconds));
}

function readBalance(response: { json?: any }): number {
  return Math.max(0, Number((response.json?.data?.credits?.total_available ?? response.json?.data?.credits?.balance)) || 0);
}

async function spendConstanceCredit(plugin: TundraPlugin, stableEventId: string): Promise<SpendResult> {
const diagnosticEnd1 = diagnostics?.start?.("billing.spendConstanceCredit") ?? (() => {});
try {

  const state = plugin.settings.billing;
  const result = await spendAccountCredits(state, () => plugin.saveSettings(), CONSTANCE_APP_ID, state.deviceId, stableEventId, 1);
  if (result.kind === "auth-required") {
    clearBillingSession(state);
    await plugin.saveSettings();
    new Notice("Tundra: your session expired. Sign in again.", 5000);
    return { kind: "error" };
  }
  if (result.kind === "insufficient") return await (result);
  if (result.kind === "ok") return await (result);
  return { kind: "error" };

} catch (diagnosticError1) { diagnostics?.failure?.("billing.spendConstanceCredit", diagnosticError1); throw diagnosticError1; } finally { diagnosticEnd1(); }
}

export type UseCommitResult = { kind: "committed" } | { kind: "pending" } | { kind: "insufficient" };
export interface UseReservation { source: "free" | "purchased"; commit(): Promise<UseCommitResult>; rollback(): Promise<void>; }

async function consumeUsage(plugin: TundraPlugin, eventId: string) {
const diagnosticEnd2 = diagnostics?.start?.("billing.consumeUsage") ?? (() => {});
try {

  const state = plugin.settings.billing;
  const result = await consumeAccountUnits({ state, appId: CONSTANCE_APP_ID, installationId: state.deviceId, refreshSession: () => refreshBillingSession(state, () => plugin.saveSettings()) }, eventId, 1);
  if (result.kind === "ok") {
    if (result.freeRemaining !== undefined) state.freeUsesRemaining = result.freeRemaining;
    if (result.balance !== undefined) state.purchasedCredits = result.balance;
  }
  return await (result);

} catch (diagnosticError2) { diagnostics?.failure?.("billing.consumeUsage", diagnosticError2); throw diagnosticError2; } finally { diagnosticEnd2(); }
}

export async function retryPendingCreditSpends(plugin: TundraPlugin): Promise<void> {
const diagnosticEnd3 = diagnostics?.start?.("billing.retryPendingCreditSpends") ?? (() => {});
try {

  for (const eventId of [...(plugin.settings.billing.pendingUsageConsumes ?? [])]) {
    const result = await consumeUsage(plugin, eventId);
    if (result.kind === "error" || result.kind === "auth-required") return;
    plugin.settings.billing.pendingUsageConsumes = plugin.settings.billing.pendingUsageConsumes.filter(id => id !== eventId);
    try { await plugin.saveSettings(); }
    catch (caughtError2) {
diagnostics.failure("billing.caught_3", caughtError2); plugin.settings.billing.pendingUsageConsumes.push(eventId); return; }
  }
  for (const stableEventId of [...plugin.settings.billing.pendingCreditSpends]) {
    const result = await spendConstanceCredit(plugin, stableEventId);
    if (result.kind === "error") break;
    plugin.settings.billing.pendingCreditSpends = plugin.settings.billing.pendingCreditSpends.filter((id) => id !== stableEventId);
    plugin.settings.billing.purchasedCredits = result.kind === "insufficient" ? 0 : result.balance;
    await plugin.saveSettings();
  }

} catch (diagnosticError3) { diagnostics?.failure?.("billing.retryPendingCreditSpends", diagnosticError3); throw diagnosticError3; } finally { diagnosticEnd3(); }
}

/** Read the canonical allowance before making a billable OpenRouter request. */
export async function checkUseAvailable(plugin: TundraPlugin): Promise<boolean> {
const diagnosticEnd4 = diagnostics?.start?.("billing.checkUseAvailable") ?? (() => {});
try {

  const state = plugin.settings.billing;
  if ((!state.billingAccessToken && !state.billingRefreshToken) || !state.billingAccountLinked) {
    plugin.support.warn("billing.entitlement.rejected", { outcome: "account_not_signed_in" });
    new Notice("Tundra: sign in or create an account in plugin settings before using AI.", 5000);
    return false;
  }
  await retryPendingCreditSpends(plugin);
  if ((plugin.settings.billing.pendingCreditSpends.length > 0 || (plugin.settings.billing.pendingUsageConsumes?.length ?? 0) > 0)) {
    plugin.support.warn("billing.entitlement.rejected", { outcome: "pending_credit_reconciliation" });
    new Notice("Tundra: a previous charge is still being confirmed. Try again when connected.", 5000);
    return false;
  }
  try {
    const query = new URLSearchParams({ app_id: CONSTANCE_APP_ID, installation_id: state.deviceId });
    const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
      url: `${CONSTANCE_BASE_URL}/api/v1/billing/entitlements/me?${query.toString()}`,
      method: "GET",
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      clearBillingSession(state);
      await plugin.saveSettings();
      plugin.support.warn("billing.entitlement.rejected", { outcome: "account_session_invalid", httpStatus: response.status });
      new Notice("Tundra: your session expired. Sign in again before using AI.", 5000);
      return false;
    }
    if (response.status < 200 || response.status >= 300) {
      plugin.support.warn("billing.entitlement.rejected", { outcome: "http_error", httpStatus: response.status });
      throw new Error(`HTTP ${response.status}`);
    }
    const entitlements = response.json?.data;
    const freeRemaining = Math.max(0, Number(entitlements?.free_usage?.remaining) || 0);
    const paidBalance = Math.max(0, Number(entitlements?.credits?.total_available ?? entitlements?.credits?.balance) || 0);
    const today = localCalendarDate();
    state.freeUsageDate = today;
    state.freeUsesRemaining = Math.min(FREE_LIFETIME_USES, Math.floor(freeRemaining));
    state.purchasedCredits = Math.floor(paidBalance);
    await plugin.saveSettings();
    if (freeRemaining > 0 || paidBalance > 0) return true;
    new Notice("Tundra: your free credits are exhausted and no purchased credits remain.", 5000);
    return false;
  } catch (caughtError4) {
diagnostics.failure("billing.caught_5", caughtError4);
    plugin.support.warn("billing.entitlement.rejected", { outcome: "request_failed" });
    new Notice("Tundra: your account could not be verified. No AI request was sent.", 5000);
    return false;
  }

} catch (diagnosticError4) { diagnostics?.failure?.("billing.checkUseAvailable", diagnosticError4); throw diagnosticError4; } finally { diagnosticEnd4(); }
}

async function pollCheckoutSettlement(plugin: TundraPlugin, checkoutId: string): Promise<void> {
const diagnosticEnd5 = diagnostics?.start?.("billing.pollCheckoutSettlement") ?? (() => {});
try {

  for (let attempt = 0; attempt < 12; attempt++) {
    await wait(5000);
    const state = plugin.settings.billing;
    if (!state.pendingCheckout || state.pendingCheckout.checkoutId !== checkoutId || (!state.billingAccessToken && !state.billingRefreshToken)) return;
    try {
      const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
        url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(checkoutId)}`,
        method: "GET",
      });
      if (response.status === 401 || response.status === 403) {
        clearBillingSession(state);
        state.pendingCheckout = null;
        await plugin.saveSettings();
        return;
      }
      if (response.status < 200 || response.status >= 300) continue;
      const data = response.json?.data;
      if (data?.settled === true) {
        const balance = await syncBalance(plugin);
        if (balance.kind !== "ok") continue;
        state.pendingCheckout = null;
        await plugin.saveSettings();
        new Notice("Tundra: payment settled and your credit balance was refreshed.", 5000);
        return;
      }
    } catch (error) {
diagnostics.failure("billing.caught_extra_1", error);
      diagnostics?.legacy?.("warn", "billing.tundra_checkout_settlement_poll_failed");
    }
  }

} catch (diagnosticError5) { diagnostics?.failure?.("billing.pollCheckoutSettlement", diagnosticError5); throw diagnosticError5; } finally { diagnosticEnd5(); }
}

async function startCheckout(plugin: TundraPlugin, planCode: string, openBrowser = true): Promise<void> {
const diagnosticEnd6 = diagnostics?.start?.("billing.startCheckout") ?? (() => {});
try {

  const state = plugin.settings.billing;
  if ((!state.billingAccessToken && !state.billingRefreshToken) || !state.billingAccountLinked) {
    new Notice("Tundra: sign in or create an account in plugin settings before buying credits.", 5000);
    return;
  }
  if (state.pendingCheckout && state.pendingCheckout.planCode !== planCode) { new Notice("A purchase is pending. Wait for its status before starting another."); return; }
  const pending = state.pendingCheckout?.planCode === planCode
    ? state.pendingCheckout
    : { idempotencyKey: generateIdempotencyKey(), planCode };
  state.pendingCheckout = pending;
  await plugin.saveSettings();
  const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
    url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkout`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": pending.idempotencyKey,
    },
    body: JSON.stringify({ app_id: CONSTANCE_APP_ID, plan_code: planCode, installation_id: state.deviceId, quantity: 1 }),
  });
  if (response.status === 401 || response.status === 403) {
    clearBillingSession(state);
    await plugin.saveSettings();
    new Notice("Tundra: your session expired. Sign in again.", 5000);
    return;
  }
  if (response.status < 200 || response.status >= 300) {
    new Notice(`Tundra: checkout could not be created (HTTP ${response.status}).`, 5000);
    return;
  }
  const data = response.json?.data;
  const checkoutId = String(data?.checkout_id || data?.id || "");
  const checkoutUrl = String(data?.checkout_url || "");
  if (!checkoutId || !checkoutUrl) {
    new Notice("Tundra: checkout could not be started. Try again from Settings.", 5000);
    return;
  }
  state.pendingCheckout = { ...pending, checkoutId };
  await plugin.saveSettings();
  if (openBrowser) window.open(checkoutUrl, "_blank", "noopener");
  void diagnostics.guard("billing.background_6", () => (pollCheckoutSettlement(plugin, checkoutId)));

} catch (diagnosticError6) { diagnostics?.failure?.("billing.startCheckout", diagnosticError6); throw diagnosticError6; } finally { diagnosticEnd6(); }
}

export function resumePendingCheckout(plugin: TundraPlugin): void {
  const pending = plugin.settings.billing.pendingCheckout;
  if (!pending) return;
  if (pending.checkoutId) void diagnostics.guard("billing.background_7", () => (pollCheckoutSettlement(plugin, pending.checkoutId!)));
  else void diagnostics.guard("billing.background_8", () => (startCheckout(plugin, pending.planCode, false)));
}

export async function reserveUse(plugin: TundraPlugin): Promise<UseReservation | null> {
const diagnosticEnd7 = diagnostics?.start?.("billing.reserveUse") ?? (() => {});
try {

  if ((!plugin.settings.billing.billingAccessToken && !plugin.settings.billing.billingRefreshToken) || !plugin.settings.billing.billingAccountLinked) {
    new Notice("Tundra: sign in or create an account in plugin settings before applying changes.", 5000);
    return null;
  }
  if (plugin.settings.billing.pendingFreeUsageClaim) {
    const state = plugin.settings.billing;
    const result = await claimAccountFreeUsage(state, () => plugin.saveSettings(), CONSTANCE_APP_ID, state.deviceId, state.pendingFreeUsageClaim!, 1);
    if (result.kind === "error" || result.kind === "auth-required") { new Notice("Previous usage is still pending. Please try again when connected."); return null; }
    state.pendingFreeUsageClaim = undefined;
    state.freeUsesRemaining = result.kind === "ok" ? result.remaining : 0;
    await plugin.saveSettings();
  }
  await retryPendingCreditSpends(plugin);
  if ((plugin.settings.billing.pendingCreditSpends.length > 0 || (plugin.settings.billing.pendingUsageConsumes?.length ?? 0) > 0)) {
    new Notice("Tundra: a previous charge is still being confirmed. Try again when connected.", 5000);
    return null;
  }
  if (!await checkUseAvailable(plugin)) return null;
  const current = plugin.settings.billing;
  const stableEventId = generateEventId();
  let settled = false;
  return {
    source: current.freeUsesRemaining > 0 ? "free" : "purchased",
    commit: async () => {
const diagnosticEnd8 = diagnostics?.start?.("billing.background.12434") ?? (() => {});
try {

      if (settled) return { kind: "committed" };
      current.pendingUsageConsumes = [...new Set([...(current.pendingUsageConsumes ?? []), stableEventId])];
      await plugin.saveSettings();
      const result = await consumeUsage(plugin, stableEventId);
      if (result.kind === "error" || result.kind === "auth-required") return { kind: "pending" };
      current.pendingUsageConsumes = current.pendingUsageConsumes.filter(id => id !== stableEventId);
      try { await plugin.saveSettings(); }
      catch (caughtError9) {
diagnostics.failure("billing.caught_10", caughtError9); current.pendingUsageConsumes = [...new Set([...(current.pendingUsageConsumes ?? []), stableEventId])]; return { kind: "pending" }; }
      settled = true;
      return result.kind === "ok" ? { kind: "committed" } : { kind: "insufficient" };

} catch (diagnosticError8) { diagnostics?.failure?.("billing.background.12434", diagnosticError8); throw diagnosticError8; } finally { diagnosticEnd8(); }
},
    rollback: async () => { const diagnosticEnd9 = diagnostics?.start?.("billing.background.13224") ?? (() => {}); try { return undefined; } catch (diagnosticError9) { diagnostics?.failure?.("billing.background.13224", diagnosticError9); throw diagnosticError9; } finally { diagnosticEnd9(); } },
  };

} catch (diagnosticError7) { diagnostics?.failure?.("billing.reserveUse", diagnosticError7); throw diagnosticError7; } finally { diagnosticEnd7(); }
}

export function isBillableApply(changedCount: number): boolean {
  return isBillableWriteBatch(changedCount);
}

export async function syncBalance(plugin: TundraPlugin): Promise<SyncResult> {
const diagnosticEnd10 = diagnostics?.start?.("billing.syncBalance") ?? (() => {});
try {

  plugin.settings.billing = ensureBillingState(plugin.settings.billing);
  const state = plugin.settings.billing;
  resumePendingPriceCheckout(plugin);
  if ((!state.billingAccessToken && !state.billingRefreshToken) || !state.billingAccountLinked) return { kind: "error" };
  try {
    const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
      url: `${CONSTANCE_BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: CONSTANCE_APP_ID, installation_id: state.deviceId }).toString()}`,
      method: "GET",
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      clearBillingSession(state);
      await plugin.saveSettings();
      return { kind: "error" };
    }
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const paid = response.json?.data?.credits?.total_available ?? response.json?.data?.credits?.balance;
    const free = response.json?.data?.free_usage?.remaining;
    if (paid == null || String(paid).trim() === "" || !Number.isFinite(Number(paid)) || Number(paid) < 0 || !Number.isFinite(free) || free < 0) return { kind: "error" };
    const balance = readBalance(response);
    plugin.settings.billing.purchasedCredits = balance;
    plugin.settings.billing.freeUsesRemaining = Math.floor(free);
    await plugin.saveSettings();
    plugin.refreshBillingCredits?.();
    return { kind: "ok", balance };
  } catch (error) {
diagnostics.failure("billing.caught_extra_2", error); diagnostics?.legacy?.("warn", "billing.tundra_constance_balance_sync_failed"); return { kind: "error" }; }

} catch (diagnosticError10) { diagnostics?.failure?.("billing.syncBalance", diagnosticError10); throw diagnosticError10; } finally { diagnosticEnd10(); }
}

export function openCheckout(plugin: TundraPlugin, tier: keyof typeof TUNDRA_PLAN_CODES): void {
  void diagnostics.guard("billing.background_11", () => (startCheckout(plugin, TUNDRA_PLAN_CODES[tier]).catch((error) => {
diagnostics.failure("billing.rejected_1", error);
    diagnostics?.legacy?.("error", "billing.tundra_authenticated_checkout_failed");
    new Notice("Tundra: checkout could not be started. Retry from settings.", 5000);
  })));
}
