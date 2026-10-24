import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { joinRequestAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatDate } from "../../../utils/format";

const LABELS = { PENDING: "Waiting for review", APPROVED: "Approved", REJECTED: "Declined" };
const FILTERS = [
  { id: "PENDING", label: "Waiting" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Declined" },
  { id: "ALL", label: "All" },
];

export default function JoinRequests() {
  const { id } = useParams();
  const [chama, setChama] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("PENDING");
  const [review, setReview] = useState(null); // { request, decision }
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [c, r] = await Promise.all([chamaAPI.getById(id), joinRequestAPI.getAll(id)]);
      setChama(c.data?.data || null);
      const raw = r.data?.data ?? [];
      setRequests(Array.isArray(raw) ? raw : []);
    } catch (err) {
      setError(err.response?.status === 403 ? "Only the officials of this chama can review join requests." : "We couldn't load the join requests.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const count = (s) => requests.filter((r) => r.status === s).length;
  const visible = useMemo(() => (filter === "ALL" ? requests : requests.filter((r) => r.status === filter)), [requests, filter]);

  const close = () => { if (!busy) { setReview(null); setComments(""); } };

  // The list only changes after the server confirms the decision.
  const submit = async () => {
    const approve = review.decision === "APPROVED";
    if (!approve && !comments.trim()) { toast.error("Please give a short reason for declining."); return; }
    setBusy(true);
    try {
      await joinRequestAPI.respond(review.request.request_id, review.decision, comments.trim());
      toast.success(approve ? `${review.request.member_name} is now a member.` : "Request declined.");
      setReview(null);
      setComments("");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't record your decision. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Join requests"
          subtitle={chama ? `People asking to join ${chama.chama_name}.` : "People asking to join this chama."}
          actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>{error}</span>
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
              <div className="cs-card"><EmptyState title="Nothing here" message="No join requests match this view." /></div>
            ) : (
              <div className="cs-loan-grid">
                {visible.map((r) => (
                  <article key={r.request_id} className="cs-card cs-loan">
                    <header className="cs-loan-head">
                      <div className="cs-list-main">
                        <h3 className="cs-loan-title">{r.member_name || "Applicant"}</h3>
                        <div className="cs-list-meta">Sent {formatDate(r.created_at)}</div>
                      </div>
                      <StatusBadge status={r.status} label={LABELS[r.status] || r.status} />
                    </header>
                    {r.message && <p className="cs-list-meta" style={{ margin: 0 }}>Message: {r.message}</p>}
                    {r.status !== "PENDING" && (
                      <p className="cs-footnote" style={{ margin: 0 }}>
                        {r.status === "APPROVED" ? "Approved" : "Declined"}
                        {r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ""}{r.reviewed_at ? ` on ${formatDate(r.reviewed_at)}` : ""}
                        {r.review_comments ? `. Note: ${r.review_comments}` : ""}
                      </p>
                    )}
                    {r.status === "PENDING" && (
                      <footer className="cs-actions">
                        <Button variant="primary" size="sm" onClick={() => setReview({ request: r, decision: "APPROVED" })}>Approve</Button>
                        <Button variant="danger" size="sm" onClick={() => setReview({ request: r, decision: "REJECTED" })}>Decline</Button>
                      </footer>
                    )}
                  </article>
                ))}
              </div>
            )}
            <p className="cs-footnote">{visible.length} of {requests.length} {requests.length === 1 ? "request" : "requests"}</p>
          </section>
        )}

        <Dialog
          open={!!review}
          onClose={close}
          title={review?.decision === "APPROVED" ? "Approve this request?" : "Decline this request?"}
          actions={(
            <>
              <Button onClick={close} disabled={busy}>Cancel</Button>
              <Button variant={review?.decision === "APPROVED" ? "primary" : "danger"} loading={busy} onClick={submit}>
                {review?.decision === "APPROVED" ? "Approve" : "Decline"}
              </Button>
            </>
          )}
        >
          <p>
            {review?.decision === "APPROVED"
              ? `${review?.request.member_name} will join as a regular member and can see the group's contributions and loans.`
              : `${review?.request.member_name} will be told the request was declined.`}
          </p>
          <label className="cs-label" htmlFor="jr-comments">{review?.decision === "APPROVED" ? "Note (optional)" : "Reason"}</label>
          <textarea id="jr-comments" className="cs-textarea" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} maxLength={300} />
        </Dialog>
      </main>
    </div>
  );
}
