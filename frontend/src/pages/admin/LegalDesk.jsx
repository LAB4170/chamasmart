import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { legalAPI } from "../../services/api";
import { Button, EmptyState, Skeleton } from "../../components/ui";
import { formatDate, downloadError } from "../../utils/format";

const errText = (e, fallback) => e.response?.data?.message || fallback;
const KINDS = [
  ["COURT_ORDER", "Court order"], ["PRESERVATION", "Preservation order"], ["DISCLOSURE_REQUEST", "Disclosure request"],
  ["POLICE_REQUEST", "Police request"], ["REGULATOR_REQUEST", "Regulator request"], ["OTHER", "Other"],
];
const STATUS = { RECEIVED: "Received", UNDER_REVIEW: "Under review", COMPLIED: "Complied with", CONTESTED: "Contested", CLOSED: "Closed" };

function useFetch(fn, deps) {
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

function useRun() {
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok, after) => {
    setBusy(true);
    try { await fn(); toast.success(ok); if (after) await after(); }
    catch (e) { toast.error(await downloadError(e, "That did not work.")); }
    finally { setBusy(false); }
  };
  return [busy, run];
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** The legal desk: case files, the register of orders and requests, and referral packs. */
export default function LegalDesk({ can, caseId, onBackToCases }) {
  const [section, setSection] = useState(caseId ? "case" : "orders");
  return (
    <>
      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {caseId && <Button variant={section === "case" ? "primary" : "secondary"} role="tab" aria-selected={section === "case"} onClick={() => setSection("case")}>Case file</Button>}
        {can("LEGAL_ORDERS") && <Button variant={section === "orders" ? "primary" : "secondary"} role="tab" aria-selected={section === "orders"} onClick={() => setSection("orders")}>Orders and requests</Button>}
        {caseId && <Button variant="secondary" onClick={onBackToCases}>Back to cases</Button>}
      </div>
      {section === "case" && caseId && <CaseFile caseId={caseId} can={can} />}
      {section === "orders" && can("LEGAL_ORDERS") && <Orders />}
    </>
  );
}

function CaseFile({ caseId, can }) {
  const { data, error, loading, reload } = useFetch(() => legalAPI.caseFile(caseId), [caseId]);
  const [busy, run] = useRun();
  const [note, setNote] = useState("");
  const [doc, setDoc] = useState({ id: "", note: "" });
  const [pack, setPack] = useState({ recipient: "", basis: "", order_id: "", include_documents: false });
  if (loading && !data) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  const c = data.case;
  const download = () => run(async () => {
    const res = await legalAPI.referralPack(caseId, { ...pack, order_id: pack.order_id || null });
    saveBlob(res.data, `chamasmart-case-${caseId}-evidence.zip`);
  }, "Pack built. The disclosure was recorded.", reload);
  const card = { padding: 14, marginTop: 12 };
  return (
    <>
      <h2 style={{ margin: "0 0 4px" }}>{data.chama.chama_name} · case {c.case_id}</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>Level {c.level} · {String(c.status).toLowerCase()}{c.urgent ? " · urgent" : ""} · opened {formatDate(c.opened_at)}</p>
      <section className="cs-card" style={card}>
        <h3 style={{ marginTop: 0 }}>Notice and response</h3>
        <p style={{ margin: "4px 0" }}>{c.reason}</p>
        <p style={{ margin: "4px 0", opacity: 0.85 }}>{c.response_text ? `The chama replied on ${formatDate(c.responded_at)}: ${c.response_text}` : "The chama has not replied."}</p>
        {c.resolution_note && <p style={{ margin: "4px 0" }}>Outcome: {c.resolution_note}</p>}
      </section>
      <section className="cs-card" style={card}>
        <h3 style={{ marginTop: 0 }}>Officials</h3>
        {data.officials.map((o) => <p key={o.user_id} style={{ margin: "4px 0" }}>{o.first_name} {o.last_name} ({String(o.role).toLowerCase()}) · {o.email} · {o.phone_number || "no phone"}</p>)}
      </section>
      <section className="cs-card" style={card}>
        <h3 style={{ marginTop: 0 }}>Agreements accepted</h3>
        {data.acceptances.length === 0 && <p style={{ margin: 0 }}>None recorded.</p>}
        {data.acceptances.map((a, i) => <p key={i} style={{ margin: "4px 0", fontSize: 14 }}>User {a.user_id} accepted {a.code} {a.version} on {formatDate(a.accepted_at)} from {a.ip_address || "unknown address"}</p>)}
      </section>
      <section className="cs-card" style={card}>
        <h3 style={{ marginTop: 0 }}>Evidence</h3>
        {data.evidence.length === 0 && <p style={{ margin: 0 }}>No documents attached yet.</p>}
        {data.evidence.map((e) => <p key={e.evidence_id} style={{ margin: "4px 0", fontSize: 14 }}>{e.doc_type} · {e.original_name}{e.note ? ` · ${e.note}` : ""} · held</p>)}
        {can("CASE_OPEN") && can("LEGAL_HOLD") && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <select className="cs-input" aria-label="Document" value={doc.id} onChange={(e) => setDoc({ ...doc, id: e.target.value })}>
              <option value="">Choose a document</option>
              {(data.documents || []).map((d) => <option key={d.doc_id} value={d.doc_id}>{d.doc_type.replace(/_/g, " ").toLowerCase()}{d.subject_user_id ? ` (official ${d.subject_user_id})` : ""} · {d.original_name}</option>)}
            </select>
            <input className="cs-input" placeholder="Why it matters" aria-label="Why it matters" value={doc.note} onChange={(e) => setDoc({ ...doc, note: e.target.value })} />
            <Button variant="secondary" disabled={busy} onClick={() => run(() => legalAPI.attachEvidence(caseId, doc.id, doc.note), "Attached and placed on hold", () => { setDoc({ id: "", note: "" }); return reload(); })}>Attach and hold</Button>
          </div>
        )}
      </section>
      <section className="cs-card" style={card}>
        <h3 style={{ marginTop: 0 }}>Notes</h3>
        {data.notes.map((n) => <p key={n.note_id} style={{ margin: "6px 0", fontSize: 14 }}><strong>{n.author}</strong> · {formatDate(n.created_at)}<br />{n.body}</p>)}
        {can("CASE_OPEN") && (
          <>
            <textarea className="cs-input" rows={3} style={{ width: "100%" }} placeholder="Add a note. Notes cannot be edited or removed." aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="secondary" disabled={busy} onClick={() => run(() => legalAPI.addNote(caseId, note), "Note added", () => { setNote(""); return reload(); })}>Add note</Button>
          </>
        )}
      </section>
      {data.orders.length > 0 && (
        <section className="cs-card" style={card}>
          <h3 style={{ marginTop: 0 }}>Orders and requests</h3>
          {data.orders.map((o) => <p key={o.order_id} style={{ margin: "4px 0", fontSize: 14 }}>#{o.order_id} {o.reference} · {o.issuing_body} · {STATUS[o.status]}{o.due_on ? ` · due ${formatDate(o.due_on)}` : ""}</p>)}
        </section>
      )}
      {can("CASE_REFERRAL") && (
        <section className="cs-card" style={card}>
          <h3 style={{ marginTop: 0 }}>Referral pack</h3>
          <p style={{ fontSize: 13, opacity: 0.8, marginTop: 0 }}>A ZIP with the case summary, officials, agreements accepted, activity log, payments, a list of documents, and a manifest of file fingerprints. Who receives it and why is recorded before it is built.</p>
          <div style={{ display: "grid", gap: 6 }}>
            <input className="cs-input" placeholder="Who is it for (for example DCI Fraud Unit)" aria-label="Recipient" value={pack.recipient} onChange={(e) => setPack({ ...pack, recipient: e.target.value })} />
            <input className="cs-input" placeholder="Legal basis (for example Court order HCCC 45 of 2026)" aria-label="Legal basis" value={pack.basis} onChange={(e) => setPack({ ...pack, basis: e.target.value })} />
            <input className="cs-input" inputMode="numeric" placeholder="Order number from the register, if any" aria-label="Order number" value={pack.order_id} onChange={(e) => setPack({ ...pack, order_id: e.target.value })} />
            {can("DOCUMENT_VIEW") && (
              <label style={{ fontSize: 14 }}><input type="checkbox" checked={pack.include_documents} onChange={(e) => setPack({ ...pack, include_documents: e.target.checked })} /> Include the stored documents (each one opened is logged)</label>
            )}
            <Button disabled={busy} onClick={download}>Build and download</Button>
          </div>
          {data.disclosures.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <strong style={{ fontSize: 14 }}>Already shared</strong>
              {data.disclosures.map((d) => <p key={d.disclosure_id} style={{ margin: "4px 0", fontSize: 13 }}>{formatDate(d.generated_at)} · {d.recipient} · {d.basis}{d.included_documents ? " · with documents" : ""}</p>)}
            </div>
          )}
        </section>
      )}
      <details style={{ marginTop: 12 }}>
        <summary>Activity on this chama ({data.trail.length})</summary>
        {data.trail.map((t, i) => <p key={i} style={{ margin: "3px 0", fontSize: 13 }}>{formatDate(t.at)} · {t.action} · {t.outcome} · {t.detail || ""}</p>)}
      </details>
    </>
  );
}

function Orders() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useFetch(() => legalAPI.orders(status), [status]);
  const [busy, run] = useRun();
  const [form, setForm] = useState({ kind: "COURT_ORDER", reference: "", issuing_body: "", received_on: "", due_on: "", chama_id: "", case_id: "", summary: "" });
  const [moves, setMoves] = useState({});
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <>
      <details style={{ marginBottom: 12 }}>
        <summary><strong>Register a new order or request</strong></summary>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <select className="cs-input" value={form.kind} onChange={set("kind")} aria-label="Kind">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input className="cs-input" placeholder="Reference (case or file number)" aria-label="Reference" value={form.reference} onChange={set("reference")} />
          <input className="cs-input" placeholder="Issued by (court, police unit, regulator)" aria-label="Issued by" value={form.issuing_body} onChange={set("issuing_body")} />
          <label>Received on <input className="cs-input" type="date" value={form.received_on} onChange={set("received_on")} /></label>
          <label>Respond by <input className="cs-input" type="date" value={form.due_on} onChange={set("due_on")} /></label>
          <input className="cs-input" inputMode="numeric" placeholder="Chama number, if it concerns one" aria-label="Chama number" value={form.chama_id} onChange={set("chama_id")} />
          <input className="cs-input" inputMode="numeric" placeholder="Case number, if linked" aria-label="Case number" value={form.case_id} onChange={set("case_id")} />
          <textarea className="cs-input" rows={3} placeholder="What it asks for" aria-label="What it asks for" value={form.summary} onChange={set("summary")} />
          <Button disabled={busy} onClick={() => run(() => legalAPI.registerOrder({ ...form, received_on: form.received_on || undefined, due_on: form.due_on || undefined }), "Registered", reload)}>Register</Button>
          <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>A preservation order places every stored document of the chama on hold straight away. What an order says cannot be changed after it is registered.</p>
        </div>
      </details>
      <select className="cs-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Show" style={{ marginBottom: 10 }}>
        <option value="">All</option>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {loading && !data ? <Skeleton /> : error ? <p role="alert">{error}</p> : !data?.length ? <EmptyState title="Nothing registered" message="Court orders and official requests appear here, oldest deadline first." /> : (
        <div style={{ display: "grid", gap: 10 }}>
          {data.map((o) => {
            const m = moves[o.order_id] || { status: "UNDER_REVIEW", note: "" };
            return (
              <div key={o.order_id} className="cs-card" style={{ padding: 12, fontSize: 14 }}>
                <strong>#{o.order_id} {o.reference}</strong> · {o.issuing_body} · {STATUS[o.status]}{o.overdue ? " · overdue" : ""}
                <div style={{ opacity: 0.85 }}>{o.summary}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Received {formatDate(o.received_on)}{o.due_on ? ` · respond by ${formatDate(o.due_on)}` : ""}{o.chama_name ? ` · ${o.chama_name}` : ""}{o.case_id ? ` · case ${o.case_id}` : ""}</div>
                {o.status !== "CLOSED" && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <select className="cs-input" aria-label="New status" value={m.status} onChange={(e) => setMoves({ ...moves, [o.order_id]: { ...m, status: e.target.value } })}>
                      {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input className="cs-input" placeholder="What happened" aria-label="What happened" value={m.note} onChange={(e) => setMoves({ ...moves, [o.order_id]: { ...m, note: e.target.value } })} />
                    <Button variant="secondary" disabled={busy} onClick={() => run(() => legalAPI.moveOrder(o.order_id, m.status, m.note), "Updated", reload)}>Update</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
