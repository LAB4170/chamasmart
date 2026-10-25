import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { payoutAPI } from "../../services/api";
import "./PendingContributions.css";

const LABEL = { REQUESTED: "Waiting for approval", APPROVED: "Approved", PAID: "Paid", REJECTED: "Rejected", CANCELLED: "Cancelled", EXPIRED: "Expired" };

/** Spending the chama's money: one official asks, others approve, someone sends it and records the M-Pesa code. */
const PayoutsModal = ({ chamaId, currentUserId, onClose, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ amount: "", payee_name: "", payee_phone: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(null);
  const [ref, setRef] = useState("");
  const keyRef = useRef(crypto.randomUUID().slice(0, 32));

  const load = useCallback(async () => {
    try { setRows((await payoutAPI.list(chamaId)).data.data || []); }
    catch (e) { toast.error(e.response?.data?.message || "Could not load payouts"); }
  }, [chamaId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await load(); onChanged?.(); }
    catch (e) { toast.error(e.response?.data?.message || "That did not work"); }
    finally { setBusy(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await payoutAPI.request(chamaId, { ...form, amount: Number(form.amount) }, keyRef.current);
      keyRef.current = crypto.randomUUID().slice(0, 32);
      setForm({ amount: "", payee_name: "", payee_phone: "", reason: "" });
    }, "Requested. Another official must approve it.");
  };

  const mine = (r) => String(r.requested_by) === String(currentUserId);
  const held = (r) => r.release_at && new Date(r.release_at) > new Date();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pending-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Payouts">
        <div className="modal-header">
          <h3>Payouts</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <form onSubmit={submit} style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <strong>Ask to spend chama money</strong>
          <input className="cs-input" type="number" min="1" step="0.01" required placeholder="Amount (KES)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="cs-input" required placeholder="Who is being paid" value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} />
          <input className="cs-input" placeholder="Their M-Pesa number (optional)" value={form.payee_phone} onChange={(e) => setForm({ ...form, payee_phone: e.target.value })} />
          <input className="cs-input" required minLength={5} placeholder="What it is for" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button className="btn-lux btn-lux-primary" disabled={busy} type="submit">Send for approval</button>
        </form>
        {rows.length === 0 ? <p style={{ opacity: 0.7 }}>No payouts yet.</p> : rows.map((r) => (
          <div key={r.payout_id} style={{ padding: 12, borderRadius: 12, marginBottom: 10, border: "1px solid rgba(128,128,128,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>KES {Number(r.amount).toLocaleString()} · {r.payee_name}</strong>
              <span>{LABEL[r.status] || r.status}</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, margin: "4px 0 8px" }}>
              {r.reason} · approvals {r.approvals} of {r.required_approvals}
              {r.status === "APPROVED" && held(r) ? ` · on hold until ${new Date(r.release_at).toLocaleString()}` : ""}
              {r.payment_reference ? ` · ${r.payment_reference}` : ""}
              {r.decision_note ? ` · ${r.decision_note}` : ""}
            </div>
            {r.status === "REQUESTED" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!mine(r) && <button className="btn-lux btn-lux-primary" disabled={busy} onClick={() => run(() => payoutAPI.approve(chamaId, r.payout_id), "Approved")}>Approve</button>}
                {!mine(r) && <button className="btn-lux btn-lux-outline" disabled={busy} onClick={() => { const n = window.prompt("Why are you rejecting this?"); if (n && n.trim()) run(() => payoutAPI.reject(chamaId, r.payout_id, n.trim()), "Rejected"); }}>Reject</button>}
                {mine(r) && <button className="btn-lux btn-lux-outline" disabled={busy} onClick={() => run(() => payoutAPI.cancel(chamaId, r.payout_id), "Cancelled")}>Cancel my request</button>}
              </div>
            )}
            {r.status === "APPROVED" && (paying === r.payout_id ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="cs-input" placeholder="M-Pesa code of the payment you sent" value={ref} onChange={(e) => setRef(e.target.value)} />
                <button className="btn-lux btn-lux-primary" disabled={busy} onClick={() => run(async () => { await payoutAPI.paid(chamaId, r.payout_id, ref); setPaying(null); setRef(""); }, "Recorded as paid")}>Record as paid</button>
              </div>
            ) : (
              <button className="btn-lux btn-lux-primary" disabled={busy || held(r)} onClick={() => setPaying(r.payout_id)}>I have sent the money</button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PayoutsModal;
