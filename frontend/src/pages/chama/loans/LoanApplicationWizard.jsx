import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { loanAPI, chamaAPI, ascaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { Button, PageHeader, Skeleton, EmptyState } from "../../../components/ui";
import { formatKES } from "../../../utils/format";
import { loanQuote } from "../../../utils/loanMath";

const MIN_LOAN = 500;
const CATEGORIES = [
  { value: "EMERGENCY", label: "Emergency" },
  { value: "SCHOOL_FEES", label: "School fees" },
  { value: "DEVELOPMENT", label: "Development" },
  { value: "BUSINESS", label: "Business" },
  { value: "MEDICAL", label: "Medical" },
];
const STEPS = ["Amount", "Terms", "Guarantors", "Review"];
const DEFAULT_CONFIG = { interest_rate: 10, interest_type: "FLAT", loan_multiplier: 3, max_repayment_months: 12, require_guarantors: true };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export default function LoanApplicationWizard() {
  const { id: chamaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [chama, setChama] = useState(null);
  const [standing, setStanding] = useState(null);
  const [members, setMembers] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ amount: "", type: "DEVELOPMENT", purpose: "", months: 6, guarantors: [], consent: false });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [chamaRes, membersRes, configRes] = await Promise.all([
        chamaAPI.getById(chamaId),
        chamaAPI.getMembers(chamaId),
        loanAPI.getConfig(chamaId),
      ]);
      const chamaData = chamaRes.data?.data;
      const membersData = membersRes.data?.data || [];
      const cfg = { ...DEFAULT_CONFIG, ...(configRes.data?.data || {}) };
      const myId = user?.id ?? user?.user_id ?? user?.userId;
      const me = membersData.find((m) => m.user_id === myId);

      let st = null;
      if (chamaData?.chama_type === "ASCA") {
        st = (await ascaAPI.getMemberStanding(chamaId).catch(() => null))?.data?.data || null;
      }
      if (!st) {
        // The server decides: savings only (verified regular contributions), less what is still owed on open loans.
        const lim = (await loanAPI.getBorrowingLimit(chamaId).catch(() => null))?.data?.data;
        if (lim) st = { equityValue: num(lim.savings), loanLimit: num(lim.available), hasActiveCycle: true };
        else { const savings = num(me?.total_contributions); st = { equityValue: savings, loanLimit: savings * num(cfg.loan_multiplier), hasActiveCycle: true }; }
      }
      setChama(chamaData); setMembers(membersData); setConfig(cfg); setStanding(st);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [chamaId, user]);

  useEffect(() => { load(); }, [load]);

  const myId = user?.id ?? user?.user_id ?? user?.userId;
  const maxMonths = num(config.max_repayment_months) || 12;
  const quote = useMemo(() => loanQuote(form.amount, config.interest_rate, form.months, config.interest_type), [form.amount, form.months, config]);
  const covered = form.guarantors.reduce((s, g) => s + num(g.amount), 0);
  const coveragePct = quote.total > 0 ? Math.min(100, Math.round((covered / quote.total) * 100)) : 0;
  const needsGuarantors = config.require_guarantors !== false;

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => m.user_id !== myId && !form.guarantors.some((g) => g.userId === m.user_id)
      && `${m.first_name} ${m.last_name}`.toLowerCase().includes(q)).slice(0, 8);
  }, [members, form.guarantors, search, myId]);

  const patch = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const addGuarantor = (m) => { setForm((p) => ({ ...p, guarantors: [...p.guarantors, { userId: m.user_id, name: `${m.first_name} ${m.last_name}`, savings: num(m.total_contributions), amount: "" }] })); setSearch(""); };
  const removeGuarantor = (userId) => setForm((p) => ({ ...p, guarantors: p.guarantors.filter((g) => g.userId !== userId) }));
  const setGuarantorAmount = (userId, v) => setForm((p) => ({ ...p, guarantors: p.guarantors.map((g) => (g.userId === userId ? { ...g, amount: v } : g)) }));

  const validate = () => {
    const e = {};
    if (step === 1) {
      const amt = num(form.amount);
      if (!form.amount || amt <= 0) e.amount = "Enter the amount you want to borrow.";
      else if (amt < MIN_LOAN) e.amount = `The minimum loan is ${formatKES(MIN_LOAN, { whole: true })}.`;
      else if (standing && chama?.chama_type !== "ASCA" && amt > standing.loanLimit) e.amount = `You can borrow up to ${formatKES(standing.loanLimit)}.`;
    }
    if (step === 2) {
      if (!form.purpose.trim()) e.purpose = "Tell the officials what the loan is for.";
      if (form.months < 1 || form.months > maxMonths) e.months = `Choose between 1 and ${maxMonths} months.`;
    }
    if (step === 3) {
      if (needsGuarantors && form.guarantors.length === 0) e.coverage = "Add at least one guarantor.";
      else if (form.guarantors.some((g) => num(g.amount) <= 0)) e.coverage = "Enter an amount for every guarantor.";
      else if (needsGuarantors && covered < quote.total) e.coverage = `Guarantors must cover ${formatKES(quote.total)}. You have ${formatKES(covered)}.`;
    }
    if (step === 4 && !form.consent) e.consent = "Please confirm before submitting.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => { if (validate()) setStep((s) => s + 1); };
  const back = () => { setErrors({}); setStep((s) => s - 1); };

  const submit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await loanAPI.apply(chamaId, {
        amount: num(form.amount),
        type: form.type,
        purpose: form.purpose.trim(),
        repaymentPeriod: Math.floor(form.months),
        guarantors: form.guarantors.map((g) => ({ userId: g.userId, amount: num(g.amount) })),
      });
      toast.success("Application submitted. Your guarantors and the officials have been asked to respond.");
      navigate(`/chamas/${chamaId}/loans`);
    } catch (err) {
      setSubmitError(err.response?.status === 429 ? "Too many applications in a short time. Please wait a moment and try again." : err.response?.data?.message || "We couldn't submit your application. Nothing was sent, so you can try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const header = <PageHeader title="Apply for a loan" subtitle={chama?.chama_name} actions={<Link to={`/chamas/${chamaId}/loans`} className="cs-btn cs-btn--secondary">Cancel</Link>} />;

  if (loading) return (<div className="cs-shell"><main className="cs-page cs-page--narrow">{header}<div className="cs-card" aria-busy="true" aria-label="Loading"><Skeleton height={16} width="40%" /><Skeleton height={40} style={{ marginTop: 12 }} /></div></main></div>);
  if (loadError) return (<div className="cs-shell"><main className="cs-page cs-page--narrow">{header}<div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}><span>We couldn&apos;t load the loan details for this chama.</span><Button size="sm" onClick={load}>Try again</Button></div></main></div>);
  if (standing && standing.equityValue <= 0) return (
    <div className="cs-shell"><main className="cs-page cs-page--narrow">{header}
      <div className="cs-card"><EmptyState title="You can't borrow yet" message={`Loans are based on what you have contributed. Make a contribution to ${chama?.chama_name || "this chama"} first, then come back.`} action={<Link to={`/chamas/${chamaId}`} className="cs-btn cs-btn--primary">Back to chama</Link>} /></div>
    </main></div>
  );

  const typeLabel = config.interest_type === "REDUCING_BALANCE" ? "reducing balance" : "flat";

  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        {header}
        <ol className="cs-steps" aria-label="Application progress">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={step === i + 1 ? "step" : undefined} className={step > i + 1 ? "is-done" : step === i + 1 ? "is-current" : ""}>
              <span className="cs-step-dot" aria-hidden="true">{step > i + 1 ? "✓" : i + 1}</span>
              <span className="cs-step-label">{label}</span>
            </li>
          ))}
        </ol>

        {submitError && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16 }}>{submitError}</div>}

        <form className="cs-card" onSubmit={(e) => { e.preventDefault(); if (step < 4) next(); else submit(); }} noValidate>
          {step === 1 && (
            <>
              <h2 className="cs-section-title">How much do you need?</h2>
              <dl className="cs-kv">
                <div><dt>Your contributions</dt><dd>{formatKES(standing?.equityValue)}</dd></div>
                {chama?.chama_type !== "ASCA" && <div><dt>You can borrow up to</dt><dd>{formatKES(standing?.loanLimit)}</dd></div>}
              </dl>
              <div className="cs-field" style={{ marginTop: 16 }}>
                <label className="cs-label" htmlFor="amount">Amount (KES)<span className="cs-required" aria-hidden="true">*</span></label>
                <input id="amount" className="cs-input cs-input--amount" type="number" inputMode="decimal" min={MIN_LOAN} step="100" value={form.amount} autoFocus
                  onChange={(e) => patch("amount", e.target.value)} aria-invalid={Boolean(errors.amount)} aria-describedby="amount-msg" />
                <span id="amount-msg" className={errors.amount ? "cs-error" : "cs-help"}>{errors.amount || `Minimum ${formatKES(MIN_LOAN, { whole: true })}. Limit is ${num(config.loan_multiplier)}× your contributions.`}</span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="cs-section-title">Loan terms</h2>
              <div className="cs-notice cs-notice--info" style={{ marginBottom: 16 }}>
                Interest is {num(config.interest_rate)}% a year ({typeLabel}), set by your chama&apos;s officials.
              </div>
              <div className="cs-field">
                <span className="cs-label" id="cat-label">Category</span>
                <div className="cs-chips" role="group" aria-labelledby="cat-label">
                  {CATEGORIES.map((c) => <button key={c.value} type="button" className="cs-chip" aria-pressed={form.type === c.value} onClick={() => patch("type", c.value)}>{c.label}</button>)}
                </div>
                <span className="cs-help">Used for reporting only. It does not change the interest.</span>
              </div>
              <div className="cs-field" style={{ marginTop: 16 }}>
                <label className="cs-label" htmlFor="months">Repayment period: {form.months} {form.months === 1 ? "month" : "months"}</label>
                <input id="months" type="range" min="1" max={maxMonths} step="1" value={Math.min(form.months, maxMonths)} onChange={(e) => patch("months", Number(e.target.value))} style={{ width: "100%" }} aria-describedby="months-msg" />
                <span id="months-msg" className={errors.months ? "cs-error" : "cs-help"}>{errors.months || `Up to ${maxMonths} months.`}</span>
              </div>
              <div className="cs-field" style={{ marginTop: 16 }}>
                <label className="cs-label" htmlFor="purpose">What is the loan for?<span className="cs-required" aria-hidden="true">*</span></label>
                <textarea id="purpose" className="cs-input" rows={4} maxLength={500} value={form.purpose} onChange={(e) => patch("purpose", e.target.value)} aria-invalid={Boolean(errors.purpose)} aria-describedby="purpose-msg" />
                <span id="purpose-msg" className={errors.purpose ? "cs-error" : "cs-help"}>{errors.purpose || `Be specific; officials read this. ${form.purpose.length}/500`}</span>
              </div>
              <dl className="cs-kv" style={{ marginTop: 16 }}>
                <div><dt>Borrowing</dt><dd>{formatKES(quote.principal)}</dd></div>
                <div><dt>Interest</dt><dd>{formatKES(quote.interest)}</dd></div>
                <div><dt>Total to repay</dt><dd>{formatKES(quote.total)}</dd></div>
                <div><dt>About each month</dt><dd>{formatKES(quote.monthly)}</dd></div>
              </dl>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="cs-section-title">Guarantors</h2>
              <p className="cs-help">{needsGuarantors ? `Guarantors must together cover the full ${formatKES(quote.total)}. ` : "Guarantors are optional in this chama. "}
                You can&apos;t guarantee your own loan, and a guarantor can pledge at most {num(config.loan_multiplier)}× their contributions across all open loans. Members with a defaulted loan can&apos;t guarantee.</p>
              <div className="cs-field" style={{ marginTop: 12 }}>
                <label className="cs-label" htmlFor="gsearch">Find a member</label>
                <input id="gsearch" className="cs-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Start typing a name" autoComplete="off" />
              </div>
              {search && (
                <ul className="cs-list" aria-label="Matching members">
                  {candidates.length === 0 ? <li className="cs-list-meta" style={{ padding: 12 }}>No members match.</li> : candidates.map((m) => (
                    <li key={m.user_id} className="cs-list-item">
                      <div className="cs-list-main"><div>{m.first_name} {m.last_name}</div><div className="cs-list-meta">Contributions {formatKES(m.total_contributions)}</div></div>
                      <Button size="sm" onClick={() => addGuarantor(m)}>Add</Button>
                    </li>
                  ))}
                </ul>
              )}
              {form.guarantors.map((g) => (
                <div key={g.userId} className="cs-field" style={{ marginTop: 16 }}>
                  <label className="cs-label" htmlFor={`g-${g.userId}`}>{g.name}<span className="cs-help"> · contributions {formatKES(g.savings)}</span></label>
                  <div className="cs-actions">
                    <input id={`g-${g.userId}`} className="cs-input cs-input--amount" type="number" inputMode="decimal" min="0" step="100" value={g.amount} onChange={(e) => setGuarantorAmount(g.userId, e.target.value)} placeholder="Amount (KES)" />
                    <Button size="sm" variant="tertiary" onClick={() => removeGuarantor(g.userId)} aria-label={`Remove ${g.name}`}>Remove</Button>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <div className="cs-progress-label"><span>Covered {formatKES(covered)} of {formatKES(quote.total)}</span><span>{coveragePct}%</span></div>
                <div className="cs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={coveragePct} aria-label="Guarantor coverage"><span style={{ width: `${coveragePct}%` }} /></div>
                {errors.coverage && <span className="cs-error" role="alert">{errors.coverage}</span>}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="cs-section-title">Review and submit</h2>
              <dl className="cs-kv">
                <div><dt>Amount</dt><dd>{formatKES(quote.principal)}</dd></div>
                <div><dt>Category</dt><dd>{CATEGORIES.find((c) => c.value === form.type)?.label}</dd></div>
                <div><dt>Interest</dt><dd>{num(config.interest_rate)}% a year ({typeLabel}) = {formatKES(quote.interest)}</dd></div>
                <div><dt>Total to repay</dt><dd>{formatKES(quote.total)}</dd></div>
                <div><dt>Monthly</dt><dd>{formatKES(quote.monthly)}</dd></div>
                <div><dt>Period</dt><dd>{form.months} {form.months === 1 ? "month" : "months"}</dd></div>
              </dl>
              <p className="cs-list-meta">Purpose: {form.purpose}</p>
              {form.guarantors.length > 0 && (
                <ul className="cs-list" aria-label="Guarantors">
                  {form.guarantors.map((g) => <li key={g.userId} className="cs-list-item"><div className="cs-list-main">{g.name}</div><strong>{formatKES(g.amount)}</strong></li>)}
                </ul>
              )}
              <p className="cs-help">The final figures are calculated by the server when you submit. Officials can only approve once every guarantor has accepted.</p>
              <div className="cs-field" style={{ marginTop: 16 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input type="checkbox" checked={form.consent} onChange={(e) => patch("consent", e.target.checked)} aria-describedby="consent-msg" style={{ marginTop: 4 }} />
                  <span>I agree to share my loan details and contribution record with my chosen guarantors and the chama officials.</span>
                </label>
                {errors.consent && <span id="consent-msg" className="cs-error" role="alert">{errors.consent}</span>}
              </div>
            </>
          )}

          <div className="cs-actions" style={{ marginTop: 20, justifyContent: "space-between" }}>
            {step > 1 ? <Button onClick={back} disabled={submitting}>Back</Button> : <span />}
            {step < 4 ? <Button type="submit" variant="primary">Continue</Button> : <Button type="submit" variant="primary" loading={submitting}>{submitting ? "Submitting…" : "Submit application"}</Button>}
          </div>
        </form>
      </main>
    </div>
  );
}
