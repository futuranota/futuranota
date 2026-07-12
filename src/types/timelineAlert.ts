/** Payload for the floating “A friendly reminder” card (minute-based). */
export interface TimelineReminderData {
  /** Stable id for dismiss / skip — e.g. `doc-DOC123` or `macro-…` */
  alertKey: string;
  /** Folder / macro / task name */
  contentLabel: string;
  /** Object / workspace name for greeting (“Hola {workspace}”) */
  workspaceLabel: string;
  /** Whole minutes until start (ceil), ≥ 1 while in window */
  minutesRemaining: number;
  /** Local clock e.g. "14:00" */
  startTimeLabel: string;
  startAtMs: number;
  kind: "doc" | "macro";
}

/** Legacy day-window toast payload (modal list / old toast). */
export interface TimelineAlertData {
  title: string;
  message: string;
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

export const MOCK_TIMELINE_REMINDER: TimelineReminderData = {
  alertKey: "mock-doc",
  contentLabel: "Content list",
  workspaceLabel: "Admin Panel",
  minutesRemaining: 1,
  startTimeLabel: "14:00",
  startAtMs: Date.now() + 60_000,
  kind: "doc",
};
