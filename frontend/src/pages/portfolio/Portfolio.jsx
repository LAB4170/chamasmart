import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { portfolioAPI } from "../../services/api";
import { Button, PageHeader, EmptyState, Skeleton } from "../../components/ui";
import { formatKES, formatDate } from "../../utils/format";

const PAGE = 25;

/** Every chama the person runs, in one place. Chamas that need a decision come first. */
export default function Portfolio() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [attention, setAttention] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(0); }, 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await portfolioAPI.page({ q: term || undefined, attention, page, size: PAGE });
      setData(res.data?.data ?? null);
    } catch (e) {
      setError(e.response?.data?.message || "We couldn't load your portfolio.");
    } finally { setLoading(false); }
  }, [term, attention, page]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      const res = await portfolioAPI.exportCsv();
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url; a.download = "portfolio.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("The export did not work. Please try again."); }
  };

  const t = data?.totals;
  const funds = t ? Object.entries(t.fund_by_currency || {}) : [];

  return (
    <div className="cs-page">
      <PageHeader title="Portfolio" subtitle="Every chama you run, in one place."
        actions={<Button variant="secondary" onClick={exportCsv} disabled={!t || t.chamas === 0}>Export as spreadsheet</Button>} />
      {error && <p role="alert">{error}</p>}
      {t && t.chamas > 0 && (
        <div className="cs-stat-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, margin: "16px 0" }}>
          <div className="cs-card" style={{ padding: 14 }}><div style={{ fontSize: 13, opacity: 0.7 }}>Chamas</div><strong style={{ fontSize: 22 }}>{t.chamas}</strong></div>
          <div className="cs-card" style={{ padding: 14 }}><div style={{ fontSize: 13, opacity: 0.7 }}>Members</div><strong style={{ fontSize: 22 }}>{t.members}</strong></div>
          {funds.map(([cur, amt]) => (
            <div className="cs-card" style={{ padding: 14 }} key={cur}><div style={{ fontSize: 13, opacity: 0.7 }}>Held in funds ({cur})</div><strong style={{ fontSize: 22 }}>{formatKES(amt)}</strong></div>
          ))}
          <div className="cs-card" style={{ padding: 14 }}><div style={{ fontSize: 13, opacity: 0.7 }}>Need a decision</div><strong style={{ fontSize: 22 }}>{t.needing_attention}</strong></div>
          <div className="cs-card" style={{ padding: 14 }}><div style={{ fontSize: 13, opacity: 0.7 }}>Held payments</div><strong style={{ fontSize: 22 }}>{t.held_payments}</strong><div style={{ fontSize: 12, opacity: 0.7 }}>{formatKES(t.held_amount)}</div></div>
          <div className="cs-card" style={{ padding: 14 }}><div style={{ fontSize: 13, opacity: 0.7 }}>Never checked against a statement</div><strong style={{ fontSize: 22 }}>{t.never_reconciled}</strong></div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "12px 0" }}>
        <input className="cs-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search by name or type" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search chamas" />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={attention} onChange={(e) => { setAttention(e.target.checked); setPage(0); }} /> Only those needing a decision
        </label>
      </div>
      {loading && !data ? <Skeleton /> : data && data.items.length === 0 ? (
        <EmptyState title={t?.chamas ? "No chamas match" : "You do not run any chamas yet"}
          description={t?.chamas ? "Try a different search." : "This page lists the chamas where you are the chairperson, treasurer or secretary."} />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {data?.items.map((c) => (
            <Link key={c.chama_id} to={`/chamas/${c.chama_id}`} className="cs-card" style={{ padding: 14, textDecoration: "none", color: "inherit", display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{c.name}</strong>
                <span>{formatKES(c.fund)}</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.75, margin: "2px 0" }}>
                {c.type} · {c.members} members · you are {String(c.role || "").toLowerCase()} · {c.plan_status === "ACTIVE" || c.plan_status === "TRIAL" ? `${c.plan} plan` : `${c.plan} plan ${String(c.plan_status).toLowerCase().replace("_", " ")}`}
              </div>
              <div style={{ fontSize: 13 }}>
                {c.needs_attention ? <span style={{ fontWeight: 600 }}>{c.reasons.join(" · ")}</span> : <span style={{ opacity: 0.7 }}>All clear</span>}
                {c.pending_verification > 0 ? ` · ${c.pending_verification} awaiting verification` : ""}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {c.reconciled_at ? `Statement checked ${formatDate(c.reconciled_at)}` : "Statement never checked"} · {c.books_checked_at ? `Books checked ${formatDate(c.books_checked_at)}` : "Books not checked yet"}
              </div>
            </Link>
          ))}
        </div>
      )}
      {data && data.total_pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16, alignItems: "center" }}>
          <Button variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page + 1} of {data.total_pages}</span>
          <Button variant="secondary" disabled={page + 1 >= data.total_pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
