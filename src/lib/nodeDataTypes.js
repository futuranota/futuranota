export const NODE_DATA_TYPES = {
  TEXT: "text",
  DATE: "date",
  CHECKBOX: "checkbox",
  METRIC: "metric",
};

export const DATA_TYPE_ICONS = {
  text: "📝",
  date: "📅",
  checkbox: "☑️",
  metric: "📊",
};

export const DATA_TYPE_LABELS = {
  text: "Texto",
  date: "Fecha",
  checkbox: "Casilla",
  metric: "Métrica",
};

export const isCompatibleConnection = (fromType, toType) => {
  const compatibilities = {
    date: ["text", "metric"],
    metric: ["date", "text"],
    text: ["date", "metric", "checkbox"],
    checkbox: ["text"],
  };
  return compatibilities[fromType]?.includes(toType) || false;
};
