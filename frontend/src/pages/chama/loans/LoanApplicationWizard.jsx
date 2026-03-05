import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI, chamaAPI, ascaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import {
  ChevronRight, ChevronLeft, DollarSign,
  Users, Calendar, CheckCircle, AlertCircle, Search,
  Star, Shield, Lock, AlertTriangle, Clock, TrendingUp
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   LOAN APPLICATION WIZARD  — Phase 13.5
   Uses the app's real CSS variable system (--card-bg, --text-primary,
   --input-bg, --border, --primary, etc.) so light/dark mode works correctly.
───────────────────────────────────────────────────────────────────────────── */

const LOAN_TYPES = [
  { value: "EMERGENCY",    label: "Emergency",       rate: 0,  desc: "Urgent crisis — 0% interest",        color: "#ef4444" },
  { value: "SCHOOL_FEES",  label: "School Fees",     rate: 2,  desc: "Education — 2% flat",                color: "#3b82f6" },
  { value: "DEVELOPMENT",  label: "Development",     rate: 5,  desc: "Personal growth — 5% flat",          color: "#8b5cf6" },
  { value: "BUSINESS",     label: "Business",        rate: 8,  desc: "Entrepreneurial — 8% flat",          color: "#f59e0b" },
  { value: "MEDICAL",      label: "Medical",         rate: 0,  desc: "Health — 0% interest",               color: "#10b981" },
];

const MAX_MONTHS = 24;
const MIN_LOAN   = 500;

export default function LoanApplicationWizard() {
  const { id: chamaId } = useParams();
  const navigate        = useNavigate();

  const [step,           setStep]           = useState(1);
  const [loading,        setLoading]        = useState(true);
  const [submitting,     setSubmitting]     = useState(false);
  const [chama,          setChama]          = useState(null);
  const [memberStanding, setMemberStanding] = useState(null);
  const [members,        setMembers]        = useState([]);
  const [search,         setSearch]         = useState("");
  const [errors,         setErrors]         = useState({});

  const [form, setForm] = useState({
    amount: "", type: "DEVELOPMENT", purpose: "", repaymentPeriod: 6, guarantors: [],
    consent: false,
  });

  /* ── Init ── */
  useEffect(() => {
    (async () => {
      try {
        const [chamaRes, standingRes, membersRes] = await Promise.all([
          chamaAPI.getById(chamaId),
          ascaAPI.getMemberStanding(chamaId).catch(() => ({ data: { data: null } })),
          chamaAPI.getMembers(chamaId),
        ]);
        const membersData = membersRes.data.data || [];
        let standing = standingRes.data.data;
        if (!standing) {
          const u  = JSON.parse(localStorage.getItem("user") || "{}");
          const me = membersData.find(m => m.user_id === (u?.user_id || u?.id || u?.userId));
          const c  = parseFloat(me?.total_contributions || 0);
          standing = { equityValue: c, loanLimit: c * 3, outstandingDebt: 0, availableCredit: c * 3, hasActiveCycle: true };
        }
        setChama(chamaRes.data.data);
        setMemberStanding(standing);
        setMembers(membersData);
      } catch (e) {
        console.error(e);
        toast.error("Failed to initialise");
      } finally {
        setLoading(false);
      }
    })();
  }, [chamaId]);

  /* ── Derived ── */
  const selectedType = LOAN_TYPES.find(t => t.value === form.type) || LOAN_TYPES[2];
  const rate = selectedType.rate;

  const amort = useMemo(() => {
    const prin     = parseFloat(form.amount) || 0;
    const interest = (prin * rate) / 100;
    const total    = prin + interest;
    const monthly  = form.repaymentPeriod > 0 ? total / form.repaymentPeriod : 0;
    return { prin, interest, total, monthly };
  }, [form.amount, rate, form.repaymentPeriod]);

  const utilPct = useMemo(() =>
    Math.min((parseFloat(form.amount || 0) / (memberStanding?.loanLimit || 1)) * 100, 100),
    [form.amount, memberStanding]);

  const filteredMembers = useMemo(() =>
    members.filter(m =>
      !form.guarantors.some(g => g.guarantorId === m.user_id) &&
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
    ), [members, form.guarantors, search]);

  const guaranteedTotal = form.guarantors.reduce((s, g) => s + (g.amount || 0), 0);
  const coveragePct     = amort.total > 0 ? Math.min((guaranteedTotal / amort.total) * 100, 100) : 0;

  /* ── Helpers ── */
  const patch     = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const clearErr  = k => setErrors(p => { const n = { ...p }; delete n[k]; return n; });
  const fmt       = n => `KES ${(n || 0).toLocaleString("en-KE")}`;

  const addGuarantor = useCallback(m => {
    setForm(p => ({
      ...p,
      guarantors: [...p.guarantors, {
        guarantorId: m.user_id,
        name: `${m.first_name} ${m.last_name}`,
        trustScore: m.trust_score || 0,
        savings: parseFloat(m.total_contributions || 0),
        amount: 0,
      }],
    }));
    setSearch("");
  }, []);

  const removeGuarantor = idx => setForm(p => ({ ...p, guarantors: p.guarantors.filter((_, i) => i !== idx) }));
  const setGuarantorAmt = (idx, v) => setForm(p => {
    const g = [...p.guarantors]; g[idx] = { ...g[idx], amount: parseFloat(v) || 0 }; return { ...p, guarantors: g };
  });

  /* ── Validation ── */
  const nextStep = () => {
    const errs = {};
    if (step === 1) {
      const amt = parseFloat(form.amount);
      if (!form.amount || amt <= 0)   errs.amount = "Enter a valid amount";
      else if (amt < MIN_LOAN)         errs.amount = `Minimum loan is KES ${MIN_LOAN.toLocaleString()}`;
      else if (memberStanding?.hasActiveCycle && amt > memberStanding.loanLimit)
        errs.amount = `Exceeds limit: ${fmt(memberStanding.loanLimit)}`;
    }
    if (step === 2) {
      if (!form.purpose.trim())          errs.purpose = "Describe how you will use this loan";
      if (form.repaymentPeriod < 1 || form.repaymentPeriod > MAX_MONTHS)
        errs.repaymentPeriod = `1 – ${MAX_MONTHS} months only`;
    }
    if (step === 3 && guaranteedTotal < amort.total)
      errs.coverage = `Need ${fmt(amort.total)} coverage — you have ${fmt(guaranteedTotal)}`;

    if (step === 4 && !form.consent)
      errs.consent = "You must consent to data sharing to proceed";

    if (Object.keys(errs).length) {
      setErrors(errs);
      Object.values(errs).forEach(m => toast.warning(m));
      return;
    }
    setErrors({});
    setStep(s => s + 1);
  };

  const prevStep = () => { setErrors({}); setStep(s => s - 1); };

  const handleSubmit = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await loanAPI.apply(chamaId, {
        amount: parseFloat(form.amount),
        type: form.type,
        purpose: form.purpose.trim(),
        repaymentPeriod: parseInt(form.repaymentPeriod),
        guarantors: form.guarantors.map(g => ({ guarantorId: g.guarantorId, amount: g.amount })),
      });
      toast.success("Application submitted! Officials & guarantors will be notified.");
      navigate(`/chamas/${chamaId}`);
    } catch (err) {
      if (err.response?.status === 429)
        toast.error("Too many loan applications. Please wait before trying again.");
      else
        toast.error(err.response?.data?.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Step UI ── */
  const renderStep = () => {
    switch (step) {
      case 1: return (
        <div>
          <StepHeader icon={<DollarSign size={20}/>} colorClass="lw-icon-amber" title="How much do you need?" sub="Enter your amount and review your borrowing capacity." />

          {/* Credit summary card */}
          <div className="lw-info-card">
            <div className="lw-info-row">
              <span>Equity (Shares)</span>
              <strong>{fmt(memberStanding?.equityValue)}</strong>
            </div>
            <div className="lw-info-row lw-info-row--sub">
              <span>Outstanding Debt</span>
              <span className="lw-text-warn">{fmt(memberStanding?.outstandingDebt)}</span>
            </div>
            <div className="lw-divider" />
            <div className="lw-info-row lw-info-row--main">
              <span>Max Loan (3× equity)</span>
              <span className="lw-text-green">{fmt(memberStanding?.loanLimit)}</span>
            </div>
            <div className="lw-progress-track">
              <div className="lw-progress-bar" style={{
                width: `${utilPct}%`,
                background: utilPct > 90 ? "#ef4444" : utilPct > 70 ? "#f59e0b" : "#22c55e"
              }} />
            </div>
            <p className="lw-helper">{Math.round(utilPct)}% of credit limit utilised</p>
          </div>

          <div className={`lw-field ${errors.amount ? "lw-field--err" : ""}`}>
            <label className="lw-label">Principal Amount (KES)</label>
            <div className="lw-input-wrap">
              <span className="lw-prefix">KES</span>
              <input
                type="number"
                inputMode="numeric"
                className="lw-input lw-input--lg"
                value={form.amount}
                min={MIN_LOAN}
                max={memberStanding?.loanLimit}
                step="500"
                onChange={e => { patch("amount", e.target.value); clearErr("amount"); }}
                placeholder="50000"
                autoFocus
              />
            </div>
            {errors.amount && <p className="lw-err-msg"><AlertCircle size={12}/>{errors.amount}</p>}
          </div>

          <div className="lw-security-note">
            <Shield size={13}/>
            <span>Applications above 3× equity are automatically rejected server-side.</span>
          </div>
        </div>
      );

      case 2: return (
        <div>
          <StepHeader icon={<Calendar size={20}/>} colorClass="lw-icon-blue" title="Loan Terms" sub="Choose category and repayment timeline." />

          {/* Type grid */}
          <div className="lw-type-grid">
            {LOAN_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => patch("type", t.value)}
                className={`lw-type-card ${form.type === t.value ? "lw-type-card--active" : ""}`}
                style={form.type === t.value ? { borderColor: t.color, background: `${t.color}12` } : {}}
              >
                <div className="lw-type-rate" style={{ color: t.color }}>{t.rate}%</div>
                <div className="lw-type-name">{t.label}</div>
                <div className="lw-type-desc">{t.desc}</div>
              </button>
            ))}
          </div>

          {/* Slider */}
          <div className={`lw-field ${errors.repaymentPeriod ? "lw-field--err" : ""}`}>
            <label className="lw-label">Repayment Period: <strong>{form.repaymentPeriod} month{form.repaymentPeriod > 1 ? "s" : ""}</strong></label>
            <input
              type="range" min="1" max={MAX_MONTHS} step="1"
              className="lw-slider"
              value={form.repaymentPeriod}
              onChange={e => { patch("repaymentPeriod", parseInt(e.target.value)); clearErr("repaymentPeriod"); }}
            />
            <div className="lw-slider-labels"><span>1 mo</span><span>{MAX_MONTHS} mo</span></div>
            {errors.repaymentPeriod && <p className="lw-err-msg"><AlertCircle size={12}/>{errors.repaymentPeriod}</p>}
          </div>

          {/* Purpose */}
          <div className={`lw-field ${errors.purpose ? "lw-field--err" : ""}`}>
            <label className="lw-label">Purpose of Loan</label>
            <textarea
              className="lw-textarea"
              rows={3}
              maxLength={500}
              value={form.purpose}
              onChange={e => { patch("purpose", e.target.value); clearErr("purpose"); }}
              placeholder="Describe clearly how the funds will be used…"
            />
            <div className="lw-char-count">{form.purpose.length} / 500</div>
            {errors.purpose && <p className="lw-err-msg"><AlertCircle size={12}/>{errors.purpose}</p>}
          </div>

          {/* Amortisation summary */}
          <div className="lw-amort-card">
            <div className="lw-amort-row"><span>Principal</span><span>{fmt(amort.prin)}</span></div>
            <div className="lw-amort-row"><span>Interest ({rate}%)</span><span className="lw-text-warn">+ {fmt(amort.interest)}</span></div>
            <div className="lw-amort-divider"/>
            <div className="lw-amort-row lw-amort-row--total"><span>Total Repayable</span><strong>{fmt(amort.total)}</strong></div>
            <div className="lw-amort-row lw-amort-row--monthly">
              <span><Clock size={13}/> Monthly</span>
              <span className="lw-text-green"><strong>{fmt(amort.monthly)}</strong>/mo</span>
            </div>
          </div>
        </div>
      );

      case 3: return (
        <div>
          <StepHeader icon={<Users size={20}/>} colorClass="lw-icon-purple" title="Select Guarantors" sub="Guarantors must cover 100% of total repayable amount." />

          <div className="lw-callout">
            <AlertTriangle size={14} className="lw-text-warn" style={{ flexShrink: 0, marginTop: 1 }}/>
            <div>
              <strong>Server-side security rules</strong>
              <ul className="lw-list">
                <li>Cannot guarantee your own loan</li>
                <li>Guarantor needs ≥ 50% savings of guarantee amount</li>
                <li>Max guarantee capacity: 3× their savings</li>
                <li>Members with defaulted loans cannot guarantee</li>
              </ul>
            </div>
          </div>

          <div className="lw-search-wrap">
            <Search size={15} className="lw-search-icon"/>
            <input
              type="text"
              className="lw-search"
              placeholder="Search members by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && filteredMembers.length > 0 && (
              <div className="lw-dropdown">
                {filteredMembers.slice(0, 8).map(m => (
                  <button key={m.user_id} type="button" className="lw-dropdown-item" onClick={() => addGuarantor(m)}>
                    <div>
                      <div className="lw-dropdown-name">{m.first_name} {m.last_name}</div>
                      <div className="lw-dropdown-sub">Savings: {fmt(m.total_contributions)} · Trust: {m.trust_score || 0}%</div>
                    </div>
                    <Star size={13} style={{ color: "#f59e0b", flexShrink: 0 }}/>
                  </button>
                ))}
              </div>
            )}
          </div>

          {form.guarantors.length > 0 && (
            <div className="lw-guarantors">
              {form.guarantors.map((g, idx) => {
                const maxCap   = (g.savings || 0) * 3;
                const capPct   = maxCap > 0 ? Math.min((g.amount / maxCap) * 100, 100) : 0;
                const halfWarn = g.amount > 0 && g.amount > (g.savings || 0) * 2;
                return (
                  <div key={g.guarantorId} className="lw-guarantor-row">
                    <div className="lw-guarantor-meta">
                      <div className="lw-guarantor-name">{g.name}</div>
                      <div className="lw-guarantor-sub">Savings: {fmt(g.savings)} · Capacity: {fmt(maxCap)}</div>
                      {halfWarn && <p className="lw-warn-inline"><AlertCircle size={10}/> Near 50% savings rule — may be rejected</p>}
                      <div className="lw-mini-track"><div className="lw-mini-fill" style={{ width: `${capPct}%`, background: capPct > 90 ? "#ef4444" : "#2563eb" }}/></div>
                    </div>
                    <div className="lw-guarantor-controls">
                      <div className="lw-input-wrap lw-input-wrap--sm">
                        <span className="lw-prefix">KES</span>
                        <input
                          type="number" inputMode="numeric" min="0" max={maxCap} step="500"
                          className="lw-input lw-input--sm"
                          value={g.amount || ""}
                          onChange={e => setGuarantorAmt(idx, e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <button type="button" className="lw-remove-btn" onClick={() => removeGuarantor(idx)} title="Remove">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="lw-coverage-card">
            <div className="lw-coverage-header">
              <span>Coverage</span>
              <span style={{ color: coveragePct >= 100 ? "#22c55e" : "#f59e0b", fontWeight: 700 }}>{Math.round(coveragePct)}%</span>
            </div>
            <div className="lw-progress-track">
              <div className="lw-progress-bar" style={{ width: `${coveragePct}%`, background: coveragePct >= 100 ? "#22c55e" : "#f59e0b" }}/>
            </div>
            <p className="lw-helper" style={{ marginTop: "0.4rem" }}>Need {fmt(amort.total)} · Covered {fmt(guaranteedTotal)}</p>
            {errors.coverage && <p className="lw-err-msg" style={{ marginTop: "0.5rem" }}><AlertCircle size={12}/>{errors.coverage}</p>}
          </div>
        </div>
      );

      case 4: return (
        <div>
          <StepHeader icon={<CheckCircle size={20}/>} colorClass="lw-icon-green" title="Review & Submit" sub="Confirm your details before final submission." />

          <div className="lw-review-card">
            <Row label="Loan Amount"       val={fmt(amort.prin)} />
            <Row label="Type"              val={selectedType.label} />
            <Row label="Interest"          val={`${rate}%`} />
            <Row label="Total Repayable"   val={<strong className="lw-text-warn">{fmt(amort.total)}</strong>} />
            <Row label="Monthly"           val={<strong className="lw-text-green">{fmt(amort.monthly)}/mo</strong>} />
            <Row label="Repayment"         val={`${form.repaymentPeriod} months`} />
            <Row label="Purpose"           val={form.purpose} />
          </div>

          {form.guarantors.length > 0 && (
            <div className="lw-review-card">
              <p className="lw-section-label">Guaranteed by</p>
              {form.guarantors.map(g => <Row key={g.guarantorId} label={g.name} val={fmt(g.amount)} />)}
              <Row label="Total Coverage" val={<strong style={{ color: coveragePct >= 100 ? "#22c55e" : "#f59e0b" }}>{fmt(guaranteedTotal)} ({Math.round(coveragePct)}%)</strong>} />
            </div>
          )}

          <div className="lw-field">
            <label className="lw-checkbox-label">
              <input 
                type="checkbox" 
                checked={form.consent} 
                onChange={e => { patch("consent", e.target.checked); clearErr("consent"); }}
              />
              <span>I consent to sharing my loan details and financial standing with my selected guarantors and Chama officials as per the **Data Protection Act (2019)**.</span>
            </label>
            {errors.consent && <p className="lw-err-msg"><AlertCircle size={12}/>{errors.consent}</p>}
          </div>

          <div className="lw-consent">
            <Lock size={13} style={{ flexShrink: 0, marginTop: 2 }}/>
            <span>By submitting you authorise officials to review this application and guarantors to be notified. Fraudulent applications may reduce your trust score.</span>
          </div>
        </div>
      );

      default: return null;
    }
  };

  if (loading) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray)" }}>
      <div style={{ textAlign: "center" }}>
        <TrendingUp size={36} className="lw-spin-slowly" style={{ color: "var(--primary)", margin: "0 auto 1rem", display: "block" }}/>
        <p>Loading application…</p>
      </div>
    </div>
  );

  if (memberStanding && memberStanding.equityValue <= 0) return (
    <div className="lw-root">
      <div className="lw-container lw-card lw-card-body lw-text-center">
        <AlertTriangle size={48} className="lw-text-warn" style={{ margin: "0 auto 1rem" }}/>
        <h2 className="lw-step-title">Action Required</h2>
        <p className="lw-step-sub" style={{ marginBottom: "1.5rem" }}>
          Constitutional Requirement: You must have active contributions in <strong>{chama?.chama_name}</strong> to apply for a loan.
        </p>
        <button className="btn btn-primary" onClick={() => navigate(`/chamas/${chamaId}`)}>Back to Chama</button>
      </div>
    </div>
  );

  return (
    <div className="lw-root">
      <div className="lw-container">

        {/* Header */}
        <div className="lw-header">
          <div>
            <button 
              onClick={() => navigate(`/chamas/${chamaId}`)} 
              className="lw-back-link"
            >
              <ChevronLeft size={14}/> Back to {chama?.chama_name}
            </button>
            <h1 className="lw-title"><Star size={18} style={{ color: "#f59e0b" }} fill="#f59e0b"/> Secure Loan</h1>
          </div>
          <span className="lw-step-badge">Step {step} of 4</span>
        </div>

        {/* Progress bar */}
        <div className="lw-progress-steps">
          {[1,2,3,4].map(s => (
            <div key={s} className={`lw-progress-seg ${s <= step ? "lw-progress-seg--on" : ""}`}/>
          ))}
        </div>

        {/* Card */}
        <div className="lw-card">
          <div className="lw-card-body">
            {renderStep()}
          </div>

          {/* Footer nav */}
          <div className="lw-footer">
            {step > 1
              ? <button className="btn btn-outline btn-sm" onClick={prevStep} disabled={submitting}><ChevronLeft size={16}/> Back</button>
              : <button className="btn btn-sm" style={{ background: "none", color: "var(--gray)", border: "1px solid var(--border)" }} onClick={() => navigate(-1)}>Cancel</button>
            }
            {step < 4
              ? <button className="btn btn-primary btn-sm" onClick={nextStep}>Continue <ChevronRight size={16}/></button>
              : (
                <button
                  className="btn btn-sm"
                  style={{ background: submitting ? "#15803d" : "#16a34a", color: "#fff", minWidth: 160, gap: "0.4rem", fontWeight: 700, opacity: submitting ? 0.7 : 1 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <><span className="lw-spinner"/>Processing…</>
                    : <><CheckCircle size={16}/> Submit Application</>
                  }
                </button>
              )
            }
          </div>
        </div>
      </div>

      {/* ── Scoped CSS ── */}
      <style>{`
        /* Root */
        .lw-root{padding:2rem 1rem;min-height:100vh;background:var(--light-gray);}
        .lw-container{width:100%;max-width:580px;margin:0 auto;}

        /* Header */
        .lw-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;}
        .lw-back-link{background:none;border:none;padding:0;font-size:0.75rem;font-weight:700;color:var(--primary);cursor:pointer;display:flex;align-items:center;gap:0.25rem;margin-bottom:0.4rem;}
        .lw-back-link:hover{text-decoration:underline;}
        .lw-eyebrow{font-size:0.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--gray);margin:0 0 .25rem;}
        .lw-title{font-size:1.45rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:.5rem;margin:0;}
        .lw-step-badge{font-size:.72rem;font-weight:700;color:var(--gray);white-space:nowrap;padding:.3rem .75rem;border:1px solid var(--border);border-radius:999px;background:var(--card-bg);}

        /* Step progress */
        .lw-progress-steps{display:flex;gap:.35rem;margin-bottom:1.25rem;}
        .lw-progress-seg{flex:1;height:5px;border-radius:999px;background:var(--border);transition:background .3s;}
        .lw-progress-seg--on{background:var(--primary);}

        /* Card */
        .lw-card{background:var(--card-bg);border:1px solid var(--card-border);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-lg);}
        .lw-card-body{padding:1.75rem 1.5rem;}

        /* Step header */
        .lw-step-header{display:flex;align-items:flex-start;gap:.85rem;margin-bottom:1.25rem;}
        .lw-step-icon{width:46px;height:46px;min-width:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;}
        .lw-icon-amber{background:#fef3c7;color:#d97706;}
        .lw-icon-blue{background:#dbeafe;color:#2563eb;}
        .lw-icon-purple{background:#ede9fe;color:#7c3aed;}
        .lw-icon-green{background:#dcfce7;color:#16a34a;}
        .lw-step-title{margin:0 0 .15rem;font-size:1.05rem;font-weight:800;color:var(--text-primary);}
        .lw-step-sub{margin:0;font-size:.82rem;color:var(--gray);}

        .lw-checkbox-label{display:flex;gap:.75rem;align-items:flex-start;font-size:.8rem;color:var(--text-primary);cursor:pointer;background:var(--surface-2);padding:.85rem;border-radius:10px;border:1.5px solid var(--border);margin-top:1rem;}
        .lw-checkbox-label input{margin-top:.2rem;}
        .lw-checkbox-label span{line-height:1.4;}
        .lw-checkbox-label:hover{border-color:var(--primary);}

        /* Info card */
        .lw-info-card{background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1.25rem;}
        .lw-info-row{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;color:var(--text-primary);margin-bottom:.4rem;}
        .lw-info-row--sub{color:var(--gray);}
        .lw-info-row--main{font-weight:700;font-size:.95rem;padding-top:.6rem;}
        .lw-divider{border:none;border-top:1px dashed var(--border);margin:.5rem 0;}

        /* Progress bar */
        .lw-progress-track{width:100%;height:7px;background:var(--border);border-radius:999px;overflow:hidden;margin:.5rem 0 .25rem;}
        .lw-progress-bar{height:100%;border-radius:999px;transition:width .5s;}
        .lw-mini-track{height:4px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:.3rem;}
        .lw-mini-fill{height:100%;border-radius:999px;transition:width .3s;}

        /* Fields */
        .lw-field{margin-bottom:1rem;}
        .lw-field--err .lw-input,.lw-field--err .lw-textarea{border-color:var(--danger)!important;}
        .lw-label{display:block;font-size:.8rem;font-weight:700;color:var(--text-primary);margin-bottom:.4rem;}
        .lw-err-msg{display:flex;align-items:center;gap:.3rem;color:var(--danger);font-size:.73rem;margin-top:.3rem;}
        .lw-helper{font-size:.72rem;color:var(--gray);margin:0;}
        .lw-char-count{font-size:.68rem;color:var(--gray);text-align:right;margin-top:.2rem;}
        .lw-section-label{font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);margin:0 0 .6rem;}

        /* Inputs */
        .lw-input-wrap{position:relative;display:flex;align-items:center;}
        .lw-input-wrap--sm{flex:1;min-width:100px;}
        .lw-prefix{position:absolute;left:.75rem;font-size:.78rem;font-weight:800;color:var(--gray);pointer-events:none;z-index:1;}
        .lw-input{
          width:100%;
          border:1.5px solid var(--input-border);
          border-radius:10px;
          padding:.65rem .75rem .65rem 3.25rem;
          font-size:.95rem;
          font-weight:600;
          background:var(--input-bg);
          color:var(--input-text);
          outline:none;
          transition:border .2s,box-shadow .2s;
          -webkit-appearance:none;
          appearance:none;
        }
        .lw-input:focus{border-color:var(--primary)!important;box-shadow:0 0 0 3px rgba(37,99,235,.12);}
        .lw-input::placeholder{color:var(--gray-light);font-weight:400;}
        .lw-input--lg{font-size:1.1rem;font-weight:700;padding-top:.75rem;padding-bottom:.75rem;}
        .lw-input--sm{font-size:.85rem;padding:.45rem .5rem .45rem 3rem;}
        .lw-textarea{
          display:block;
          width:100%;
          border:1.5px solid var(--input-border);
          border-radius:10px;
          padding:.65rem .9rem;
          font-size:.88rem;
          background:var(--input-bg);
          color:var(--input-text);
          resize:vertical;
          outline:none;
          transition:border .2s;
          font-family:inherit;
        }
        .lw-textarea:focus{border-color:var(--primary)!important;}
        .lw-textarea::placeholder{color:var(--gray-light);}

        /* Slider */
        .lw-slider{width:100%;-webkit-appearance:none;appearance:none;height:5px;border-radius:999px;background:var(--primary);outline:none;cursor:pointer;margin:.5rem 0 .25rem;}
        .lw-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:3px solid var(--primary);box-shadow:0 1px 6px rgba(0,0,0,.2);cursor:pointer;}
        .lw-slider-labels{display:flex;justify-content:space-between;font-size:.68rem;color:var(--gray);}

        /* Loan type cards */
        .lw-type-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.65rem;margin-bottom:1.25rem;}
        @media(min-width:420px){.lw-type-grid{grid-template-columns:repeat(3,1fr);}}
        .lw-type-card{padding:.75rem .6rem;border:1.5px solid var(--border);border-radius:12px;text-align:center;cursor:pointer;background:var(--card-bg);transition:all .2s;color:var(--text-primary);}
        .lw-type-card:hover{border-color:var(--primary);}
        .lw-type-card--active{box-shadow:0 0 0 3px rgba(37,99,235,.12);}
        .lw-type-rate{font-size:1.3rem;font-weight:900;}
        .lw-type-name{font-size:.72rem;font-weight:700;margin:.1rem 0;color:var(--text-primary);}
        .lw-type-desc{font-size:.62rem;color:var(--gray);line-height:1.3;}

        /* Amort card */
        .lw-amort-card{background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:1rem;margin-top:1rem;}
        .lw-amort-row{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;color:var(--text-primary);padding:.2rem 0;gap:.5rem;}
        .lw-amort-row--total{font-weight:800;font-size:.95rem;margin-top:.3rem;}
        .lw-amort-row--monthly{font-size:.82rem;margin-top:.2rem;}
        .lw-amort-divider{border:none;border-top:1px dashed var(--border);margin:.35rem 0;}

        /* Guarantors */
        .lw-callout{display:flex;gap:.65rem;background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;padding:.85rem;font-size:.78rem;color:#92400e;margin-bottom:1rem;}
        [data-theme='dark'] .lw-callout{background:rgba(251,191,36,.08);color:#fcd34d;border-color:rgba(251,191,36,.3);}
        .lw-list{padding-left:1.1rem;margin:.3rem 0 0;color:inherit;}
        .lw-list li{margin-bottom:.15rem;}
        .lw-search-wrap{position:relative;margin-bottom:.85rem;}
        .lw-search-icon{position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:var(--gray);pointer-events:none;}
        .lw-search{
          width:100%;
          border:1.5px solid var(--input-border);
          border-radius:10px;
          padding:.65rem .75rem .65rem 2.5rem;
          font-size:.9rem;
          background:var(--input-bg);
          color:var(--input-text);
          outline:none;
          transition:border .2s;
        }
        .lw-search:focus{border-color:var(--primary);}
        .lw-search::placeholder{color:var(--gray-light);}
        .lw-dropdown{position:absolute;top:calc(100% + .35rem);left:0;right:0;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-xl);z-index:100;max-height:220px;overflow-y:auto;}
        .lw-dropdown-item{display:flex;justify-content:space-between;align-items:center;width:100%;padding:.65rem 1rem;cursor:pointer;border:none;background:none;text-align:left;color:var(--text-primary);transition:background .15s;}
        .lw-dropdown-item:hover{background:var(--surface-2);}
        .lw-dropdown-name{font-weight:600;font-size:.85rem;color:var(--text-primary);}
        .lw-dropdown-sub{font-size:.72rem;color:var(--gray);margin-top:.1rem;}
        .lw-guarantors{display:flex;flex-direction:column;gap:.6rem;margin-bottom:.85rem;}
        .lw-guarantor-row{background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:.85rem;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.6rem;}
        .lw-guarantor-meta{flex:1;min-width:0;}
        .lw-guarantor-name{font-weight:700;font-size:.85rem;color:var(--text-primary);}
        .lw-guarantor-sub{font-size:.7rem;color:var(--gray);margin-top:.1rem;}
        .lw-guarantor-controls{display:flex;align-items:center;gap:.4rem;}
        .lw-remove-btn{font-size:1rem;font-weight:700;padding:.25rem .5rem;border:1px solid var(--border);border-radius:6px;background:none;color:var(--danger);cursor:pointer;}
        .lw-warn-inline{display:flex;align-items:center;gap:.2rem;font-size:.68rem;color:var(--warning);margin-top:.2rem;}
        .lw-coverage-card{background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:1rem;}
        .lw-coverage-header{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;font-weight:600;color:var(--text-primary);margin-bottom:.5rem;}

        /* Security notes */
        .lw-security-note{display:flex;align-items:flex-start;gap:.45rem;font-size:.72rem;color:var(--gray);background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:.55rem .75rem;margin-top:.75rem;}
        .lw-consent{display:flex;align-items:flex-start;gap:.5rem;font-size:.73rem;color:var(--gray);background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:.75rem;margin-top:.85rem;}
        [data-theme='dark'] .lw-consent{background:rgba(249,115,22,.08);border-color:rgba(249,115,22,.2);}

        /* Review card */
        .lw-review-card{background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:.9rem 1rem;margin-bottom:.75rem;}
        .lw-review-row{display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;font-size:.83rem;color:var(--text-primary);padding:.3rem 0;border-bottom:1px solid var(--border);}
        .lw-review-row:last-child{border:none;}
        .lw-review-label{color:var(--gray);font-size:.75rem;flex-shrink:0;}
        .lw-review-value{font-weight:600;text-align:right;}

        /* Footer */
        .lw-footer{display:flex;justify-content:space-between;align-items:center;padding:.9rem 1.5rem;border-top:1px solid var(--border);background:var(--surface-2);}

        /* Colours */
        .lw-text-green{color:#22c55e;}
        .lw-text-warn{color:#f59e0b;}

        /* Spinner */
        .lw-spinner{display:inline-block;width:13px;height:13px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:lwSpin .7s linear infinite;}
        @keyframes lwSpin{to{transform:rotate(360deg)}}

        /* Mobile */
        @media(max-width:480px){
          .lw-card-body{padding:1.25rem 1rem;}
          .lw-footer{padding:.75rem 1rem;}
          .lw-title{font-size:1.15rem;}
        }
      `}</style>
    </div>
  );
}

/* Sub-components */
function StepHeader({ icon, colorClass, title, sub }) {
  return (
    <div className="lw-step-header">
      <div className={`lw-step-icon ${colorClass}`}>{icon}</div>
      <div><h2 className="lw-step-title">{title}</h2><p className="lw-step-sub">{sub}</p></div>
    </div>
  );
}

function Row({ label, val }) {
  return (
    <div className="lw-review-row">
      <span className="lw-review-label">{label}</span>
      <span className="lw-review-value">{val}</span>
    </div>
  );
}
