import { Notice, Setting, requestUrl } from "obsidian";
import type TundraPlugin from "./main";
import { CONSTANCE_ACCOUNT_BASE_URL, clearBillingSession, requestAuthenticatedBilling } from "./constance-account";
import { syncBalance } from "./billing";

const APP_ID = "tundra-frontmatter-wrangler";
const checkoutPolls = new WeakMap<object, Set<string>>();

function wait(milliseconds: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, milliseconds)); }

async function pollPriceCheckoutSettlement(plugin: TundraPlugin, checkoutId: string): Promise<void> {
  let active = checkoutPolls.get(plugin);
  if (!active) { active = new Set<string>(); checkoutPolls.set(plugin, active); }
  if (active.has(checkoutId)) return;
  active.add(checkoutId);
  try {
    for (let attempt = 0; attempt < 12; attempt++) {
      await wait(5000);
      const state = plugin.settings.billing;
      const pending = state.pendingPriceCheckout;
      if (!pending || pending.checkoutId !== checkoutId || (!state.billingAccessToken && !state.billingRefreshToken)) return;
      try {
        const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
          url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(checkoutId)}`,
          method: "GET",
        });
        if (response.status === 401 || response.status === 403) {
          clearBillingSession(state);
          await plugin.saveSettings();
          return;
        }
        if (response.status < 200 || response.status >= 300) continue;
        const checkout = response.json?.data;
        const terminal = checkout?.settled === true || ["completed", "fulfilled", "failed", "canceled", "cancelled", "expired"].includes(checkout?.status);
        if (!terminal || state.pendingPriceCheckout !== pending) continue;
        state.pendingPriceCheckout = undefined;
        await plugin.saveSettings();
        const balance = await syncBalance(plugin);
        plugin.refreshBillingCredits?.();
        new Notice(checkout?.settled === true || ["completed", "fulfilled"].includes(checkout?.status)
          ? "Tundra: payment settled and your credit balance was refreshed."
          : "Tundra: purchase did not complete; your current balance was refreshed.", 5000);
        if (balance.kind !== "ok") new Notice("Tundra: the purchase ended, but the latest balance could not be loaded.", 5000);
        return;
      } catch (error) { console.warn("Tundra: Paddle checkout settlement poll failed", error); }
    }
  } finally { active.delete(checkoutId); }
}

export function resumePendingPriceCheckout(plugin: TundraPlugin): void {
  const pending = plugin.settings.billing.pendingPriceCheckout;
  if (pending?.checkoutId) void pollPriceCheckoutSettlement(plugin, pending.checkoutId);
}

function data(response: any): any {
  if (response.status < 200 || response.status >= 300) throw new Error(response.json?.detail?.message || `Billing service unavailable (HTTP ${response.status}).`);
  return response.json?.data;
}

export function addLivePacks(root: HTMLElement, plugin: TundraPlugin): void {
  const section = root.createDiv();
  const status = section.createEl("p", { text: "Loading current Paddle prices…" });
  void requestUrl({ url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/public-products?app_id=${APP_ID}`, method: "GET", throw: false }).then((productsResponse) => {
    const products = data(productsResponse);
    const configured = products?.app_id === APP_ID && Array.isArray(products?.packs) ? products.packs : [];
    if (!configured.length) throw new Error("No current one-time offers are available.");
    status.setText("Current Paddle prices. Checkout calculates applicable tax.");
    for (const pack of configured) {
      const priceId = typeof pack?.price_id === "string" ? pack.price_id : "";
      const units = Number(pack?.native_units);
      const unit = typeof pack?.unit === "string" && pack.unit.trim() ? pack.unit.trim() : "apply batches";
      const amount = typeof pack?.formatted_total === "string" ? pack.formatted_total : "";
      const available = pack?.available === true && !!priceId && Number.isSafeInteger(units) && units > 0 && !!amount;
      const description = [pack?.description, Number.isSafeInteger(units) && units > 0 ? `${units.toLocaleString()} ${unit}` : "", available ? "" : pack?.availability_reason || "Current price unavailable"].filter(Boolean).join(" · ");
      new Setting(section).setName(pack?.price_name || pack?.name || pack?.code || "One-time offer").setDesc(description).addButton(button => {
        button.setButtonText(available ? `Buy ${amount}` : "Pricing unavailable").setDisabled(!available).onClick(async () => {
          button.setDisabled(true);
          try {
            const state = plugin.settings.billing;
            if (!state.billingAccountLinked || (!state.billingAccessToken && !state.billingRefreshToken)) throw new Error("Connect your billing account before buying credits.");
            let pending = state.pendingPriceCheckout;
            if (pending?.owner && pending.owner !== state.billingEmail) throw new Error("Sign in to the account that started the pending purchase.");
            if (pending?.checkoutId) {
              const check = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), { url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/checkouts/${encodeURIComponent(pending.checkoutId)}`, method: "GET" });
              const checkout = data(check);
              if (checkout?.settled === true || ["completed", "canceled", "cancelled", "failed", "expired"].includes(checkout?.status)) {
                state.pendingPriceCheckout = undefined;
                await plugin.saveSettings();
                await syncBalance(plugin);
                plugin.refreshBillingCredits?.();
                new Notice(checkout?.settled === true || checkout?.status === "completed"
                  ? "Tundra: payment settled and your credit balance was refreshed."
                  : "Tundra: purchase did not complete; your current balance was refreshed.", 5000);
                return;
              }
            }
            if (pending && pending.priceId !== priceId) throw new Error("A purchase is already pending. Resolve it before starting another.");
            pending ??= { idempotencyKey: `checkout_${crypto.randomUUID()}`, priceId, owner: state.billingEmail };
            state.pendingPriceCheckout = pending;
            await plugin.saveSettings();
            const response = await requestAuthenticatedBilling(state, () => plugin.saveSettings(), {
              url: `${CONSTANCE_ACCOUNT_BASE_URL}/api/v1/billing/checkout-price`, method: "POST",
              headers: { "Content-Type": "application/json", "Idempotency-Key": pending.idempotencyKey },
              body: JSON.stringify({ app_id: APP_ID, installation_id: state.deviceId, price_id: priceId, quantity: 1 }),
            });
            if (response.status === 401 || response.status === 403) { clearBillingSession(state); await plugin.saveSettings(); throw new Error("Your billing session expired. Sign in again."); }
            const checkout = data(response);
            const checkoutId = String(checkout?.checkout_id || "");
            if (!checkoutId) throw new Error("Checkout is still being confirmed. Retry this same offer to recover it safely.");
            pending.checkoutId = checkoutId;
            await plugin.saveSettings();
            if (typeof checkout.checkout_url === "string" && checkout.checkout_url) window.open(checkout.checkout_url, "_blank", "noopener");
            else new Notice("Checkout is being confirmed. Your pending purchase is saved.");
            await syncBalance(plugin);
            plugin.refreshBillingCredits?.();
            void pollPriceCheckoutSettlement(plugin, checkoutId);
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "Checkout unavailable.");
          } finally { button.setDisabled(!available); }
        });
      });
    }
  }).catch((error) => status.setText(error instanceof Error ? error.message : "Pricing temporarily unavailable. Buying is disabled."));
}
