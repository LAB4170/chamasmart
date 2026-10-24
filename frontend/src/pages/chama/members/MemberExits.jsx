import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { exitAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";
import { useAuth } from "../../../context/AuthContext";

const LABELS = { REQUESTED: "Awaiting approval", APPROVED: "Approved, awaiting refund", COMPLETED: "Left the chama", DECLINED: "Declined", CANCELLED: "Cancelled" };
const KIND = { LEAVE: "Asked to leave", REMOVAL: "Removal by an official" };

export default function MemberExits() {
  const { id } = useParams();
  const { user } = useAuth();
  const me = user?.id ?? user?.user_id ?? user?.userId;
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind: "leave" | "decline" | "pay" | "statement", row?, data? }
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [l, p] = await Promise.all([exitAPI.list(id), exitAPI.preview(id).catch(() => null)]);
      setRows(l.data?.data ?? []);
      setPreview(p?.data?.data ?? null);
    } catch (e) {
      setError(e.response?.data?.message || "We couldn't load this page.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const close = () => { if (!busy) { setDialog(null); setText(""); } };
  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(ok || res.data?.message || "Done.");
      setDialog(null); setText("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || "That didn't go through. Nothing was changed.", { autoClose: 8000 });
    } finally { setBusy(false); }
  };
  const showStatement = async (row) => {
    try {
      const res = await exitAPI.statement(id, row.exit_id);
      setDialog({ kind: "statement", data: res.data?.data });
    } catch (e) { toast.error(e.response?.data?.message || "We couldn't load the statement."); }
  };

  const blockers = preview?.blockers ?? [];
  const mine = rows.filter((r) => String(r.user_id) === String(me));
  const hasOpen = mine.some((r) => r.status === "REQUESTED" || r.status === "APPROVED");
  const queue = rows.filter((r) => String(r.user_id) !== String(me));

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Leaving the chama" subtitle="Your savings are refunded before you go. Two officials handle it." actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>} />
        {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16 }}>{error} <Button size="sm" onClick={load}>Try again</Button></div>}
        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading"><Skeleton height={20} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></div>
        ) : (
          <>
            {preview && (
              <section className="cs-card" aria-label="Your exit" style={{ marginBottom: 16 }}>
                <h2 className="cs-card-title">Your own exit</h2>
                <dl className="cs-kv"><div><dt>Refund if you leave now</dt><dd>{formatKES(preview.refund)}</dd></div></dl>
                <p className="cs-help">The refund is your verified regular savings. Welfare, fines and one-off payments are not refunded.</p>
                {blockers.length > 0 && (
                  <div className="cs-notice cs-notice--warning" role="status">
                    <div>You can&apos;t leave yet:<ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>
                  </div>
                )}
                <div className="cs-actions">
                  <Button variant="danger" disabled={blockers.length > 0 || hasOpen} onClick={() => setDialog({ kind: "leave" })}>Ask to leave</Button>
                </div>
                {hasOpen && <p className="cs-help">You already have a request in progress.</p>}
              </section>
            )}

            <section aria-label="Exit requests">
              <h2 className="cs-section-title">Requests</h2>
              {rows.length === 0 ? (
                <div className="cs-card"><EmptyState title="No exit requests" message="Nobody is leaving this chama right now." /></div>
              ) : (
                <div className="cs-loan-grid">
                  {rows.map((r) => {
                    const own = String(r.user_id) === String(me);
                    const open = r.status === "REQUESTED" || r.status === "APPROVED";
                    return (
                      <article key={r.exit_id} className="cs-card cs-loan">
                        <header className="cs-loan-head">
                          <div className="cs-list-main">
                            <h3 className="cs-loan-title">{own ? "You" : r.member_name}</h3>
                            <div className="cs-list-meta">{KIND[r.kind] || r.kind} · {formatDate(r.created_at)}</div>
                          </div>
                          <StatusBadge status={r.status === "COMPLETED" ? "PAID" : r.status === "DECLINED" || r.status === "CANCELLED" ? "REJECTED" : "PENDING"} label={LABELS[r.status] || r.status} />
                        </header>
                        <dl className="cs-kv">
                          <div><dt>Refund</dt><dd>{formatKES(r.refund_amount || 0)}</dd></div>
                          {r.payout_reference && <div><dt>Reference</dt><dd>{r.payout_reference}</dd></div>}
                        </dl>
                        {r.note && <p className="cs-list-meta" style={{ margin: 0 }}>{r.note}</p>}
                        <footer className="cs-actions">
                          {!own && r.status === "REQUESTED" && (<>
                            <Button size="sm" onClick={() => run(() => exitAPI.decide(id, r.exit_id, "APPROVED"))} loading={busy}>Approve</Button>
                            <Button size="sm" variant="danger" onClick={() => setDialog({ kind: "decline", row: r })}>Decline</Button>
                          </>)}
                          {!own && r.status === "APPROVED" && <Button size="sm" onClick={() => setDialog({ kind: "pay", row: r })}>Record refund</Button>}
                          {open && (own || String(r.requested_by) === String(me)) && <Button size="sm" variant="secondary" onClick={() => run(() => exitAPI.cancel(id, r.exit_id), "Request cancelled.")}>Cancel</Button>}
                          {r.status === "COMPLETED" && <Button size="sm" variant="secondary" onClick={() => showStatement(r)}>Closing statement</Button>}
                        </footer>
                      </article>
                    );
                  })}
                </div>
              )}
              {queue.length === 0 && rows.length > 0 && null}
            </section>
          </>
        )}

        <Dialog open={dialog?.kind === "leave"} onClose={close} title="Ask to leave this chama?"
          actions={(<><Button onClick={close} disabled={busy}>Stay</Button><Button variant="danger" loading={busy} onClick={() => run(() => exitAPI.leave(id))}>Ask to leave</Button></>)}>
          <p>An official will approve it and a different official will pay your refund of {formatKES(preview?.refund || 0)}. You stay a member until the refund is paid. You can cancel until then.</p>
        </Dialog>

        <Dialog open={dialog?.kind === "decline"} onClose={close} title="Decline this request?"
          actions={(<><Button onClick={close} disabled={busy}>Back</Button><Button variant="danger" loading={busy} disabled={!text.trim()} onClick={() => run(() => exitAPI.decide(id, dialog.row.exit_id, "REJECTED", text.trim()), "Request declined.")}>Decline</Button></>)}>
          <label className="cs-label" htmlFor="ex-note">Reason</label>
          <textarea id="ex-note" className="cs-textarea" rows={3} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />
        </Dialog>

        <Dialog open={dialog?.kind === "pay"} onClose={close} title="Record the refund"
          actions={(<><Button onClick={close} disabled={busy}>Back</Button><Button loading={busy} disabled={Number(dialog?.row?.refund_amount) > 0 && text.trim().length < 6} onClick={() => run(() => exitAPI.pay(id, dialog.row.exit_id, text.trim()))}>Confirm refund paid</Button></>)}>
          <p>Only confirm after you have sent {formatKES(dialog?.row?.refund_amount || 0)} to {dialog?.row?.member_name}. The amount leaves the chama fund and the member is removed.</p>
          <label className="cs-label" htmlFor="ex-ref">Payment reference (for example the M-Pesa code)</label>
          <input id="ex-ref" className="cs-input" value={text} maxLength={40} onChange={(e) => setText(e.target.value.toUpperCase())} />
        </Dialog>

        <Dialog open={dialog?.kind === "statement"} onClose={close} title="Closing statement" actions={<Button onClick={close}>Close</Button>}>
          {dialog?.data && (
            <dl className="cs-kv">
              <div><dt>Member</dt><dd>{dialog.data.member}</dd></div>
              <div><dt>Chama</dt><dd>{dialog.data.chama}</dd></div>
              <div><dt>Savings paid in</dt><dd>{formatKES(dialog.data.savings_paid_in)}</dd></div>
              <div><dt>Applied to guaranteed loans</dt><dd>{formatKES(dialog.data.applied_to_guaranteed_loans)}</dd></div>
              <div><dt>Refunded</dt><dd>{formatKES(dialog.data.refund)}</dd></div>
              <div><dt>Reference</dt><dd>{dialog.data.payout_reference || "—"}</dd></div>
              <div><dt>Date</dt><dd>{dialog.data.completed_at ? formatDate(dialog.data.completed_at) : "—"}</dd></div>
            </dl>
          )}
        </Dialog>
      </main>
    </div>
  );
}
