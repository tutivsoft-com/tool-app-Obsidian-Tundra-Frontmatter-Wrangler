export const FREE_LIFETIME_USES = 5; // Server lifetime allowance; local state is a display mirror only.

/** Retained historical checkout codes for already pending legacy purchases, never public display. */
export const TUNDRA_CREDIT_PACKS = [{planCode:"one_time"},{planCode:"standard"}] as const;

export interface BillingState {
  deviceId: string;
  billingEmail: string;
  billingAccessToken: string;
  billingRefreshToken: string;
  billingAccessExpiresAt: number;
  billingAccountLinked: boolean;
  purchasedCredits: number;
  freeUsageDate: string;
  freeUsesRemaining: number;
  pendingCreditSpends: string[];
  pendingUsageConsumes: string[];
  pendingFreeUsageClaim?: string;
  pendingCheckout: { idempotencyKey: string; planCode: string; checkoutId?: string } | null;
  pendingPriceCheckout?: { idempotencyKey: string; priceId: string; owner: string; checkoutId?: string };
}

export type LocalCreditSource = "free" | "purchased" | "remote";

export function localCalendarDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultBillingState(): BillingState {
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
    pendingUsageConsumes: [],
    pendingCheckout: null,
  };
}

export function normalizeBillingState(state: Partial<BillingState> | undefined, today: string): BillingState {
  const next: BillingState = { ...defaultBillingState(), ...(state ?? {}) };
  next.purchasedCredits = Math.max(0, Math.floor(Number(next.purchasedCredits) || 0));
  next.billingAccessToken = typeof next.billingAccessToken === "string" ? next.billingAccessToken : "";
  next.billingRefreshToken = typeof next.billingRefreshToken === "string" ? next.billingRefreshToken : "";
  next.billingAccessExpiresAt = Number.isFinite(Number(next.billingAccessExpiresAt)) ? Number(next.billingAccessExpiresAt) : 0;
  next.billingAccountLinked = next.billingAccountLinked === true && Boolean(next.billingAccessToken);
  next.freeUsesRemaining = Math.max(0, Math.min(FREE_LIFETIME_USES, Math.floor(Number(next.freeUsesRemaining) || 0)));
  next.pendingCreditSpends = [...new Set((next.pendingCreditSpends ?? []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
  next.pendingUsageConsumes = [...new Set((next.pendingUsageConsumes ?? []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
  if (!next.pendingCheckout || typeof next.pendingCheckout.idempotencyKey !== "string" || typeof next.pendingCheckout.planCode !== "string") next.pendingCheckout = null;
  if (next.pendingPriceCheckout && (typeof next.pendingPriceCheckout.idempotencyKey !== "string" || typeof next.pendingPriceCheckout.priceId !== "string" || typeof next.pendingPriceCheckout.owner !== "string")) next.pendingPriceCheckout = undefined;
  return next;
}

/** Claim one local allowance before a paid relay spend is attempted. */
export function claimLocalAllowance(state: BillingState, today: string): { state: BillingState; source: LocalCreditSource | "none" } {
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

export function restorePurchasedAllowance(state: BillingState): BillingState {
  return { ...state, purchasedCredits: Math.max(0, Math.floor(Number(state.purchasedCredits) || 0) + 1) };
}

export function isBillableWriteBatch(changedCount: number): boolean {
  return Number.isFinite(changedCount) && changedCount > 0;
}
