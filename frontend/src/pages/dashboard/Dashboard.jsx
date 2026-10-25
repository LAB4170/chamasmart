import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { chamaAPI, loanAPI, authAPI } from "../../services/api";
import ChamaCard from "../../components/ChamaCard";
import { Button, PageHeader, StatCard, StatusBadge, Skeleton, EmptyState } from "../../components/ui";
import { formatKES, formatDate, sumAmounts } from "../../utils/format";

const FREQ_LABELS = { WEEKLY: "week", MONTHLY: "month", DAILY: "day", BIWEEKLY: "2 weeks", QUARTERLY: "quarter" };
const SHARE_COLORS = ["#8aa0ff", "#5eead4", "#ffd166", "#ff9ec0", "#c3b5ff"];
const PLACEHOLDER_NAMES = ["antigravityagent", "antigravity agent", "user", "chamasmarter"];

function VerifyEmailBanner({ user }) {
  const [state, setState] = useState("idle");
  const verified = user && (user.emailVerified ?? user.email_verified);
  if (!user || verified !== false) return null;
  const resend = async () => {
    setState("sending");
    try { await authAPI.resendEmailVerification(); setState("sent"); }
    catch (err) { setState(err.response?.data?.message || "We couldn't send it just now."); }
  };
  return (
    <div className="cs-notice" role="status" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
      <span className="cs-verify-text">
        <b>{state === "sent" ? "Check your inbox" : "Confirm your email"}</b>
        <span>{state === "sent" ? `We sent a link to ${user.email}. Look in spam too.` : `${user.email}. Needed to recover your password and to serve as treasurer or secretary.`}
          {state !== "idle" && state !== "sent" && state !== "sending" && <> {state}</>}</span>
      </span>
      {state !== "sent" && <Button size="sm" onClick={resend} loading={state === "sending"}>Send confirmation link</Button>}
    </div>
  );
}

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

        <VerifyEmailBanner user={user} />

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
            <section className="cs-hero" aria-label="Your money across chamas">
              <p className="cs-hero-label">Held across your chamas</p>
              <p className="cs-hero-amount"><small>KES</small>{formatKES(sumAmounts(chamas, (c) => c.current_fund)).replace(/^KES\s/, "")}</p>
              <p className="cs-hero-note">Group money, not only yours. {chamas.length} chama{chamas.length === 1 ? "" : "s"}.</p>
              {chamas.length > 1 && Number(sumAmounts(chamas, (c) => c.current_fund)) > 0 && (
                <div className="cs-hero-split" role="img" aria-label={"Share of money by chama: " + chamas.map((c) => `${c.chama_name} ${formatKES(c.current_fund, { whole: true })}`).join(", ")}>
                  <div className="cs-hero-bar">
                    {chamas.map((c, i) => <span key={c.chama_id} style={{ flexGrow: Math.max(Number(c.current_fund) || 0, 0.0001), background: SHARE_COLORS[i % SHARE_COLORS.length] }} />)}
                  </div>
                  <ul className="cs-hero-legend">
                    {chamas.slice(0, 4).map((c, i) => <li key={c.chama_id}><i style={{ background: SHARE_COLORS[i % SHARE_COLORS.length] }} />{c.chama_name}</li>)}
                  </ul>
                </div>
              )}
              <div className="cs-hero-row">
                <div className="cs-hero-chip"><span>You owe</span><b>{formatKES(loans.summary.totalBorrowed)}</b></div>
                <div className="cs-hero-chip"><span>You guarantee</span><b>{formatKES(loans.summary.totalGuaranteed)}</b></div>
              </div>
            </section>

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
              {chamas.length === 0 ? (
                <div className="cs-card"><EmptyState title="You're not in a chama yet" message="Create a group for your members, or join one you've been invited to." action={<Link to="/join-chama" className="cs-btn cs-btn--primary">Join a chama</Link>} /></div>
              ) : (
                <div className="cs-chama-grid">{chamas.map((c) => <ChamaCard key={c.chama_id} c={c} />)}</div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
