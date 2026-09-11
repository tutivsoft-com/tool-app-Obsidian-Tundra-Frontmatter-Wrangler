import { Notice, requestUrl } from "obsidian";
import type TundraPlugin from "./main";
import {
  claimLocalAllowance,
  isBillableWriteBatch,
  localCalendarDate,
  normalizeBillingState,
  restorePurchasedAllowance,
  type BillingState,
} from "./billing-model";
export { defaultBillingState, FREE_USES_PER_DAY } from "./billing-model";

export const CONSTANCE_BASE_URL = "https://app.tutivsoft.com";
export const CONSTANCE_APP_ID = "tundra-frontmatter-wrangler";

export const TUNDRA_PRICE_IDS = {
  usd001: "pri_01m28hmkzcn3cf9e04qq1s9jw6",
  usd010: "pri_01m28hmmvr4zs9enh6tptd7gjy",
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

function readBalance(response: { json?: any }): number {
  return Math.max(0, Number(response.json?.data?.credits?.balance) || 0);
}

async function spendConstanceCredit(plugin: TundraPlugin): Promise<SpendResult> {
  const state = plugin.settings.billing;
  try {
    const response = await requestUrl({
      url: `${CONSTANCE_BASE_URL}/api/v1/public/browser/credits/spend`, method: "POST", throw: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: CONSTANCE_APP_ID, external_customer_id: state.deviceId, machine_id: state.deviceId, amount: 1, event_id: generateEventId() }),
    });
    if (response.status === 402 || response.status === 404) return { kind: "insufficient" };
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    return { kind: "ok", balance: readBalance(response) };
  } catch (error) { console.warn("Tundra: Constance credit spend failed", error); return { kind: "error" }; }
}

export async function reserveUse(plugin: TundraPlugin): Promise<boolean> {
  const today = localCalendarDate();
  const current = ensureBillingState(plugin.settings.billing);
  const claim = claimLocalAllowance(current, today);
  plugin.settings.billing = claim.state;

  if (claim.source === "free") {
    await plugin.saveSettings();
    return true;
  }

  // A zero mirror is not an authorization to spend. Refresh it once so a
  // purchase made on the checkout page can be used without requiring a
  // plugin reload. The remote spend remains the authoritative debit.
  if (claim.source === "remote") {
    const sync = await syncBalance(plugin);
    if (sync.kind !== "ok" || sync.balance < 1) {
      new Notice("Tundra: your free uses are exhausted and no purchased credits remain.", 5000);
      return false;
    }
    const refreshed = claimLocalAllowance(plugin.settings.billing, today);
    plugin.settings.billing = refreshed.state;
    if (refreshed.source !== "purchased") {
      new Notice("Tundra: your free uses are exhausted and no purchased credits remain.", 5000);
      return false;
    }
  }

  await plugin.saveSettings();
  const result = await spendConstanceCredit(plugin);
  if (result.kind === "ok") {
    plugin.settings.billing.purchasedCredits = result.balance;
    await plugin.saveSettings();
    return true;
  }

  // The local mirror was reserved optimistically. Put it back on a
  // transient failure; a confirmed insufficient response clears it.
  if (result.kind === "error") plugin.settings.billing = restorePurchasedAllowance(plugin.settings.billing);
  else plugin.settings.billing.purchasedCredits = 0;
  await plugin.saveSettings();
  new Notice(result.kind === "insufficient" ? "Tundra: no purchased credits are available for this write batch." : "Tundra: billing could not be verified, so this write was not started.", 5000);
  return false;
}

export function isBillableApply(changedCount: number): boolean {
  return isBillableWriteBatch(changedCount);
}

export async function syncBalance(plugin: TundraPlugin): Promise<SyncResult> {
  plugin.settings.billing = ensureBillingState(plugin.settings.billing);
  try {
    const response = await requestUrl({
      url: `${CONSTANCE_BASE_URL}/api/v1/public/browser/entitlements`, method: "POST", throw: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: CONSTANCE_APP_ID, external_customer_id: plugin.settings.billing.deviceId, machine_id: plugin.settings.billing.deviceId }),
    });
    if (response.status < 200 || response.status >= 300) return { kind: "error" };
    const balance = readBalance(response);
    plugin.settings.billing.purchasedCredits = balance;
    await plugin.saveSettings();
    return { kind: "ok", balance };
  } catch (error) { console.warn("Tundra: Constance balance sync failed", error); return { kind: "error" }; }
}

export function openCheckout(plugin: TundraPlugin, tier: keyof typeof TUNDRA_PRICE_IDS): void {
  const priceId = TUNDRA_PRICE_IDS[tier];
  const email = plugin.settings.billing.billingEmail.trim();
  if (!email || !email.includes("@")) { new Notice("Enter a valid billing email in Tundra settings first.", 5000); return; }
  const params = new URLSearchParams({ app_id: CONSTANCE_APP_ID, price_id: priceId, email, external_customer_id: plugin.settings.billing.deviceId });
  window.open(`${CONSTANCE_BASE_URL}/buy?${params.toString()}`, "_blank");
}
