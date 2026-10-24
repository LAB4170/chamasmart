import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { loanAPI } from "../../services/api";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton } from "../../components/ui";
import { formatKES, formatDate } from "../../utils/format";

const FILTERS = [
  { id: "PENDING", label: "Awaiting you" },
  { id: "APPROVED", label: "Accepted" },
  { id: "REJECTED", label: "Declined" },
  { id: "ALL", label: "All" },
];
const STATUS_LABELS = { PENDING: "Awaiting your response", APPROVED: "Accepted", REJECTED: "Declined" };

export default function MyGuarantees() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("PENDING");
  const [busy, setBusy] = useState(null);       // `${loanId}-${decision}` while a request is in flight
  const [confirming, setConfirming] = useState(null); // loanId awaiting "Confirm accept"

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await loanAPI.getMyGuarantees();
      const raw = res.data?.data?.data || res.data?.data || res.data || [];
      setItems(Array.isArray(raw) ? raw : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // The list is only refreshed after the server confirms the response was recorded.
  const respond = async (loanId, decision) => {
    setBusy(`${loanId}-${decision}`);
    try {
      await loanAPI.respondGuarantor(loanId, decision);
      toast.success(decision === "ACCEPT" ? "Guarantee accepted." : "Guarantee declined.");
      setConfirming(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't record your response. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const count = (s) => items.filter((g) => g.guarantee_status === s).length;
  const pending = count("PENDING");
  const visible = useMemo(() => (filter === "ALL" ? items : items.filter((g) => g.guarantee_status === filter)), [items, filter]);

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Loans I guarantee"
          subtitle={pending > 0 ? `${pending} ${pending === 1 ? "request needs" : "requests need"} your response.` : "Guarantee requests from members of your chamas."}
          actions={<Link to="/loans" className="cs-btn cs-btn--secondary">My loans</Link>}
        />

        <div className="cs-notice cs-notice--info" style={{ marginBottom: 16 }}>
          <span>
            Accepting a guarantee pledges your savings as security for the borrower. If they default, your savings may be used to recover the loan.
            Only accept if you trust the borrower.
          </span>
        </div>

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load your guarantee requests.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-grid" aria-busy="true" aria-label="Loading guarantee requests">
            {[0, 1].map((i) => <div key={i} className="cs-card"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>)}
          </div>
        ) : !error && (
          <section aria-label="Guarantee requests">
            <div className="cs-chips" role="group" aria-label="Filter requests" style={{ marginBottom: 16 }}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="cs-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label} ({f.id === "ALL" ? items.length : count(f.id)})
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="cs-card">
                <EmptyState title="Nothing here" message="No guarantee requests match this view." />
              </div>
            ) : (
              <div className="cs-loan-grid">
                {visible.map((g, idx) => {
                  const key = g.loan_id ?? idx;
                  const isPending = g.guarantee_status === "PENDING";
                  return (
                    <article key={`guarantee-${key}`} className="cs-card cs-loan">
                      <header className="cs-loan-head">
                        <div className="cs-list-main">
                          <h3 className="cs-loan-title">{g.borrower_name || "Member"}</h3>
                          <div className="cs-list-meta">{g.chama_name || "Chama"}</div>
                        </div>
                        <StatusBadge status={g.guarantee_status} label={STATUS_LABELS[g.guarantee_status]} />
                      </header>
                      <dl className="cs-kv">
                        <div><dt>Loan amount</dt><dd>{formatKES(g.loan_amount)}</dd></div>
                        <div><dt>Your guarantee</dt><dd>{formatKES(g.guarantee_amount)}</dd></div>
                        <div><dt>Term</dt><dd>{g.term_months ? `${g.term_months} months` : "—"}</dd></div>
                        <div><dt>Monthly payment</dt><dd>{formatKES(g.monthly_payment)}</dd></div>
                      </dl>
                      {g.purpose && <p className="cs-list-meta" style={{ margin: 0 }}>Purpose: {g.purpose}</p>}
                      <p className="cs-footnote" style={{ margin: 0 }}>Requested {formatDate(g.created_at)}</p>

                      {isPending && (confirming === g.loan_id ? (
                        <div className="cs-notice cs-notice--warning" role="group" aria-label="Confirm guarantee" style={{ flexDirection: "column" }}>
                          <span>You are pledging up to {formatKES(g.guarantee_amount)} of your savings for {g.borrower_name || "this member"}.</span>
                          <footer className="cs-actions">
                            <Button variant="primary" size="sm" loading={busy === `${g.loan_id}-ACCEPT`} disabled={busy !== null} onClick={() => respond(g.loan_id, "ACCEPT")}>Confirm and accept</Button>
                            <Button size="sm" disabled={busy !== null} onClick={() => setConfirming(null)}>Cancel</Button>
                          </footer>
                        </div>
                      ) : (
                        <footer className="cs-actions">
                          <Button variant="primary" size="sm" disabled={busy !== null} onClick={() => setConfirming(g.loan_id)}>Accept</Button>
                          <Button variant="danger" size="sm" loading={busy === `${g.loan_id}-REJECT`} disabled={busy !== null} onClick={() => respond(g.loan_id, "REJECT")}>Decline</Button>
                        </footer>
                      ))}
                    </article>
                  );
                })}
              </div>
            )}
            <p className="cs-footnote">{visible.length} of {items.length} {items.length === 1 ? "request" : "requests"}</p>
          </section>
        )}
      </main>
    </div>
  );
}
