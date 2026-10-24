import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { loanAPI } from "../../../services/api";
import { Button, PageHeader, Skeleton } from "../../../components/ui";

const DEFAULTS = { interest_rate: "10", interest_type: "FLAT", loan_multiplier: "3", max_repayment_months: "12", require_guarantors: true, late_fee_percent: "0", committee_threshold: "20000", committee_size: "2" };

export default function LoanConfigPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let live = true;
    loanAPI.getConfig(id)
      .then((r) => {
        const c = r.data?.data;
        if (live && c) {
          setForm({
            interest_rate: String(c.interest_rate ?? DEFAULTS.interest_rate),
            interest_type: c.interest_type || DEFAULTS.interest_type,
            loan_multiplier: String(c.loan_multiplier ?? DEFAULTS.loan_multiplier),
            max_repayment_months: String(c.max_repayment_months ?? DEFAULTS.max_repayment_months),
            require_guarantors: c.require_guarantors !== false,
            late_fee_percent: String(c.late_fee_percent ?? DEFAULTS.late_fee_percent),
            committee_threshold: String(c.committee_threshold ?? DEFAULTS.committee_threshold),
            committee_size: String(c.committee_size ?? DEFAULTS.committee_size),
          });
        }
      })
      .catch(() => { if (live) setLoadError(true); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const validate = () => {
    const er = {};
    const rate = Number(form.interest_rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) er.interest_rate = "Enter a rate between 0 and 100.";
    const mult = Number(form.loan_multiplier);
    if (!Number.isFinite(mult) || mult < 1 || mult > 10) er.loan_multiplier = "Enter a multiplier between 1 and 10.";
    const months = Number(form.max_repayment_months);
    if (!Number.isInteger(months) || months < 1 || months > 60) er.max_repayment_months = "Enter a whole number of months from 1 to 60.";
    const fee = Number(form.late_fee_percent);
    if (!Number.isFinite(fee) || fee < 0 || fee > 50) er.late_fee_percent = "Enter a late fee between 0 and 50 percent.";
    const thr = Number(form.committee_threshold);
    if (!Number.isFinite(thr) || thr <= 0) er.committee_threshold = "Enter an amount above zero.";
    const size = Number(form.committee_size);
    if (!Number.isInteger(size) || size < 1 || size > 3) er.committee_size = "Choose 1, 2 or 3 approvals.";
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await loanAPI.updateConfig(id, {
        interest_rate: Number(form.interest_rate),
        interest_type: form.interest_type,
        loan_multiplier: Number(form.loan_multiplier),
        max_repayment_months: Number(form.max_repayment_months),
        require_guarantors: form.require_guarantors,
        late_fee_percent: Number(form.late_fee_percent),
        committee_threshold: Number(form.committee_threshold),
        committee_size: Number(form.committee_size),
      });
      toast.success("Loan terms saved. They apply to new applications; existing loans keep their terms.");
      navigate(`/chamas/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't save the loan terms.");
    } finally {
      setSaving(false);
    }
  };

  const aria = (n) => ({ id: `lc-${n}`, name: n, "aria-invalid": errors[n] ? "true" : undefined, "aria-describedby": errors[n] ? `lc-${n}-err` : `lc-${n}-help` });
  const msg = (n, help) => (errors[n] ? <span className="cs-error" id={`lc-${n}-err`} role="alert">{errors[n]}</span> : <span className="cs-help" id={`lc-${n}-help`}>{help}</span>);

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Loan terms" subtitle="Set once for the whole chama. Members can't override them." actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>} />
        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading loan terms"><Skeleton height={20} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></div>
        ) : loadError ? (
          <div className="cs-notice cs-notice--danger" role="alert">We couldn&apos;t load the current terms, and only officials can change them. Go back and try again.</div>
        ) : (
          <form className="cs-card" onSubmit={save} noValidate style={{ maxWidth: 720 }}>
            <div className="cs-form-grid">
              <div className="cs-field">
                <label className="cs-label" htmlFor="lc-interest_rate">Interest rate (% a year)</label>
                <input className="cs-input" type="number" inputMode="decimal" min="0" max="100" step="0.5" {...aria("interest_rate")} value={form.interest_rate} onChange={set} />
                {msg("interest_rate", "Charged on the amount borrowed, per year of the repayment period.")}
              </div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="lc-interest_type">Interest type</label>
                <select className="cs-select" {...aria("interest_type")} value={form.interest_type} onChange={set}>
                  <option value="FLAT">Flat: on the full amount borrowed</option>
                  <option value="REDUCING_BALANCE">Reducing balance: on what is still owed</option>
                </select>
                {msg("interest_type", form.interest_type === "FLAT" ? "Interest is worked out once on the principal." : "Interest falls as the principal is repaid.")}
              </div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="lc-loan_multiplier">Loan limit (× savings)</label>
                <input className="cs-input" type="number" inputMode="decimal" min="1" max="10" step="0.5" {...aria("loan_multiplier")} value={form.loan_multiplier} onChange={set} />
                {msg("loan_multiplier", `A member can borrow up to ${form.loan_multiplier || "—"} times their savings.`)}
              </div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="lc-max_repayment_months">Longest repayment (months)</label>
                <input className="cs-input" type="number" inputMode="numeric" min="1" max="60" {...aria("max_repayment_months")} value={form.max_repayment_months} onChange={set} />
                {msg("max_repayment_months", "Applications asking for longer are refused.")}
              </div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="lc-late_fee_percent">Late fee (% of an overdue instalment)</label>
                <input className="cs-input" type="number" inputMode="decimal" min="0" max="50" step="0.5" {...aria("late_fee_percent")} value={form.late_fee_percent} onChange={set} />
                {msg("late_fee_percent", "Charged once per overdue instalment. 0 switches late fees off.")}
              </div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="lc-committee_threshold">Loans from (KES) need more than one approval</label>
                <input className="cs-input" type="number" inputMode="decimal" min="1" {...aria("committee_threshold")} value={form.committee_threshold} onChange={set} />
                {msg("committee_threshold", "Smaller loans need one official who is not the borrower.")}
              </div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="lc-committee_size">Approvals needed for those loans</label>
                <input className="cs-input" type="number" inputMode="numeric" min="1" max="3" {...aria("committee_size")} value={form.committee_size} onChange={set} />
                {msg("committee_size", "Different officials, never the borrower.")}
              </div>
            </div>
            <label className="cs-check" style={{ marginBottom: 16 }}>
              <input type="checkbox" name="require_guarantors" checked={form.require_guarantors} onChange={set} />
              <span>Require guarantors on every loan</span>
            </label>
            <div className="cs-actions">
              <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
              <Button type="submit" loading={saving}>Save terms</Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
