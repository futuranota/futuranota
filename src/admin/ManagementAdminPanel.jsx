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

const PIE_COLORS = [
  "#7ec8ff",
  "#e8a87c",
  "#85d4a0",
  "#c9a0ff",
  "#ff9eb5",
  "#ffd166",
  "#6ee7d8",
];

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
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

export function ManagementAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [dbWarning, setDbWarning] = useState(null);
  const [includeSeed, setIncludeSeed] = useState(true);
  const [data, setData] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", notes: "", estimatedCostUsd: "", enabled: true });
  const [saving, setSaving] = useState(false);

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

  function startEdit(integration) {
    setEditId(integration.id);
    setEditForm({
      label: integration.label || "",
      notes: integration.notes || "",
      estimatedCostUsd: String(integration.estimatedCostUsd ?? 0),
      enabled: integration.enabled !== false,
    });
  }

  async function handleSaveIntegration(e) {
    e.preventDefault();
    if (!editId) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await patchManagementIntegration(editId, {
        label: editForm.label,
        notes: editForm.notes,
        enabled: editForm.enabled,
        estimatedCostUsd: Number(editForm.estimatedCostUsd) || 0,
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

  return (
    <div className="mgmt-panel">
      <div className="admin-panel__head">
        <div>
          <h1 className="admin-card__title" style={{ fontSize: 18, marginBottom: 6 }}>
            Management
          </h1>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            API integrations, usage calls, and Futura Nota account metrics. Keys stay in `.env.local` / Vercel — never stored here.
          </p>
        </div>
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
      </div>

      {errorMessage ? <div className="admin-error">{errorMessage}</div> : null}
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
            Alternativa sin service role: ejecuta <code>supabase_management.sql</code> y en SQL Editor:
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
        <h2 className="mgmt-section-title">API integrations</h2>
        <p className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
          Status from env + health probe. Edit estimated cost per call for expense tracking.
        </p>
        <div className="mgmt-grid">
          {(data?.integrations || []).map((integration) => (
            <article key={integration.id} className="mgmt-api-card">
              <div className="mgmt-api-card__head">
                <strong>{integration.label}</strong>
                <StatusBadge ok={integration.ok} configured={integration.configured} />
              </div>
              <p className="muted mgmt-api-card__env">
                {integration.envVar || "—"}
                {integration.configured ? " · set" : " · missing"}
              </p>
              <p className="mgmt-api-card__msg">{integration.statusMessage}</p>
              <p className="muted" style={{ fontSize: 11 }}>
                Est. {formatUsd(integration.estimatedCostUsd)} / call
                {integration.latencyMs != null ? ` · ${integration.latencyMs}ms` : ""}
              </p>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                style={{ marginTop: 10 }}
                onClick={() => startEdit(integration)}
              >
                Edit metadata
              </button>
            </article>
          ))}
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
              Est. cost USD / call
              <input
                className="auth-split-input"
                type="number"
                step="0.0001"
                min="0"
                value={editForm.estimatedCostUsd}
                onChange={(e) => setEditForm((f) => ({ ...f, estimatedCostUsd: e.target.value }))}
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
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditId(null)}>
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

      <section className="admin-card">
        <h2 className="mgmt-section-title">
          Users
          {data?.users?.length ? (
            <span className="mgmt-count-badge">{data.users.length}</span>
          ) : null}
        </h2>
        <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
          All accounts from Supabase — plan and credits from <code>profiles</code>.
        </p>
        <div className="mgmt-table-wrap">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Credits</th>
                <th>Tokens</th>
                <th>Total calls</th>
                <th>Last call</th>
              </tr>
            </thead>
            <tbody>
              {(data?.users || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No users — set FUTURA_SUPABASE_SERVICE_ROLE_KEY and ensure profiles exist in Supabase.
                  </td>
                </tr>
              ) : (
                data.users.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      {u.email}
                      {u.isAdmin ? <span className="mgmt-badge mgmt-badge--ok" style={{ marginLeft: 8 }}>admin</span> : null}
                    </td>
                    <td>{u.plan === "pro" ? "Pro" : "Starter"}</td>
                    <td><strong>{u.creditsLabel}</strong></td>
                    <td className="muted">
                      {u.plan === "pro"
                        ? `${u.tokensBalance ?? "—"} / ${u.tokensCap ?? "—"}`
                        : "—"}
                    </td>
                    <td>{u.totalCalls}</td>
                    <td className="muted">{formatDate(u.lastCallAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2 className="mgmt-section-title">Recent calls</h2>
        <div className="mgmt-table-wrap">
          <table className="mgmt-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Provider</th>
                <th>Endpoint</th>
                <th>Credits</th>
                <th>Tokens</th>
                <th>Est.</th>
                <th>Status</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentEvents || []).length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No calls yet. Run an Intel search from /app or `npm run seed:management`.
                  </td>
                </tr>
              ) : (
                data.recentEvents.map((ev) => (
                  <tr key={ev.id}>
                    <td className="muted">{formatDate(ev.createdAt)}</td>
                    <td>{ev.userEmail || "—"}</td>
                    <td>{ev.provider}</td>
                    <td>{ev.endpoint}</td>
                    <td>{ev.creditsDebited || "—"}</td>
                    <td>{ev.tokensDebited || "—"}</td>
                    <td className="muted">{formatUsd(ev.estimatedCostUsd)}</td>
                    <td>
                      <span className={`mgmt-badge mgmt-badge--${ev.status === "success" ? "ok" : "error"}`}>
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
    </div>
  );
}
