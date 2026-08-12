import { useCallback, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  fetchManagementOverview,
  patchManagementIntegration,
  createManagementGasto,
  deleteManagementGasto,
  createManagementQuota,
  patchManagementQuota,
  deleteManagementQuota,
  patchManagementUserQuotaActive,
} from "../lib/managementApi.js";
import { GINA_DEPT_RAIL_COLORS } from "../lib/gina/ginaDepartmentColors.js";
import { formatStorageBytes, formatStorageBytesParts } from "../lib/planConfig.js";
import { resolveUserPlanDates } from "../lib/planCycleDates.js";
import { MANAGEMENT_SECTIONS } from "./AdminSidebarNav.jsx";

const PIE_COLORS = GINA_DEPT_RAIL_COLORS.length
  ? GINA_DEPT_RAIL_COLORS
  : [
    "#7ec8ff",
    "#e8a87c",
    "#85d4a0",
    "#c9a0ff",
    "#ff9eb5",
    "#ffd166",
    "#6ee7d8",
  ];

const SECTION_COPY = {
  [MANAGEMENT_SECTIONS.api]: { title: "API Integrations" },
  [MANAGEMENT_SECTIONS.users]: { title: "Users" },
  [MANAGEMENT_SECTIONS.calls]: { title: "Recent Calls" },
  [MANAGEMENT_SECTIONS.gastos]: { title: "Gastos" },
  [MANAGEMENT_SECTIONS.storage]: { title: "Storage & Quotas" },
};

/** Local time, unambiguous Y-M-D (avoids 8/10 vs 10/8 locale confusion). */
function formatDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return String(iso);
  }
}

function formatUsd(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Number(n).toFixed(4)}`;
}

function formatUsdShort(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Number(n).toFixed(2)}`;
}

function formatPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n)}%`;
}

function StatusBadge({ ok, configured }) {
  if (!configured) {
    return <span className="mgmt-badge mgmt-badge--missing">Not configured</span>;
  }
  if (ok) {
    return <span className="mgmt-badge mgmt-badge--ok">OK</span>;
  }
  return <span className="mgmt-badge mgmt-badge--error">Error</span>;
}

function LifecycleBadge({ status }) {
  const pending = status === "pending";
  return (
    <span className={`mgmt-badge ${pending ? "mgmt-badge--pending" : "mgmt-badge--active"}`}>
      {pending ? "Pending" : "Active"}
    </span>
  );
}

function FreeLimitCell({ used, limit }) {
  if (limit == null) {
    return <span className="muted">—</span>;
  }
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const over = used >= limit;
  return (
    <div className="mgmt-limit-cell">
      <span className={over ? "mgmt-limit-cell__text is-over" : "mgmt-limit-cell__text"}>
        {used} / {limit}
      </span>
      <div className="mgmt-limit-meter" aria-hidden="true">
        <div
          className={`mgmt-limit-meter__fill${over ? " is-over" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * @param {string|null|undefined} lastCallAt
 * @param {number} days
 */
function isInactiveSince(lastCallAt, days) {
  if (!lastCallAt) return true;
  const t = new Date(lastCallAt).getTime();
  if (!Number.isFinite(t)) return true;
  return t < Date.now() - days * 24 * 60 * 60 * 1000;
}

/**
 * @param {Array<{ totalCalls?: number, lastCallAt?: string|null }>} users
 * @param {'all'|'never'|'inactive_7'|'inactive_30'} filter
 */
function filterUsersByActivity(users, filter) {
  if (filter === "all") return users;
  if (filter === "never") return users.filter((u) => !u.totalCalls);
  if (filter === "inactive_7") return users.filter((u) => isInactiveSince(u.lastCallAt, 7));
  if (filter === "inactive_30") return users.filter((u) => isInactiveSince(u.lastCallAt, 30));
  return users;
}

const USER_FEATURE_COLUMNS = [
  { key: "credits", label: "Credits" },
  { key: "calendar", label: "Event calendar" },
  { key: "forecast", label: "Forecast" },
  { key: "launchRadar", label: "Launch Radar" },
  { key: "marketHype", label: "Market Hype" },
  { key: "campaignLive", label: "Campaign live" },
  { key: "tokens", label: "Tokens" },
  { key: "storage", label: "Storage" },
  { key: "stepsLibrary", label: "Steps library" },
];

function downloadUserFeaturesCsv(users) {
  const headers = [
    "email",
    "plan",
    "date_free",
    "date_pro",
    "days_to_pro",
    "next_date",
    "quota_active",
    ...USER_FEATURE_COLUMNS.map((c) => c.key),
  ];
  const lines = [headers.join(",")];
  for (const u of users) {
    const f = u.features || {};
    const planDates = resolveUserPlanDates({
      plan: u.plan,
      freeStartedAt: u.profileCreatedAt,
      proStartedAt: u.planUpgradedAt,
    });
    lines.push([
      u.email || "",
      u.plan === "pro" ? "Pro" : "Starter",
      planDates.freeYmd || "",
      planDates.proYmd || "",
      planDates.daysToPro != null ? String(planDates.daysToPro) : "",
      planDates.nextYmd || "",
      u.quotaActive === false ? "inactive" : "active",
      ...USER_FEATURE_COLUMNS.map((c) => f[c.key] ?? ""),
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = localDateKey(new Date().toISOString()) || "export";
  a.href = url;
  a.download = `user-features-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Local calendar date YYYY-MM-DD from ISO timestamp. */
function localDateKey(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * @param {Array<Record<string, unknown>>} events
 * @param {{
 *   user: string,
 *   provider: string,
 *   endpoint: string,
 *   status: string,
 *   dateFrom: string,
 *   dateTo: string,
 * }} filters
 */
function filterRecentEvents(events, filters) {
  return events.filter((ev) => {
    if (filters.user === "__empty__") {
      if (ev.userEmail) return false;
    } else if (filters.user && filters.user !== "all") {
      if (String(ev.userEmail || "").toLowerCase() !== filters.user.toLowerCase()) return false;
    }
    if (filters.provider !== "all" && ev.provider !== filters.provider) return false;
    if (filters.endpoint !== "all" && ev.endpoint !== filters.endpoint) return false;
    if (filters.status !== "all" && ev.status !== filters.status) return false;
    const day = localDateKey(ev.createdAt);
    if (filters.dateFrom && (!day || day < filters.dateFrom)) return false;
    if (filters.dateTo && (!day || day > filters.dateTo)) return false;
    return true;
  });
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {Array<Record<string, unknown>>} events
 */
function downloadRecentCallsCsv(events) {
  const headers = [
    "when",
    "user_email",
    "provider",
    "endpoint",
    "model",
    "credits",
    "plan_tokens",
    "input_tokens",
    "output_tokens",
    "compute_units",
    "estimated_cost_usd",
    "status",
    "billed",
    "preview",
  ];
  const lines = [headers.join(",")];
  for (const ev of events) {
    lines.push([
      formatDate(ev.createdAt),
      ev.userEmail || "",
      ev.provider || "",
      ev.endpoint || "",
      ev.model || "",
      ev.creditsDebited ?? "",
      ev.tokensDebited ?? "",
      ev.inputTokens ?? "",
      ev.outputTokens ?? "",
      ev.computeUnits ?? "",
      ev.estimatedCostUsd ?? "",
      ev.status || "",
      ev.billed === false ? "false" : "true",
      ev.queryPreview || "",
    ].map(csvEscape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = localDateKey(new Date().toISOString()) || "export";
  a.href = url;
  a.download = `recent-calls-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const EMPTY_CALL_FILTERS = {
  user: "all",
  provider: "all",
  endpoint: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

/** Display ISO date as MM/DD/YYYY */
function formatDateMdY(isoDate) {
  if (!isoDate) return "—";
  const raw = String(isoDate).slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(isoDate);
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function todayIsoDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function PieBlock({ title, data }) {
  const chart = (data || []).map((row, i) => ({
    ...row,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const hasData = chart.length > 0;
  return (
    <div className="mgmt-pie-block">
      <h3 className="mgmt-section-title">{title}</h3>
      {!hasData ? (
        <p className="muted mgmt-empty">No calls logged yet.</p>
      ) : (
        <div className="mgmt-provider-pie">
          <div className="mgmt-provider-pie__chart">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload || {};
                    return (
                      <div className="mgmt-provider-pie__tooltip">
                        <span className="mgmt-provider-pie__tooltip-name">{row.name}</span>
                        <span className="mgmt-provider-pie__tooltip-val">{row.value} calls</span>
                      </div>
                    );
                  }}
                />
                <Pie
                  data={chart}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={28}
                  outerRadius={72}
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                >
                  {chart.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} stroke="none" />
                  ))}
                  <LabelList
                    dataKey="value"
                    stroke="none"
                    fontSize={11}
                    fontWeight={600}
                    fill="#f0f0f0"
                  />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mgmt-provider-pie__legend" aria-label="Providers">
            {chart.map((row) => (
              <li key={row.name} className="mgmt-provider-pie__legend-item">
                <span
                  className="mgmt-provider-pie__dot"
                  style={{ background: row.fill }}
                  aria-hidden
                />
                <span className="mgmt-provider-pie__legend-name">{row.name}</span>
                <span className="mgmt-provider-pie__legend-val">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TOP_ENDPOINTS_LIMIT = 8;

function TopEndpointsBar({ data }) {
  const top = (data || []).slice(0, TOP_ENDPOINTS_LIMIT);
  const hasData = top.length > 0;
  return (
    <div className="mgmt-pie-block">
      <h3 className="mgmt-section-title">Top endpoints</h3>
      {!hasData ? (
        <p className="muted mgmt-empty">No calls logged yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, top.length * 36)}>
          <BarChart
            data={top}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "#9aa3af", fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fill: "#c8cdd5", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "#151515",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#e8eaed" }}
              itemStyle={{ color: "#7ec8ff" }}
            />
            <Bar dataKey="value" name="Calls" fill="#7ec8ff" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function EndpointCreditMatrix({ rows }) {
  const list = rows || [];
  return (
    <section className="admin-card">
      <h3 className="mgmt-section-title" style={{ marginBottom: 12 }}>
        Credits / endpoint matrix
      </h3>
      <div className="mgmt-table-wrap">
        <table className="mgmt-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Calls</th>
              <th>Success %</th>
              <th>Credits debited</th>
              <th>Plan tokens</th>
              <th>API cost $</th>
              <th>$ / call</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">No usage events yet.</td>
              </tr>
            ) : (
              list.map((row) => {
                const perCall = row.calls > 0 ? row.estimatedCostUsd / row.calls : 0;
                return (
                  <tr key={row.endpoint}>
                    <td><code className="mgmt-code">{row.endpoint}</code></td>
                    <td>{row.calls}</td>
                    <td>{formatPct(row.successRatePct)}</td>
                    <td>{row.creditsDebited || "—"}</td>
                    <td className="muted">{row.tokensDebited || "—"}</td>
                    <td><strong>{formatUsd(row.estimatedCostUsd)}</strong></td>
                    <td className="muted">{formatUsd(perCall)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   gastos?: {
 *     entries?: Array<Record<string, unknown>>,
 *     totalListedUsd?: number,
 *     totalMonthlyUsd?: number,
 *     warning?: string|null,
 *   },
 *   onChanged: () => void,
 *   onError: (msg: string) => void,
 * }} props
 */
function GastosSection({ gastos, onChanged, onError }) {
  const entries = gastos?.entries || [];
  const [form, setForm] = useState({
    productName: "",
    billing: "monthly",
    amountUsd: "",
    startedAt: todayIsoDate(),
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      await createManagementGasto({
        productName: form.productName.trim(),
        billing: form.billing === "annual" ? "annual" : "monthly",
        amountUsd: Number(form.amountUsd),
        startedAt: form.startedAt,
      });
      setForm({
        productName: "",
        billing: "monthly",
        amountUsd: "",
        startedAt: todayIsoDate(),
      });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add gasto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    onError("");
    try {
      await deleteManagementGasto(id);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete gasto");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="admin-card">
      {gastos?.warning ? (
        <div className="mgmt-setup-banner mgmt-setup-banner--warn" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>{gastos.warning}</p>
        </div>
      ) : null}

      <form className="mgmt-gastos-form" onSubmit={handleAdd}>
        <label className="mgmt-filter-field">
          <span className="muted">Producto</span>
          <input
            type="text"
            required
            placeholder="Cursor"
            value={form.productName}
            onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
          />
        </label>
        <label className="mgmt-filter-field">
          <span className="muted">Plan</span>
          <select
            value={form.billing}
            onChange={(e) => setForm((f) => ({ ...f, billing: e.target.value }))}
          >
            <option value="monthly">Recurrente (mensual)</option>
            <option value="annual">Anual</option>
          </select>
        </label>
        <label className="mgmt-filter-field">
          <span className="muted">Plan cost $</span>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            placeholder="20"
            value={form.amountUsd}
            onChange={(e) => setForm((f) => ({ ...f, amountUsd: e.target.value }))}
          />
        </label>
        <label className="mgmt-filter-field">
          <span className="muted">Fecha inicio</span>
          <input
            type="date"
            required
            value={form.startedAt}
            onChange={(e) => setForm((f) => ({ ...f, startedAt: e.target.value }))}
          />
        </label>
        <div className="mgmt-gastos-form__actions">
          <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      <div className="mgmt-gastos-totals">
        <div className="mgmt-kpi">
          <span className="mgmt-kpi__label">Total a gastar / mes</span>
          <strong className="mgmt-kpi__value">{formatUsdShort(gastos?.totalMonthlyUsd ?? 0)}</strong>
          <span className="mgmt-kpi__hint muted">Anual ÷ 12 · resta del margen</span>
        </div>
        <div className="mgmt-kpi">
          <span className="mgmt-kpi__label">Suma planes</span>
          <strong className="mgmt-kpi__value">{formatUsdShort(gastos?.totalListedUsd ?? 0)}</strong>
          <span className="mgmt-kpi__hint muted">Costos tal como los anotaste</span>
        </div>
      </div>

      <div className="mgmt-table-wrap" style={{ marginTop: 14 }}>
        <table className="mgmt-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Plan</th>
              <th>Plan cost</th>
              <th>$ / mes</th>
              <th>Inicio</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  Sin gastos aún — agrega Cursor, storage, hosting, etc.
                </td>
              </tr>
            ) : (
              entries.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.productName}</strong></td>
                  <td>{row.billing === "annual" ? "Anual" : "Recurrente"}</td>
                  <td>{formatUsdShort(row.amountUsd)}</td>
                  <td className="muted">{formatUsdShort(row.monthlyUsd)}</td>
                  <td className="muted">{formatDateMdY(row.startedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={deletingId === row.id}
                      onClick={() => handleDelete(row.id)}
                    >
                      {deletingId === row.id ? "…" : "Eliminar"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


function formatQuotaNumber(n, unit) {
  if (unit === "calls" || unit === "tokens" || unit === "MAU") {
    return Number(n || 0).toLocaleString();
  }
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatOverageRate(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v > 0 && v < 0.0001) return `$${v.toExponential(2)}`;
  return formatUsd(v);
}

/** Time left as a plain number of days (UTC). */
function formatTimeLeftDays(q) {
  if (!q?.resets) return "—";
  if (q.daysRemaining != null && Number.isFinite(Number(q.daysRemaining))) {
    return String(q.daysRemaining);
  }
  return "0";
}

/** Next reset calendar date UTC, e.g. 09/18. */
function formatNextResetDate(q) {
  if (!q?.resets || !q.resetAtYmd) return "—";
  const parts = String(q.resetAtYmd).slice(0, 10).split("-");
  if (parts.length !== 3) return "—";
  const [, month, day] = parts;
  return `${month}/${day}`;
}

const EMPTY_QUOTA_FORM = {
  provider: "",
  included: "1000",
  unit: "calls",
  type: "free",
  resets: true,
  everyN: "1",
  everyUnit: "day",
  overageUsd: "",
  anchorAt: "",
};

/** Derive internal meter_kind from free-text Meter (unit). */
function deriveMeterKindFromUnit(unit) {
  return /token/i.test(String(unit || "")) ? "tokens" : "calls";
}

function shortAccountId(id) {
  const s = String(id || "");
  if (s.length <= 12) return s || "—";
  return `${s.slice(0, 8)}…`;
}

/**
 * Per-account Postgres + Bucket used. Plan Used = sum vs 5 GB / 5 MB.
 * 8 GB / 100 GB are project ceilings — not shown as denominators.
 */
function AccountStorageSpendTable({ storageSpend }) {
  const rows = storageSpend?.rows || [];
  const totals = storageSpend?.totals || {};
  return (
    <div className="mgmt-storage-spend">
      <h3 className="mgmt-section-title" style={{ marginBottom: 8 }}>
        Storage by account
      </h3>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 12 }}>
        Postgres = DB rows. Bucket = <code>doc-images</code>. Used = both.
        Total assigned = plan cap given to that account (sum in footer).
      </p>
      {storageSpend?.warning ? (
        <div className="mgmt-setup-banner mgmt-setup-banner--warn" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>{String(storageSpend.warning)}</p>
        </div>
      ) : null}
      <div className="mgmt-table-wrap">
        <table className="mgmt-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Email</th>
              <th title="Workspace rows in Postgres">Postgres</th>
              <th title="Files in Storage bucket doc-images">Bucket</th>
              <th title="Postgres + Bucket">Used</th>
              <th title="Plan storage allotted to this account">Total assigned</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">No accounts yet.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const over = row.capBytes > 0 && row.usedBytes > row.capBytes;
                return (
                  <tr
                    key={row.userId}
                    className={over ? "mgmt-row--quota-over" : undefined}
                  >
                    <td>
                      <code className="mgmt-code" title={row.userId}>
                        {shortAccountId(row.userId)}
                      </code>
                    </td>
                    <td>{row.email || "—"}</td>
                    <td>{formatStorageBytes(row.postgresBytes)}</td>
                    <td>{formatStorageBytes(row.bucketBytes)}</td>
                    <td>
                      <strong>{formatStorageBytes(row.usedBytes)}</strong>
                    </td>
                    <td>{row.capLabel || formatStorageBytes(row.capBytes)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="mgmt-quota-footer">
        <span className="muted">Total Postgres:</span>
        {" "}
        <strong>{formatStorageBytes(totals.postgresBytes)}</strong>
        <span className="muted" style={{ marginLeft: 16 }}>Total Bucket:</span>
        {" "}
        <strong>{formatStorageBytes(totals.bucketBytes)}</strong>
        <span className="muted" style={{ marginLeft: 16 }}>Total used:</span>
        {" "}
        <strong>{formatStorageBytes(totals.usedBytes)}</strong>
        <span className="muted" style={{ marginLeft: 16 }}>Total assigned:</span>
        {" "}
        <strong>{formatStorageBytesParts(totals.assignedBytes)}</strong>
      </div>
    </div>
  );
}

/**
 * Cupos — oferta / demanda / extra (sin repetir Users / Recent Calls $).
 */
function StorageQuotasSection({ quotas, asOf, onAsOfChange, onChanged, onError, storageSpend }) {
  const items = quotas?.items || [];
  const providers = quotas?.availableProviders || [];
  const totalCost = Number(quotas?.totalCostToPay) || 0;
  const canEditDb = quotas?.source === "db";
  const [form, setForm] = useState({ ...EMPTY_QUOTA_FORM });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_QUOTA_FORM });
  const [deletingId, setDeletingId] = useState(null);

  const isEditing = Boolean(editId);
  const activeForm = isEditing ? editForm : form;
  const setActiveForm = isEditing ? setEditForm : setForm;

  function startEdit(row) {
    setEditId(row.id);
    setEditForm({
      provider: row.provider || "",
      included: String(row.included ?? ""),
      unit: row.unit || "calls",
      type: row.type || "free",
      resets: Boolean(row.resets),
      everyN: row.everyN != null ? String(row.everyN) : "1",
      everyUnit: row.everyUnit === "month" ? "month" : "day",
      overageUsd: row.overageUsd != null ? String(row.overageUsd) : "",
      anchorAt: row.anchorAt || "",
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditForm({ ...EMPTY_QUOTA_FORM });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canEditDb) {
      onError("Run supabase_management_quotas.sql first to add meters in DB.");
      return;
    }
    if (!activeForm.provider) {
      onError("Pick a provider from Recent Calls.");
      return;
    }
    const included = Number(activeForm.included);
    if (!Number.isFinite(included) || included < 0) {
      onError("Included must be a non-negative number.");
      return;
    }
    if (activeForm.resets) {
      const everyN = Number(activeForm.everyN);
      if (!Number.isFinite(everyN) || everyN < 1) {
        onError("Every N must be ≥ 1 when Reset is yes.");
        return;
      }
    }

    const unit = activeForm.unit.trim();
    if (!unit) {
      onError("Meter is required.");
      return;
    }
    const meterKind = deriveMeterKindFromUnit(unit);

    const payload = {
      provider: activeForm.provider,
      productName: activeForm.provider,
      meterKind,
      included,
      unit,
      type: activeForm.type,
      resets: Boolean(activeForm.resets),
      everyN: activeForm.resets ? Number(activeForm.everyN) : null,
      everyUnit: activeForm.resets ? activeForm.everyUnit : null,
      overageUsd: activeForm.overageUsd.trim() === "" ? null : Number(activeForm.overageUsd),
      anchorAt: activeForm.anchorAt.trim() || null,
    };
    if (payload.overageUsd != null && !Number.isFinite(payload.overageUsd)) {
      onError("Cost Overdue must be a number.");
      return;
    }

    setSaving(true);
    onError("");
    try {
      if (isEditing) {
        await patchManagementQuota(editId, payload);
        cancelEdit();
      } else {
        await createManagementQuota(payload);
        setForm({ ...EMPTY_QUOTA_FORM });
      }
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : (isEditing ? "Failed to save meter" : "Failed to add meter"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    onError("");
    try {
      await deleteManagementQuota(id);
      if (editId === id) cancelEdit();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete meter");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mgmt-quotas">
      <AccountStorageSpendTable storageSpend={storageSpend} />

      <div className="mgmt-quota-toolbar" style={{ marginTop: 20 }}>
        <label className="mgmt-filter-field">
          <span className="muted">Date picked (UTC)</span>
          <input
            type="date"
            value={asOf}
            onChange={(e) => onAsOfChange(e.target.value)}
          />
        </label>
        {quotas?.source === "defaults" ? (
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Defaults · run SQL to edit
          </p>
        ) : null}
      </div>

      {quotas?.warning ? (
        <div className="mgmt-setup-banner mgmt-setup-banner--warn" style={{ marginBottom: 12 }}>
          <p style={{ margin: 0 }}>{String(quotas.warning)}</p>
        </div>
      ) : null}

      <div className="mgmt-table-wrap">
        <table className="mgmt-table mgmt-table--quotas">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Included</th>
              <th>Meter</th>
              <th>Reset?</th>
              <th title="Days until reset (UTC)">Time left</th>
              <th title="Next reset date (UTC)">Next reset</th>
              <th title="Used / included in current window">Used</th>
              <th>Over</th>
              <th>Cost Overdue</th>
              <th>Pay</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="muted">No meters — pick a provider below or run supabase_management_quotas.sql.</td>
              </tr>
            ) : (
              items.map((q) => (
                <tr
                  key={q.id}
                  className={[
                    q.exhausted ? "mgmt-row--quota-over" : "",
                    editId === q.id ? "mgmt-row--editing" : "",
                  ].filter(Boolean).join(" ") || undefined}
                  title={q.periodLabel || ""}
                >
                  <td>
                    <code className="mgmt-code">{q.provider || "—"}</code>
                  </td>
                  <td>
                    <strong>{formatQuotaNumber(q.included, q.unit)}</strong>
                  </td>
                  <td className="muted">{q.unit || "—"}</td>
                  <td>{q.resets ? "yes" : "no"}</td>
                  <td>{formatTimeLeftDays(q)}</td>
                  <td title={q.resets ? (q.resetAtYmd || "") : "No reset"}>
                    {formatNextResetDate(q)}
                  </td>
                  <td>
                    <strong>{formatQuotaNumber(q.used, q.unit)}</strong>
                    <span className="muted"> / {formatQuotaNumber(q.included, q.unit)}</span>
                  </td>
                  <td className={q.over > 0 ? undefined : "muted"}>
                    {formatQuotaNumber(q.over, q.unit)}
                  </td>
                  <td className="muted">{formatOverageRate(q.overageUsd)}</td>
                  <td>
                    {q.costToPay > 0 ? (
                      <strong>{formatUsd(q.costToPay)}</strong>
                    ) : (
                      <span className="muted">{formatUsd(0)}</span>
                    )}
                  </td>
                  <td>
                    {canEditDb ? (
                      <div className="mgmt-quota-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => (editId === q.id ? cancelEdit() : startEdit(q))}
                        >
                          {editId === q.id ? "Close" : "Edit"}
                        </button>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mgmt-quota-footer">
        <span className="muted">Extra total (pay):</span>
        {" "}
        <strong>{formatUsd(totalCost)}</strong>
      </div>

      <form className="mgmt-gastos-form" style={{ marginTop: 16 }} onSubmit={handleSubmit}>
        <strong style={{ gridColumn: "1 / -1" }}>
          {isEditing ? "Edit meter" : "Add meter"}
        </strong>
        <QuotaMeterFields
          form={activeForm}
          setForm={setActiveForm}
          providers={providers}
        />
        <div className="admin-form-actions" style={{ gridColumn: "1 / -1" }}>
          {isEditing ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={cancelEdit}>
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            className="btn btn-sm btn-primary"
            disabled={saving || !canEditDb || !activeForm.provider}
          >
            {saving ? (isEditing ? "Saving…" : "Adding…") : (isEditing ? "Save" : "Add")}
          </button>
          {isEditing && canEditDb ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={deletingId === editId || saving}
              onClick={() => {
                if (!editId) return;
                const ok = window.confirm("Delete this meter? This does not wipe usage history yet.");
                if (!ok) return;
                handleDelete(editId);
              }}
            >
              {deletingId === editId ? "…" : "Delete"}
            </button>
          ) : null}
        </div>
        {!canEditDb ? (
          <p className="muted" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12 }}>
            Defaults are read-only until you run <code>supabase_management_quotas.sql</code>.
          </p>
        ) : null}
      </form>
    </div>
  );
}

function QuotaMeterFields({ form, setForm, providers }) {
  return (
    <>
      <label className="mgmt-filter-field">
        <span className="muted">Provider</span>
        <select
          required
          value={form.provider}
          onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
        >
          <option value="">Select…</option>
          {(providers || []).map((p) => (
            <option key={p.provider} value={p.provider}>
              {p.provider}
            </option>
          ))}
        </select>
      </label>
      <label className="mgmt-filter-field">
        <span className="muted">Meter</span>
        <input
          type="text"
          required
          placeholder="calls"
          value={form.unit}
          onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
        />
      </label>
      <label className="mgmt-filter-field">
        <span className="muted">Included (free)</span>
        <input
          type="number"
          min="0"
          step="1"
          required
          value={form.included}
          onChange={(e) => setForm((f) => ({ ...f, included: e.target.value }))}
        />
      </label>
      <label className="mgmt-filter-field">
        <span className="muted">Type</span>
        <select
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="free">Free</option>
          <option value="welcome">Welcome (one-shot)</option>
          <option value="paid">Paid</option>
        </select>
      </label>
      <label className="mgmt-filter-field">
        <span className="muted">Reset?</span>
        <select
          value={form.resets ? "yes" : "no"}
          onChange={(e) => setForm((f) => ({ ...f, resets: e.target.value === "yes" }))}
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </select>
      </label>
      {form.resets ? (
        <>
          <label className="mgmt-filter-field">
            <span className="muted">Every N</span>
            <input
              type="number"
              min="1"
              required
              value={form.everyN}
              onChange={(e) => setForm((f) => ({ ...f, everyN: e.target.value }))}
            />
          </label>
          <label className="mgmt-filter-field">
            <span className="muted">Unit</span>
            <select
              value={form.everyUnit}
              onChange={(e) => setForm((f) => ({ ...f, everyUnit: e.target.value }))}
            >
              <option value="day">day</option>
              <option value="month">month</option>
            </select>
          </label>
        </>
      ) : null}
      <label className="mgmt-filter-field">
        <span className="muted">Cost Overdue</span>
        <div className="mgmt-money-input">
          <span className="mgmt-money-input__prefix" aria-hidden>$</span>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="0.23"
            value={form.overageUsd}
            onChange={(e) => setForm((f) => ({ ...f, overageUsd: e.target.value }))}
          />
        </div>
      </label>
      <label className="mgmt-filter-field">
        <span className="muted">Anchor (YYYY-MM-DD)</span>
        <input
          type="date"
          value={form.anchorAt}
          onChange={(e) => setForm((f) => ({ ...f, anchorAt: e.target.value }))}
        />
      </label>
    </>
  );
}

/**
 * @param {{ section?: string }} props
 */
export function ManagementAdminPanel({ section = MANAGEMENT_SECTIONS.api }) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [dbWarning, setDbWarning] = useState(null);
  const [includeSeed, setIncludeSeed] = useState(true);
  const [data, setData] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    label: "",
    notes: "",
    estimatedCostUsd: "",
    enabled: true,
    lifecycleStatus: "active",
    dailyFreeLimit: "",
    metaDescription: "",
    dashboardUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [userActivityFilter, setUserActivityFilter] = useState("all");
  const [callFilters, setCallFilters] = useState(EMPTY_CALL_FILTERS);
  const [asOfYmd, setAsOfYmd] = useState(() => todayIsoDate());
  const [togglingUserId, setTogglingUserId] = useState(null);
  const [featureUsageExpanded, setFeatureUsageExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchManagementOverview({ includeSeed, asOf: asOfYmd });
      setData(result);
      setDbWarning(result.dbWarning || null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load management data");
    } finally {
      setLoading(false);
    }
  }, [includeSeed, asOfYmd]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (section !== MANAGEMENT_SECTIONS.api) setEditId(null);
  }, [section]);

  function startEdit(integration) {
    setEditId(integration.id);
    setEditForm({
      label: integration.label || "",
      notes: integration.notes || "",
      estimatedCostUsd: String(integration.estimatedCostUsd ?? 0),
      enabled: integration.enabled !== false,
      lifecycleStatus: integration.lifecycleStatus === "pending" ? "pending" : "active",
      dailyFreeLimit:
        integration.dailyFreeLimit == null ? "" : String(integration.dailyFreeLimit),
      metaDescription: integration.metaDescription || "",
      dashboardUrl: integration.dashboardUrl || "",
    });
  }

  async function handleSaveIntegration(e) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const limitRaw = editForm.dailyFreeLimit.trim();
      await patchManagementIntegration(editId, {
        label: editForm.label,
        notes: editForm.notes,
        enabled: editForm.enabled,
        estimatedCostUsd: Number(editForm.estimatedCostUsd) || 0,
        lifecycleStatus: editForm.lifecycleStatus,
        dailyFreeLimit: limitRaw === "" ? null : Number(limitRaw),
        metaDescription: editForm.metaDescription,
        dashboardUrl: editForm.dashboardUrl,
      });
      setEditId(null);
      await load();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleQuotaActive(user) {
    const next = user.quotaActive === false;
    setTogglingUserId(user.userId);
    setErrorMessage(null);
    try {
      await patchManagementUserQuotaActive(user.userId, next);
      setData((prev) => {
        if (!prev?.users) return prev;
        return {
          ...prev,
          users: prev.users.map((u) => (
            u.userId === user.userId ? { ...u, quotaActive: next } : u
          )),
        };
      });
      await load();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update active status");
    } finally {
      setTogglingUserId(null);
    }
  }

  const stats = data?.stats?.totals || {
    today: 0,
    month: 0,
    allTime: 0,
    estimatedCostUsd: 0,
    estimatedCostUsdMonth: 0,
    successRatePct: null,
    successCount: 0,
    errorCount: 0,
  };
  const margin = data?.margin || {
    proSubscribers: 0,
    proTestSubscribers: 0,
    mrrUsd: 0,
    mrrSampleUsd: 0,
    apiCostMonthUsd: 0,
    opexMonthUsd: 0,
    gastosMonthUsd: 0,
    marginUsd: 0,
    listPriceUsd: 20,
  };
  const alerts = data?.alerts || [];
  const quotas = data?.quotas || { items: [], note: "", source: "defaults", totalCostToPay: 0 };
  const copy = SECTION_COPY[section] || SECTION_COPY[MANAGEMENT_SECTIONS.api];
  const showToolbar = section !== MANAGEMENT_SECTIONS.storage
    && section !== MANAGEMENT_SECTIONS.gastos;
  const filteredUsers = filterUsersByActivity(data?.users || [], userActivityFilter);
  const recentEvents = data?.recentEvents || [];
  const filteredCalls = filterRecentEvents(recentEvents, callFilters);
  const callUserOptions = uniqueSorted(recentEvents.map((e) => e.userEmail));
  const callProviderOptions = uniqueSorted(recentEvents.map((e) => e.provider));
  const callEndpointOptions = uniqueSorted(recentEvents.map((e) => e.endpoint));
  const callFiltersActive = Object.entries(callFilters).some(([k, v]) => {
    if (k === "dateFrom" || k === "dateTo") return Boolean(v);
    return v !== "all";
  });

  function setCallFilter(key, value) {
    setCallFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="mgmt-panel">
      <div className="admin-panel__head">
        <div>
          <p className="mgmt-breadcrumb muted">Management</p>
          <h1 className="admin-card__title" style={{ fontSize: 18, marginBottom: 0 }}>
            {copy.title}
            {section === MANAGEMENT_SECTIONS.users && data?.users?.length ? (
              <span className="mgmt-count-badge">{data.users.length}</span>
            ) : null}
            {section === MANAGEMENT_SECTIONS.calls && recentEvents.length ? (
              <span className="mgmt-count-badge">{filteredCalls.length}</span>
            ) : null}
          </h1>
        </div>
        {showToolbar ? (
          <div className="admin-form-actions">
            <label className="mgmt-seed-toggle">
              <input
                type="checkbox"
                checked={includeSeed}
                onChange={(e) => setIncludeSeed(e.target.checked)}
              />
              Include seed data
            </label>
            <button type="button" className="btn btn-sm btn-primary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="admin-error">{errorMessage}</div>
      ) : null}

      {section !== MANAGEMENT_SECTIONS.storage && section !== MANAGEMENT_SECTIONS.gastos ? (
        <>
          {dbWarning ? (
            <div className="mgmt-setup-banner">
              <strong>Configuración requerida</strong>
              <p>{dbWarning}</p>
              <ol className="mgmt-setup-steps">
                <li>
                  Supabase → <strong>Settings → API</strong> → copia la clave <code>service_role</code>
                </li>
                <li>
                  Pégala en <code>.env.local</code> como <code>FUTURA_SUPABASE_SERVICE_ROLE_KEY=...</code>
                </li>
                <li>Reinicia <code>npm run dev</code> y pulsa Refresh</li>
              </ol>
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                Alternativa sin service role: ejecuta <code>supabase_management.sql</code> +{" "}
                <code>supabase_management_integrations_v2.sql</code> y en SQL Editor:
                <code> INSERT INTO admin_allowlist (email) VALUES (&apos;tu-email-admin&apos;);</code>
              </p>
            </div>
          ) : null}
          {data?.usersWarning ? (
            <div className="mgmt-setup-banner mgmt-setup-banner--warn">
              <strong>Solo se muestra tu cuenta</strong>
              <p>{data.usersWarning}</p>
            </div>
          ) : null}
          {data?.usersSource === "rpc" && (data?.users?.length ?? 0) > 0 ? (
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              {data.users.length} cuentas cargadas vía admin_allowlist (sin service role).
            </p>
          ) : null}
        </>
      ) : null}

      {section === MANAGEMENT_SECTIONS.api ? (
        <>
          <section className="mgmt-kpi-row admin-card">
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">Calls today</span>
              <strong className="mgmt-kpi__value">{stats.today}</strong>
            </div>
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">Calls this month</span>
              <strong className="mgmt-kpi__value">{stats.month}</strong>
            </div>
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">All-time calls</span>
              <strong className="mgmt-kpi__value">{stats.allTime}</strong>
            </div>
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">Est. cost (all-time)</span>
              <strong className="mgmt-kpi__value">{formatUsd(stats.estimatedCostUsd)}</strong>
            </div>
          </section>

          <section className="mgmt-kpi-row admin-card">
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">Success rate</span>
              <strong className="mgmt-kpi__value">{formatPct(stats.successRatePct)}</strong>
              <span className="mgmt-kpi__hint muted">
                {stats.successCount ?? 0} ok · {stats.errorCount ?? 0} err
              </span>
            </div>
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">API $ this month</span>
              <strong className="mgmt-kpi__value">{formatUsd(stats.estimatedCostUsdMonth)}</strong>
              {data?.budgetUsd != null ? (
                <span className="mgmt-kpi__hint muted">Budget ${Number(data.budgetUsd).toFixed(2)}</span>
              ) : null}
            </div>
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">Gastos / mes</span>
              <strong className="mgmt-kpi__value">{formatUsdShort(margin.gastosMonthUsd ?? margin.opexMonthUsd)}</strong>
              <span className="mgmt-kpi__hint muted">Desde Gastos (anual ÷ 12)</span>
            </div>
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">Paid MRR</span>
              <strong className="mgmt-kpi__value">{formatUsdShort(margin.mrrUsd)}</strong>
              <span className="mgmt-kpi__hint muted">
                {margin.proSubscribers ?? 0} Pro · sample {formatUsdShort(margin.mrrSampleUsd)}
                {(margin.proTestSubscribers ?? 0) > 0 ? ` · ${margin.proTestSubscribers} test` : ""}
              </span>
            </div>
            <div className="mgmt-kpi">
              <span className="mgmt-kpi__label">Margin</span>
              <strong
                className={`mgmt-kpi__value${Number(margin.marginUsd) < 0 ? " is-neg" : ""}`}
              >
                {formatUsdShort(margin.marginUsd)}
              </strong>
              <span className="mgmt-kpi__hint muted">Paid MRR − API$ − Gastos</span>
            </div>
          </section>

          {alerts.length > 0 ? (
            <ul className="mgmt-alerts__list mgmt-alerts__list--mini" aria-label="Alerts">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className={`mgmt-alert mgmt-alert--mini mgmt-alert--${a.level === "danger" ? "danger" : "warn"}`}
                >
                  {a.message}
                </li>
              ))}
            </ul>
          ) : null}

          <section className="admin-card">
            <div className="mgmt-users-toolbar" style={{ marginBottom: 12 }}>
              <h2 className="mgmt-section-title" style={{ margin: 0 }}>Integrations</h2>
              <a
                className="mgmt-download-link"
                style={{ marginLeft: "auto" }}
                href="/management-api-integrations.sheets.csv"
                download="management-api-integrations.sheets.csv"
              >
                CSV
              </a>
            </div>
            <div className="mgmt-table-wrap">
              <table className="mgmt-table mgmt-table--integrations">
                <thead>
                  <tr>
                    <th>API</th>
                    <th>Meta</th>
                    <th>Status</th>
                    <th>Env / probe</th>
                    <th>Free / day</th>
                    <th>Used today</th>
                    <th>Cost / unit</th>
                    <th>Calls today</th>
                    <th>Total calls</th>
                    <th>Est. $ today</th>
                    <th>Dashboard</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data?.integrations || []).length === 0 ? (
                    <tr>
                      <td colSpan={12} className="muted">
                        No integrations — run supabase_management.sql (+ v2/v3) or Refresh.
                      </td>
                    </tr>
                  ) : (
                    (data?.integrations || []).map((integration) => (
                      <tr
                        key={integration.id}
                        className={
                          integration.lifecycleStatus === "pending"
                            ? "mgmt-row--pending"
                            : undefined
                        }
                      >
                        <td>
                          <strong>{integration.label}</strong>
                          <div className="muted" style={{ fontSize: 11 }}>
                            {integration.id}
                          </div>
                        </td>
                        <td className="mgmt-meta-cell" title={integration.metaDescription || ""}>
                          {integration.metaDescription || (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <LifecycleBadge status={integration.lifecycleStatus} />
                        </td>
                        <td>
                          <StatusBadge ok={integration.ok} configured={integration.configured} />
                          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                            {integration.envVar || "—"}
                          </div>
                        </td>
                        <td className="muted">
                          {integration.dailyFreeLimit == null
                            ? "—"
                            : integration.dailyFreeLimit}
                        </td>
                        <td>
                          <FreeLimitCell
                            used={integration.callsToday || 0}
                            limit={integration.dailyFreeLimit}
                          />
                        </td>
                        <td>{formatUsd(integration.estimatedCostUsd)}</td>
                        <td>{integration.callsToday ?? 0}</td>
                        <td>{integration.callsTotal ?? 0}</td>
                        <td className="muted">
                          {formatUsd(integration.estimatedCostTodayUsd ?? 0)}
                        </td>
                        <td>
                          {integration.dashboardUrl ? (
                            <a
                              className="mgmt-dash-link"
                              href={integration.dashboardUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Open
                            </a>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => startEdit(integration)}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {editId ? (
            <section className="admin-card">
              <h2 className="mgmt-section-title">Edit integration · {editId}</h2>
              <form onSubmit={handleSaveIntegration} className="admin-form-grid">
                <label className="admin-field">
                  Label
                  <input
                    className="auth-split-input"
                    value={editForm.label}
                    onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </label>
                <label className="admin-field">
                  Lifecycle
                  <select
                    className="auth-split-input"
                    value={editForm.lifecycleStatus}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, lifecycleStatus: e.target.value }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
                <label className="admin-field">
                  Est. cost USD / call
                  <input
                    className="auth-split-input"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={editForm.estimatedCostUsd}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, estimatedCostUsd: e.target.value }))
                    }
                  />
                </label>
                <label className="admin-field">
                  Free limit / day
                  <input
                    className="auth-split-input"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Empty = none"
                    value={editForm.dailyFreeLimit}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, dailyFreeLimit: e.target.value }))
                    }
                  />
                </label>
                <label className="admin-field" style={{ gridColumn: "1 / -1" }}>
                  Meta description
                  <textarea
                    className="auth-split-input"
                    rows={2}
                    value={editForm.metaDescription}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, metaDescription: e.target.value }))
                    }
                    placeholder="Qué hace esta API en Futura Nota…"
                  />
                </label>
                <label className="admin-field" style={{ gridColumn: "1 / -1" }}>
                  Dashboard URL (acceso rápido)
                  <input
                    className="auth-split-input"
                    type="url"
                    value={editForm.dashboardUrl}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, dashboardUrl: e.target.value }))
                    }
                    placeholder="https://…"
                  />
                </label>
                <label className="admin-field" style={{ gridColumn: "1 / -1" }}>
                  Notes
                  <textarea
                    className="auth-split-input"
                    rows={2}
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </label>
                <label className="mgmt-seed-toggle">
                  <input
                    type="checkbox"
                    checked={editForm.enabled}
                    onChange={(e) => setEditForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                  Enabled in catalog
                </label>
                <div className="admin-form-actions" style={{ gridColumn: "1 / -1" }}>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setEditId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="mgmt-pie-row admin-card">
            <PieBlock title="Calls by provider" data={data?.stats?.byProvider || []} />
            <TopEndpointsBar data={data?.stats?.byEndpoint || []} />
          </section>

          <EndpointCreditMatrix rows={data?.stats?.endpointMatrix || []} />
        </>
      ) : null}

      {section === MANAGEMENT_SECTIONS.users ? (
        <>
        <section className="admin-card">
          <div className="mgmt-users-toolbar">
            <span className="muted" style={{ fontSize: 12 }}>
              Activity
            </span>
            <div className="mgmt-filter-chips" role="group" aria-label="User activity filter">
              {[
                { id: "all", label: "All" },
                { id: "never", label: "Never called" },
                { id: "inactive_7", label: "Inactive 7d" },
                { id: "inactive_30", label: "Inactive 30d" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`mgmt-filter-chip${userActivityFilter === opt.id ? " is-active" : ""}`}
                  onClick={() => setUserActivityFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="muted" style={{ fontSize: 12, marginLeft: "auto" }}>
              {filteredUsers.length} / {(data?.users || []).length}
            </span>
          </div>
          <div className="mgmt-table-wrap">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Credits</th>
                  <th>Tokens</th>
                  <th>Total calls</th>
                  <th>API cost $</th>
                  <th>Last call</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      {(data?.users || []).length === 0
                        ? "No users — set FUTURA_SUPABASE_SERVICE_ROLE_KEY and ensure profiles exist in Supabase."
                        : "No users match this activity filter."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        {u.email}
                        {u.isAdmin ? (
                          <span className="mgmt-badge mgmt-badge--ok" style={{ marginLeft: 8 }}>
                            admin
                          </span>
                        ) : null}
                        {u.isTest ? (
                          <span className="mgmt-badge mgmt-badge--pending" style={{ marginLeft: 8 }}>
                            test
                          </span>
                        ) : null}
                      </td>
                      <td>{u.plan === "pro" ? "Pro" : "Starter"}</td>
                      <td>
                        <strong>{u.creditsLabel}</strong>
                      </td>
                      <td className="muted">
                        {u.plan === "pro"
                          ? `${u.tokensBalance ?? "—"} / ${u.tokensCap ?? "—"}`
                          : "—"}
                      </td>
                      <td>{u.totalCalls}</td>
                      <td>
                        <strong>{formatUsd(u.apiCostUsd ?? 0)}</strong>
                      </td>
                      <td className="muted">{formatDate(u.lastCallAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className={`admin-card mgmt-feature-usage${featureUsageExpanded ? " is-expanded" : ""}`}
          style={{ marginTop: 16 }}
        >
          <div className="mgmt-users-toolbar">
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Feature usage
            </h3>
            <button
              type="button"
              className={`mgmt-expand-toggle${featureUsageExpanded ? " is-expanded" : ""}`}
              aria-pressed={featureUsageExpanded}
              onClick={() => setFeatureUsageExpanded((open) => !open)}
              title={featureUsageExpanded ? "Fit table to column" : "Widen table, no horizontal scroll"}
            >
              <svg
                className="mgmt-expand-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                {featureUsageExpanded ? (
                  <path
                    d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : (
                  <path
                    d="M9 4H4v5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
              {featureUsageExpanded ? "Compact" : "Expand"}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginLeft: "auto" }}
              disabled={filteredUsers.length === 0}
              onClick={() => downloadUserFeaturesCsv(filteredUsers)}
            >
              Export CSV
            </button>
          </div>
          <div className="mgmt-table-wrap">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Plan</th>
                  <th>Date (free)</th>
                  <th>Date (Pro)</th>
                  <th>Next Date</th>
                  <th>Status</th>
                  {USER_FEATURE_COLUMNS.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6 + USER_FEATURE_COLUMNS.length} className="muted">
                      No users to show.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const f = u.features || {};
                    const isActive = u.quotaActive !== false;
                    const planDates = resolveUserPlanDates({
                      plan: u.plan,
                      freeStartedAt: u.profileCreatedAt,
                      proStartedAt: u.planUpgradedAt,
                    });
                    return (
                      <tr
                        key={`feat-${u.userId}`}
                        className={isActive ? undefined : "mgmt-row--inactive"}
                      >
                        <td>{u.email}</td>
                        <td>{u.plan === "pro" ? "Pro" : "Starter"}</td>
                        <td className="muted">{planDates.freeYmd || "—"}</td>
                        <td>
                          {planDates.proYmd || <span className="muted">—</span>}
                          {planDates.daysToPro != null ? (
                            <div className="muted mgmt-plan-date-hint">{planDates.daysToPro}d</div>
                          ) : null}
                        </td>
                        <td
                          className="muted"
                          title={
                            planDates.anchorKind === "pro"
                              ? "Monthly reset from Pro date"
                              : planDates.anchorKind === "free"
                                ? "Monthly reset from free date"
                                : ""
                          }
                        >
                          {planDates.nextYmd || "—"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`mgmt-active-toggle${isActive ? " is-active" : " is-inactive"}`}
                            disabled={togglingUserId === u.userId}
                            onClick={() => handleToggleQuotaActive(u)}
                            title={isActive
                              ? "Counts toward Supabase storage pool"
                              : "Excluded from Supabase storage pool"}
                          >
                            {togglingUserId === u.userId
                              ? "…"
                              : (isActive ? "Active" : "Inactive")}
                          </button>
                        </td>
                        {USER_FEATURE_COLUMNS.map((col) => (
                          <td key={col.key} className="muted">
                            {f[col.key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        </>
      ) : null}

      {section === MANAGEMENT_SECTIONS.calls ? (
        <section className="admin-card">
          <div className="mgmt-calls-toolbar">
            <label className="mgmt-filter-field">
              <span className="muted">User</span>
              <select
                value={callFilters.user}
                onChange={(e) => setCallFilter("user", e.target.value)}
              >
                <option value="all">All</option>
                <option value="__empty__">(no email)</option>
                {callUserOptions.map((email) => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </label>
            <label className="mgmt-filter-field">
              <span className="muted">Provider</span>
              <select
                value={callFilters.provider}
                onChange={(e) => setCallFilter("provider", e.target.value)}
              >
                <option value="all">All</option>
                {callProviderOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="mgmt-filter-field">
              <span className="muted">Endpoint</span>
              <select
                value={callFilters.endpoint}
                onChange={(e) => setCallFilter("endpoint", e.target.value)}
              >
                <option value="all">All</option>
                {callEndpointOptions.map((ep) => (
                  <option key={ep} value={ep}>{ep}</option>
                ))}
              </select>
            </label>
            <label className="mgmt-filter-field">
              <span className="muted">Status</span>
              <select
                value={callFilters.status}
                onChange={(e) => setCallFilter("status", e.target.value)}
              >
                <option value="all">All</option>
                <option value="success">success</option>
                <option value="error">error</option>
              </select>
            </label>
            <label className="mgmt-filter-field">
              <span className="muted">From</span>
              <input
                type="date"
                value={callFilters.dateFrom}
                onChange={(e) => setCallFilter("dateFrom", e.target.value)}
              />
            </label>
            <label className="mgmt-filter-field">
              <span className="muted">To</span>
              <input
                type="date"
                value={callFilters.dateTo}
                onChange={(e) => setCallFilter("dateTo", e.target.value)}
              />
            </label>
            <div className="mgmt-calls-toolbar__actions">
              {callFiltersActive ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setCallFilters(EMPTY_CALL_FILTERS)}
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={filteredCalls.length === 0}
                onClick={() => downloadRecentCallsCsv(filteredCalls)}
              >
                Export CSV
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                {filteredCalls.length} / {recentEvents.length}
              </span>
            </div>
          </div>
          <div className="mgmt-table-wrap">
            <table className="mgmt-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Provider</th>
                    <th>Endpoint</th>
                    <th>Credits</th>
                    <th>Plan tok</th>
                    <th>In/Out</th>
                    <th>Est. $</th>
                    <th>Status</th>
                    <th>Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCalls.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="muted">
                        {recentEvents.length === 0
                          ? "No calls yet. Run an Intel search from /app or `npm run seed:management`."
                          : "No calls match these filters."}
                      </td>
                    </tr>
                  ) : (
                    filteredCalls.map((ev) => (
                      <tr key={ev.id}>
                        <td className="muted">{formatDate(ev.createdAt)}</td>
                        <td>{ev.userEmail || "—"}</td>
                        <td>
                          {ev.provider}
                          {ev.billed === false ? (
                            <span className="mgmt-badge mgmt-badge--pending" style={{ marginLeft: 6 }}>
                              mock
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {ev.endpoint}
                          {ev.model ? (
                            <div className="muted" style={{ fontSize: 10 }}>{ev.model}</div>
                          ) : null}
                        </td>
                        <td>{ev.creditsDebited || "—"}</td>
                        <td>{ev.tokensDebited || "—"}</td>
                        <td className="muted">
                          {(ev.inputTokens || ev.outputTokens)
                            ? `${ev.inputTokens || 0}/${ev.outputTokens || 0}`
                            : (ev.computeUnits != null ? `${ev.computeUnits} CU` : "—")}
                        </td>
                        <td className="muted">{formatUsd(ev.estimatedCostUsd)}</td>
                        <td>
                          <span
                            className={`mgmt-badge mgmt-badge--${ev.status === "success" ? "ok" : "error"}`}
                          >
                            {ev.status}
                          </span>
                        </td>
                        <td className="muted mgmt-preview">{ev.queryPreview || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === MANAGEMENT_SECTIONS.gastos ? (
        <>
          <div className="admin-form-actions" style={{ marginBottom: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <GastosSection
            gastos={data?.gastos}
            onChanged={load}
            onError={(msg) => setErrorMessage(msg || null)}
          />
        </>
      ) : null}

      {section === MANAGEMENT_SECTIONS.storage ? (
        <>
          <div className="admin-form-actions" style={{ marginBottom: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
          <section className="admin-card">
            <StorageQuotasSection
              quotas={quotas}
              storageSpend={data?.storageSpend}
              asOf={asOfYmd}
              onAsOfChange={setAsOfYmd}
              onChanged={load}
              onError={(msg) => setErrorMessage(msg || null)}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
