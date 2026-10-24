import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ascaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { Button, PageHeader, StatCard, EmptyState, Skeleton, DataTable } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

export default function AscaDashboard() {
  const { id } = useParams();
  const { user } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await ascaAPI.getEquity(id);
      const list = res.data?.data ?? [];
      setCycles(Array.isArray(list) ? list : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cycle = cycles.find((c) => c.status === "ACTIVE") || cycles[0] || null;
  const members = cycle?.members ?? [];
  const mine = members.find((m) => String(m.user_id) === String(user?.user_id));
  const totalOwned = members.reduce((s, m) => s + (m.shares_owned || 0), 0);
  const myShares = mine?.shares_owned || 0;
  const price = Number(cycle?.share_price || 0);
  const ownership = totalOwned > 0 ? (myShares / totalOwned) * 100 : 0;

  const columns = [
    { key: "member_name", header: "Member" },
    { key: "shares_owned", header: "Shares", align: "num" },
    { key: "total_investment", header: "Invested", align: "num", sortValue: (r) => Number(r.total_investment || 0), render: (r) => formatKES(r.total_investment) },
  ];

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Shares"
          subtitle="Who owns what in the chama's share pool."
          actions={(
            <>
              <Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>
              <Link to={`/chamas/${id}/asca/buy-shares`} className="cs-btn cs-btn--primary">Record share purchase</Link>
            </>
          )}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load the share cycle.</span><Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading shares"><Skeleton height={20} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></div>
        ) : !error && (!cycle ? (
          <div className="cs-card"><EmptyState title="No share cycle yet" message="An official needs to start a share cycle before shares can be recorded." /></div>
        ) : (
          <>
            <p className="cs-list-meta" style={{ marginBottom: 12 }}>
              {cycle.cycle_name} · {formatDate(cycle.start_date)} to {formatDate(cycle.end_date)} · {formatKES(price)} a share
            </p>
            <div className="cs-grid" style={{ marginBottom: 16 }}>
              <StatCard label="Your shares" value={String(myShares)} note={`Worth ${formatKES(myShares * price)} at today's price`} />
              <StatCard label="Your ownership" value={`${ownership.toFixed(1)}%`} note="Share of shares sold so far" />
              <StatCard label="Shares still available" value={String(cycle.available_shares ?? 0)} note={`${cycle.total_shares ?? 0} in total`} />
            </div>
            <section className="cs-card" aria-label="Shareholders">
              <h2 className="cs-card-title">Shareholders</h2>
              <DataTable columns={columns} rows={members} rowKey={(r) => r.membership_id} caption="Shareholders in this cycle" emptyMessage="No shares have been recorded yet." summarize={(rs) => `${rs.reduce((t, r) => t + (r.shares_owned || 0), 0)} shares · ${formatKES(rs.reduce((t, r) => t + Number(r.total_investment || 0), 0))} invested`} />
            </section>
            <p className="cs-footnote">Dividends and investment proposals aren&apos;t available yet. Share purchases are recorded by an official once payment is received.</p>
          </>
        ))}
      </main>
    </div>
  );
}
