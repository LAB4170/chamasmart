import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import { adminAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Button, PageHeader, EmptyState, Skeleton } from "../../components/ui";
import { formatDate } from "../../utils/format";
import FinanceDesk from "./FinanceDesk";
import LegalDesk from "./LegalDesk";

const TABS = [
  ["overview", "Overview", "OVERVIEW_VIEW"],
  ["applications", "Applications", "VERIFY_VIEW"],
  ["cases", "Cases", "CASE_VIEW"],
  ["payments", "Finance", "FINANCE_VIEW"],
  ["legal", "Legal", "LEGAL_ORDERS"],
  ["agreements", "Agreements", "AGREEMENT_MANAGE"],
  ["staff", "Staff", "STAFF_MANAGE"],
  ["audit", "Activity log", "AUDIT_VIEW"],
];

const LEVELS = {
  1: "Warning",
  2: "Listing suspended",
  3: "Payouts frozen",
  4: "Closed and referred",
};

const errText = (e, fallback) => e.response?.data?.message || fallback;

/** The platform operator's console. What you see depends on your role. */
export default function AdminConsole() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [open, setOpen] = useState(null);
  const [legalCase, setLegalCase] = useState(null);
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;
    adminAPI.me().then((r) => {
      const m = r.data?.data;
      setMe(m);
      const first = TABS.find(([, , p]) => m.permissions.includes(p));
      if (first) setTab(first[0]);
    }).catch((e) => setError(errText(e, "You do not have access to the admin console.")));
  }, [user]);

  if (user && user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;
  if (error) return <div className="cs-page"><p role="alert">{error}</p></div>;
  if (!me) return <div className="cs-page"><Skeleton /></div>;
  const can = (p) => me.permissions.includes(p);
  const visible = TABS.filter(([, , p]) => can(p));

  return (
    <div className="cs-page">
      <PageHeader title="Admin console" subtitle={`Signed in as ${me.roles.map((r) => r.replace(/_/g, " ").toLowerCase()).join(", ")}.${me.two_person_rule ? " Two-person rule is on." : ""}`} />
      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 16px" }}>
        {visible.map(([k, label]) => (
          <Button key={k} variant={tab === k ? "primary" : "secondary"} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(null); setLegalCase(null); }}>{label}</Button>
        ))}
      </div>
      {tab === "overview" && <Overview go={(t) => setTab(t)} />}
      {tab === "applications" && (open ? <Review chamaId={open} can={can} twoPerson={me.two_person_rule} onBack={() => setOpen(null)} /> : <Queue onOpen={setOpen} />)}
      {tab === "cases" && <Cases can={can} meId={me.user_id} onOpenFile={(id) => { setLegalCase(id); setTab("legal"); }} onOpenChama={(id) => { if (can("VERIFY_VIEW")) { setTab("applications"); setOpen(id); } }} />}
      {tab === "payments" && <FinanceDesk can={can} />}
      {tab === "legal" && <LegalDesk key={legalCase || "register"} can={can} caseId={legalCase} onBackToCases={() => { setLegalCase(null); setTab("cases"); }} />}
      {tab === "agreements" && <Agreements />}
      {tab === "staff" && <Staff meId={me.user_id} />}
      {tab === "audit" && <Audit />}
    </div>
  );
}

function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await fn(); setData(res.data?.data ?? null); }
    catch (e) { setError(errText(e, "We couldn't load this.")); }
    finally { setLoading(false); }
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}

function Stat({ label, value, warn, onClick }) {
  return (
    <button type="button" className="cs-card" onClick={onClick} disabled={!onClick}
      style={{ padding: 14, textAlign: "left", cursor: onClick ? "pointer" : "default", border: warn ? "1px solid currentColor" : undefined }}>
      <div style={{ fontSize: 13, opacity: 0.7 }}>{label}</div>
      <strong style={{ fontSize: 22 }}>{value}</strong>
    </button>
  );
}

function Overview({ go }) {
  const { data, error, loading } = useLoad(() => adminAPI.overview());
  if (loading) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  const d = data || {};
  return (
    <>
      {d.agreements_unpublished > 0 && (
        <p className="cs-card" style={{ padding: 12 }} role="status">
          {d.agreements_unpublished} of the 3 agreements are not published. No chama can apply for listing until a lawyer has reviewed them and you publish them under Agreements.
        </p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        {d.chamas !== undefined && <Stat label="Active chamas" value={d.chamas} />}
        {d.listed !== undefined && <Stat label="Publicly listed" value={d.listed} />}
        {d.awaiting_review !== undefined && <Stat label="Applications to review" value={d.awaiting_review} warn={d.awaiting_review > 0} onClick={() => go("applications")} />}
        {d.open_cases !== undefined && <Stat label="Open cases" value={d.open_cases} warn={d.open_cases > 0} onClick={() => go("cases")} />}
        {d.proposals_to_confirm !== undefined && <Stat label="Notices waiting for a second person" value={d.proposals_to_confirm} warn={d.proposals_to_confirm > 0} onClick={() => go("cases")} />}
        {d.cases_awaiting_response !== undefined && <Stat label="Cases waiting for the chama" value={d.cases_awaiting_response} />}
        {d.reviews_due_30_days !== undefined && <Stat label="Reviews due in 30 days" value={d.reviews_due_30_days} warn={d.reviews_due_30_days > 0} />}
        {d.unrouted_payments !== undefined && <Stat label="Payments no chama claimed" value={d.unrouted_payments} warn={d.unrouted_payments > 0} onClick={() => go("payments")} />}
        {d.failed_books_checks !== undefined && <Stat label="Chamas whose books failed a check" value={d.failed_books_checks} warn={d.failed_books_checks > 0} />}
        {d.past_due_plans !== undefined && <Stat label="Plans overdue or paused" value={d.past_due_plans} warn={d.past_due_plans > 0} />}
      </div>
    </>
  );
}

function Queue({ onOpen }) {
  const [status, setStatus] = useState("SUBMITTED");
  const { data, error, loading } = useLoad(() => adminAPI.queue(status), [status]);
  const options = [["SUBMITTED", "New"], ["IN_REVIEW", "In review"], ["CHANGES_REQUESTED", "Waiting for the chama"], ["APPROVED", "Listed"], ["SUSPENDED", "Suspended"], ["REJECTED", "Declined"], ["REVOKED", "Removed"]];
  return (
    <>
      <label style={{ display: "block", marginBottom: 12 }}>Show{" "}
        <select className="cs-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {loading ? <Skeleton /> : error ? <p role="alert">{error}</p> : !data?.length ? (
        <EmptyState title="Nothing here" message="No applications with this status." />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {data.map((a) => (
            <button type="button" key={a.chama_id} className="cs-card" style={{ padding: 14, textAlign: "left" }} onClick={() => onOpen(a.chama_id)}>
              <strong>{a.chama_name}</strong>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                {a.registered_name} · {a.registration_number}
                {a.submitted_at ? ` · applied ${formatDate(a.submitted_at)}` : ""}
                {a.next_review_at ? ` · review due ${formatDate(a.next_review_at)}` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

const DOC_LABEL = {
  REGISTRATION_CERTIFICATE: "Registration certificate",
  CONSTITUTION: "Constitution",
  OFFICIALS_RESOLUTION: "Officials' resolution",
  PAYBILL_PROOF: "Paybill proof",
  OFFICIAL_ID: "National ID",
};

/** Stored documents for one chama. Opening a file is recorded against your name. */
function Documents({ chamaId, can, isSuper }) {
  const { data, error, loading, reload } = useLoad(() => adminAPI.documents(chamaId), [chamaId]);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const open = async (d) => {
    setBusy(true);
    try {
      const res = await adminAPI.openDocument(d.doc_id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = d.original_name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.success("Opened. This was recorded against your name.");
    } catch (e) { toast.error(errText(e, "Could not open this file.")); }
    finally { setBusy(false); }
  };
  const act = async (fn, ok) => {
    if (reason.trim().length < 10) { toast.error("Write the reason first (at least 10 characters)."); return; }
    setBusy(true);
    try { await fn(); toast.success(ok); setReason(""); await reload(); }
    catch (e) { toast.error(errText(e, "That did not work.")); }
    finally { setBusy(false); }
  };

  if (loading && !data) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  const docs = data || [];
  return (
    <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>Documents</h3>
      {docs.length === 0 && <p style={{ margin: 0 }}>Nothing uploaded yet.</p>}
      {docs.map((d) => (
        <div key={d.doc_id} style={{ padding: "6px 0", borderTop: "1px solid rgba(128,128,128,.25)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 220 }}>
            {DOC_LABEL[d.doc_type] || d.doc_type}{d.subject_user_id ? ` (official ${d.subject_user_id})` : ""} · {d.original_name}
            <br /><span style={{ fontSize: 12, opacity: 0.7 }}>
              {String(d.status).toLowerCase()} · uploaded by {d.uploaded_by_name} on {formatDate(d.uploaded_at)}
              {d.legal_hold ? ` · on legal hold: ${d.hold_reason}` : ""}
              {d.status !== "DELETED" && d.retention_until ? ` · kept until ${formatDate(d.retention_until)}` : ""}
            </span>
          </span>
          {d.status !== "DELETED" && can("DOCUMENT_VIEW") && <Button variant="secondary" disabled={busy} onClick={() => open(d)}>Open</Button>}
          {d.status !== "DELETED" && can("LEGAL_HOLD") && (
            <Button variant="secondary" disabled={busy} onClick={() => act(() => adminAPI.holdDocument(d.doc_id, !d.legal_hold, reason), d.legal_hold ? "Hold released" : "Hold placed")}>
              {d.legal_hold ? "Release hold" : "Place hold"}
            </Button>
          )}
          {d.status !== "DELETED" && isSuper && (
            <Button variant="secondary" disabled={busy} onClick={() => act(() => adminAPI.deleteDocument(d.doc_id, reason), "Contents erased")}>Erase</Button>
          )}
        </div>
      ))}
      {docs.length > 0 && (can("LEGAL_HOLD") || isSuper) && (
        <div style={{ marginTop: 10 }}>
          <input className="cs-input" style={{ width: "100%" }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for a hold or erasure (recorded in the activity log)" aria-label="Reason" />
          {can("LEGAL_HOLD") && <Button variant="secondary" disabled={busy} onClick={() => act(() => adminAPI.holdAllDocuments(chamaId, reason), "All documents held")}>Hold every document for this chama</Button>}
          <p style={{ fontSize: 12, opacity: 0.7 }}>Held files cannot be erased. Erasing removes the file contents for good; the record that it existed stays.</p>
        </div>
      )}
    </section>
  );
}

function Review({ chamaId, can, twoPerson, onBack }) {
  const { data, error, loading, reload } = useLoad(() => adminAPI.detail(chamaId), [chamaId]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseLevel, setCaseLevel] = useState(1);
  const [caseReason, setCaseReason] = useState("");
  const [urgent, setUrgent] = useState(false);

  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setNote(""); await reload(); }
    catch (e) { toast.error(errText(e, "That did not work.")); }
    finally { setBusy(false); }
  };

  if (loading && !data) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  const v = data;
  const reviewing = ["SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED"].includes(v.status);
  const blockers = (v.readiness || []).filter((r) => !r.passed);

  return (
    <>
      <Button variant="secondary" onClick={onBack}>Back to applications</Button>
      <h2 style={{ margin: "12px 0 4px" }}>{v.registered_name || `Chama ${chamaId}`}</h2>
      <p style={{ opacity: 0.75, margin: 0 }}>Status: {String(v.status).toLowerCase().replace(/_/g, " ")}{v.listed ? " · publicly listed" : ""}</p>

      {v.registration_number && (
        <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Application</h3>
          <p style={{ margin: "4px 0" }}>Registered with {v.registration_body}, number {v.registration_number}.</p>
          <p style={{ margin: "4px 0" }}>Collects money: {v.collection_summary}</p>
          <p style={{ margin: "4px 0" }}>Public description: {v.public_blurb}</p>
          <p style={{ margin: "4px 0" }}>Contact: {v.contact_phone || "not given"}</p>
          {v.review_note && <p style={{ margin: "4px 0" }}>Last decision note: {v.review_note}</p>}
        </section>
      )}

      <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Officials</h3>
        {(v.officials || []).map((o) => (
          <p key={o.user_id} style={{ margin: "4px 0" }}>
            <strong>{o.first_name} {o.last_name}</strong> ({String(o.role).toLowerCase()}) · {o.email} · {o.phone_number || "no phone"} · email {o.email_verified ? "confirmed" : "not confirmed"}
          </p>
        ))}
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 0 }}>Check each ID against the person on a call, using the numbers above.</p>
      </section>

      {(can("DOCUMENT_VIEW") || can("LEGAL_HOLD")) && <Documents chamaId={chamaId} can={can} isSuper={can("DOCUMENT_DELETE")} />}

      <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Checkpoints</h3>
        {(v.readiness || []).map((r) => (
          <div key={r.code} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", flexWrap: "wrap" }}>
            <span aria-hidden="true">{r.passed ? "✔" : "○"}</span>
            <span style={{ flex: 1, minWidth: 200 }}>{r.label}{r.auto ? "" : " (you confirm)"}</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{r.passed ? "Done" : "Not done"}</span>
            {!r.auto && reviewing && can("VERIFY_REVIEW") && (
              <Button variant="secondary" disabled={busy}
                onClick={() => run(() => adminAPI.setCheck(chamaId, r.code, !r.passed, note || undefined), r.passed ? "Check cleared" : "Check recorded")}>
                {r.passed ? "Clear" : "Mark done"}
              </Button>
            )}
          </div>
        ))}
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 0 }}>Automatic checks update by themselves. The note box below is saved with the check you mark.</p>
      </section>

      {reviewing && (
        <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Decision</h3>
          <textarea className="cs-input" rows={3} style={{ width: "100%" }} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Note. Shown to the chama if you ask for changes or decline." aria-label="Decision note" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {can("LISTING_APPROVE") && <Button disabled={busy || blockers.length > 0} onClick={() => run(() => adminAPI.approve(chamaId, note), "Approved and listed")}>Approve and list</Button>}
            {can("VERIFY_REVIEW") && <Button variant="secondary" disabled={busy} onClick={() => run(() => adminAPI.requestChanges(chamaId, note), "Sent back to the chama")}>Ask for changes</Button>}
            {can("VERIFY_REVIEW") && <Button variant="secondary" disabled={busy} onClick={() => run(() => adminAPI.reject(chamaId, note), "Declined")}>Decline</Button>}
          </div>
          {twoPerson && <p style={{ fontSize: 13 }}>The two-person rule is on: whoever recorded checks on this application cannot be the one who approves it.</p>}
          {!can("LISTING_APPROVE") && <p style={{ fontSize: 13 }}>Your role can review but not approve. When the checkpoints are done, a super admin approves.</p>}
          {blockers.length > 0 && <p style={{ fontSize: 13 }}>{blockers.length} checkpoint{blockers.length > 1 ? "s" : ""} still open: {blockers[0].label}{blockers.length > 1 ? " and others." : "."}</p>}
        </section>
      )}

      {v.status === "APPROVED" && can("LISTING_APPROVE") && (
        <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>Listed until {v.next_review_at ? formatDate(v.next_review_at) : "reviewed"}</h3>
          <textarea className="cs-input" rows={2} style={{ width: "100%" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for removing the listing" aria-label="Reason" />
          <Button variant="secondary" disabled={busy} style={{ marginTop: 8 }} onClick={() => run(() => adminAPI.delist(chamaId, note), "Removed from the listing")}>Remove from listing</Button>
        </section>
      )}

      <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Notices to this chama</h3>
        {(v.cases || []).length === 0 && <p style={{ opacity: 0.7 }}>No notices have been sent.</p>}
        {(v.cases || []).map((c) => (
          <div key={c.case_id} style={{ padding: "8px 0", borderTop: "1px solid rgba(128,128,128,.25)" }}>
            <strong>{LEVELS[c.level]}</strong> · {c.status.toLowerCase()} · {formatDate(c.opened_at)}{c.urgent ? " · urgent" : ""}
            <div>{c.reason}</div>
            {c.response_text && <div style={{ opacity: 0.85 }}>Chama's response: {c.response_text}</div>}
            {c.resolution_note && <div style={{ opacity: 0.85 }}>Outcome: {c.resolution_note}</div>}
          </div>
        ))}
        {can("CASE_OPEN") && <><h4 style={{ marginBottom: 4 }}>Send a notice</h4>
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 0 }}>
          A warning comes first and gives the chama 7 days to answer. Levels 2 to 4 need that warning to have run its time, unless members' money is at immediate risk and you mark the notice urgent. ChamaSmart does not hold the chama's money: these steps only stop what the platform controls.
        </p>
        <select className="cs-input" value={caseLevel} onChange={(e) => setCaseLevel(Number(e.target.value))} aria-label="Level">
          {Object.entries(LEVELS).filter(([k]) => Number(k) < 3 || can("CASE_ESCALATE")).map(([k, l]) => <option key={k} value={k}>{k}. {l}</option>)}
        </select>
        <textarea className="cs-input" rows={3} style={{ width: "100%", marginTop: 8 }} value={caseReason} onChange={(e) => setCaseReason(e.target.value)}
          placeholder="What was found. The chama will read this word for word." aria-label="What was found" />
        <label style={{ display: "flex", gap: 6, alignItems: "center", margin: "6px 0" }}>
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent: members' money is at immediate risk
        </label>
        <Button variant="secondary" disabled={busy} onClick={() => run(async () => { await adminAPI.openCase(chamaId, caseLevel, caseReason, urgent); setCaseReason(""); setUrgent(false); }, "Notice recorded")}>Send notice</Button>
        {twoPerson && <p style={{ fontSize: 13 }}>Levels 3 and 4 wait for a second person to confirm before the chama is told or anything changes.</p>}</>}
      </section>
    </>
  );
}

function Cases({ can, meId, onOpenChama, onOpenFile }) {
  const { data, error, loading, reload } = useLoad(() => adminAPI.cases());
  const [notes, setNotes] = useState({});
  const act = async (fn, ok) => {
    try { await fn(); toast.success(ok); reload(); }
    catch (e) { toast.error(errText(e, "That did not work.")); }
  };
  if (loading) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  if (!data?.length) return <EmptyState title="No open cases" message="Notices sent to chamas appear here until they are closed." />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {data.map((c) => (
        <div key={c.case_id} className="cs-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong>{c.chama_name}</strong>
            <span>{LEVELS[c.level]}{c.urgent ? " · urgent" : ""}{c.status === "PROPOSED" ? " · waiting for a second person" : ""}</span>
          </div>
          <p style={{ margin: "6px 0" }}>{c.reason}</p>
          <p style={{ fontSize: 13, opacity: 0.75, margin: "0 0 8px" }}>
            Opened {formatDate(c.opened_at)} · {c.status === "PROPOSED" ? "the chama has not been told yet" : c.responded ? "the chama has responded" : "no response yet"}
          </p>
          <textarea className="cs-input" rows={2} style={{ width: "100%" }} placeholder={c.status === "PROPOSED" ? "Reason, if you withdraw it" : "Outcome and why the case is closed"}
            value={notes[c.case_id] || ""} onChange={(e) => setNotes({ ...notes, [c.case_id]: e.target.value })} aria-label="Note" />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {can("VERIFY_VIEW") && <Button variant="secondary" onClick={() => onOpenChama(c.chama_id)}>Open chama</Button>}
            <Button variant="secondary" onClick={() => onOpenFile(c.case_id)}>Case file</Button>
            {c.status === "PROPOSED" && can("CASE_ESCALATE") && c.opened_by !== meId && <Button onClick={() => act(() => adminAPI.confirmCase(c.case_id), "Confirmed and sent")}>Confirm and send</Button>}
            {c.status === "PROPOSED" && c.opened_by === meId && <span style={{ fontSize: 13, alignSelf: "center" }}>You proposed this; someone else must confirm.</span>}
            {c.status === "PROPOSED" && can("CASE_ESCALATE") && <Button variant="secondary" onClick={() => act(() => adminAPI.withdrawCase(c.case_id, notes[c.case_id] || ""), "Withdrawn")}>Withdraw</Button>}
            {c.status === "OPEN" && can("CASE_RESOLVE") && <Button onClick={() => act(() => adminAPI.resolveCase(c.case_id, notes[c.case_id] || ""), "Case closed")}>Close case</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Staff({ meId }) {
  const staff = useLoad(() => adminAPI.staff());
  const roles = useLoad(() => adminAPI.roles());
  const settings = useLoad(() => adminAPI.settings());
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState(["VERIFICATION_REVIEWER"]);
  const [busy, setBusy] = useState(false);
  const refresh = () => { staff.reload(); settings.reload(); };
  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); refresh(); }
    catch (e) { toast.error(errText(e, "That did not work.")); }
    finally { setBusy(false); }
  };
  if (staff.loading || roles.loading) return <Skeleton />;
  if (staff.error) return <p role="alert">{staff.error}</p>;
  const st = settings.data;
  const toggle = (code) => setPicked((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
  return (
    <>
      <section className="cs-card" style={{ padding: 14 }}>
        <h3 style={{ marginTop: 0 }}>Two-person rule</h3>
        <p style={{ margin: "4px 0" }}>
          {st?.two_person_rule ? "On." : "Off."} When on, the person who recorded checks on an application cannot approve it, and level 3 and 4 notices wait for a second person to confirm.
        </p>
        <p style={{ fontSize: 13, opacity: 0.75 }}>People who can approve listings: {st?.approvers ?? 0}. People who can confirm serious notices: {st?.escalators ?? 0}. It can be switched on once there are at least two of each.</p>
        <Button variant="secondary" disabled={busy} onClick={() => run(() => adminAPI.setTwoPerson(!st?.two_person_rule), st?.two_person_rule ? "Switched off" : "Switched on")}>
          {st?.two_person_rule ? "Switch off" : "Switch on"}
        </Button>
        {st?.audit_chain_last && <p style={{ fontSize: 13, opacity: 0.75 }}>Last nightly check of the activity log: {st.audit_chain_last}</p>}
      </section>

      <section style={{ marginTop: 14 }}>
        <h3>People</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {(staff.data || []).map((p) => (
            <div key={p.user_id} className="cs-card" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <strong>{p.first_name} {p.last_name}{p.user_id === meId ? " (you)" : ""}</strong>
                <span>{String(p.status).toLowerCase()}</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{p.email} · {p.roles.map((r) => r.replace(/_/g, " ").toLowerCase()).join(", ")} · two-factor {p.mfa_on ? "on" : "OFF"}{p.last_action_at ? ` · last active ${formatDate(p.last_action_at)}` : ""}</div>
              {p.user_id !== meId && p.status !== "REMOVED" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {p.status === "ACTIVE" && <Button variant="secondary" disabled={busy} onClick={() => run(() => adminAPI.staffAction(p.user_id, "suspend"), "Suspended")}>Suspend</Button>}
                  {p.status === "SUSPENDED" && <Button variant="secondary" disabled={busy} onClick={() => run(() => adminAPI.staffAction(p.user_id, "reinstate"), "Reinstated")}>Reinstate</Button>}
                  <Button variant="secondary" disabled={busy} onClick={() => { if (window.confirm(`Remove ${p.first_name} from the staff?`)) run(() => adminAPI.staffAction(p.user_id, "remove"), "Removed"); }}>Remove</Button>
                  {(roles.data || []).map((r) => (
                    <label key={r.role_code} style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
                      <input type="checkbox" checked={p.roles.includes(r.role_code)} disabled={busy}
                        onChange={() => { const next = p.roles.includes(r.role_code) ? p.roles.filter((x) => x !== r.role_code) : [...p.roles, r.role_code]; if (next.length) run(() => adminAPI.setStaffRoles(p.user_id, next), "Roles changed"); }} /> {r.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="cs-card" style={{ padding: 14, marginTop: 14 }}>
        <h3 style={{ marginTop: 0 }}>Add a person</h3>
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 0 }}>They need a ChamaSmart account with a confirmed email, and must not be a member of any chama. Ask them to turn on two-factor sign-in before they open the console.</p>
        <input className="cs-input" style={{ width: "100%" }} type="email" placeholder="Their account email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Account email" />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "8px 0" }}>
          {(roles.data || []).map((r) => (
            <label key={r.role_code} style={{ display: "flex", gap: 4, alignItems: "center" }} title={r.permissions.join(", ")}>
              <input type="checkbox" checked={picked.includes(r.role_code)} onChange={() => toggle(r.role_code)} /> {r.label}
            </label>
          ))}
        </div>
        <Button disabled={busy || !email || picked.length === 0} onClick={() => run(async () => { await adminAPI.addStaff(email, picked); setEmail(""); }, "Added")}>Add to staff</Button>
      </section>
    </>
  );
}

function Agreements() {
  const { data, error, loading, reload } = useLoad(() => adminAPI.agreements());
  const [viewing, setViewing] = useState(null);
  const [counsel, setCounsel] = useState("");
  const view = async (id) => {
    try { const r = await adminAPI.agreement(id); setViewing(r.data.data); }
    catch (e) { toast.error(errText(e, "Could not open this.")); }
  };
  const publish = async () => {
    try { await adminAPI.publishAgreement(viewing.agreement_id, counsel); toast.success("Published"); setViewing(null); setCounsel(""); reload(); }
    catch (e) { toast.error(errText(e, "That did not work.")); }
  };
  if (loading) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  return (
    <>
      <p className="cs-card" style={{ padding: 12 }}>
        These texts are drafts. Have a Kenyan lawyer review and amend them, then publish them here with the lawyer's name. Until all three are published, no chama can accept them or apply for listing. Publishing a new version replaces the old one and chamas will need to accept it again.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {(data || []).map((a) => (
          <div key={a.agreement_id} className="cs-card" style={{ padding: 14, display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <strong>{a.title}</strong>
              <div style={{ fontSize: 13, opacity: 0.75 }}>Version {a.version} · {a.status.toLowerCase()}{a.reviewed_by_counsel ? ` · reviewed by ${a.reviewed_by_counsel}` : ""}</div>
            </div>
            <Button variant="secondary" onClick={() => view(a.agreement_id)}>Read</Button>
          </div>
        ))}
      </div>
      {viewing && (
        <section className="cs-card" style={{ padding: 14, marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>{viewing.title} ({viewing.version})</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", maxHeight: 420, overflow: "auto" }}>{viewing.body}</pre>
          <p style={{ fontSize: 12, opacity: 0.6 }}>Fingerprint {viewing.body_hash}</p>
          {viewing.status === "DRAFT" && (
            <>
              <input className="cs-input" style={{ width: "100%" }} value={counsel} onChange={(e) => setCounsel(e.target.value)} placeholder="Name of the lawyer or firm that reviewed this text" aria-label="Reviewing lawyer" />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <Button onClick={publish}>Publish this version</Button>
                <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>
              </div>
            </>
          )}
          {viewing.status !== "DRAFT" && <Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>}
        </section>
      )}
    </>
  );
}

function Audit() {
  const [f, setF] = useState({ action: "", outcome: "" });
  const [applied, setApplied] = useState({ action: "", outcome: "" });
  const [chain, setChain] = useState(null);
  const { data, error, loading } = useLoad(() => adminAPI.audit({ limit: 200, action: applied.action || undefined, outcome: applied.outcome || undefined }), [applied]);
  const check = async () => {
    try { const r = await adminAPI.verifyAudit(); setChain(r.data.data); }
    catch (e) { toast.error(errText(e, "Could not check the log.")); }
  };
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input className="cs-input" placeholder="Search by action" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label="Action" />
        <select className="cs-input" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} aria-label="Outcome">
          <option value="">All outcomes</option><option value="ALLOWED">Allowed</option><option value="DENIED">Refused</option><option value="ALERT">Alerts</option>
        </select>
        <Button variant="secondary" onClick={() => setApplied(f)}>Filter</Button>
        <Button variant="secondary" onClick={check}>Check the log has not been altered</Button>
      </div>
      {chain && (
        <p role="status" className="cs-card" style={{ padding: 12 }}>
          {chain.ok ? `The log is intact. ${chain.checked} entries checked.` : `The log has been altered. The first problem is entry ${chain.first_break_seq}: ${chain.reason}.`}
        </p>
      )}
      {loading ? <Skeleton /> : error ? <p role="alert">{error}</p> : !data?.length ? (
        <EmptyState title="Nothing recorded yet" message="Every action, refusal and view of personal data in this console is listed here and cannot be changed." />
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {data.map((a) => (
            <div key={a.action_id} className="cs-card" style={{ padding: 10, fontSize: 14 }}>
              <strong>{String(a.action).replace(/_/g, " ").toLowerCase()}</strong>{a.outcome !== "ALLOWED" ? ` · ${a.outcome === "DENIED" ? "refused" : a.outcome.toLowerCase()}` : ""}
              {a.chama_id ? ` · chama ${a.chama_id}` : ""} · {formatDate(a.at)}
              <div style={{ opacity: 0.8 }}>
                {a.first_name ? `${a.first_name} ${a.last_name}` : a.admin_id ? `user ${a.admin_id}` : "system"}{a.roles ? ` (${a.roles.replace(/_/g, " ").toLowerCase()})` : ""} · {a.ip_address}
              </div>
              {a.detail && <div style={{ opacity: 0.8 }}>{a.detail}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
