import { createPortal } from "react-dom";
import { PRICING_PLANS_DEFAULT, planBullets } from "../../marketing/lib/pricingDefaults.js";
import { useI18n } from "../../i18n/useI18n.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card.jsx";

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

  return createPortal(
    <div className="pro-checkout-abandon-overlay" role="presentation">
      <button
        type="button"
        className="pro-checkout-abandon-overlay__backdrop"
        aria-label={t("proCheckoutAbandon.continueStarter")}
        onClick={onContinueStarter}
      />
      <Card
        className="pro-checkout-abandon-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-checkout-abandon-title"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle id="pro-checkout-abandon-title">
            {t("proCheckoutAbandon.title")}
          </CardTitle>
          <CardDescription>{t("proCheckoutAbandon.body")}</CardDescription>
        </CardHeader>

        <CardContent>
          {priceLabel ? (
            <p className="pro-checkout-abandon-card__price">
              {t("proCheckoutAbandon.priceLabel", { price: priceLabel })}
            </p>
          ) : null}
          <ul className="upgrade-bullets pro-checkout-abandon-card__bullets">
            {planBullets(proPlan).slice(0, 4).map((b) => <li key={b}>{b}</li>)}
          </ul>
        </CardContent>

        <CardFooter className="pro-checkout-abandon-card__footer">
          <button
            type="button"
            className="btn primary pro-checkout-abandon-card__btn"
            disabled={busy}
            onClick={onCompletePayment}
          >
            {busy ? t("plans.processing") : t("proCheckoutAbandon.completePayment")}
          </button>
          <button
            type="button"
            className="btn ghost pro-checkout-abandon-card__btn"
            disabled={busy}
            onClick={onContinueStarter}
          >
            {t("proCheckoutAbandon.continueStarter")}
          </button>
        </CardFooter>
      </Card>
    </div>,
    document.body,
  );
}
