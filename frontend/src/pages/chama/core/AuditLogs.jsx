import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { auditAPI } from "../../../services/api";
import { Button, PageHeader, StatCard, DataTable } from "../../../components/ui";
import { formatKES, formatDateTime } from "../../../utils/format";

const pretty = (s) => (s || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function AuditLogs() {
  const { id } = useParams();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState({ action: "", startDate: "", endDate: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
      const [l, s] = await Promise.all([auditAPI.getChamaLogs(id, params), auditAPI.getChamaSummary(id)]);
      const raw = l.data?.data ?? [];
      setLogs(Array.isArray(raw) ? raw : []);
      setSummary(s.data?.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id, filter]);

  useEffect(() => { load(); }, [load]);

  const set = (e) => setFilter((f) => ({ ...f, [e.target.name]: e.target.value }));

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
      const res = await auditAPI.exportChamaLogs(id, "csv", params);
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("We couldn't export the log.");
    } finally {
      setExporting(false);
    }
  };

  const actions = Object.keys(summary?.by_action || {});
  const columns = [
    { key: "created_at", header: "When", sortValue: (r) => (r.created_at ? new Date(r.created_at).getTime() : 0), render: (r) => formatDateTime(r.created_at) },
    { key: "user_name", header: "Member", render: (r) => r.user_name || "System", searchText: (r) => `${r.user_name || ""} ${r.user_email || ""}` },
    { key: "action", header: "Event", render: (r) => pretty(r.action) },
    { key: "amount", header: "Amount", align: "num", sortValue: (r) => Number(r.amount || 0), render: (r) => (r.amount != null ? formatKES(r.amount) : "—") },
    { key: "details", header: "Details", render: (r) => r.details || "—" },
  ];

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Audit trail"
          subtitle="Every money event the chama has recorded. Officials only."
          actions={(
            <>
              <Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>
              <Button onClick={exportCsv} loading={exporting}>Export CSV</Button>
            </>
          )}
        />

        {summary && (
          <div className="cs-grid" style={{ marginBottom: 16 }}>
            <StatCard label="Events recorded" value={String(summary.total_events ?? 0)} />
            <StatCard label="Total amount across events" value={formatKES(summary.total_amount ?? 0)} note="Adds up all events, including reversals" />
          </div>
        )}

        <section className="cs-card" aria-label="Filters" style={{ marginBottom: 16 }}>
          <div className="cs-form-grid">
            <div className="cs-field">
              <label className="cs-label" htmlFor="al-action">Event type</label>
              <select id="al-action" name="action" className="cs-select" value={filter.action} onChange={set}>
                <option value="">All events</option>
                {actions.map((a) => <option key={a} value={a}>{pretty(a)}</option>)}
              </select>
            </div>
            <div className="cs-field"><label className="cs-label" htmlFor="al-from">From</label><input id="al-from" type="date" name="startDate" className="cs-input" value={filter.startDate} max={filter.endDate || undefined} onChange={set} /></div>
            <div className="cs-field"><label className="cs-label" htmlFor="al-to">To</label><input id="al-to" type="date" name="endDate" className="cs-input" value={filter.endDate} min={filter.startDate || undefined} onChange={set} /></div>
          </div>
        </section>

        <DataTable
          columns={columns}
          rows={logs}
          rowKey={(r) => r.audit_id}
          caption="Audit events"
          loading={loading}
          error={error ? "We couldn't load the audit trail. It is only available to officials." : undefined}
          onRetry={load}
          searchPlaceholder="Search member or details"
          emptyMessage="No events match these filters."
          summarize={(rs) => `${rs.length} events · ${formatKES(rs.reduce((t, r) => t + Number(r.amount || 0), 0))}`}
        />
      </main>
    </div>
  );
}
