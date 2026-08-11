import { useCallback, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  fetchManagementOverview,
  patchManagementIntegration,
} from "../lib/managementApi.js";
import { MANAGEMENT_SECTIONS } from "./AdminSidebarNav.jsx";

const PIE_COLORS = [
  "#7ec8ff",
  "#e8a87c",
  "#85d4a0",
  "#c9a0ff",
  "#ff9eb5",
  "#ffd166",
  "#6ee7d8",
];

const SECTION_COPY = {
  [MANAGEMENT_SECTIONS.api]: {
    title: "API Integrations",
    sub: "Active vs pending catalog, meta, dashboard links, free daily limits, cost/unit, and call counts. Keys stay in `.env.local` / Vercel. Run `supabase_management_integrations_v2.sql` + `v3.sql` to persist columns.",
  },
  [MANAGEMENT_SECTIONS.users]: {
    title: "Users",
    sub: "Accounts from Supabase — plan, credits, accumulated API cost $, and activity. Filter inactive users for retention.",
  },
  [MANAGEMENT_SECTIONS.calls]: {
    title: "Recent Calls",
    sub: "Latest API usage events across providers and endpoints.",
  },
  [MANAGEMENT_SECTIONS.storage]: {
    title: "Storage",
    sub: "Placeholder for file / blob storage management.",
  },
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

function PieBlock({ title, data }) {
  const hasData = data?.length > 0;
  return (
    <div className="mgmt-pie-block">
      <h3 className="mgmt-section-title">{title}</h3>
      {!hasData ? (
        <p className="muted mgmt-empty">No calls logged yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={72}
              label={({ name, value }) => `${name} (${value})`}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
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

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchManagementOverview({ includeSeed });
      setData(result);
      setDbWarning(result.dbWarning || null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load management data");
    } finally {
      setLoading(false);
    }
  }, [includeSeed]);

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

  const stats = data?.stats?.totals || { today: 0, month: 0, allTime: 0, estimatedCostUsd: 0 };
  const copy = SECTION_COPY[section] || SECTION_COPY[MANAGEMENT_SECTIONS.api];
  const showToolbar = section !== MANAGEMENT_SECTIONS.storage;
  const filteredUsers = filterUsersByActivity(data?.users || [], userActivityFilter);

  return (
    <div className="mgmt-panel">
      <div className="admin-panel__head">
        <div>
          <p className="mgmt-breadcrumb muted">Management</p>
          <h1 className="admin-card__title" style={{ fontSize: 18, marginBottom: 6 }}>
            {copy.title}
            {section === MANAGEMENT_SECTIONS.users && data?.users?.length ? (
              <span className="mgmt-count-badge">{data.users.length}</span>
            ) : null}
          </h1>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {copy.sub}
          </p>
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

      {errorMessage && section !== MANAGEMENT_SECTIONS.storage ? (
        <div className="admin-error">{errorMessage}</div>
      ) : null}

      {section !== MANAGEMENT_SECTIONS.storage ? (
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
              <span className="mgmt-kpi__label">Est. cost (logged)</span>
              <strong className="mgmt-kpi__value">{formatUsd(stats.estimatedCostUsd)}</strong>
            </div>
          </section>

          <section className="admin-card">
            <h2 className="mgmt-section-title">Integrations</h2>
            <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
              Active first, then pending. Call counts come from logged events (Intel / Campaign Study today —
              other routes land in a later logging pass).{" "}
              <a
                className="mgmt-download-link"
                href="/management-api-integrations.sheets.csv"
                download="management-api-integrations.sheets.csv"
              >
                Download CSV for Google Sheets
              </a>
            </p>
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
            <PieBlock title="Calls by endpoint" data={data?.stats?.byEndpoint || []} />
          </section>
        </>
      ) : null}

      {section === MANAGEMENT_SECTIONS.users ? (
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
      ) : null}

      {section === MANAGEMENT_SECTIONS.calls ? (
        <section className="admin-card">
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
                  {(data?.recentEvents || []).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="muted">
                        No calls yet. Run an Intel search from /app or `npm run seed:management`.
                      </td>
                    </tr>
                  ) : (
                    data.recentEvents.map((ev) => (
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

      {section === MANAGEMENT_SECTIONS.storage ? (
        <section className="admin-card mgmt-empty-section">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Nothing here yet. Storage tools will land in this subsection later.
          </p>
        </section>
      ) : null}
    </div>
  );
}
