import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { financeAPI } from "../../services/api";
import { Button, EmptyState, Skeleton } from "../../components/ui";
import { formatDate, formatKES, downloadError } from "../../utils/format";

const errText = (e, fallback) => e.response?.data?.message || fallback;
const KIND = { ASSIGN_PAYMENT: "Give to a member", RETURN_PAYMENT: "Return to sender", REFUND: "Refund" };
const SECTIONS = [["unclaimed", "Unclaimed payments"], ["requests", "Requests"], ["plans", "Plans"], ["invoices", "Invoices and VAT"]];

function useFetch(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { setData((await fn()).data.data); setError(""); }
    catch (e) { setError(errText(e, "Could not load this.")); }
    finally { setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

/** The accountant's desk. Money is only ever moved after a second, authorised person approves. */
export default function FinanceDesk({ can }) {
  const [section, setSection] = useState("unclaimed");
  const summary = useFetch(() => financeAPI.overview());
  const s = summary.data;
  return (
    <>
      {s && (
        <p style={{ margin: "0 0 12px", opacity: 0.85 }}>
          {s.unrouted_payments} unclaimed · {s.requests_waiting} waiting for approval · {s.refunds_to_send} approved and still to send · {s.past_due_plans} plans behind
        </p>
      )}
      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {SECTIONS.map(([k, l]) => (
          <Button key={k} variant={section === k ? "primary" : "secondary"} role="tab" aria-selected={section === k} onClick={() => setSection(k)}>{l}</Button>
        ))}
      </div>
      {section === "unclaimed" && <Unclaimed can={can} changed={summary.reload} />}
      {section === "requests" && <Requests can={can} changed={summary.reload} />}
      {section === "plans" && <Plans />}
      {section === "invoices" && <Invoices can={can} changed={summary.reload} />}
    </>
  );
}

function useRun(changed) {
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok, after) => {
    setBusy(true);
    try { await fn(); toast.success(ok); if (after) await after(); changed?.(); }
    catch (e) { toast.error(errText(e, "That did not work.")); }
    finally { setBusy(false); }
  };
  return [busy, run];
}

function Unclaimed({ can, changed }) {
  const { data, error, loading, reload } = useFetch(() => financeAPI.unrouted());
  const [busy, run] = useRun(changed);
  const [form, setForm] = useState({});
  const set = (id, k, v) => setForm((f) => ({ ...f, [id]: { ...f[id], [k]: v } }));
  if (loading && !data) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  if (!data?.length) return <EmptyState title="Nothing unclaimed" message="Payments that no chama could claim appear here." />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {data.map((p) => {
        const f = form[p.event_id] || {};
        return (
          <div key={p.event_id} className="cs-card" style={{ padding: 12, fontSize: 14 }}>
            <strong>{formatKES(p.amount)}</strong> · {p.reference} · {p.received_at ? formatDate(p.received_at) : ""}
            <div style={{ opacity: 0.8 }}>
              {p.payer_name || "Unknown payer"} {p.payer_phone ? `(${p.payer_phone})` : ""} typed “{p.account_typed || "nothing"}”. {p.reason}
            </div>
            {can("FINANCE_MANAGE") && (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input className="cs-input" inputMode="numeric" placeholder="Chama number" aria-label="Chama number" value={f.chama || ""} onChange={(e) => set(p.event_id, "chama", e.target.value)} style={{ width: 170 }} />
                  <input className="cs-input" inputMode="numeric" placeholder="Member's user number" aria-label="Member user number" value={f.user || ""} onChange={(e) => set(p.event_id, "user", e.target.value)} style={{ width: 230 }} />
                </div>
                <input className="cs-input" placeholder="Why this is right, or why it goes back (at least 10 characters)" aria-label="Reason" value={f.reason || ""} onChange={(e) => set(p.event_id, "reason", e.target.value)} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Button variant="secondary" disabled={busy}
                    onClick={() => run(() => financeAPI.assign({ event_id: p.event_id, chama_id: f.chama, user_id: f.user, reason: f.reason }), "Sent for approval", reload)}>Give to this member</Button>
                  <Button variant="secondary" disabled={busy}
                    onClick={() => run(() => financeAPI.returnPayment({ event_id: p.event_id, reason: f.reason }), "Sent for approval", reload)}>Return to sender</Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Requests({ can, changed }) {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useFetch(() => financeAPI.requests(status), [status]);
  const [busy, run] = useRun(changed);
  const [refs, setRefs] = useState({});
  const [notes, setNotes] = useState({});
  if (loading && !data) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  return (
    <>
      <select className="cs-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Show" style={{ marginBottom: 10 }}>
        <option value="">All</option><option value="PROPOSED">Waiting for approval</option><option value="APPROVED">Approved, still to send</option><option value="DONE">Done</option><option value="REJECTED">Rejected</option>
      </select>
      {!data?.length && <EmptyState title="No requests" message="Requests to give, return or refund money appear here." />}
      <div style={{ display: "grid", gap: 10 }}>
        {(data || []).map((r) => (
          <div key={r.request_id} className="cs-card" style={{ padding: 12, fontSize: 14 }}>
            <strong>{KIND[r.kind] || r.kind}: {formatKES(r.amount)}</strong> · {String(r.status).toLowerCase()}
            <div style={{ opacity: 0.8 }}>
              Proposed by {r.proposed_by_name} on {formatDate(r.proposed_at)}. {r.reason}
              {r.decided_by_name ? ` Decided by ${r.decided_by_name}${r.decision_note ? `: ${r.decision_note}` : ""}.` : ""}
              {r.external_ref ? ` Sent, reference ${r.external_ref}.` : ""}
            </div>
            {r.status === "PROPOSED" && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {can("FINANCE_APPROVE") && <Button disabled={busy} onClick={() => run(() => financeAPI.approve(r.request_id), "Approved", reload)}>Approve</Button>}
                {can("FINANCE_APPROVE") && (
                  <>
                    <input className="cs-input" placeholder="Reason for rejecting" aria-label="Reason for rejecting" value={notes[r.request_id] || ""} onChange={(e) => setNotes({ ...notes, [r.request_id]: e.target.value })} />
                    <Button variant="secondary" disabled={busy} onClick={() => run(() => financeAPI.reject(r.request_id, notes[r.request_id]), "Rejected", reload)}>Reject</Button>
                  </>
                )}
                {can("FINANCE_MANAGE") && <Button variant="secondary" disabled={busy} onClick={() => run(() => financeAPI.cancel(r.request_id), "Withdrawn", reload)}>Withdraw</Button>}
              </div>
            )}
            {r.status === "APPROVED" && can("FINANCE_MANAGE") && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <input className="cs-input" placeholder="Reference from M-Pesa or Paystack after sending" aria-label="Provider reference" value={refs[r.request_id] || ""} onChange={(e) => setRefs({ ...refs, [r.request_id]: e.target.value })} />
                <Button disabled={busy} onClick={() => run(() => financeAPI.complete(r.request_id, refs[r.request_id]), "Recorded", reload)}>I have sent it</Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, opacity: 0.7 }}>ChamaSmart does not send money from this screen. After approval, send the return or refund from the M-Pesa portal or the Paystack dashboard, then record its reference here.</p>
    </>
  );
}

function Plans() {
  const { data, error, loading } = useFetch(() => financeAPI.subscriptions());
  if (loading) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  if (!data?.length) return <EmptyState title="No plans yet" message="Chamas that choose a paid plan appear here." />;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {data.map((p) => (
        <div key={p.chama_id} className="cs-card" style={{ padding: 12, fontSize: 14 }}>
          <strong>{p.chama_name}</strong> · {p.plan_code} · {String(p.status).toLowerCase().replace(/_/g, " ")}
          <div style={{ opacity: 0.8 }}>{p.members} members · {formatKES(p.price)} · {p.current_period_end ? `paid until ${formatDate(p.current_period_end)}` : "no end date"}</div>
        </div>
      ))}
    </div>
  );
}

function Invoices({ can, changed }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const { data, error, loading, reload } = useFetch(() => financeAPI.invoices(from, to), [from, to]);
  const [busy, run] = useRun(changed);
  const [refund, setRefund] = useState({});

  const download = async () => {
    try {
      const res = await financeAPI.vatExport(from, to);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `chamasmart-vat-${from}-to-${to}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { toast.error(await downloadError(e, "Could not export.")); }
  };
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <label>From <input className="cs-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input className="cs-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <Button variant="secondary" onClick={download}>Download VAT file (CSV)</Button>
      </div>
      {loading && !data ? <Skeleton /> : error ? <p role="alert">{error}</p> : !data?.length ? <EmptyState title="No invoices in this period" message="An invoice is issued each time a chama pays for its plan." /> : (
        <div style={{ display: "grid", gap: 8 }}>
          {data.map((i) => {
            const f = refund[i.invoice_id] || {};
            return (
              <div key={i.invoice_id} className="cs-card" style={{ padding: 12, fontSize: 14 }}>
                <strong>{i.invoice_number}</strong> · {i.chama_name} · {i.plan_code} · {formatKES(i.gross)}
                <div style={{ opacity: 0.8 }}>Net {formatKES(i.net)}, VAT {formatKES(i.vat)} · {formatDate(i.issued_at)}{Number(i.refunded) > 0 ? ` · refunded ${formatKES(i.refunded)}` : ""}</div>
                {can("FINANCE_MANAGE") && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <input className="cs-input" inputMode="decimal" placeholder="Amount" aria-label="Refund amount" style={{ width: 110 }} value={f.amount || ""} onChange={(e) => setRefund({ ...refund, [i.invoice_id]: { ...f, amount: e.target.value } })} />
                    <input className="cs-input" placeholder="Reason for the refund" aria-label="Refund reason" value={f.reason || ""} onChange={(e) => setRefund({ ...refund, [i.invoice_id]: { ...f, reason: e.target.value } })} />
                    <Button variant="secondary" disabled={busy} onClick={() => run(() => financeAPI.refund({ invoice_id: i.invoice_id, amount: f.amount, reason: f.reason }), "Sent for approval", reload)}>Request refund</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 12, opacity: 0.7 }}>VAT is only added once ChamaSmart is registered for it. Your accountant confirms that setting before the first filing.</p>
    </>
  );
}
