import { useState, useEffect, useCallback } from "react";
import { loanAPI } from "../../../services/api";
import { Button, StatCard, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const STATUS_LABELS = {
  PENDING: "Pending", APPROVED: "Approved", DISBURSED: "Disbursed", ACTIVE: "Active",
  COMPLETED: "Repaid", DEFAULTED: "Defaulted", REJECTED: "Rejected",
};

/** Portfolio figures come straight from the server, which computes them from the chama's loan records. */
export default function LoanAnalyticsDashboard({ chamaId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await loanAPI.getAnalytics(chamaId);
      setData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.status === 403 ? "Only officials can view loan analytics." : "We couldn't load the analytics.");
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="cs-card" aria-busy="true" aria-label="Loading analytics"><Skeleton height={14} width="40%" /><Skeleton height={40} style={{ marginTop: 12 }} /></div>;
  if (error) {
    return (
      <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span>{error}</span>
        <Button size="sm" onClick={load}>Try again</Button>
      </div>
    );
  }
  if (!data) return null;

  const statuses = Object.entries(data.by_status || {});
  return (
    <section aria-label="Loan analytics">
      <div className="cs-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Loans" value={String(data.total_loans ?? 0)} />
        <StatCard label="Total lent" value={formatKES(data.total_disbursed)} />
        <StatCard label="Repaid so far" value={formatKES(data.total_repaid)} />
        <StatCard label="Still owed" value={formatKES(data.outstanding_balance)} />
        <StatCard label="In default" value={formatKES(data.defaulted_balance)} note={`${data.default_rate_percent ?? 0}% of what is owed`} />
      </div>
      <div className="cs-card">
        <h2 className="cs-card-title">Loans by status</h2>
        {statuses.length === 0 ? <p className="cs-list-meta">No loans yet.</p> : (
          <ul className="cs-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {statuses.map(([s, n]) => (
              <li key={s} className="cs-list-item"><span className="cs-list-main">{STATUS_LABELS[s] || s}</span><strong>{n}</strong></li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
