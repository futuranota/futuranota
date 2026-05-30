/** Preset units for metric pickers (nodes + documents). */
export const METRIC_UNIT_OPTIONS = [
  { id: "", label: "— unit —" },
  { id: "%", label: "%" },
  { id: "km", label: "km" },
  { id: "mi", label: "mi" },
  { id: "m", label: "m" },
  { id: "mm", label: "mm" },
  { id: "s", label: "s" },
  { id: "min", label: "min" },
  { id: "h", label: "h" },
  { id: "days", label: "days" },
  { id: "d", label: "d" },
  { id: "USD", label: "USD" },
  { id: "EUR", label: "EUR" },
  { id: "kWh", label: "kWh" },
  { id: "units", label: "units" },
  { id: "kg", label: "kg" },
  { id: "lb", label: "lb" },
];

/** Length units for product card dimension pickers. */
export const DIMENSION_UNIT_OPTIONS = [
  { id: "", label: "—" },
  { id: "mm", label: "mm" },
  { id: "cm", label: "cm" },
  { id: "m", label: "m" },
  { id: "in", label: "in" },
  { id: "ft", label: "ft" },
];

export function metricUnitInOptions(unit) {
  const id = String(unit ?? "");
  return METRIC_UNIT_OPTIONS.some((o) => o.id === id);
}
