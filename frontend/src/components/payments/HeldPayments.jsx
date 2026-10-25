import { useState, useEffect, useCallback } from "react";
import { X, RefreshCw, Inbox } from "lucide-react";
import { toast } from "react-toastify";
import { paymentAPI } from "../../services/api";
import "./PendingContributions.css";

/** Money that reached the chama's paybill but could not be credited by itself. An official gives it to a member or records how it was handled. */
const HeldPayments = ({ chamaId, members = [], currentUserId, onClose, onChanged }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [pick, setPick] = useState({});
  const [result, setResult] = useState(null);
  const [last, setLast] = useState(null);
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await paymentAPI.held(chamaId);
      setRows(res.data.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not load held payments");
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => { load(); paymentAPI.latestReconcile(chamaId).then((r) => setLast(r.data.data)).catch(() => {}); }, [load, chamaId]);

  const checkStatement = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast.error("That file is too large. Export one month at a time.");
    try {
      const res = await paymentAPI.reconcile(chamaId, await file.text());
      setResult(res.data.data);
      setLast({ reconciled: res.data.data.reconciled, run_at: new Date().toISOString() });
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not read that statement");
    }
  };

  const assign = async (row) => {
    const userId = pick[row.event_id];
    if (!userId) return toast.error("Choose the member this money belongs to");
    setBusy(row.event_id);
    try {
      await paymentAPI.assignHeld(chamaId, row.event_id, Number(userId));
      toast.success("Assigned and credited");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not assign this payment");
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (row) => {
    if (!reason.trim()) return toast.error("Say how this was dealt with");
    setBusy(row.event_id);
    try {
      await paymentAPI.resolveHeld(chamaId, row.event_id, reason.trim());
      toast.success("Marked as dealt with");
      setReasonFor(null);
      setReason("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not update this payment");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pending-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Held payments">
        <div className="modal-header">
          <h3>Held payments ({rows.length})</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="modal-close" onClick={load} aria-label="Refresh"><RefreshCw size={18} /></button>
            <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
          </div>
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.75 }}>
          These payments reached your paybill but could not be matched to a member automatically. Nothing is credited until you decide.
        </p>
        <div style={{ margin: "0 0 14px", padding: 12, borderRadius: 12, border: "1px solid rgba(128,128,128,.25)" }}>
          <strong>Check the M-Pesa statement</strong>
          <div style={{ fontSize: 13, opacity: 0.8, margin: "4px 0 8px" }}>
            {last?.reconciled === true ? `Last check ${new Date(last.run_at).toLocaleDateString()}: every payment was accounted for.`
              : last?.reconciled === false ? `Last check ${new Date(last.run_at).toLocaleDateString()}: ${last.breaks ?? "some"} payment(s) need attention.`
              : "Upload the paybill statement (CSV) and every payment is compared with your books."}
          </div>
          <input type="file" accept=".csv,text/csv,text/plain" onChange={checkStatement} aria-label="Upload M-Pesa statement" />
          {result && (
            <div style={{ marginTop: 10, fontSize: 14 }}>
              <div>{result.reconciled ? "Everything matches." : "Some payments need attention."} {result.matched} of {result.statement_lines} matched · total KES {Number(result.statement_total).toLocaleString()}</div>
              {result.breaks?.slice(0, 20).map((b) => (
                <div key={b.receipt} style={{ fontSize: 13, opacity: 0.85 }}>{b.receipt} · KES {Number(b.amount).toLocaleString()} · {b.why}</div>
              ))}
            </div>
          )}
        </div>
        {loading ? <p>Loading…</p> : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", opacity: 0.7 }}>
            <Inbox size={28} /><p>No payments are waiting for a decision.</p>
          </div>
        ) : rows.map((r) => (
          <div key={r.event_id} className="pending-item" style={{ padding: 12, borderRadius: 12, marginBottom: 10, border: "1px solid rgba(128,128,128,.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>KES {Number(r.amount || 0).toLocaleString()}</strong>
              <span style={{ fontFamily: "monospace" }}>{r.reference}</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, margin: "4px 0 8px" }}>
              {r.payer_name || "Unknown payer"}{r.payer_phone ? ` · ${r.payer_phone}` : ""}{r.account_typed ? ` · typed account “${r.account_typed}”` : ""}
              <br />Why it is held: {r.reason}
            </div>
            {reasonFor === r.event_id ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input className="cs-input" style={{ flex: 1, minWidth: 180 }} placeholder="For example: returned to the payer by M-Pesa" value={reason} onChange={(e) => setReason(e.target.value)} />
                <button className="btn-lux btn-lux-primary" disabled={busy === r.event_id} onClick={() => resolve(r)}>Save</button>
                <button className="btn-lux btn-lux-outline" onClick={() => { setReasonFor(null); setReason(""); }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select className="cs-input" value={pick[r.event_id] || ""} onChange={(e) => setPick({ ...pick, [r.event_id]: e.target.value })} aria-label="Member this money belongs to">
                  <option value="">Choose member…</option>
                  {members.filter((m) => String(m.user_id) !== String(currentUserId)).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
                <button className="btn-lux btn-lux-primary" disabled={busy === r.event_id} onClick={() => assign(r)}>Credit to member</button>
                <button className="btn-lux btn-lux-outline" onClick={() => { setReasonFor(r.event_id); setReason(""); }}>Handled another way</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeldPayments;
