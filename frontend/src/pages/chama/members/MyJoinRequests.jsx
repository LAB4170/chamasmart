import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { joinRequestAPI } from "../../../services/api";
import { useSocket } from "../../../context/SocketContext";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton } from "../../../components/ui";
import { formatDate } from "../../../utils/format";

const LABELS = { PENDING: "Waiting for review", APPROVED: "Approved", REJECTED: "Declined" };
const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "PENDING", label: "Waiting" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Declined" },
];

export default function MyJoinRequests() {
  const { socket } = useSocket();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await joinRequestAPI.getMyRequests();
      const raw = res.data?.data ?? [];
      setRequests(Array.isArray(raw) ? raw : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on("join_request_responded", load);
    return () => socket.off("join_request_responded", load);
  }, [socket, load]);

  const count = (s) => requests.filter((r) => r.status === s).length;
  const visible = useMemo(() => (filter === "ALL" ? requests : requests.filter((r) => r.status === filter)), [requests, filter]);

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="My join requests"
          subtitle="Chamas you have asked to join, and what the officials decided."
          actions={<Link to="/browse-chamas" className="cs-btn cs-btn--primary">Find a chama</Link>}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load your requests.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-grid" aria-busy="true" aria-label="Loading requests">
            {[0, 1].map((i) => <div key={i} className="cs-card"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>)}
          </div>
        ) : !error && (
          <section aria-label="Join requests">
            <div className="cs-chips" role="group" aria-label="Filter requests" style={{ marginBottom: 16 }}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="cs-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label} ({f.id === "ALL" ? requests.length : count(f.id)})
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="cs-card">
                <EmptyState
                  title={requests.length === 0 ? "No requests yet" : "Nothing here"}
                  message={requests.length === 0 ? "Browse public chamas and ask to join one." : "No requests match this view."}
                  action={requests.length === 0 ? <Link to="/browse-chamas" className="cs-btn cs-btn--primary">Browse chamas</Link> : null}
                />
              </div>
            ) : (
              <div className="cs-loan-grid">
                {visible.map((r) => (
                  <article key={r.request_id} className="cs-card cs-loan">
                    <header className="cs-loan-head">
                      <div className="cs-list-main">
                        <h3 className="cs-loan-title">{r.chama_name || "Chama"}</h3>
                        <div className="cs-list-meta">Sent {formatDate(r.created_at)}</div>
                      </div>
                      <StatusBadge status={r.status} label={LABELS[r.status] || r.status} />
                    </header>
                    {r.message && <p className="cs-list-meta" style={{ margin: 0 }}>Your message: {r.message}</p>}
                    {r.status !== "PENDING" && (
                      <p className="cs-footnote" style={{ margin: 0 }}>
                        {r.status === "APPROVED" ? "Approved" : "Declined"}
                        {r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ""}{r.reviewed_at ? ` on ${formatDate(r.reviewed_at)}` : ""}
                        {r.review_comments ? `. Note: ${r.review_comments}` : ""}
                      </p>
                    )}
                    {r.status === "APPROVED" && (
                      <footer className="cs-actions"><Link to={`/chamas/${r.chama_id}`} className="cs-btn cs-btn--primary cs-btn--sm">Open chama</Link></footer>
                    )}
                  </article>
                ))}
              </div>
            )}
            <p className="cs-footnote">{visible.length} of {requests.length} {requests.length === 1 ? "request" : "requests"}</p>
          </section>
        )}
      </main>
    </div>
  );
}
