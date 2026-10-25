import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import { adminAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { Button, PageHeader, EmptyState, Skeleton } from "../../components/ui";
import { formatDate } from "../../utils/format";

const TABS = [
  ["overview", "Overview"],
  ["applications", "Applications"],
  ["cases", "Cases"],
  ["agreements", "Agreements"],
  ["audit", "Activity log"],
];

const LEVELS = {
  1: "Warning",
  2: "Listing suspended",
  3: "Payouts frozen",
  4: "Closed and referred",
};

const errText = (e, fallback) => e.response?.data?.message || fallback;

/** The platform operator's console. Reviewing a chama for the public listing, handling notices, and publishing the agreements officials must accept. */
export default function AdminConsole() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [open, setOpen] = useState(null);
  if (user && user.role !== "ADMIN") return <Navigate to="/dashboard" replace />;

  return (
    <div className="cs-page">
      <PageHeader title="Admin console" subtitle="Review chamas before they are listed, handle notices, and keep the agreements current." />
      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 16px" }}>
        {TABS.map(([k, label]) => (
          <Button key={k} variant={tab === k ? "primary" : "secondary"} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(null); }}>{label}</Button>
        ))}
      </div>
      {tab === "overview" && <Overview go={(t) => setTab(t)} />}
      {tab === "applications" && (open ? <Review chamaId={open} onBack={() => setOpen(null)} /> : <Queue onOpen={setOpen} />)}
      {tab === "cases" && <Cases onOpenChama={(id) => { setTab("applications"); setOpen(id); }} />}
      {tab === "agreements" && <Agreements />}
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
        <Stat label="Active chamas" value={d.chamas} />
        <Stat label="Publicly listed" value={d.listed} />
        <Stat label="Applications to review" value={d.awaiting_review} warn={d.awaiting_review > 0} onClick={() => go("applications")} />
        <Stat label="Open cases" value={d.open_cases} warn={d.open_cases > 0} onClick={() => go("cases")} />
        <Stat label="Cases waiting for the chama" value={d.cases_awaiting_response} />
        <Stat label="Reviews due in 30 days" value={d.reviews_due_30_days} warn={d.reviews_due_30_days > 0} />
        <Stat label="Payments no chama claimed" value={d.unrouted_payments} warn={d.unrouted_payments > 0} />
        <Stat label="Chamas whose books failed a check" value={d.failed_books_checks} warn={d.failed_books_checks > 0} />
        <Stat label="Plans overdue or paused" value={d.past_due_plans} warn={d.past_due_plans > 0} />
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

function Review({ chamaId, onBack }) {
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
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 0 }}>Check identity documents against the person on a call, using the numbers above. Documents are received outside the platform and are not stored here.</p>
      </section>

      <section className="cs-card" style={{ padding: 14, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Checkpoints</h3>
        {(v.readiness || []).map((r) => (
          <div key={r.code} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", flexWrap: "wrap" }}>
            <span aria-hidden="true">{r.passed ? "✔" : "○"}</span>
            <span style={{ flex: 1, minWidth: 200 }}>{r.label}{r.auto ? "" : " (you confirm)"}</span>
            <span style={{ fontSize: 12, opacity: 0.7 }}>{r.passed ? "Done" : "Not done"}</span>
            {!r.auto && reviewing && (
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
            <Button disabled={busy || blockers.length > 0} onClick={() => run(() => adminAPI.approve(chamaId, note), "Approved and listed")}>Approve and list</Button>
            <Button variant="secondary" disabled={busy} onClick={() => run(() => adminAPI.requestChanges(chamaId, note), "Sent back to the chama")}>Ask for changes</Button>
            <Button variant="secondary" disabled={busy} onClick={() => run(() => adminAPI.reject(chamaId, note), "Declined")}>Decline</Button>
          </div>
          {blockers.length > 0 && <p style={{ fontSize: 13 }}>{blockers.length} checkpoint{blockers.length > 1 ? "s" : ""} still open: {blockers[0].label}{blockers.length > 1 ? " and others." : "."}</p>}
        </section>
      )}

      {v.status === "APPROVED" && (
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
        <h4 style={{ marginBottom: 4 }}>Send a notice</h4>
        <p style={{ fontSize: 13, opacity: 0.75, marginTop: 0 }}>
          A warning comes first and gives the chama 7 days to answer. Levels 2 to 4 need that warning to have run its time, unless members' money is at immediate risk and you mark the notice urgent. ChamaSmart does not hold the chama's money: these steps only stop what the platform controls.
        </p>
        <select className="cs-input" value={caseLevel} onChange={(e) => setCaseLevel(Number(e.target.value))} aria-label="Level">
          {Object.entries(LEVELS).map(([k, l]) => <option key={k} value={k}>{k}. {l}</option>)}
        </select>
        <textarea className="cs-input" rows={3} style={{ width: "100%", marginTop: 8 }} value={caseReason} onChange={(e) => setCaseReason(e.target.value)}
          placeholder="What was found. The chama will read this word for word." aria-label="What was found" />
        <label style={{ display: "flex", gap: 6, alignItems: "center", margin: "6px 0" }}>
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent: members' money is at immediate risk
        </label>
        <Button variant="secondary" disabled={busy} onClick={() => run(async () => { await adminAPI.openCase(chamaId, caseLevel, caseReason, urgent); setCaseReason(""); setUrgent(false); }, "Notice sent")}>Send notice</Button>
      </section>
    </>
  );
}

function Cases({ onOpenChama }) {
  const { data, error, loading, reload } = useLoad(() => adminAPI.cases());
  const [notes, setNotes] = useState({});
  const close = async (id) => {
    try { await adminAPI.resolveCase(id, notes[id] || ""); toast.success("Case closed"); reload(); }
    catch (e) { toast.error(errText(e, "That did not work.")); }
  };
  if (loading) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  if (!data?.length) return <EmptyState title="No open cases" message="Notices you send to chamas appear here until you close them." />;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {data.map((c) => (
        <div key={c.case_id} className="cs-card" style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <strong>{c.chama_name}</strong>
            <span>{LEVELS[c.level]}{c.urgent ? " · urgent" : ""}</span>
          </div>
          <p style={{ margin: "6px 0" }}>{c.reason}</p>
          <p style={{ fontSize: 13, opacity: 0.75, margin: "0 0 8px" }}>Opened {formatDate(c.opened_at)} · {c.responded ? "the chama has responded" : "no response yet"}</p>
          <textarea className="cs-input" rows={2} style={{ width: "100%" }} placeholder="Outcome and why the case is closed"
            value={notes[c.case_id] || ""} onChange={(e) => setNotes({ ...notes, [c.case_id]: e.target.value })} aria-label="Outcome" />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <Button variant="secondary" onClick={() => onOpenChama(c.chama_id)}>Open chama</Button>
            <Button onClick={() => close(c.case_id)}>Close case</Button>
          </div>
        </div>
      ))}
    </div>
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
  const { data, error, loading } = useLoad(() => adminAPI.audit(200));
  if (loading) return <Skeleton />;
  if (error) return <p role="alert">{error}</p>;
  if (!data?.length) return <EmptyState title="Nothing recorded yet" message="Every action taken in this console is listed here and cannot be changed." />;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {data.map((a) => (
        <div key={a.action_id} className="cs-card" style={{ padding: 10, fontSize: 14 }}>
          <strong>{String(a.action).replace(/_/g, " ").toLowerCase()}</strong>{a.chama_id ? ` · chama ${a.chama_id}` : ""} · {formatDate(a.at)}
          <div style={{ opacity: 0.8 }}>{a.detail}</div>
        </div>
      ))}
    </div>
  );
}
