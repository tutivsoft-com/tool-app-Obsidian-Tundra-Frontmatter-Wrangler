import { Notice, requestUrl } from "obsidian";
import type TundraPlugin from "./main";
import {
  claimLocalAllowance,
  isBillableWriteBatch,
  localCalendarDate,
  normalizeBillingState,
  TUNDRA_CREDIT_PACKS,
  type BillingState,
} from "./billing-model";
import { claimAccountFreeUsage, spendAccountCredits } from "./constance-account";
export { defaultBillingState, FREE_USES_PER_DAY } from "./billing-model";

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
  return next;
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
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function readBalance(response: { json?: any }): number {
  return Math.max(0, Number(response.json?.data?.credits?.balance) || 0);
}

async function spendConstanceCredit(plugin: TundraPlugin, stableEventId: string): Promise<SpendResult> {
  const state = plugin.settings.billing;
  const result = await spendAccountCredits(state, CONSTANCE_APP_ID, state.deviceId, stableEventId, 1);
  if (result.kind === "auth-required") {
    state.billingAccessToken = "";
    state.billingAccountLinked = false;
    await plugin.saveSettings();
    new Notice("Tundra: your billing session expired. Sign in again.", 5000);
    return { kind: "error" };
  }
  if (result.kind === "insufficient") return result;
  if (result.kind === "ok") return result;
  return { kind: "error" };
}

export type UseCommitResult = { kind: "committed" } | { kind: "pending" } | { kind: "insufficient" };
export interface UseReservation { source: "free" | "purchased"; commit(): Promise<UseCommitResult>; rollback(): Promise<void>; }

export async function retryPendingCreditSpends(plugin: TundraPlugin): Promise<void> {
  for (const stableEventId of [...plugin.settings.billing.pendingCreditSpends]) {
    const result = await spendConstanceCredit(plugin, stableEventId);
    if (result.kind === "error") break;
    plugin.settings.billing.pendingCreditSpends = plugin.settings.billing.pendingCreditSpends.filter((id) => id !== stableEventId);
    plugin.settings.billing.purchasedCredits = result.kind === "insufficient" ? 0 : result.balance;
    await plugin.saveSettings();
  }
}

async function pollCheckoutSettlement(plugin: TundraPlugin, checkoutId: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await wait(5000);
    const state = plugin.settings.billing;
    if (!state.pendingCheckout || state.pendingCheckout.checkoutId !== checkoutId || !state.billingAccessToken) return;
    try {
      const response = await requestUrl({
        url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(checkoutId)}`,
        method: "GET",
        headers: { Authorization: `Bearer ${state.billingAccessToken}` },
        throw: false,
      });
      if (response.status === 401 || response.status === 403) {
        state.billingAccessToken = "";
        state.billingAccountLinked = false;
        state.pendingCheckout = null;
        await plugin.saveSettings();
        return;
      }
      if (response.status < 200 || response.status >= 300) continue;
      const data = response.json?.data;
      if (data?.settled === true) {
        state.pendingCheckout = null;
        await plugin.saveSettings();
        await syncBalance(plugin);
        new Notice("Tundra: payment settled and your credit balance was refreshed.", 5000);
        return;
      }
    } catch (error) {
      console.warn("Tundra: checkout settlement poll failed", error);
    }
  }
}

async function startCheckout(plugin: TundraPlugin, planCode: string): Promise<void> {
  const state = plugin.settings.billing;
  if (!state.billingAccessToken || !state.billingAccountLinked) {
    new Notice("Tundra: sign in or create a billing account in plugin settings before buying credits.", 5000);
    return;
  }
  const pending = state.pendingCheckout?.planCode === planCode
    ? state.pendingCheckout
    : { idempotencyKey: generateIdempotencyKey(), planCode };
  state.pendingCheckout = pending;
  await plugin.saveSettings();
  const response = await requestUrl({
    url: `${CONSTANCE_BASE_URL}/api/v1/billing/checkout`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.billingAccessToken}`,
      "Idempotency-Key": pending.idempotencyKey,
    },
    body: JSON.stringify({ app_id: CONSTANCE_APP_ID, plan_code: planCode, installation_id: state.deviceId, quantity: 1 }),
    throw: false,
  });
  if (response.status === 401 || response.status === 403) {
    state.billingAccessToken = "";
    state.billingAccountLinked = false;
    state.pendingCheckout = null;
    await plugin.saveSettings();
    new Notice("Tundra: your billing session expired. Sign in again.", 5000);
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
    new Notice("Tundra: Constance returned an incomplete checkout response.", 5000);
    return;
  }
  state.pendingCheckout = { ...pending, checkoutId };
  await plugin.saveSettings();
  window.open(checkoutUrl, "_blank");
  void pollCheckoutSettlement(plugin, checkoutId);
}

export function resumePendingCheckout(plugin: TundraPlugin): void {
  const pending = plugin.settings.billing.pendingCheckout;
  if (!pending) return;
  if (pending.checkoutId) void pollCheckoutSettlement(plugin, pending.checkoutId);
  else void startCheckout(plugin, pending.planCode);
}

export async function reserveUse(plugin: TundraPlugin): Promise<UseReservation | null> {
  if (!plugin.settings.billing.billingAccessToken || !plugin.settings.billing.billingAccountLinked) {
    new Notice("Tundra: sign in or create a billing account in plugin settings before applying changes.", 5000);
    return null;
  }
  await retryPendingCreditSpends(plugin);
  if (plugin.settings.billing.pendingCreditSpends.length > 0) {
    new Notice("Tundra: a previous credit charge is still being reconciled. Try again when connected.", 5000);
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
      new Notice(free.kind === "insufficient" ? "Tundra: today's account free allowance is exhausted." : "Tundra: the account allowance could not be verified.", 5000);
      return null;
    }
    plugin.settings.billing.freeUsesRemaining = free.remaining;
    await plugin.saveSettings();
    return { source: "free", commit: async () => ({ kind: "committed" }), rollback: async () => undefined };
  }

  // A zero mirror is not an authorization to spend. Refresh it once so a
  // purchase made on the checkout page can be used without requiring a
  // plugin reload. The remote spend is deferred until a write succeeds.
  if (claim.source === "remote") {
    const sync = await syncBalance(plugin);
    if (sync.kind !== "ok" || sync.balance < 1) {
      new Notice("Tundra: your free uses are exhausted and no purchased credits remain.", 5000);
      return null;
    }
    const refreshed = claimLocalAllowance(plugin.settings.billing, today);
    plugin.settings.billing = refreshed.state;
    if (refreshed.source !== "purchased") {
      new Notice("Tundra: your free uses are exhausted and no purchased credits remain.", 5000);
      return null;
    }
  }

  // The local balance can be stale after a purchase or another installation's
  // spend. Confirm it before changing any notes.
  const freshBalance = await syncBalance(plugin);
  if (freshBalance.kind !== "ok" || freshBalance.balance < 1) {
    new Notice("Tundra: purchased credits could not be verified. Refresh your balance and try again.", 5000);
    return null;
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
      await plugin.saveSettings();
    },
  };
}

export function isBillableApply(changedCount: number): boolean {
  return isBillableWriteBatch(changedCount);
}

export async function syncBalance(plugin: TundraPlugin): Promise<SyncResult> {
  plugin.settings.billing = ensureBillingState(plugin.settings.billing);
  const state = plugin.settings.billing;
  if (!state.billingAccessToken || !state.billingAccountLinked) return { kind: "error" };
  try {
    const response = await requestUrl({
      url: `${CONSTANCE_BASE_URL}/api/v1/billing/entitlements/me?${new URLSearchParams({ app_id: CONSTANCE_APP_ID, installation_id: state.deviceId }).toString()}`,
      method: "GET", throw: false,
      headers: { Authorization: `Bearer ${state.billingAccessToken}` },
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
  } catch (error) { console.warn("Tundra: Constance balance sync failed", error); return { kind: "error" }; }
}

export function openCheckout(plugin: TundraPlugin, tier: keyof typeof TUNDRA_PLAN_CODES): void {
  void startCheckout(plugin, TUNDRA_PLAN_CODES[tier]).catch((error) => {
    console.error("Tundra: authenticated checkout failed", error);
    new Notice("Tundra: checkout could not be started. Retry from settings.", 5000);
  });
}
