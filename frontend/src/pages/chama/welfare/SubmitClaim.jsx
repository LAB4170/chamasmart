import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { welfareAPI } from "../../../services/api";
import { Button, PageHeader, EmptyState, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const pretty = (s) => (s || "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const today = () => new Date().toISOString().split("T")[0];

export default function SubmitClaim() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ eventId: "", amount: "", date: "", description: "" });
  const [file, setFile] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await welfareAPI.getConfig(id);
        const list = res.data?.data ?? [];
        if (live) setConfig((Array.isArray(list) ? list : []).filter((c) => c.is_active !== false));
      } catch {
        if (live) setLoadError(true);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [id]);

  const chosen = config.find((c) => String(c.id) === String(form.eventId));
  const ceiling = chosen ? Number(chosen.payout_amount) : 0;

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const pick = (e) => {
    const c = config.find((x) => String(x.id) === e.target.value);
    setForm((f) => ({ ...f, eventId: e.target.value, amount: c ? String(c.payout_amount) : "" }));
  };

  const validate = () => {
    const er = {};
    if (!chosen) er.eventId = "Choose what the claim is for.";
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) er.amount = "Enter the amount you are claiming.";
    else if (ceiling > 0 && amt > ceiling) er.amount = `The most this cover pays is ${formatKES(ceiling)}.`;
    if (!form.date) er.date = "Say when it happened.";
    else if (form.date > today()) er.date = "The date can't be in the future.";
    if (form.description.trim().length < 10) er.description = "Tell the officials what happened (at least 10 characters).";
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        chama_id: id,
        event_type_id: chosen.id,
        claim_amount: Number(form.amount),
        date_of_occurrence: form.date,
        description: form.description.trim(),
      };
      if (file) payload.proof_document = file;
      const res = await welfareAPI.submitClaim(id, payload);
      toast.success(res.data?.message || "Claim submitted. Officials will review it.");
      navigate(`/chamas/${id}/welfare`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't submit the claim.");
    } finally {
      setSaving(false);
    }
  };

  const err = (n) => errors[n] && <span className="cs-error" id={`sc-${n}-err`} role="alert">{errors[n]}</span>;
  const aria = (n) => ({ id: `sc-${n}`, name: n, "aria-invalid": errors[n] ? "true" : undefined, "aria-describedby": errors[n] ? `sc-${n}-err` : undefined });

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="File a welfare claim" subtitle="Two officials review every claim before it is approved." actions={<Link to={`/chamas/${id}/welfare`} className="cs-btn cs-btn--secondary">Back</Link>} />
        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading"><Skeleton height={20} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></div>
        ) : loadError ? (
          <div className="cs-notice cs-notice--danger" role="alert">We couldn&apos;t load the welfare cover for this chama. Go back and try again.</div>
        ) : config.length === 0 ? (
          <div className="cs-card"><EmptyState title="No cover to claim against" message="An official has to set up welfare cover before claims can be filed." /></div>
        ) : (
          <form className="cs-card" onSubmit={submit} noValidate style={{ maxWidth: 720 }}>
            <div className="cs-field">
              <label className="cs-label" htmlFor="sc-eventId">Claim for</label>
              <select className="cs-select" {...aria("eventId")} value={form.eventId} onChange={pick}>
                <option value="">Choose…</option>
                {config.map((c) => <option key={c.id} value={c.id}>{pretty(c.event_type)} — up to {formatKES(c.payout_amount)}</option>)}
              </select>
              {err("eventId")}
            </div>
            <div className="cs-form-grid">
              <div className="cs-field">
                <label className="cs-label" htmlFor="sc-amount">Amount (KES)</label>
                <input className="cs-input" type="number" inputMode="decimal" min="1" {...aria("amount")} value={form.amount} onChange={set} />
                {err("amount")}
              </div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="sc-date">Date it happened</label>
                <input className="cs-input" type="date" max={today()} {...aria("date")} value={form.date} onChange={set} />
                {err("date")}
              </div>
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="sc-description">What happened</label>
              <textarea className="cs-textarea" rows={4} {...aria("description")} value={form.description} onChange={set} />
              {err("description")}
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="sc-proof">Proof (optional)</label>
              <input id="sc-proof" className="cs-input" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <span className="cs-help">Files aren&apos;t stored yet, so officials may ask you for proof directly.</span>
            </div>
            <div className="cs-actions">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving}>Submit claim</Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
