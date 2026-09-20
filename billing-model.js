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
    pendingCreditSpends: []
  };
}
function normalizeBillingState(state, today) {
  const next = { ...defaultBillingState(), ...state ?? {} };
  if (next.freeUsageDate !== today) {
    next.freeUsageDate = today;
    next.freeUsesRemaining = FREE_USES_PER_DAY;
  }
  next.purchasedCredits = Math.max(0, Math.floor(Number(next.purchasedCredits) || 0));
  next.billingAccessToken = typeof next.billingAccessToken === "string" ? next.billingAccessToken : "";
  next.billingAccountLinked = next.billingAccountLinked === true && Boolean(next.billingAccessToken);
  next.freeUsesRemaining = Math.max(0, Math.min(FREE_USES_PER_DAY, Math.floor(Number(next.freeUsesRemaining) || 0)));
  next.pendingCreditSpends = [...new Set((next.pendingCreditSpends ?? []).filter((id) => typeof id === "string" && id.startsWith("evt_")))];
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
export {
  FREE_USES_PER_DAY,
  claimLocalAllowance,
  defaultBillingState,
  isBillableWriteBatch,
  localCalendarDate,
  normalizeBillingState,
  restorePurchasedAllowance
};
