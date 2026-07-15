/**
 * Prompt when a child doc is missing date/time under an active folder reservation.
 * @returns {Promise<"stay"|"discard">}
 */
export async function confirmChildScheduleOrDiscard(askConfirm, t, iconSrc = "/uploads/CalendarDots.svg") {
  const stay = await askConfirm({
    title: t("meta.childScheduleRequiredTitle"),
    message: t("meta.childScheduleRequiredBody"),
    confirmLabel: t("common.ok"),
    cancelLabel: t("meta.childScheduleCloseWithoutSave"),
    tone: "default",
    hideCancel: false,
    iconSrc,
  });
  return stay ? "stay" : "discard";
}
