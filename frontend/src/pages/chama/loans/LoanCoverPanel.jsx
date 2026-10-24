import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { coverAPI } from "../../../services/api";
import { Button, Dialog } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

const REASON = { DEATH: "Death of the borrower", DISABILITY: "Permanent disability" };
const STATUS = { PENDING: "Waiting for a second official", APPROVED: "Paid from the reserve", REJECTED: "Declined" };

// Loan cover reserve: balance, claims, and the two-official claim flow. Officials only.
export default function LoanCoverPanel({ chamaId, loans = [], me, onChanged }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind: "claim" | "decide", row?, approve? }
  const [form, setForm] = useState({ loan_id: "", reason: "DEATH", details: "" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData((await coverAPI.overview(chamaId)).data?.data ?? null); setFailed(false); } catch { setFailed(true); }
  }, [chamaId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(ok || res.data?.message || "Done.");
      setDialog(null); setNote(""); setForm({ loan_id: "", reason: "DEATH", details: "" });
      await load();
      if (onChanged) await onChanged();
    } catch (e) {
      toast.error(e.response?.data?.message || "That didn't go through. Nothing was changed.", { autoClose: 8000 });
    } finally { setBusy(false); }
  };

  if (failed) return null;
  if (!data) return null;
  const covered = loans.filter((l) => Number(l.cover_premium) > 0 && ["APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED"].includes(l.status));
  if (Number(data.cover_percent) === 0 && Number(data.reserve) === 0 && data.claims.length === 0) return null;
  const formOk = form.loan_id && form.details.trim().length >= 10;
  return (
    <section className="cs-card" style={{ marginBottom: 16 }} aria-label="Loan cover">
      <h2 className="cs-card-title">Loan cover</h2>
      <dl className="cs-kv">
        <div><dt>Premium on new loans</dt><dd>{Number(data.cover_percent)}%</dd></div>
        <div><dt>Reserve held</dt><dd>{formatKES(data.reserve)}</dd></div>
      </dl>
      <p className="cs-help">The reserve is part of the chama fund but is never lent out. It is the limit of the cover: it is not an outside insurer.</p>
      <div className="cs-actions"><Button size="sm" disabled={covered.length === 0} onClick={() => setDialog({ kind: "claim" })}>Record a death or disability</Button></div>
      {data.claims.length > 0 && (
        <ul className="cs-list" style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {data.claims.map((c) => (
            <li key={c.claim_id} className="cs-list-item">
              <div className="cs-list-main">
                <div className="cs-list-title">Loan {c.loan_id}: {REASON[c.reason] || c.reason}</div>
                <div className="cs-list-meta">{STATUS[c.status] || c.status} · {formatDate(c.created_at)}{c.status === "APPROVED" ? ` · ${formatKES(c.amount_paid)} paid` : ""}{c.decision_note ? ` · ${c.decision_note}` : ""}</div>
              </div>
              {c.status === "PENDING" && (
                <span className="cs-actions">
                  <Button size="sm" onClick={() => setDialog({ kind: "decide", row: c, approve: true })}>Approve</Button>
                  <Button size="sm" variant="danger" onClick={() => setDialog({ kind: "decide", row: c, approve: false })}>Decline</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog?.kind === "claim"} onClose={() => !busy && setDialog(null)} title="Record a death or disability"
        actions={(<><Button onClick={() => setDialog(null)} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!formOk} onClick={() => run(() => coverAPI.request(chamaId, { loan_id: Number(form.loan_id), reason: form.reason, details: form.details.trim() }), "Recorded. A different official must decide it.")}>Record claim</Button></>)}>
        <div className="cs-field">
          <label className="cs-label" htmlFor="cv-loan">Loan</label>
          <select id="cv-loan" className="cs-select" value={form.loan_id} onChange={(e) => setForm({ ...form, loan_id: e.target.value })}>
            <option value="">Choose…</option>
            {covered.filter((l) => String(l.borrower_id ?? l.user_id) !== String(me)).map((l) => <option key={l.loan_id} value={l.loan_id}>Loan {l.loan_id}: {l.borrower_name || l.member_name || "Borrower"}, balance {formatKES(l.balance || 0)}</option>)}
          </select>
        </div>
        <div className="cs-field">
          <label className="cs-label" htmlFor="cv-reason">What happened</label>
          <select id="cv-reason" className="cs-select" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
            <option value="DEATH">Death of the borrower</option>
            <option value="DISABILITY">Permanent disability</option>
          </select>
        </div>
        <div className="cs-field">
          <label className="cs-label" htmlFor="cv-details">What you have seen (certificate, medical report, family)</label>
          <textarea id="cv-details" className="cs-textarea" rows={3} maxLength={500} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        </div>
      </Dialog>

      <Dialog open={dialog?.kind === "decide"} onClose={() => !busy && setDialog(null)} title={dialog?.approve ? "Pay this claim from the reserve?" : "Decline this claim?"}
        actions={(<><Button onClick={() => setDialog(null)} disabled={busy}>Back</Button><Button variant={dialog?.approve ? "primary" : "danger"} loading={busy} disabled={!dialog?.approve && note.trim().length < 3}
          onClick={() => run(() => coverAPI.decide(chamaId, dialog.row.claim_id, dialog.approve ? "APPROVED" : "REJECTED", note.trim()))}>{dialog?.approve ? "Pay from reserve" : "Decline"}</Button></>)}>
        <p>{dialog?.approve ? "What is still owed on the loan is paid from the reserve, up to what the reserve holds. This cannot be undone." : "The loan stays as it is."}</p>
        <label className="cs-label" htmlFor="cv-note">{dialog?.approve ? "Note (optional)" : "Reason"}</label>
        <input id="cv-note" className="cs-input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </Dialog>
    </section>
  );
}
