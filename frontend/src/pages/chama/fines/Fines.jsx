import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { fineAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

const LABELS = { OWED: "Owed", PAID: "Paid", WAIVED: "Waived" };
const BADGE = { OWED: "PENDING", PAID: "PAID", WAIVED: "REJECTED" };

export default function Fines() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // { kind: "issue" | "waive", row? }
  const [form, setForm] = useState({ user_id: "", amount: "", reason: "" });
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fineAPI.list(id);
      setData(res.data?.data ?? null);
    } catch (e) {
      setError(e.response?.data?.message || "We couldn't load the fines.");
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const canManage = !!data?.can_manage;
  useEffect(() => {
    if (!canManage) return;
    chamaAPI.getMembers(id).then((r) => {
      const list = (r.data?.data ?? []).filter((m) => m.is_active !== false);
      setMembers(list.map((m) => ({ id: m.user_id ?? m.userId, name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.member_name || "Member" })));
    }).catch(() => {});
  }, [id, canManage]);

  const close = () => { if (!busy) { setDialog(null); setNote(""); } };
  const run = async (fn, ok) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setDialog(null); setNote(""); setForm({ user_id: "", amount: "", reason: "" });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || "That didn't go through. Nothing was changed.", { autoClose: 8000 });
    } finally { setBusy(false); }
  };

  const fines = data?.fines ?? [];
  const formOk = form.user_id && Number(form.amount) > 0 && form.reason.trim().length >= 3;
  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Fines" subtitle={canManage ? "Fines issued in this chama. Late-round fines are added automatically." : "Fines you owe, and how to clear them."}
          actions={(<>{canManage && <Button onClick={() => setDialog({ kind: "issue" })}>Issue a fine</Button>}<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link></>)} />
        {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16 }}>{error} <Button size="sm" onClick={load}>Try again</Button></div>}
        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading"><Skeleton height={20} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></div>
        ) : (
          <>
            {data && Number(data.outstanding_total) > 0 && (
              <div className="cs-notice cs-notice--warning" role="status" style={{ marginBottom: 16 }}>
                {canManage ? "Outstanding across the chama" : "You owe"} {formatKES(data.outstanding_total)}. To pay, record a contribution of type Fine; it clears the oldest fines first once an official verifies it.
              </div>
            )}
            {fines.length === 0 ? (
              <div className="cs-card"><EmptyState title="No fines" message="Nobody owes a fine right now." /></div>
            ) : (
              <div className="cs-loan-grid">
                {fines.map((f) => (
                  <article key={f.fine_id} className="cs-card cs-loan">
                    <header className="cs-loan-head">
                      <div className="cs-list-main">
                        <h3 className="cs-loan-title">{f.member_name}</h3>
                        <div className="cs-list-meta">{f.issued_by_system ? "Added automatically" : "Issued by an official"} · {formatDate(f.created_at)}</div>
                      </div>
                      <StatusBadge status={BADGE[f.status] || "PENDING"} label={LABELS[f.status] || f.status} />
                    </header>
                    <dl className="cs-kv">
                      <div><dt>Fine</dt><dd>{formatKES(f.amount)}</dd></div>
                      <div><dt>Still owed</dt><dd>{f.status === "OWED" ? formatKES(f.outstanding) : "—"}</dd></div>
                    </dl>
                    <p className="cs-list-meta" style={{ margin: 0 }}>{f.reason}{f.status === "WAIVED" && f.closed_note ? ` · Waived: ${f.closed_note}` : ""}</p>
                    {canManage && f.status === "OWED" && (
                      <footer className="cs-actions"><Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "waive", row: f })}>Waive</Button></footer>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}

        <Dialog open={dialog?.kind === "issue"} onClose={close} title="Issue a fine"
          actions={(<><Button onClick={close} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!formOk} onClick={() => run(() => fineAPI.issue(id, { user_id: Number(form.user_id), amount: Number(form.amount), reason: form.reason.trim() }), "Fine issued. The member has been told.")}>Issue fine</Button></>)}>
          <div className="cs-field">
            <label className="cs-label" htmlFor="fn-member">Member</label>
            <select id="fn-member" className="cs-select" value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
              <option value="">Choose…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="fn-amount">Amount (KES)</label>
            <input id="fn-amount" className="cs-input" type="number" inputMode="decimal" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="fn-reason">Reason the member will read</label>
            <input id="fn-reason" className="cs-input" maxLength={200} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <p className="cs-help">You can&apos;t fine yourself; another official has to.</p>
        </Dialog>

        <Dialog open={dialog?.kind === "waive"} onClose={close} title="Waive this fine?"
          actions={(<><Button onClick={close} disabled={busy}>Back</Button><Button variant="danger" loading={busy} disabled={note.trim().length < 3} onClick={() => run(() => fineAPI.waive(id, dialog.row.fine_id, note.trim()), "Fine waived.")}>Waive fine</Button></>)}>
          <p>{dialog?.row && `${formatKES(dialog.row.outstanding)} for ${dialog.row.member_name} will no longer be owed. This is recorded in the audit trail.`}</p>
          <label className="cs-label" htmlFor="fn-note">Reason</label>
          <input id="fn-note" className="cs-input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Dialog>
      </main>
    </div>
  );
}
