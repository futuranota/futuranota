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

/** Display date as mm/dd/yy from YYYY-MM-DD or ISO. */
export function formatMmDdYy(dateInput) {
  if (!dateInput) return null;
  const d =
    typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
      ? new Date(`${dateInput}T12:00:00`)
      : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/** Launch date input — empty when unset (unlike created date). */
export function launchDateInputFromIso(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
