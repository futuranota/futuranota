export const NODE_DATA_TYPES = {
  TEXT: "text",
  DATE: "date",
  CHECKBOX: "checkbox",
  METRIC: "metric",
  VIDEO: "video",
};

export const DATA_TYPE_ICONS = {
  text: "📝",
  date: "📅",
  checkbox: "☑️",
  metric: "📊",
  video: "▶️",
};

export const DATA_TYPE_ICON_ASSETS = {
  text: "/uploads/botones/node.svg",
  date: "/uploads/botones/CalendarDots.svg",
};

export const DATA_TYPE_LABELS = {
  text: "Text",
  date: "Date",
  checkbox: "Checkbox",
  metric: "Metric",
  video: "Video",
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
