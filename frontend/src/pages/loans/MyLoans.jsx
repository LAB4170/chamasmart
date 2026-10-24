import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { loanAPI } from "../../services/api";
import { Button, PageHeader, StatCard, StatusBadge, EmptyState, Skeleton } from "../../components/ui";
import { formatKES, formatDate } from "../../utils/format";

const ACTIVE = ["APPROVED", "DISBURSED", "DEFAULTED"];
const FILTERS = [
  { id: "ACTIVE", label: "Active" },
  { id: "PENDING", label: "Pending" },
  { id: "PAID", label: "Completed" },
  { id: "ALL", label: "All" },
];
const STATUS_LABELS = { PENDING: "Pending review", DISBURSED: "Active", APPROVED: "Approved", COMPLETED: "Paid off", PAID_OFF: "Paid off" };

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const isOverdue = (l) => ACTIVE.includes(l.status) && num(l.balance) > 0 && l.due_date && new Date(l.due_date) < new Date(new Date().toDateString());
const progress = (l) => { const total = num(l.total_repayable); return total > 0 ? Math.min(100, Math.round((num(l.amount_paid) / total) * 100)) : 0; };

export default function MyLoans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("ACTIVE");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await loanAPI.getUserLoans();
      const raw = res.data?.data ?? res.data;
      setLoans(Array.isArray(raw) ? raw : raw?.loans || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Every figure below is computed from the member's own loan records, so it always reconciles with the list.
  const totals = useMemo(() => {
    const active = loans.filter((l) => ACTIVE.includes(l.status));
    return {
      owed: active.reduce((s, l) => s + num(l.balance), 0),
      repaid: loans.reduce((s, l) => s + num(l.amount_paid), 0),
      activeCount: active.length,
    };
  }, [loans]);

  const visible = useMemo(() => loans.filter((l) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return ACTIVE.includes(l.status);
    if (filter === "PENDING") return l.status === "PENDING";
    return l.status === "COMPLETED" || l.status === "PAID_OFF";
  }), [loans, filter]);

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="My loans" subtitle="What you've borrowed from your chamas and how much is left to repay."
          actions={<Link to="/my-guarantees" className="cs-btn cs-btn--secondary">Loans I guarantee</Link>} />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load your loans.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-grid" aria-busy="true" aria-label="Loading your loans">
            {[0, 1, 2].map((i) => <div key={i} className="cs-card"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>)}
          </div>
        ) : !error && (
          <>
            <div className="cs-grid">
              <StatCard label="You still owe" value={formatKES(totals.owed)} note="On active loans" />
              <StatCard label="Repaid so far" value={formatKES(totals.repaid)} note="Across all your loans" />
              <StatCard label="Active loans" value={totals.activeCount} />
            </div>

            <section className="cs-section" aria-labelledby="loan-list">
              <h2 id="loan-list" className="cs-section-title">Loans</h2>
              <div className="cs-chips" role="group" aria-label="Filter loans" style={{ marginBottom: 16 }}>
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" className="cs-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
                ))}
              </div>

              {visible.length === 0 ? (
                <div className="cs-card">
                  <EmptyState title={loans.length === 0 ? "No loans yet" : "No loans in this view"}
                    message={loans.length === 0 ? "When you borrow from one of your chamas, the loan and its repayments will appear here." : "Try another filter to see your other loans."}
                    action={loans.length === 0 ? <Link to="/chamas" className="cs-btn cs-btn--primary">Go to my chamas</Link> : <Button onClick={() => setFilter("ALL")}>Show all loans</Button>} />
                </div>
              ) : (
                <div className="cs-loan-grid">
                  {visible.map((l) => {
                    const pct = progress(l);
                    const canRepay = ACTIVE.includes(l.status) && num(l.balance) > 0;
                    return (
                      <article key={l.loan_id} className="cs-card cs-loan">
                        <header className="cs-loan-head">
                          <div className="cs-list-main">
                            <h3 className="cs-loan-title">{l.chama_name}</h3>
                            <div className="cs-list-meta">{l.purpose || "No purpose given"}</div>
                          </div>
                          <StatusBadge status={isOverdue(l) ? "OVERDUE" : l.status} label={isOverdue(l) ? "Overdue" : STATUS_LABELS[l.status]} />
                        </header>
                        <dl className="cs-kv">
                          <div><dt>Borrowed</dt><dd>{formatKES(l.loan_amount)}</dd></div>
                          <div><dt>Left to repay</dt><dd>{formatKES(l.balance)}</dd></div>
                          <div><dt>Interest</dt><dd>{l.interest_rate != null ? `${num(l.interest_rate)}%` : "—"}</dd></div>
                          <div><dt>Due date</dt><dd>{formatDate(l.due_date)}</dd></div>
                        </dl>
                        <div>
                          <div className="cs-progress-label"><span>Repaid</span><span>{pct}%</span></div>
                          <div className="cs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Repayment progress for ${l.chama_name}`}>
                            <span style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <footer className="cs-actions">
                          <Link to={`/chamas/${l.chama_id}/loans`} className="cs-btn cs-btn--secondary cs-btn--sm">Details</Link>
                          {canRepay && <Link to={`/chamas/${l.chama_id}/loans/${l.loan_id}/repay`} className="cs-btn cs-btn--primary cs-btn--sm">Repay</Link>}
                        </footer>
                      </article>
                    );
                  })}
                </div>
              )}
              <p className="cs-footnote">{visible.length} of {loans.length} {loans.length === 1 ? "loan" : "loans"}</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
