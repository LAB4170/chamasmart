import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { listingAPI } from "../../services/api";
import "./PendingContributions.css";

const STATUS_TEXT = {
  NOT_STARTED: "Not applied",
  DRAFT: "Not applied",
  SUBMITTED: "Waiting for review",
  IN_REVIEW: "Being reviewed",
  CHANGES_REQUESTED: "Changes needed",
  APPROVED: "Listed publicly",
  REJECTED: "Declined",
  SUSPENDED: "Listing suspended",
  REVOKED: "Removed from the listing",
};
const LEVEL_TEXT = { 1: "Warning", 2: "Listing suspended", 3: "Payouts paused", 4: "Account closed" };
const DOC_TYPES = [
  ["REGISTRATION_CERTIFICATE", "Registration certificate"],
  ["CONSTITUTION", "Constitution"],
  ["OFFICIALS_RESOLUTION", "Resolution naming the officials"],
  ["PAYBILL_PROOF", "Proof the paybill is in the chama's name"],
  ["OFFICIAL_ID", "National ID of an official"],
];
const DOC_NAME = Object.fromEntries(DOC_TYPES);
const err = (e, f) => e.response?.data?.message || f;

/** Public listing for officials: read and accept the agreements, apply, and answer any notice from ChamaSmart. */
const ListingModal = ({ chamaId, isChair, currentUserId, onClose }) => {
  const [status, setStatus] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [notices, setNotices] = useState([]);
  const [reading, setReading] = useState(null);
  const [replies, setReplies] = useState({});
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState([]);
  const [docType, setDocType] = useState("REGISTRATION_CERTIFICATE");
  const [docSubject, setDocSubject] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [form, setForm] = useState({ registration_body: "", registration_number: "", registered_name: "", collection_summary: "", public_blurb: "", contact_phone: "" });

  const load = useCallback(async () => {
    try {
      const [s, a, n] = await Promise.all([listingAPI.status(chamaId), listingAPI.agreements(), listingAPI.notices(chamaId)]);
      setStatus(s.data.data); setAgreements(a.data.data || []); setNotices(n.data.data || []);
      try { setDocs((await listingAPI.documents(chamaId)).data.data || []); } catch { setDocs([]); }
    } catch (e) { toast.error(err(e, "Could not load the listing page")); }
  }, [chamaId]);
  useEffect(() => { load(); }, [load]);

  const missing = (id) => (status?.agreements || []).find((x) => x.agreement_id === id)?.missing || [];
  const iAccepted = (id) => !missing(id).includes(Number(currentUserId));

  const accept = async (id) => {
    setBusy(true);
    try { await listingAPI.accept(chamaId, id); toast.success("Recorded"); setReading(null); await load(); }
    catch (e) { toast.error(err(e, "Could not record this")); }
    finally { setBusy(false); }
  };
  const apply = async (ev) => {
    ev.preventDefault(); setBusy(true);
    try { await listingAPI.apply(chamaId, form); toast.success("Application sent"); await load(); }
    catch (e) { toast.error(err(e, "Could not send the application")); }
    finally { setBusy(false); }
  };
  const upload = async (ev) => {
    ev.preventDefault();
    if (!docFile) { toast.error("Choose a PDF, JPEG or PNG file first"); return; }
    if (docType === "OFFICIAL_ID" && !docSubject) { toast.error("Choose which official this ID belongs to"); return; }
    setBusy(true);
    try {
      await listingAPI.upload(chamaId, docType, docFile, docType === "OFFICIAL_ID" ? docSubject : undefined);
      toast.success("Uploaded and stored encrypted");
      setDocFile(null); ev.target.reset(); await load();
    } catch (e2) { toast.error(err(e2, "Could not upload this file")); }
    finally { setBusy(false); }
  };
  const respond = async (caseId) => {
    setBusy(true);
    try { await listingAPI.respond(chamaId, caseId, replies[caseId] || ""); toast.success("Your response was sent"); await load(); }
    catch (e) { toast.error(err(e, "Could not send your response")); }
    finally { setBusy(false); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const st = status?.status;
  const canApply = isChair && ["NOT_STARTED", "DRAFT", "CHANGES_REQUESTED"].includes(st);
  const openNotices = notices.filter((n) => n.status === "OPEN");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pending-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Public listing">
        <div className="modal-header">
          <h2>Public listing</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {!status ? <p>Loading…</p> : (
          <div style={{ display: "grid", gap: 14 }}>
            {openNotices.map((n) => (
              <section key={n.case_id} role="alert" style={{ border: "1px solid currentColor", borderRadius: 8, padding: 12 }}>
                <strong>Notice from ChamaSmart: {LEVEL_TEXT[n.level]}</strong>
                <p style={{ margin: "6px 0" }}>{n.reason}</p>
                <p style={{ fontSize: 13, opacity: 0.8, margin: "0 0 6px" }}>
                  You have the right to respond. We read every response and record it. ChamaSmart does not hold your chama's money; this notice only affects what the platform does.
                </p>
                {n.response_text
                  ? <p style={{ fontSize: 14 }}>Your response was sent. You can send another.</p> : null}
                <textarea className="cs-input" rows={3} style={{ width: "100%" }} value={replies[n.case_id] || ""} onChange={(e) => setReplies({ ...replies, [n.case_id]: e.target.value })} placeholder="Your response" aria-label="Your response" />
                <button className="btn-lux btn-lux-outline" style={{ marginTop: 6 }} disabled={busy} onClick={() => respond(n.case_id)}>Send response</button>
              </section>
            ))}

            <section>
              <p style={{ margin: 0 }}><strong>{STATUS_TEXT[st] || st}</strong></p>
              {st === "APPROVED" && <p style={{ margin: "4px 0", fontSize: 14 }}>Your chama appears in the public listing. For the first 30 days after listing, payouts are held 72 hours and capped lower each day, to protect members.</p>}
              {st === "CHANGES_REQUESTED" && status.review_note && <p style={{ margin: "4px 0" }}>What to fix: {status.review_note}</p>}
              {st === "REJECTED" && status.review_note && <p style={{ margin: "4px 0" }}>Reason: {status.review_note}</p>}
              {(st === "SUSPENDED" || st === "REVOKED") && <p style={{ margin: "4px 0" }}>Contact ChamaSmart to talk about re-listing. Answer any notice above first.</p>}
              {["NOT_STARTED", "DRAFT"].includes(st) && <p style={{ margin: "4px 0", fontSize: 14 }}>A public listing lets people you do not know find and join your chama. Because that is where fraud happens, ChamaSmart reviews every chama first. Private chamas need no review.</p>}
            </section>

            <section>
              <h3 style={{ margin: "0 0 6px" }}>What must be in place</h3>
              {(status.readiness || []).map((r) => (
                <div key={r.code} style={{ display: "flex", gap: 8, padding: "3px 0" }}>
                  <span aria-hidden="true">{r.passed ? "✔" : "○"}</span>
                  <span>{r.label}{r.auto ? "" : " (checked by ChamaSmart)"}</span>
                </div>
              ))}
            </section>

            <section>
              <h3 style={{ margin: "0 0 6px" }}>Agreements</h3>
              {agreements.length === 0 && <p style={{ fontSize: 14 }}>The agreements are being finalised. You will be able to accept them here soon.</p>}
              {agreements.map((a) => (
                <div key={a.agreement_id} style={{ padding: "6px 0", borderTop: "1px solid rgba(128,128,128,.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span>{a.title}</span>
                    <span style={{ fontSize: 13 }}>{iAccepted(a.agreement_id) ? "You accepted" : "Waiting for you"}{missing(a.agreement_id).length ? ` · ${missing(a.agreement_id).length} official${missing(a.agreement_id).length > 1 ? "s" : ""} still to accept` : " · all officials accepted"}</span>
                  </div>
                  <button className="btn-lux btn-lux-outline" style={{ marginTop: 4 }} onClick={() => setReading(reading?.agreement_id === a.agreement_id ? null : a)}>
                    {reading?.agreement_id === a.agreement_id ? "Hide" : "Read"}
                  </button>
                  {reading?.agreement_id === a.agreement_id && (
                    <div>
                      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", maxHeight: 320, overflow: "auto", fontSize: 14 }}>{a.body}</pre>
                      {!iAccepted(a.agreement_id) && (
                        <button className="btn-lux btn-lux-primary" disabled={busy} onClick={() => accept(a.agreement_id)}>I have read this and I accept it</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <p style={{ fontSize: 13, opacity: 0.75 }}>The chairperson, treasurer and secretary must each accept all three. Your acceptance is recorded with the time and the exact text.</p>
            </section>

            {(isChair || docs.length > 0) && (
              <section>
                <h3 style={{ margin: "0 0 6px" }}>Documents</h3>
                <p style={{ fontSize: 13, opacity: 0.75, margin: "0 0 8px" }}>
                  Files are stored encrypted. Only ChamaSmart's verification and legal staff can open them, and each opening is recorded. You can see what you uploaded but cannot download it again. PDF, JPEG or PNG, up to 5 MB.
                </p>
                {docs.filter((d) => d.status === "ACTIVE").map((d) => (
                  <div key={d.doc_id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", flexWrap: "wrap" }}>
                    <span>{DOC_NAME[d.doc_type] || d.doc_type}{d.subject_user_id ? ` (official ${d.subject_user_id})` : ""}</span>
                    <span style={{ fontSize: 13, opacity: 0.75 }}>{d.original_name}</span>
                  </div>
                ))}
                {(status.readiness || []).filter((r) => r.code === "DOCUMENTS_UPLOADED" && !r.passed).map((r) => (
                  <p key={r.code} style={{ fontSize: 14, margin: "6px 0" }}>{r.label}</p>
                ))}
                {isChair && (
                  <form onSubmit={upload} style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <select className="cs-input" value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Document type">
                      {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {docType === "OFFICIAL_ID" && (
                      <select className="cs-input" value={docSubject} onChange={(e) => setDocSubject(e.target.value)} aria-label="Whose ID">
                        <option value="">Whose ID is this?</option>
                        {(status.officials || []).map((o) => <option key={o.user_id} value={o.user_id}>{o.first_name} {o.last_name} ({String(o.role).toLowerCase()})</option>)}
                      </select>
                    )}
                    <input className="cs-input" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setDocFile(e.target.files?.[0] || null)} aria-label="File" />
                    <button className="btn-lux btn-lux-outline" type="submit" disabled={busy}>Upload</button>
                  </form>
                )}
              </section>
            )}

            {canApply && (
              <form onSubmit={apply} style={{ display: "grid", gap: 8 }}>
                <h3 style={{ margin: 0 }}>Apply</h3>
                <input className="cs-input" required placeholder="Registered with (for example Registrar of Societies)" value={form.registration_body} onChange={set("registration_body")} aria-label="Registered with" />
                <input className="cs-input" required placeholder="Registration number" value={form.registration_number} onChange={set("registration_number")} aria-label="Registration number" />
                <input className="cs-input" required placeholder="Name as registered" value={form.registered_name} onChange={set("registered_name")} aria-label="Name as registered" />
                <input className="cs-input" required placeholder="Where you collect money, and in whose name (for example Paybill 123456, Ver Group)" value={form.collection_summary} onChange={set("collection_summary")} aria-label="Where you collect money" />
                <textarea className="cs-input" required rows={3} placeholder="What people will read in the public listing" value={form.public_blurb} onChange={set("public_blurb")} aria-label="Public description" />
                <input className="cs-input" placeholder="Phone number we can call" value={form.contact_phone} onChange={set("contact_phone")} aria-label="Phone number" />
                <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>After you apply, ChamaSmart will review the documents above and call each official.</p>
                <button className="btn-lux btn-lux-primary" type="submit" disabled={busy}>Send application</button>
              </form>
            )}
            {!isChair && ["NOT_STARTED", "DRAFT"].includes(st) && <p style={{ fontSize: 14 }}>Only the chairperson can send the application.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListingModal;
