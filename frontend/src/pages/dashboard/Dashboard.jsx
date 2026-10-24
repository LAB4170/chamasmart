import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { chamaAPI, loanAPI } from "../../services/api";
import { Button, PageHeader, StatCard, StatusBadge, DataTable, Skeleton } from "../../components/ui";
import { formatKES, formatDate, sumAmounts } from "../../utils/format";

const TYPE_LABELS = { ROSCA: "Merry-go-round", ASCA: "Investment", TABLE_BANKING: "Table banking", WELFARE: "Welfare" };
const typeLabel = (t) => TYPE_LABELS[t] || (t ? t.replace(/_/g, " ").toLowerCase() : "—");
const FREQ_LABELS = { WEEKLY: "week", MONTHLY: "month", DAILY: "day", BIWEEKLY: "2 weeks", QUARTERLY: "quarter" };
const PLACEHOLDER_NAMES = ["antigravityagent", "antigravity agent", "user", "chamasmarter"];

export default function Dashboard() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [chamas, setChamas] = useState([]);
  const [loans, setLoans] = useState({ borrowed: [], guaranteed: [], summary: { totalBorrowed: 0, totalGuaranteed: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const firstName = user?.firstName || user?.first_name || "";
  const hasRealName = firstName && !PLACEHOLDER_NAMES.includes(firstName.toLowerCase().trim());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [chamasRes, loansRes] = await Promise.all([chamaAPI.getMyChamas(), loanAPI.getUnifiedSummary()]);
      setChamas(Array.isArray(chamasRes.data?.data) ? chamasRes.data.data : []);
      const d = loansRes.data?.data;
      if (d) setLoans({ borrowed: d.borrowed || [], guaranteed: d.guaranteed || [], summary: d.summary || { totalBorrowed: 0, totalGuaranteed: 0 } });
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && !hasRealName) { navigate("/complete-profile"); return; }
    if (user) load();
  }, [user, hasRealName, navigate, load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onUpdate = (data) => {
      if (data?.type === "MPESA_SUCCESS") toast.success(`M-Pesa payment of ${formatKES(data.amount || 0)} was confirmed.`);
      load();
    };
    socket.on("personal_dashboard_update", onUpdate);
    return () => socket.off("personal_dashboard_update", onUpdate);
  }, [socket, load]);

  // Items that need the member's action, taken only from real loan records.
  const attention = useMemo(() => {
    const items = [];
    loans.guaranteed.forEach((g) => {
      if (String(g.my_guarantee_status || "").toUpperCase() === "PENDING") {
        items.push({ key: `g-${g.loan_id ?? g.id}`, to: `/my-guarantees`, title: `Guarantee request from ${g.borrower_name || "a member"}`, meta: `${g.chama_name || ""} · ${formatKES(g.my_guarantee_amount)}`, status: "PENDING" });
      }
    });
    loans.borrowed.forEach((b) => {
      if (b.due_date && Number(b.balance) > 0) {
        items.push({ key: `b-${b.loan_id ?? b.id}`, to: `/chamas/${b.chama_id}/loans`, title: `Loan repayment due ${formatDate(b.due_date)}`, meta: `${b.chama_name || ""} · Balance ${formatKES(b.balance)}`, status: b.status });
      }
    });
    return items;
  }, [loans]);

  const columns = useMemo(() => [
    { key: "chama_name", header: "Chama", render: (c) => <Link className="cs-link" to={`/chamas/${c.chama_id}`}>{c.chama_name}</Link> },
    { key: "chama_type", header: "Type", render: (c) => typeLabel(c.chama_type), sortValue: (c) => typeLabel(c.chama_type) },
    { key: "role", header: "Your role", render: (c) => (c.role ? c.role.charAt(0) + c.role.slice(1).toLowerCase() : "Member") },
    { key: "total_members", header: "Members", align: "num" },
    { key: "contribution_amount", header: "Contribution", align: "num", sortValue: (c) => Number(c.contribution_amount) || 0,
      render: (c) => `${formatKES(c.contribution_amount, { whole: true })}${FREQ_LABELS[String(c.contribution_frequency).toUpperCase()] ? ` / ${FREQ_LABELS[String(c.contribution_frequency).toUpperCase()]}` : ""}` },
    { key: "current_fund", header: "Group fund", align: "num", sortValue: (c) => Number(c.current_fund) || 0, render: (c) => formatKES(c.current_fund) },
  ], []);

  const actions = (
    <>
      <Link to="/join-chama" className="cs-btn cs-btn--secondary">Join a chama</Link>
      <Link to="/chamas/create" className="cs-btn cs-btn--primary">Create a chama</Link>
    </>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title={hasRealName ? `Hello, ${firstName}` : "Welcome to ChamaSmart"} subtitle="Your chamas and loan commitments at a glance." actions={actions} />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load your dashboard.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-grid" aria-busy="true" aria-label="Loading dashboard">
            {[0, 1, 2, 3].map((i) => <div key={i} className="cs-card"><Skeleton height={14} width="50%" /><Skeleton height={32} style={{ marginTop: 12 }} /></div>)}
          </div>
        ) : (
          <>
            <div className="cs-grid">
              <StatCard label="Your chamas" value={chamas.length} />
              <StatCard label="Combined group funds" value={formatKES(sumAmounts(chamas, (c) => c.current_fund))} note="Money held by your groups, not only yours" />
              <StatCard label="You owe" value={formatKES(loans.summary.totalBorrowed)} note={`${loans.borrowed.length} loan${loans.borrowed.length === 1 ? "" : "s"}`} />
              <StatCard label="You guarantee" value={formatKES(loans.summary.totalGuaranteed)} note={`${loans.guaranteed.length} guarantee${loans.guaranteed.length === 1 ? "" : "s"}`} />
            </div>

            {attention.length > 0 && (
              <section className="cs-section" aria-labelledby="attn">
                <h2 id="attn" className="cs-section-title">Needs your attention</h2>
                <div className="cs-card cs-card--flush">
                  <ul className="cs-list">
                    {attention.map((a) => (
                      <li key={a.key}>
                        <Link to={a.to} className="cs-list-item">
                          <div className="cs-list-main"><div className="cs-list-title">{a.title}</div><div className="cs-list-meta">{a.meta}</div></div>
                          <StatusBadge status={a.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            <section className="cs-section" aria-labelledby="mine">
              <h2 id="mine" className="cs-section-title">Your chamas</h2>
              <DataTable
                columns={columns}
                rows={chamas}
                rowKey={(c) => c.chama_id}
                caption="Your chamas"
                searchPlaceholder="Search your chamas"
                pageSize={8}
                searchable={chamas.length > 8}
                emptyTitle="You're not in a chama yet"
                emptyMessage="Create a group for your members, or join one you've been invited to."
                emptyAction={<Link to="/join-chama" className="cs-btn cs-btn--primary">Join a chama</Link>}
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
