/** Payload from a timeline trigger (backend or local rules). */
export interface TimelineAlertData {
  /** e.g. "T-Minus 7 Días: Ventana de Producción" */
  title: string;
  /** Actionable guidance for this temporal frame */
  message: string;
  /** Parent campaign reference label */
  campaignRef: string;
}

export const MOCK_TIMELINE_ALERT: TimelineAlertData = {
  title: "T-Minus 7 Días: Ventana de Producción",
  message:
    "Alinea tus queries de búsqueda con los productos ensamblados en canvas. "
    + "Prioriza keywords de intención de compra y verifica que cada nodo de producto "
    + "esté conectado a su ventana de launch antes de escalar contenido.",
  campaignRef: "Ref: Alphabet Corp - Google Pixel",
};
