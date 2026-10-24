import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { welfareAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, StatCard, StatusBadge, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

const OFFICIALS = ["CHAIRPERSON", "SECRETARY", "TREASURER"];
const pretty = (s) => (s || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export default function WelfareDashboard() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [balance, setBalance] = useState(0);
  const [claims, setClaims] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [officialCount, setOfficialCount] = useState(2);
  const [coverOpen, setCoverOpen] = useState(false);
  const [cover, setCover] = useState({ name: "", payout: "", waiting: "0", perYear: "0" });
  const [coverError, setCoverError] = useState("");
  const [payingId, setPayingId] = useState(null);
  const [config, setConfig] = useState([]);
  const [role, setRole] = useState("");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [fund, mine, cfg, chama] = await Promise.all([
        welfareAPI.getFund(id),
        welfareAPI.getMemberClaims(),
        welfareAPI.getConfig(id),
        chamaAPI.getById(id),
      ]);
      setBalance(Number(fund.data?.data?.balance ?? 0));
      const allMine = mine.data?.data ?? [];
      setClaims((Array.isArray(allMine) ? allMine : []).filter((c) => !c.chama_id || String(c.chama_id) === String(id)));
      const cf = cfg.data?.data ?? [];
      setConfig(Array.isArray(cf) ? cf : []);
      const r = (chama.data?.data?.role || "").toUpperCase();
      setRole(r);
      if (OFFICIALS.includes(r)) {
        try {
          const ms = (await chamaAPI.getMembers(id)).data?.data ?? [];
          setOfficialCount((Array.isArray(ms) ? ms : []).filter((m) => OFFICIALS.includes(String(m.role || "").toUpperCase()) && m.is_active !== false).length);
        } catch { /* leave the notice off if we can't count */ }
        try {
          const all = await welfareAPI.getChamaClaims(id);
          const list = all.data?.data ?? [];
          setWaiting((Array.isArray(list) ? list : []).filter((c) => c.status === "APPROVED"));
        } catch { setWaiting([]); }
      } else setWaiting([]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setFormError("Enter an amount greater than zero.");
    setFormError("");
    setSaving(true);
    try {
      await welfareAPI.makeContribution(id, { amount: value, paymentMethod: method });
      toast.info("Submitted. It joins the welfare fund once an official verifies it.");
      setOpen(false);
      setAmount("");
      await load();
    } catch (err) {
      setFormError(err.response?.data?.message || "We couldn't submit your contribution.");
    } finally {
      setSaving(false);
    }
  };

  const saveCover = async (e) => {
    e.preventDefault();
    const payout = Number(cover.payout);
    if (!cover.name.trim()) return setCoverError("Name the event, for example Bereavement.");
    if (!Number.isFinite(payout) || payout <= 0) return setCoverError("Enter the payout amount.");
    setCoverError("");
    setSaving(true);
    try {
      await welfareAPI.updateConfig(id, { event_type: cover.name.trim(), payout_amount: payout, waiting_period_days: Number(cover.waiting) || 0, max_claims_per_year: Number(cover.perYear) || 0 });
      toast.success("Cover added.");
      setCoverOpen(false);
      setCover({ name: "", payout: "", waiting: "0", perYear: "0" });
      await load();
    } catch (err) {
      setCoverError(err.response?.data?.message || "We couldn't save the cover.");
    } finally { setSaving(false); }
  };

  const payClaim = async (claim) => {
    setPayingId(claim.claim_id);
    try {
      await welfareAPI.payClaim(claim.claim_id);
      toast.success("Paid from the welfare fund and recorded.");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't go through. Nothing was changed.", { autoClose: 8000 });
    } finally {
      setPayingId(null);
    }
  };

  const maxCover = config.reduce((m, c) => Math.max(m, Number(c.payout_amount) || 0), 0);
  const low = maxCover > 0 && balance < maxCover;

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Welfare fund"
          subtitle="Support for members in difficult times."
          actions={(
            <>
              <Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>
              <Link to={`/chamas/${id}/welfare/submit-claim`} className="cs-btn cs-btn--secondary">File a claim</Link>
              {OFFICIALS.includes(role) && <Link to={`/chamas/${id}/welfare/admin`} className="cs-btn cs-btn--secondary">Manage</Link>}
              <Button onClick={() => setOpen(true)}>Contribute</Button>
            </>
          )}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load the welfare fund.</span><Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading welfare fund"><Skeleton height={20} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></div>
        ) : !error && (
          <>
            {low && (
              <div className="cs-notice cs-notice--warning" role="status" style={{ marginBottom: 16 }}>
                <strong>Low fund.</strong>&nbsp;The balance ({formatKES(balance)}) is below the largest payout ({formatKES(maxCover)}).
              </div>
            )}
            <div className="cs-grid" style={{ marginBottom: 16 }}>
              <StatCard label="Fund balance" value={formatKES(balance)} note="Verified contributions only" />
              <StatCard label="Your claims" value={String(claims.length)} />
              <StatCard label="Cover types" value={String(config.length)} />
            </div>

            {OFFICIALS.includes(role) && officialCount < 2 && (
              <div className="cs-notice cs-notice--warning" role="status" style={{ marginBottom: 16 }}>
                <strong>Claims need two officials.</strong>&nbsp;Only one official is set up, so no claim can be approved yet. The chairperson should appoint a treasurer or secretary.
              </div>
            )}
            <section className="cs-card" aria-label="Coverage" style={{ marginBottom: 16 }}>
              <h2 className="cs-card-title">What the fund covers</h2>
              {config.length === 0 ? (
                <EmptyState title="No cover set up yet" message="An official needs to set the payout amounts before claims can be filed." />
              ) : (
                <dl className="cs-kv">
                  {config.map((c) => (
                    <div key={c.id ?? c.event_type}><dt>{pretty(c.event_type)}</dt><dd>{formatKES(c.payout_amount)}{c.waiting_period_days > 0 ? ` · after ${c.waiting_period_days} days` : ""}{c.max_claims_per_year > 0 ? ` · ${c.max_claims_per_year} a year` : ""}</dd></div>
                  ))}
                </dl>
              )}
            </section>

            {waiting.length > 0 && (
              <section className="cs-card" aria-label="Approved claims waiting for funds" style={{ marginBottom: 16 }}>
                <h2 className="cs-card-title">Approved, waiting for funds</h2>
                <p className="cs-help">These claims have two approvals but the fund was short when they were approved. Nothing has been paid yet.</p>
                <ul className="cs-list">
                  {waiting.map((c) => (
                    <li key={c.claim_id} className="cs-list-item">
                      <div className="cs-list-main">
                        <div className="cs-list-title">{pretty(c.event_type)} · {formatKES(c.claim_amount)}</div>
                        <div className="cs-list-meta">{c.member_name ? `${c.member_name} · ` : ""}{formatDate(c.created_at)}</div>
                      </div>
                      <Button size="sm" loading={payingId === c.claim_id} disabled={balance < Number(c.claim_amount)} onClick={() => payClaim(c)}>
                        {balance < Number(c.claim_amount) ? "Fund too low" : "Pay now"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="cs-card" aria-label="Your claims">
              <h2 className="cs-card-title">Your claims</h2>
              {claims.length === 0 ? (
                <EmptyState title="No claims" message="You haven't filed a welfare claim." />
              ) : (
                <ul className="cs-list">
                  {claims.map((c) => (
                    <li key={c.claim_id} className="cs-list-item">
                      <div className="cs-list-main">
                        <div className="cs-list-title">{pretty(c.event_type)}</div>
                        <div className="cs-list-meta">{formatDate(c.created_at)} · {formatKES(c.claim_amount)}</div>
                      </div>
                      <StatusBadge status={c.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="cs-footnote">ChamaSmart records the fund. Cash or transfers happen outside the app.</p>
          </>
        )}

        <Dialog
          open={coverOpen}
          onClose={() => setCoverOpen(false)}
          title="Add welfare cover"
          actions={(<><Button onClick={() => setCoverOpen(false)}>Cancel</Button><Button type="submit" form="cover-form" loading={saving}>Save</Button></>)}
        >
          <form id="cover-form" onSubmit={saveCover} noValidate>
            {coverError && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}>{coverError}</div>}
            <div className="cs-field"><label className="cs-label" htmlFor="cv-name">Event</label><input id="cv-name" className="cs-input" value={cover.name} onChange={(e) => setCover({ ...cover, name: e.target.value })} /></div>
            <div className="cs-field"><label className="cs-label" htmlFor="cv-payout">Payout (KES)</label><input id="cv-payout" className="cs-input" type="number" inputMode="decimal" min="1" value={cover.payout} onChange={(e) => setCover({ ...cover, payout: e.target.value })} /></div>
            <div className="cs-field"><label className="cs-label" htmlFor="cv-wait">Waiting period (days of membership)</label><input id="cv-wait" className="cs-input" type="number" inputMode="numeric" min="0" value={cover.waiting} onChange={(e) => setCover({ ...cover, waiting: e.target.value })} /></div>
            <div className="cs-field"><label className="cs-label" htmlFor="cv-year">Claims allowed per member per year (0 for no limit)</label><input id="cv-year" className="cs-input" type="number" inputMode="numeric" min="0" value={cover.perYear} onChange={(e) => setCover({ ...cover, perYear: e.target.value })} /></div>
          </form>
        </Dialog>

        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Contribute to the welfare fund"
          actions={(<><Button onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" form="welfare-form" loading={saving}>Submit</Button></>)}
        >
          <form id="welfare-form" onSubmit={submit} noValidate>
            {formError && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}>{formError}</div>}
            <div className="cs-field"><label className="cs-label" htmlFor="wf-amount">Amount (KES)</label><input id="wf-amount" className="cs-input" type="number" inputMode="decimal" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="wf-method">How did you pay?</label>
              <select id="wf-method" className="cs-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="CASH">Cash</option><option value="MPESA">M-Pesa</option><option value="BANK_TRANSFER">Bank transfer</option>
              </select>
              <span className="cs-help">An official confirms it before it counts.</span>
            </div>
          </form>
        </Dialog>
      </main>
    </div>
  );
}
