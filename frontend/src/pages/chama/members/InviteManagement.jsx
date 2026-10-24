import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { chamaAPI, inviteAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatDate } from "../../../utils/format";

const STATUS_LABELS = { ACTIVE: "Active", ACCEPTED: "Used", REVOKED: "Revoked", EXPIRED: "Expired" };

const effectiveStatus = (inv) =>
  inv.status === "ACTIVE" && inv.expires_at && new Date(inv.expires_at) < new Date() ? "EXPIRED" : inv.status;

export default function InviteManagement() {
  const { id } = useParams();
  const [chama, setChama] = useState(null);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", phone_number: "", role: "MEMBER" });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [c, i] = await Promise.all([chamaAPI.getById(id), inviteAPI.getAll(id)]);
      setChama(c.data?.data || null);
      const raw = i.data?.data ?? [];
      setInvites(Array.isArray(raw) ? raw : []);
    } catch (err) {
      setError(err.response?.status === 403 ? "Only the officials of this chama can manage invitations." : "We couldn't load the invitations.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isChair = (chama?.role || "").toUpperCase() === "CHAIRPERSON";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await inviteAPI.generate(id, {
        email: form.email.trim() || undefined,
        phone_number: form.phone_number.trim() || undefined,
        role: form.role,
      });
      const code = res.data?.data?.invite_code;
      toast.success(code ? `Invitation ${code} created.` : "Invitation created.");
      setForm({ email: "", phone_number: "", role: "MEMBER" });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't create the invitation.");
    } finally {
      setCreating(false);
    }
  };

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied.");
    } catch {
      toast.info(`Code: ${code}`);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await inviteAPI.deactivate(revoking.invite_id);
      toast.success("Invitation revoked.");
      setRevoking(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't revoke the invitation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Invitations"
          subtitle={chama ? `Invite people to ${chama.chama_name}.` : "Invite people to this chama."}
          actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>{error}</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {!error && (
          <>
            <form className="cs-card" onSubmit={create} style={{ marginBottom: 16 }} aria-label="Create invitation">
              <h2 className="cs-card-title">New invitation</h2>
              <div className="cs-notice cs-notice--info" style={{ marginBottom: 12 }}>
                <span>
                  Invitations are not sent automatically. Create one, then share the code yourself.
                  Each code works once and expires after 7 days. If you enter an email or phone number, only that person can use it.
                </span>
              </div>
              <div className="cs-form-grid">
                <div className="cs-field">
                  <label className="cs-label" htmlFor="inv-email">Email (optional)</label>
                  <input id="inv-email" type="email" className="cs-input" value={form.email} onChange={set("email")} autoComplete="off" />
                </div>
                <div className="cs-field">
                  <label className="cs-label" htmlFor="inv-phone">Phone (optional)</label>
                  <input id="inv-phone" type="tel" className="cs-input" value={form.phone_number} onChange={set("phone_number")} autoComplete="off" />
                </div>
                <div className="cs-field">
                  <label className="cs-label" htmlFor="inv-role">Role</label>
                  <select id="inv-role" className="cs-select" value={form.role} onChange={set("role")}>
                    <option value="MEMBER">Member</option>
                    {isChair && <option value="TREASURER">Treasurer</option>}
                    {isChair && <option value="SECRETARY">Secretary</option>}
                  </select>
                </div>
              </div>
              <div className="cs-actions" style={{ marginTop: 12 }}>
                <Button type="submit" variant="primary" loading={creating}>Create invitation</Button>
              </div>
            </form>

            <section aria-label="Invitations">
              {loading ? (
                <div className="cs-card" aria-busy="true" aria-label="Loading invitations"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>
              ) : invites.length === 0 ? (
                <div className="cs-card"><EmptyState title="No invitations yet" message="Create one above and share the code." /></div>
              ) : (
                <div className="cs-loan-grid">
                  {invites.map((inv) => {
                    const st = effectiveStatus(inv);
                    return (
                      <article key={inv.invite_id} className="cs-card cs-loan">
                        <header className="cs-loan-head">
                          <div className="cs-list-main">
                            <h3 className="cs-loan-title" style={{ fontFamily: "monospace", letterSpacing: 1 }}>{inv.invite_code}</h3>
                            <div className="cs-list-meta">{inv.role} · created {formatDate(inv.created_at)}</div>
                          </div>
                          <StatusBadge status={st} label={STATUS_LABELS[st] || st} />
                        </header>
                        <dl className="cs-kv">
                          <div><dt>For</dt><dd>{inv.email || inv.phone_number || "Anyone with the code"}</dd></div>
                          <div><dt>{st === "ACCEPTED" ? "Used by" : "Expires"}</dt><dd>{st === "ACCEPTED" ? (inv.accepted_by_name || "—") : formatDate(inv.expires_at)}</dd></div>
                        </dl>
                        {st === "ACTIVE" && (
                          <footer className="cs-actions">
                            <Button size="sm" onClick={() => copy(inv.invite_code)}>Copy code</Button>
                            <Button variant="danger" size="sm" onClick={() => setRevoking(inv)}>Revoke</Button>
                          </footer>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <Dialog
          open={!!revoking}
          onClose={() => { if (!busy) setRevoking(null); }}
          title="Revoke this invitation?"
          actions={(
            <>
              <Button onClick={() => setRevoking(null)} disabled={busy}>Keep it</Button>
              <Button variant="danger" loading={busy} onClick={revoke}>Revoke</Button>
            </>
          )}
        >
          <p>Code {revoking?.invite_code} will stop working immediately.</p>
        </Dialog>
      </main>
    </div>
  );
}
