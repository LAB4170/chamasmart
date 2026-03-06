import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI, chamaAPI, ascaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import {
  ChevronRight, ChevronLeft, DollarSign,
  Users, Calendar, CheckCircle, AlertCircle, Search,
  Star, Shield, Lock, AlertTriangle, Clock, TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─────────────────────────────────────────────────────────────────────────────
   LOAN APPLICATION WIZARD  — Phase 13.5
   Uses the app's real CSS variable system (--card-bg, --text-primary,
   --input-bg, --border, --primary, etc.) so light/dark mode works correctly.
───────────────────────────────────────────────────────────────────────────── */

// Categories for classification/reporting only — interest rate is set by officials
const LOAN_CATEGORIES = [
  { value: "EMERGENCY",   label: "Emergency",   icon: "🚨", color: "#ef4444", desc: "Urgent crisis" },
  { value: "SCHOOL_FEES", label: "School Fees",  icon: "🎓", color: "#3b82f6", desc: "Education" },
  { value: "DEVELOPMENT", label: "Development",  icon: "🌱", color: "#8b5cf6", desc: "Personal growth" },
  { value: "BUSINESS",    label: "Business",     icon: "💼", color: "#f59e0b", desc: "Entrepreneurial" },
  { value: "MEDICAL",     label: "Medical",      icon: "🏥", color: "#10b981", desc: "Healthcare" },
];

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
  const [loanConfig,     setLoanConfig]     = useState({
    interest_rate: 10,
    interest_type: 'FLAT',
    loan_multiplier: 3,
    max_repayment_months: 12,
  });

  const [form, setForm] = useState({
    amount: "", type: "DEVELOPMENT", purpose: "", repaymentPeriod: 6, guarantors: [],
    consent: false,
  });


  /* ── Init ── */
  useEffect(() => {
    (async () => {
      try {
        const [chamaRes, membersRes, configRes] = await Promise.all([
          chamaAPI.getById(chamaId),
          chamaAPI.getMembers(chamaId),
          loanAPI.getConfig(chamaId).catch(() => ({ data: { data: null } })),
        ]);

        const chamaData = chamaRes.data.data;
        const membersData = membersRes.data.data || [];
        const u = JSON.parse(localStorage.getItem("user") || "{}");
        const myUserId = u?.user_id || u?.id || u?.userId;
        const me = membersData.find(m => m.user_id === myUserId);

        // Load official loan config
        if (configRes.data.data) {
          setLoanConfig(prev => ({ ...prev, ...configRes.data.data }));
        }

        const officialMultiplier = configRes.data.data?.loan_multiplier || 3;
        let standing;

        if (chamaData?.chama_type === 'ASCA') {
          // Only call the ASCA-specific API for ASCA chamas
          const standingRes = await ascaAPI.getMemberStanding(chamaId).catch(() => ({ data: { data: null } }));
          standing = standingRes.data.data;
        }

        if (!standing) {
          // For TABLE_BANKING and all non-ASCA types, use member's total_contributions
          const contributions = parseFloat(me?.total_contributions || 0);
          standing = {
            equityValue: contributions,
            loanLimit: contributions * officialMultiplier,
            outstandingDebt: 0,
            availableCredit: contributions * officialMultiplier,
            hasActiveCycle: true,
          };
        }

        setChama(chamaData);
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
  // Official interest rate — NOT selectable by member
  const officialRate     = loanConfig.interest_rate || 10;
  const maxMonths        = loanConfig.max_repayment_months || 12;
  const selectedCategory = LOAN_CATEGORIES.find(c => c.value === form.type) || LOAN_CATEGORIES[2];

  const amort = useMemo(() => {
    const prin     = parseFloat(form.amount) || 0;
    const rate     = officialRate || 0;
    const months   = parseInt(form.repaymentPeriod) || 1;
    
    // Match backend LoanCalculator.calculateFlatInterest
    // (principal * interestRate * termMonths) / 1200
    const interest = Math.round((prin * rate * months) / 1200);
    const total    = prin + interest;
    const monthly  = months > 0 ? total / months : 0;
    return { prin, interest, total, monthly };
  }, [form.amount, officialRate, form.repaymentPeriod]);

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
      if (!form.purpose.trim())          errs.purpose = "Describe clearly how you will use this loan";
      if (form.repaymentPeriod < 1 || form.repaymentPeriod > maxMonths)
        errs.repaymentPeriod = `1 – ${maxMonths} months only (officials' maximum)`;
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
        guarantors: form.guarantors.map(g => ({ userId: g.guarantorId, amount: parseFloat(g.amount) })),
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
          <StepHeader icon={<Calendar size={20}/>} colorClass="lw-icon-blue" title="Loan Terms" sub="Your interest rate is set by the chama officials." />

          {/* Official Interest Rate Banner */}
          <div className="lw-rate-banner">
            <div className="lw-rate-banner-left">
              <Lock size={16} className="lw-rate-lock-icon" />
              <div>
                <div className="lw-rate-label">Official Interest Rate</div>
                <div className="lw-rate-sub">{loanConfig.interest_type === 'REDUCING_BALANCE' ? 'Reducing Balance' : 'Flat Rate'} · Set by chama officials</div>
              </div>
            </div>
            <div className="lw-rate-value">{officialRate}%</div>
          </div>

          {/* Loan Category Chips (for classification only, no rates) */}
          <div className="lw-field">
            <label className="lw-label">Loan Category <span className="lw-label-hint">(For reporting purposes only)</span></label>
            <div className="lw-category-chips">
              {LOAN_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => patch("type", cat.value)}
                  className={`lw-category-chip ${form.type === cat.value ? "lw-category-chip--active" : ""}`}
                  style={form.type === cat.value ? {
                    borderColor: cat.color,
                    background: `${cat.color}18`,
                    color: cat.color,
                  } : {}}
                >
                  <span className="lw-chip-icon">{cat.icon}</span>
                  <span className="lw-chip-label">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Repayment Period Slider */}
          <div className={`lw-field ${errors.repaymentPeriod ? "lw-field--err" : ""}`}>
            <label className="lw-label">Repayment Period: <strong>{form.repaymentPeriod} month{form.repaymentPeriod > 1 ? "s" : ""}</strong></label>
            <input
              type="range" min="1" max={maxMonths} step="1"
              className="lw-slider"
              value={Math.min(form.repaymentPeriod, maxMonths)}
              onChange={e => { patch("repaymentPeriod", parseInt(e.target.value)); clearErr("repaymentPeriod"); }}
            />
            <div className="lw-slider-labels"><span>1 mo</span><span>{maxMonths} mo (max)</span></div>
            {errors.repaymentPeriod && <p className="lw-err-msg"><AlertCircle size={12}/>Max repayment is {maxMonths} months as set by officials</p>}
          </div>

          {/* Purpose of Loan — redesigned, large textarea */}
          <div className={`lw-field ${errors.purpose ? "lw-field--err" : ""}`}>
            <label className="lw-label">
              Purpose of Loan <span className="lw-required">*</span>
            </label>
            <p className="lw-field-hint">Be specific — officials will review this before approval. Vague applications may be rejected.</p>
            <textarea
              className="lw-textarea lw-textarea--lg"
              rows={6}
              maxLength={500}
              value={form.purpose}
              onChange={e => { patch("purpose", e.target.value); clearErr("purpose"); }}
              placeholder={`e.g. "I will use this ${fmt(amort.prin)} loan to purchase 3 bags of fertiliser and 50kg of maize seed for my ½-acre farm on Nakuru Road. Expected harvest in 3 months will cover repayments."`}
            />
            <div className="lw-char-count" style={{ color: form.purpose.length > 400 ? '#f59e0b' : undefined }}>
              {form.purpose.length} / 500 characters
            </div>
            {errors.purpose && <p className="lw-err-msg"><AlertCircle size={12}/>{errors.purpose}</p>}
          </div>

          {/* Amortisation summary */}
          <div className="lw-amort-card">
            <div className="lw-amort-row"><span>Principal</span><span>{fmt(amort.prin)}</span></div>
            <div className="lw-amort-row"><span>Interest ({officialRate}% {loanConfig.interest_type === 'REDUCING_BALANCE' ? 'reducing' : 'flat'})</span><span className="lw-text-warn">+ {fmt(amort.interest)}</span></div>
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
            <Row label="Type"              val={selectedCategory.label} />
            <Row label="Interest"          val={`${officialRate}%`} />
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
    <div className="min-h-[85vh] w-full flex flex-col items-center justify-center p-6 bg-slate-50/50 dark:bg-transparent">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white dark:border-slate-800 rounded-[3rem] p-10 shadow-2xl shadow-slate-200/50 dark:shadow-none text-center relative overflow-hidden">
          {/* Decorative background glow */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50" />
          
          <div className="flex justify-center mb-8">
             <div className="relative">
               <motion.div 
                 animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
                 transition={{ duration: 3, repeat: Infinity }}
                 className="absolute inset-0 bg-amber-500 rounded-full blur-2xl"
               />
               <div className="relative w-24 h-24 bg-amber-50 dark:bg-amber-950/30 rounded-full flex items-center justify-center border border-amber-100 dark:border-amber-900/50">
                 <AlertTriangle size={48} className="text-amber-500" strokeWidth={2.5} />
               </div>
             </div>
          </div>
          
          <h2 className="text-3xl font-[900] text-slate-900 dark:text-white mb-4 tracking-tight leading-tight">
            Verification Required
          </h2>
          
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed mb-10 px-4">
            To maintain Chama integrity, you must have active contributions in <span className="text-slate-900 dark:text-white font-bold">{chama?.chama_name || 'this group'}</span> to apply for credit.
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
            <button 
              onClick={() => navigate(`/chamas/${chamaId}`)}
              className="lw-back-link"
              style={{ fontSize: '1rem', padding: '0.75rem 2rem', background: 'var(--primary)', color: '#fff', borderRadius: '999px', border: 'none', fontWeight: 700, boxShadow: 'var(--shadow-md)', transition: 'all 0.25s', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ChevronLeft size={18} />
              Return to Chama
            </button>
          </div>
        </div>
        
        <p className="mt-8 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
          Security Protocol v2.4
        </p>
      </motion.div>
    </div>
  );

  return (
    <div className="lw-root">
      <div className="lw-container">

        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lw-header"
        >
          <div>
            <button 
              onClick={() => navigate(`/chamas/${chamaId}`)} 
              className="lw-back-link"
            >
              <ChevronLeft size={16}/> Back to {chama?.chama_name}
            </button>
            <h1 className="lw-title"><Star size={24} style={{ color: "#f59e0b" }} fill="#f59e0b"/> Secure Loan</h1>
          </div>
          <span className="lw-step-badge">Phase {step} of 4</span>
        </motion.div>

        {/* Progress bar */}
        <div className="lw-progress-steps">
          {[1,2,3,4].map(s => (
            <div key={s} className={`lw-progress-seg ${s <= step ? "lw-progress-seg--on" : ""}`}/>
          ))}
        </div>

        {/* Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lw-card"
        >
          <div className="lw-card-body">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer nav */}
          <div className="lw-footer">
            {step > 1
              ? <button className="btn btn-outline btn-sm" onClick={prevStep} disabled={submitting}><ChevronLeft size={18}/> Previous</button>
              : <button className="btn btn-sm btn-outline" style={{ opacity: 0.6 }} onClick={() => navigate(-1)}>Cancel</button>
            }
            {step < 4
              ? <button className="btn btn-primary btn-sm" onClick={nextStep}>Continue <ChevronRight size={18}/></button>
              : (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ background: submitting ? "var(--success-dark)" : "var(--success)", minWidth: 180 }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting
                    ? <><span className="lw-spinner"/>Submitting…</>
                    : <><CheckCircle size={18}/> Confirm Application</>
                  }
                </button>
              )
            }
          </div>
        </motion.div>
      </div>

      {/* ── Scoped CSS ── */}
      <style>{`
        /* Root */
        .lw-root{padding:2rem 1rem;min-height:100vh;background:var(--bg-page-gradient);background-attachment:fixed;transition: background 0.3s ease; display: flex; flex-direction: column;}
        .lw-root--centered-page{justify-content: center; align-items: center;}
        .lw-container{width:100%;max-width:640px;margin:0 auto; padding: 0 1rem;}
        .lw-container--guard{max-width: 480px;}
        .lw-text-center{text-align: center; justify-content: center;}
        
        /* Guard Specific */
        .lw-guard-card{padding: 4rem 2.5rem; text-align: center; display: flex; flex-direction: column; align-items: center;}
        .lw-guard-illustration{margin-bottom: 2rem; position: relative;}
        .lw-guard-icon-wrapper{position: relative; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;}
        .lw-guard-icon-bg{color: var(--warning); opacity: 0.1; position: absolute;}
        .lw-guard-icon-fg{color: var(--warning); position: relative; z-index: 10; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.3));}
        .lw-guard-title{font-size: 2.25rem; font-weight: 900; color: var(--text-primary); margin-bottom: 1rem; letter-spacing: -0.04em;}
        .lw-guard-text{font-size: 1.05rem; color: var(--gray); line-height: 1.6; max-width: 320px; margin: 0 auto 2.5rem; font-weight: 500;}
        .lw-guard-btn{
          background: var(--success);
          color: white;
          border: none;
          padding: 1.1rem 2.5rem;
          border-radius: 18px;
          font-weight: 900;
          font-size: 1.1rem;
          letter-spacing: -0.01em;
          box-shadow: 0 12px 24px rgba(34, 197, 94, 0.25);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          cursor: pointer;
        }
        .lw-guard-btn:hover{transform: translateY(-5px) scale(1.05); box-shadow: 0 20px 32px rgba(34, 197, 94, 0.35); background: #16a34a;}
        .lw-guard-btn:active{transform: scale(0.95);}

        /* Header */
        .lw-header{display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;margin-bottom:1.5rem;padding: 0 0.5rem;}
        .lw-back-link{background:none;border:none;padding:0;font-size:0.85rem;font-weight:600;color:var(--primary);cursor:pointer;display:flex;align-items:center;gap:0.4rem;margin-bottom:0.5rem;transition: opacity 0.2s;}
        .lw-back-link:hover{opacity: 0.8;}
        .lw-title{font-size:1.75rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.75rem;margin:0;letter-spacing: -0.02em;}
        .lw-step-badge{font-size:.75rem;font-weight:700;color:var(--gray);background:var(--bg-surface-glass);backdrop-filter: var(--glass-blur);padding:.4rem 1rem;border:1px solid var(--border);border-radius:999px;box-shadow: var(--shadow-sm);}

        /* Step progress */
        .lw-progress-steps{display:flex;gap:.5rem;margin-bottom:2rem;padding: 0 0.5rem;}
        .lw-progress-seg{flex:1;height:6px;border-radius:999px;background:var(--border);transition:all .4s cubic-bezier(0.4, 0, 0.2, 1);box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);}
        .lw-progress-seg--on{background:var(--primary);box-shadow: 0 0 10px rgba(37, 99, 235, 0.3);}

        /* Card Modernisation */
        .lw-card{background:var(--bg-surface-glass);backdrop-filter: blur(12px);border:1px solid var(--border);border-radius:24px;overflow:hidden;box-shadow:var(--shadow-xl);transition: all 0.3s ease;}
        .lw-card--glass{background:var(--bg-surface-glass);}
        .lw-card-body{padding:2.5rem 2rem;}

        /* Step header */
        .lw-step-header{display:flex;align-items:center;gap:1.25rem;margin-bottom:2rem;}
        .lw-step-icon{width:56px;height:56px;min-width:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow: var(--shadow-md);}
        .lw-icon-amber{background:rgba(245, 158, 11, 0.15);color:#d97706;}
        .lw-icon-blue{background:rgba(37, 99, 235, 0.15);color:#2563eb;}
        .lw-icon-purple{background:rgba(124, 58, 237, 0.15);color:#7c3aed;}
        .lw-icon-green{background:rgba(22, 163, 74, 0.15);color:#16a34a;}
        .lw-step-title{margin:0 0 .25rem;font-size:1.35rem;font-weight:800;color:var(--text-primary);letter-spacing: -0.01em;}
        .lw-step-sub{margin:0;font-size:.9rem;color:var(--gray);line-height:1.5;}

        .lw-checkbox-label{display:flex;gap:1rem;align-items:flex-start;font-size:.9rem;color:var(--text-primary);cursor:pointer;background:var(--surface-2);padding:1.25rem;border-radius:16px;border:1.5px solid var(--border);margin-top:1.5rem;transition: all 0.2s;}
        .lw-checkbox-label input{margin-top:.3rem;width: 18px; height: 18px;}
        .lw-checkbox-label:hover{border-color:var(--primary);background: var(--bg-surface);}

        /* Info card */
        .lw-info-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:1.5rem;margin-bottom:2rem;box-shadow: var(--shadow-sm);}
        .lw-info-row{display:flex;justify-content:space-between;align-items:center;font-size:.9rem;color:var(--text-primary);margin-bottom:.6rem;}
        .lw-info-row--sub{color:var(--gray);}
        .lw-info-row--main{font-weight:800;font-size:1.1rem;padding-top:.75rem;border-top: 1px solid var(--border);margin-top: 0.5rem;}
        .lw-divider{border:none;border-top:1px dashed var(--border);margin:.75rem 0;}

        /* Progress bars */
        .lw-progress-track{width:100%;height:10px;background:var(--border);border-radius:999px;overflow:hidden;margin:.75rem 0 .5rem;}
        .lw-progress-bar{height:100%;border-radius:999px;transition:width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);}
        .lw-mini-track{height:6px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:.5rem;}
        .lw-mini-fill{height:100%;border-radius:999px;transition:width 0.5s ease;}

        /* Fields */
        .lw-field{margin-bottom:1.5rem;}
        .lw-label{display:block;font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:.6rem;text-transform: uppercase; letter-spacing: 0.05em;}

        /* Inputs Modernisation */
        .lw-input-wrap{position:relative;display:flex;align-items:center;transition: transform 0.2s;}
        .lw-input-wrap:focus-within{transform: scale(1.01);}
        .lw-input{
          width:100%;
          border:2px solid var(--border);
          border-radius:14px;
          padding:.85rem 1rem .85rem 3.5rem;
          font-size:1.1rem;
          font-weight:700;
          background:var(--bg-surface);
          color:var(--text-primary);
          outline:none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lw-input:focus{border-color:var(--primary);box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);}
        .lw-prefix{position:absolute;left:1.25rem;font-size:0.9rem;font-weight:800;color:var(--gray);opacity: 0.7;}
        .lw-input--lg{font-size:1.5rem;padding: 1.1rem 1.25rem 1.1rem 3.75rem;}

        /* Slider */
        .lw-slider{width:100%;-webkit-appearance:none;height:8px;border-radius:999px;background:var(--border);outline:none;cursor:pointer;margin:1rem 0;}
        .lw-slider::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;border-radius:50%;background:#fff;border:4px solid var(--primary);box-shadow:var(--shadow-md);cursor:pointer;transition: transform 0.2s;}
        .lw-slider::-webkit-slider-thumb:hover{transform: scale(1.15);}

        /* Official Rate Banner */
        .lw-rate-banner{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(37,99,235,0.1) 0%,rgba(37,99,235,0.04) 100%);border:1.5px solid rgba(37,99,235,0.25);border-radius:20px;padding:1.25rem 1.5rem;margin-bottom:2rem;}
        .lw-rate-banner-left{display:flex;align-items:center;gap:1rem;}
        .lw-rate-lock-icon{color:var(--primary);opacity:0.8;flex-shrink:0;}
        .lw-rate-label{font-size:0.9rem;font-weight:800;color:var(--text-primary);margin-bottom:0.15rem;letter-spacing:-0.01em;}
        .lw-rate-sub{font-size:0.78rem;color:var(--gray);font-weight:600;}
        .lw-rate-value{font-size:2.75rem;font-weight:900;color:var(--primary);letter-spacing:-0.04em;line-height:1;}

        /* Loan Category Chips */
        .lw-category-chips{display:flex;flex-wrap:wrap;gap:0.75rem;margin-top:0.25rem;}
        .lw-category-chip{display:flex;align-items:center;gap:0.5rem;padding:0.6rem 1.1rem;border:2px solid var(--border);border-radius:999px;background:var(--bg-surface);color:var(--gray);font-size:0.9rem;font-weight:700;cursor:pointer;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);}
        .lw-category-chip:hover{border-color:var(--primary);color:var(--primary);transform:translateY(-2px);box-shadow:var(--shadow-md);}
        .lw-category-chip--active{font-weight:800;transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.1);}
        .lw-chip-icon{font-size:1.1rem;line-height:1;}
        .lw-chip-label{line-height:1;}
        .lw-label-hint{font-weight:500;color:var(--gray);text-transform:none;letter-spacing:normal;font-size:0.78rem;}
        .lw-required{color:var(--danger);}
        .lw-field-hint{font-size:0.83rem;color:var(--gray);margin:0 0 0.75rem;line-height:1.5;}

        /* Textarea variants */
        .lw-textarea{width:100%;border:2px solid var(--border);border-radius:14px;padding:1rem;font-size:0.95rem;font-weight:500;background:var(--bg-surface);color:var(--text-primary);resize:vertical;outline:none;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);line-height:1.6;font-family:inherit;}
        .lw-textarea:focus{border-color:var(--primary);box-shadow:0 0 0 4px rgba(37,99,235,0.12);}
        .lw-textarea--lg{min-height:160px;font-size:1rem;}
        .lw-char-count{text-align:right;font-size:0.78rem;color:var(--gray);margin-top:0.4rem;font-weight:600;}

        /* Amort card */
        .lw-amort-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:1.5rem;margin-top:1.5rem;box-shadow: var(--shadow-sm);}
        .lw-amort-row{display:flex;justify-content:space-between;align-items:center;font-size:1rem;color:var(--text-primary);padding:.5rem 0;}
        .lw-amort-row--total{font-weight:900;font-size:1.25rem;margin-top:.75rem;padding-top: 0.75rem; border-top: 2px solid var(--border);}

        /* Illustration area for guard */
        .lw-guard-illustration{height: 120px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem;}

        /* Footer */
        .lw-footer{display:flex;justify-content:space-between;align-items:center;padding:1.5rem 2rem;border-top:1px solid var(--border);background:var(--bg-surface-glass);backdrop-filter: blur(8px);}
        .btn-sm{padding: 0.75rem 1.5rem; font-size: 0.95rem; font-weight: 700; border-radius: 12px;}

        /* Animations */
        /* Guarantors & Search */
        .lw-callout{display:flex;gap:.75rem;background:rgba(245, 158, 11, 0.08);border:1px solid rgba(245, 158, 11, 0.2);border-radius:16px;padding:1.25rem;font-size:0.85rem;color:var(--text-primary);margin-bottom:1.5rem;}
        .lw-list{padding-left:1.25rem;margin:.5rem 0 0;color:var(--gray);}
        .lw-list li{margin-bottom:.25rem;}
        
        .lw-search-wrap{position:relative;margin-bottom:1.25rem;}
        .lw-search-icon{position:absolute;left:1.1rem;top:50%;transform:translateY(-50%);color:var(--gray);opacity:0.6;}
        .lw-search{
          width:100%;
          border:2px solid var(--border);
          border-radius:14px;
          padding:.85rem 1rem .85rem 2.75rem;
          font-size:.95rem;
          background:var(--bg-surface);
          color:var(--text-primary);
          outline:none;
          transition:all 0.2s ease;
        }
        .lw-search:focus{border-color:var(--primary);box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);}
        
        .lw-dropdown{position:absolute;top:calc(100% + .5rem);left:0;right:0;background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-xl);z-index:100;max-height:280px;overflow-y:auto;backdrop-filter: blur(12px);}
        .lw-dropdown-item{display:flex;justify-content:space-between;align-items:center;width:100%;padding:1rem 1.25rem;cursor:pointer;border:none;background:none;text-align:left;color:var(--text-primary);transition:background 0.2s;}
        .lw-dropdown-item:hover{background:var(--bg-page);}
        .lw-dropdown-name{font-weight:700;font-size:.95rem;}
        .lw-dropdown-sub{font-size:.78rem;color:var(--gray);margin-top:.15rem;}
        
        .lw-guarantors{display:flex;flex-direction:column;gap:.75rem;margin-bottom:1.5rem;}
        .lw-guarantor-row{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;padding:1.25rem;display:flex;justify-content:space-between;align-items:center;transition: transform 0.2s;}
        .lw-guarantor-row:hover{transform: scale(1.01);}
        .lw-guarantor-meta{flex:1;min-width:0;}
        .lw-guarantor-name{font-weight:700;font-size:1rem;}
        .lw-guarantor-sub{font-size:.8rem;color:var(--gray);margin-top:.2rem;}
        .lw-guarantor-controls{display:flex;align-items:center;gap:.75rem;}
        .lw-remove-btn{width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; border: 1.5px solid var(--border); border-radius: 10px; background: none; color: var(--danger); cursor: pointer; transition: all 0.2s;}
        .lw-remove-btn:hover{background: rgba(239, 68, 68, 0.1); border-color: var(--danger);}
        
        .lw-coverage-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:1.5rem;box-shadow: var(--shadow-sm);}
        .lw-coverage-header{display:flex;justify-content:space-between;align-items:center;font-size:1rem;font-weight:700;margin-bottom:.75rem;}

        /* Security & Review */
        .lw-security-note{display:flex;align-items:center;gap:.6rem;font-size:.8rem;color:var(--gray);background:var(--bg-page);border:1px solid var(--border);border-radius:12px;padding:.75rem 1rem;margin-top:1.25rem;}
        .lw-consent{display:flex;align-items:flex-start;gap:.75rem;font-size:.85rem;color:var(--gray);background:rgba(249, 115, 22, 0.05);border:1px solid rgba(249, 115, 22, 0.15);border-radius:16px;padding:1.25rem;margin-top:1.5rem;}
        
        .lw-review-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:1.25rem 1.5rem;margin-bottom:1.25rem;box-shadow: var(--shadow-sm);}
        .lw-review-row{display:flex;justify-content:space-between;align-items:center;padding:.85rem 0;border-bottom:1px solid var(--border);}
        .lw-review-row:last-child{border:none;}
        .lw-review-label{color:var(--gray);font-size:.9rem;font-weight:500;}
        .lw-review-value{font-weight:700;text-align:right;}

        @keyframes lwSpin{to{transform:rotate(360deg)}}
        .lw-spin-slowly{animation: lwSpin 8s linear infinite;}

        @media(max-width:480px){
          .lw-card-body{padding:1.5rem 1.25rem;}
          .lw-footer{padding:1rem 1.25rem;}
          .lw-title{font-size:1.4rem;}
          .lw-type-grid{grid-template-columns: 1fr;}
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
