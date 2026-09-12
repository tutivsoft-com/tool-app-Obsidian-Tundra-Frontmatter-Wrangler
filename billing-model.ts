export const FREE_USES_PER_DAY = 3;

export interface BillingState {
  deviceId: string;
  billingEmail: string;
  purchasedCredits: number;
  freeUsageDate: string;
  freeUsesRemaining: number;
  pendingCreditSpends: string[];
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
    purchasedCredits: 0,
    freeUsageDate: "",
    freeUsesRemaining: FREE_USES_PER_DAY,
    pendingCreditSpends: [],
  };
}

export function normalizeBillingState(state: Partial<BillingState> | undefined, today: string): BillingState {
  const next: BillingState = { ...defaultBillingState(), ...(state ?? {}) };
  if (next.freeUsageDate !== today) {
    next.freeUsageDate = today;
    next.freeUsesRemaining = FREE_USES_PER_DAY;
  }
  next.purchasedCredits = Math.max(0, Math.floor(Number(next.purchasedCredits) || 0));
  next.freeUsesRemaining = Math.max(0, Math.min(FREE_USES_PER_DAY, Math.floor(Number(next.freeUsesRemaining) || 0)));
  next.pendingCreditSpends = [...new Set((next.pendingCreditSpends ?? []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
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
