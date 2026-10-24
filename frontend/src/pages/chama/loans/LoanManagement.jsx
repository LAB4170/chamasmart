import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { loanAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { Button, PageHeader, StatCard, StatusBadge, DataTable, Dialog, Skeleton } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";
import LoanAnalyticsDashboard from "./LoanAnalyticsDashboard";
import PendingRepayments from "./PendingRepayments";
import ArrearsList from "./ArrearsList";

const OPEN = ["APPROVED", "DISBURSED", "DEFAULTED"];
const PAID = ["COMPLETED", "PAID_OFF"];
const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "ACTIVE", label: "Active" },
  { id: "PAID", label: "Paid off" },
];
const STATUS_LABELS = { PENDING: "Awaiting review", APPROVED: "Approved", DISBURSED: "Active", COMPLETED: "Paid off", PAID_OFF: "Paid off" };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const toList = (d) => (Array.isArray(d) ? d : d?.loans || []);

export default function LoanManagement() {
  const { id } = useParams();
  const { user } = useAuth();

  const [chama, setChama] = useState(null);
  const [loans, setLoans] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [tab, setTab] = useState("LOANS");
  const [busyId, setBusyId] = useState(null);

  const [details, setDetails] = useState(null); // { loan: row, data, loading, error }
  const [approveFor, setApproveFor] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [c, l, m] = await Promise.all([chamaAPI.getById(id), loanAPI.getChamaLoans(id), chamaAPI.getMembers(id)]);
      setChama(c.data?.data || c.data);
      setLoans(toList(l.data?.data));
      setMembers(m.data?.data || m.data || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const refreshLoans = async () => {
    const res = await loanAPI.getChamaLoans(id);
    setLoans(toList(res.data?.data));
  };

  const myRole = members.find((m) => m.user_id === user?.id)?.role || "MEMBER";
  const isOfficial = ["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(myRole);

  const approve = async () => {
    const loan = approveFor;
    setBusyId(loan.loan_id);
    try {
      const res = await loanAPI.approve(id, loan.loan_id);
      toast[res.data?.message?.includes("already approved") ? "info" : "success"](res.data?.message?.includes("already approved") ? "This loan was already approved." : "Loan approved.");
      setApproveFor(null);
      await refreshLoans();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't approve this loan.", { autoClose: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async () => {
    const loan = rejectFor;
    if (!reason.trim()) return;
    setBusyId(loan.loan_id);
    try {
      await loanAPI.reject(id, loan.loan_id, reason.trim());
      toast.success("Loan rejected.");
      setRejectFor(null);
      await refreshLoans();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't reject this loan.");
    } finally {
      setBusyId(null);
    }
  };

  const openDetails = async (loan) => {
    setDetails({ loan, data: null, loading: true, error: false });
    try {
      const res = await loanAPI.getLoanById(id, loan.loan_id);
      setDetails({ loan, data: res.data?.data || res.data, loading: false, error: false });
    } catch {
      setDetails({ loan, data: null, loading: false, error: true });
    }
  };

  const stats = useMemo(() => {
    const open = loans.filter((l) => OPEN.includes(l.status));
    return {
      total: loans.length,
      pending: loans.filter((l) => l.status === "PENDING").length,
      active: open.length,
      lent: open.reduce((s, l) => s + num(l.loan_amount), 0),
    };
  }, [loans]);

  const rows = useMemo(() => loans.filter((l) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING") return l.status === "PENDING";
    if (filter === "ACTIVE") return OPEN.includes(l.status);
    return PAID.includes(l.status);
  }), [loans, filter]);

  const countFor = (f) => (f === "ALL" ? loans.length : f === "PENDING" ? stats.pending : f === "ACTIVE" ? stats.active : loans.filter((l) => PAID.includes(l.status)).length);

  const columns = [
    { key: "borrower_name", header: "Borrower", render: (l) => (<><strong>{l.borrower_name}</strong>{l.purpose && <div className="cs-list-meta">{l.purpose}</div>}</>), searchText: (l) => `${l.borrower_name} ${l.purpose || ""}` },
    { key: "loan_amount", header: "Amount", align: "num", sortValue: (l) => num(l.loan_amount), render: (l) => formatKES(l.loan_amount) },
    { key: "interest_rate", header: "Interest", align: "num", sortValue: (l) => num(l.interest_rate), render: (l) => (l.interest_rate != null ? `${num(l.interest_rate)}%` : "—") },
    { key: "total_repayable", header: "Total repayable", align: "num", sortValue: (l) => num(l.total_repayable), render: (l) => formatKES(l.total_repayable) },
    { key: "amount_paid", header: "Paid", align: "num", sortValue: (l) => num(l.amount_paid), render: (l) => formatKES(l.amount_paid || 0) },
    { key: "due_date", header: "Due", sortValue: (l) => l.due_date || "", render: (l) => formatDate(l.due_date), searchText: (l) => formatDate(l.due_date) },
    { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} label={STATUS_LABELS[l.status]} />, searchText: (l) => STATUS_LABELS[l.status] || l.status },
    {
      key: "actions", header: "Actions", sortValue: undefined, searchText: () => "",
      render: (l) => (
        <div className="cs-actions">
          <Button size="sm" onClick={() => openDetails(l)}>Details</Button>
          {l.status === "PENDING" && isOfficial && (
            <>
              <Button size="sm" variant="primary" disabled={busyId === l.loan_id} onClick={() => setApproveFor(l)}>Approve</Button>
              <Button size="sm" variant="danger" disabled={busyId === l.loan_id} onClick={() => { setReason(""); setRejectFor(l); }}>Reject</Button>
            </>
          )}
          {((l.is_borrower && OPEN.includes(l.status)) || (l.is_guarantor && l.status === "DEFAULTED")) && (
            <Link to={`/chamas/${id}/loans/${l.loan_id}/repay`} className={`cs-btn cs-btn--sm ${l.status === "DEFAULTED" ? "cs-btn--danger" : "cs-btn--primary"}`}>
              {l.is_guarantor ? "Settle liability" : "Repay"}
            </Link>
          )}
        </div>
      ),
    },
  ];

  const d = details?.data;
  const scheduleCols = [
    { key: "installment_number", header: "#", align: "num" },
    { key: "due_date", header: "Due", render: (r) => formatDate(r.due_date) },
    { key: "total_amount", header: "Total due", align: "num", render: (r) => formatKES(r.total_amount) },
    { key: "principal_amount", header: "Principal", align: "num", render: (r) => formatKES(r.principal_amount) },
    { key: "interest_amount", header: "Interest", align: "num", render: (r) => formatKES(r.interest_amount) },
    { key: "balance", header: "Balance", align: "num", render: (r) => formatKES(r.balance) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status === "PAID" ? "PAID" : "PENDING"} label={r.status === "PAID" ? "Paid" : "Due"} /> },
  ];
  const guarantorCols = [
    { key: "name", header: "Guarantor", render: (g) => <strong>{g.guarantor_name || `${g.first_name || ""} ${g.last_name || ""}`.trim() || "Unknown"}</strong> },
    { key: "guarantee_amount", header: "Covering", align: "num", render: (g) => formatKES(g.guarantee_amount) },
    { key: "status", header: "Response", render: (g) => <StatusBadge status={g.status === "ACCEPTED" ? "APPROVED" : g.status || "PENDING"} label={g.status === "ACCEPTED" ? "Accepted" : g.status === "REJECTED" ? "Declined" : "Awaiting"} /> },
    { key: "liability_status", header: "Savings", render: (g) => (g.liability_status === "FROZEN" ? <StatusBadge status="DEFAULTED" label="Frozen" /> : "—") },
  ];

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Loans"
          subtitle={chama?.chama_name}
          actions={
            <>
              <Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>
              <Link to={`/chamas/${id}/loans/apply`} className="cs-btn cs-btn--primary">Apply for a loan</Link>
            </>
          }
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load the loans for this chama.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-grid" aria-busy="true" aria-label="Loading loans">
            {[0, 1, 2, 3].map((i) => <div key={i} className="cs-card"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>)}
          </div>
        ) : !error && (
          <>
            {isOfficial && (
              <div className="cs-chips" role="group" aria-label="View" style={{ marginBottom: 16 }}>
                <button type="button" className="cs-chip" aria-pressed={tab === "LOANS"} onClick={() => setTab("LOANS")}>Loans</button>
                <button type="button" className="cs-chip" aria-pressed={tab === "DASHBOARD"} onClick={() => setTab("DASHBOARD")}>Analytics</button>
              </div>
            )}

            {tab === "DASHBOARD" && isOfficial ? (
              <LoanAnalyticsDashboard chamaId={id} />
            ) : (
              <>
                <div className="cs-grid">
                  <StatCard label="Loans" value={stats.total} note="All time" />
                  <StatCard label="Awaiting review" value={stats.pending} />
                  <StatCard label="Active loans" value={stats.active} />
                  <StatCard label="Lent out" value={formatKES(stats.lent)} note="Principal on active loans" />
                </div>
                {isOfficial && <PendingRepayments chamaId={id} onVerified={refreshLoans} />}
                {isOfficial && <ArrearsList chamaId={id} />}

                <section className="cs-section" aria-labelledby="loan-table">
                  <h2 id="loan-table" className="cs-section-title">All loans</h2>
                  <div className="cs-chips" role="group" aria-label="Filter loans" style={{ marginBottom: 16 }}>
                    {FILTERS.map((f) => (
                      <button key={f.id} type="button" className="cs-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label} ({countFor(f.id)})</button>
                    ))}
                  </div>
                  <DataTable
                    caption="Loans in this chama"
                    columns={columns}
                    rows={rows}
                    rowKey={(l) => l.loan_id}
                    searchPlaceholder="Search by borrower or purpose"
                    emptyTitle="No loans in this view"
                    emptyMessage="Try another filter, or apply for a loan."
                    summarize={(filtered) => `Total borrowed ${formatKES(filtered.reduce((s, l) => s + num(l.loan_amount), 0))} · paid ${formatKES(filtered.reduce((s, l) => s + num(l.amount_paid), 0))}`}
                  />
                </section>
              </>
            )}
          </>
        )}
      </main>

      <Dialog open={Boolean(details)} title={details ? `Loan: ${details.loan.borrower_name}` : ""} onClose={() => setDetails(null)}
        actions={<Button onClick={() => setDetails(null)}>Close</Button>}>
        {details?.loading && <div aria-busy="true"><Skeleton height={16} width="60%" /><Skeleton height={16} style={{ marginTop: 8 }} /></div>}
        {details?.error && <div className="cs-notice cs-notice--danger" role="alert">We couldn&apos;t load the details for this loan.</div>}
        {d?.loan && (
          <>
            <dl className="cs-kv">
              <div><dt>Amount</dt><dd>{formatKES(d.loan.loan_amount)}</dd></div>
              <div><dt>Interest</dt><dd>{d.loan.interest_rate != null ? `${num(d.loan.interest_rate)}%` : "—"}{d.loan.interest_type ? ` (${String(d.loan.interest_type).toLowerCase()})` : ""}</dd></div>
              <div><dt>Total repayable</dt><dd>{formatKES(d.loan.total_repayable)}</dd></div>
              <div><dt>Paid</dt><dd>{formatKES(d.loan.amount_paid || 0)}</dd></div>
              <div><dt>Balance</dt><dd>{formatKES(d.loan.balance || 0)}</dd></div>
              <div><dt>Monthly payment</dt><dd>{formatKES(d.loan.monthly_payment || 0)}</dd></div>
            </dl>
            {d.schedule?.length > 0 && (
              <section style={{ marginTop: 16 }}>
                <h3 className="cs-section-title">Repayment schedule</h3>
                <DataTable columns={scheduleCols} rows={d.schedule} rowKey={(r) => r.installment_number} searchable={false} pageSize={24} />
              </section>
            )}
            {d.guarantors?.length > 0 && (
              <section style={{ marginTop: 16 }}>
                <h3 className="cs-section-title">Guarantors</h3>
                {d.loan.status === "DEFAULTED" && chama?.chama_type === "ASCA" && (
                  <div className="cs-notice cs-notice--danger" style={{ marginBottom: 12 }}>This loan has defaulted. Guarantors&apos; shares are frozen to cover the liability.</div>
                )}
                <DataTable columns={guarantorCols} rows={d.guarantors} rowKey={(g) => g.guarantor_user_id ?? g.guarantor_name ?? `${g.first_name}-${g.last_name}`} searchable={false} />
              </section>
            )}
          </>
        )}
      </Dialog>

      <Dialog open={Boolean(approveFor)} title="Approve this loan?" onClose={() => busyId === null && setApproveFor(null)}
        actions={<><Button onClick={() => setApproveFor(null)} disabled={busyId !== null}>Cancel</Button><Button variant="primary" loading={busyId !== null} onClick={approve}>Approve loan</Button></>}>
        {approveFor && <p>{approveFor.borrower_name} is asking for {formatKES(approveFor.loan_amount)}.</p>}
      </Dialog>

      <Dialog open={Boolean(rejectFor)} title="Reject this loan?" onClose={() => busyId === null && setRejectFor(null)}
        actions={<><Button onClick={() => setRejectFor(null)} disabled={busyId !== null}>Cancel</Button><Button variant="danger" loading={busyId !== null} disabled={!reason.trim()} onClick={reject}>Reject loan</Button></>}>
        <div className="cs-field">
          <label className="cs-label" htmlFor="reject-reason">Reason<span className="cs-required" aria-hidden="true">*</span></label>
          <textarea id="reject-reason" className="cs-input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Not enough guarantors" />
        </div>
      </Dialog>
    </div>
  );
}
