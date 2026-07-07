import { Modal } from "../shared/Modal.jsx";
import { PRICING_PLANS_DEFAULT, planBullets } from "../../marketing/lib/pricingDefaults.js";
import { useI18n } from "../../i18n/useI18n.js";

export function ProCheckoutAbandonModal({
  open,
  busy = false,
  billing = "monthly",
  onCompletePayment,
  onContinueStarter,
}) {
  const { t } = useI18n();
  if (!open) return null;

  const proPlan = PRICING_PLANS_DEFAULT.find((p) => p.id === "pro");
  const price = billing === "annual" ? proPlan?.annualPrice : proPlan?.price;
  const suffix = billing === "annual" ? proPlan?.annualPriceSuffix : proPlan?.priceSuffix;
  const priceLabel = price ? `$${price}${suffix || ""}` : "";

  return (
    <div className="modal-overlay fn-modal pro-checkout-abandon-overlay" role="presentation">
      <div
        className="modal glass notes-modal fn-modal-panel pro-checkout-abandon-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-checkout-abandon-title"
      >
        <div className="modal-header">
          <span id="pro-checkout-abandon-title" className="label" style={{ color: "var(--hud)" }}>
            {t("proCheckoutAbandon.title")}
          </span>
        </div>
        <div className="modal-body">
          <p className="upgrade-reason">{t("proCheckoutAbandon.body")}</p>
          {priceLabel ? (
            <p className="pro-checkout-abandon-modal__price muted">
              {t("proCheckoutAbandon.priceLabel", { price: priceLabel })}
            </p>
          ) : null}
          <ul className="upgrade-bullets">
            {planBullets(proPlan).slice(0, 4).map((b) => <li key={b}>{b}</li>)}
          </ul>
          <div className="pro-checkout-abandon-modal__actions">
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={onCompletePayment}
            >
              {busy ? t("plans.processing") : t("proCheckoutAbandon.completePayment")}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={onContinueStarter}
            >
              {t("proCheckoutAbandon.continueStarter")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
