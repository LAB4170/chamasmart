import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { welfareAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

const LABELS = { SUBMITTED: "Awaiting review", VERIFIED: "Awaiting review", APPROVED: "Approved, awaiting funds", PAID: "Paid", REJECTED: "Declined" };
const FILTERS = [
  { id: "OPEN", label: "Needs review" },
  { id: "DONE", label: "Decided" },
  { id: "ALL", label: "All" },
];
const isOpen = (c) => c.status === "SUBMITTED" || c.status === "VERIFIED";

function ProofFiles({ claimId }) {
  const [files, setFiles] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    welfareAPI.listDocuments(claimId).then((r) => { if (live) setFiles(r.data?.data ?? []); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [claimId]);
  const open = async (f) => {
    try {
      const res = await welfareAPI.downloadDocument(claimId, f.document_id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = f.file_name; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { toast.error("We couldn't open that file."); }
  };
  if (failed) return <p className="cs-list-meta" style={{ margin: 0 }}>Proof files could not be loaded.</p>;
  if (!files || files.length === 0) return <p className="cs-list-meta" style={{ margin: 0 }}>No proof file attached.</p>;
  return (
    <ul className="cs-list-meta" style={{ margin: 0, paddingLeft: 18 }} aria-label="Proof files">
      {files.map((f) => <li key={f.document_id}><button type="button" className="cs-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => open(f)}>{f.file_name}</button> ({Math.max(1, Math.round(f.size_bytes / 1024))} KB)</li>)}
    </ul>
  );
}

export default function WelfareAdmin() {
  const { id } = useParams();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("OPEN");
  const [review, setReview] = useState(null); // { claim, decision }
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await welfareAPI.getChamaClaims(id);
      const raw = res.data?.data ?? [];
      setClaims(Array.isArray(raw) ? raw : []);
    } catch {
      setError("We couldn't load the claims.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => claims.filter((c) => (filter === "ALL" ? true : filter === "OPEN" ? isOpen(c) : !isOpen(c))), [claims, filter]);
  const close = () => { if (!busy) { setReview(null); setComments(""); } };

  // The status changes only after the server confirms; payment needs two different officials to approve.
  const submit = async () => {
    const approve = review.decision === "APPROVED";
    if (!approve && !comments.trim()) { toast.error("Please give a reason for declining."); return; }
    setBusy(true);
    try {
      await welfareAPI.approveClaim(review.claim.claim_id, { decision: review.decision, comments: comments.trim() });
      toast.success(approve ? "Your approval is recorded." : "Claim declined.");
      setReview(null);
      setComments("");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't record your decision.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Welfare claims" subtitle="A claim is paid once two different officials approve it." actions={<Link to={`/chamas/${id}/welfare`} className="cs-btn cs-btn--secondary">Back to welfare</Link>} />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>{error}</span><Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading claims"><Skeleton height={14} width="40%" /><Skeleton height={40} style={{ marginTop: 12 }} /></div>
        ) : !error && (
          <section aria-label="Claims">
            <div className="cs-chips" role="group" aria-label="Filter claims" style={{ marginBottom: 16 }}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="cs-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label} ({f.id === "ALL" ? claims.length : claims.filter((c) => (f.id === "OPEN" ? isOpen(c) : !isOpen(c))).length})
                </button>
              ))}
            </div>
            {visible.length === 0 ? (
              <div className="cs-card"><EmptyState title="Nothing here" message="No claims match this view." /></div>
            ) : (
              <div className="cs-loan-grid">
                {visible.map((c) => (
                  <article key={c.claim_id} className="cs-card cs-loan">
                    <header className="cs-loan-head">
                      <div className="cs-list-main">
                        <h3 className="cs-loan-title">{c.member_name}</h3>
                        <div className="cs-list-meta">{c.event_type} · filed {formatDate(c.created_at)}</div>
                      </div>
                      <StatusBadge status={c.status} label={LABELS[c.status] || c.status} />
                    </header>
                    <dl className="cs-kv">
                      <div><dt>Amount</dt><dd>{formatKES(c.claim_amount)}</dd></div>
                      <div><dt>Happened</dt><dd>{c.date_of_occurrence ? formatDate(c.date_of_occurrence) : "—"}</dd></div>
                    </dl>
                    {c.description && <p className="cs-list-meta" style={{ margin: 0 }}>{c.description}</p>}
                    <ProofFiles claimId={c.claim_id} />
                    {(c.approvals || []).length > 0 && (
                      <ul className="cs-list-meta" style={{ margin: 0, paddingLeft: 18 }}>
                        {c.approvals.map((a) => <li key={a.approval_id}>{a.approver_name}: {a.status === "APPROVED" ? "approved" : "declined"}{a.comments ? ` (${a.comments})` : ""}</li>)}
                      </ul>
                    )}
                    {isOpen(c) && (
                      <footer className="cs-actions">
                        <Button variant="primary" size="sm" onClick={() => setReview({ claim: c, decision: "APPROVED" })}>Approve</Button>
                        <Button variant="danger" size="sm" onClick={() => setReview({ claim: c, decision: "REJECTED" })}>Decline</Button>
                      </footer>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <Dialog
          open={!!review}
          onClose={close}
          title={review?.decision === "APPROVED" ? "Approve this claim?" : "Decline this claim?"}
          actions={(
            <>
              <Button onClick={close} disabled={busy}>Cancel</Button>
              <Button variant={review?.decision === "APPROVED" ? "primary" : "danger"} loading={busy} onClick={submit}>{review?.decision === "APPROVED" ? "Approve" : "Decline"}</Button>
            </>
          )}
        >
          <p>
            {review?.decision === "APPROVED"
              ? `${formatKES(review?.claim.claim_amount)} for ${review?.claim.member_name}. It is paid from the welfare fund once a second official also approves. You can't decide on your own claim or approve twice.`
              : "One decline closes the claim."}
          </p>
          <label className="cs-label" htmlFor="wc-comments">{review?.decision === "APPROVED" ? "Note (optional)" : "Reason"}</label>
          <textarea id="wc-comments" className="cs-textarea" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} maxLength={300} />
        </Dialog>
      </main>
    </div>
  );
}
