/** YYYY-MM-DD for &lt;input type="date" /&gt; */
export function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function dateInputFromIso(iso) {
  if (!iso) return todayDateInputValue();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayDateInputValue();
  return d.toISOString().slice(0, 10);
}

export function isoFromDateInput(yyyyMmDd) {
  if (!yyyyMmDd) return new Date().toISOString();
  return new Date(`${yyyyMmDd}T12:00:00`).toISOString();
}

/** Launch date input — empty when unset (unlike created date). */
export function launchDateInputFromIso(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
