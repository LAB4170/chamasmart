import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI } from "../../../services/api";
import { toast } from "react-toastify";
import {
  ArrowLeft, Save, CreditCard, Lock, Percent,
  TrendingUp, Clock, CheckSquare, Square, Zap, Info
} from "lucide-react";
import "../core/ChamaDetailsLux.css";

const LOAN_CATEGORIES = [
  { value: "EMERGENCY",   label: "Emergency",  icon: Zap,        color: "#ef4444", bg: "rgba(239,68,68,0.1)"    },
  { value: "SCHOOL_FEES", label: "School Fees",icon: Lock,       color: "#3b82f6", bg: "rgba(59,130,246,0.1)"   },
  { value: "DEVELOPMENT", label: "Development",icon: TrendingUp, color: "#10b981", bg: "rgba(16,185,129,0.1)"   },
  { value: "BUSINESS",    label: "Business",   icon: CreditCard, color: "var(--lux-gold)", bg: "rgba(212,175,55,0.1)" },
  { value: "MEDICAL",     label: "Medical",    icon: Info,       color: "#a78bfa", bg: "rgba(167,139,250,0.1)"  },
];

export default function LoanConfigPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({
    interest_rate: 10,
    interest_type: "FLAT",
    loan_multiplier: 3,
    max_repayment_months: 12,
    allowed_categories: ["EMERGENCY", "SCHOOL_FEES", "DEVELOPMENT", "BUSINESS", "MEDICAL"],
  });

  useEffect(() => {
    loanAPI.getConfig(id)
      .then(r => {
        if (r.data.data) setConfig(prev => ({ ...prev, ...r.data.data }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await loanAPI.updateConfig(id, config);
      toast.success("Loan configuration updated! Members will see the new terms immediately.");
      navigate(`/chamas/${id}`, { state: { tab: "management" } });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update loan configuration");
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (value) => {
    setConfig(prev => ({
      ...prev,
      allowed_categories: prev.allowed_categories.includes(value)
        ? prev.allowed_categories.filter(c => c !== value)
        : [...prev.allowed_categories, value],
    }));
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"60vh", color:"var(--lux-text-secondary)" }}>
      <CreditCard size={32} style={{ marginRight:"1rem", color:"var(--lux-gold)" }} />
      Loading loan configuration…
    </div>
  );

  const monthlyInterest = config.interest_type === "FLAT"
    ? config.interest_rate
    : (config.interest_rate / config.max_repayment_months).toFixed(2);

  return (
    <div className="manage-page-root">
      <div className="container" style={{ maxWidth: "860px" }}>

        {/* ── HERO BAND ── */}
        <div className="manage-hero-band" style={{ marginBottom: "2rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"1.25rem", flex:1 }}>
            <div className="manage-hero-icon">
              <CreditCard size={26} />
            </div>
            <div>
              <h1>Loan Configuration</h1>
              <p>Set the terms that govern all member loans in this chama</p>
            </div>
          </div>
          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button
              className="btn-return-lux"
              onClick={() => navigate(`/chamas/${id}`, { state:{ tab:"management" } })}
            >
              <ArrowLeft size={15} /> Back
            </button>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* ── INTEREST SETTINGS ── */}
          <div className="msec" style={{ marginBottom:"1.5rem" }}>
            <div className="msec-header">
              <div className="msec-icon" style={{ background:"rgba(212,175,55,0.12)", border:"1px solid rgba(212,175,55,0.2)", color:"var(--lux-gold)" }}>
                <Percent size={20} />
              </div>
              <div>
                <p className="msec-title">Interest Settings</p>
                <p className="msec-sub">Applied uniformly to all loan types — members cannot override this</p>
              </div>
            </div>
            <div className="msec-body">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>

                {/* Interest Rate */}
                <div>
                  <label className="mlabel" style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                    <Lock size={12} /> Interest Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0" max="100" step="0.5"
                    className="minput"
                    value={config.interest_rate}
                    onChange={e => setConfig(p => ({ ...p, interest_rate: parseFloat(e.target.value) || 0 }))}
                  />
                  <small style={{ color:"var(--lux-text-secondary)", fontSize:"0.72rem", marginTop:"4px", display:"block" }}>
                    Rate applied to ALL approved loans equally.
                  </small>
                </div>

                {/* Interest Type */}
                <div>
                  <label className="mlabel">Interest Type</label>
                  <select
                    className="minput"
                    value={config.interest_type}
                    onChange={e => setConfig(p => ({ ...p, interest_type: e.target.value }))}
                  >
                    <option value="FLAT">Flat Rate (applied once at disbursement)</option>
                    <option value="REDUCING_BALANCE">Reducing Balance (monthly on outstanding)</option>
                  </select>
                  <small style={{ color:"var(--lux-text-secondary)", fontSize:"0.72rem", marginTop:"4px", display:"block" }}>
                    {config.interest_type === "FLAT"
                      ? "Simple: total interest = principal × rate."
                      : "Interest reduces as member pays down the principal."}
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* ── LOAN LIMITS ── */}
          <div className="msec" style={{ marginBottom:"1.5rem" }}>
            <div className="msec-header">
              <div className="msec-icon" style={{ background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.2)", color:"#3b82f6" }}>
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="msec-title">Loan Limits & Repayment</p>
                <p className="msec-sub">Control how much members can borrow and how long to repay</p>
              </div>
            </div>
            <div className="msec-body">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>

                {/* Multiplier */}
                <div>
                  <label className="mlabel" style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                    <TrendingUp size={12} /> Loan Multiplier (× savings)
                  </label>
                  <input
                    type="number"
                    min="1" max="10" step="0.5"
                    className="minput"
                    value={config.loan_multiplier}
                    onChange={e => setConfig(p => ({ ...p, loan_multiplier: parseFloat(e.target.value) || 3 }))}
                  />
                  <small style={{ color:"var(--lux-text-secondary)", fontSize:"0.72rem", marginTop:"4px", display:"block" }}>
                    Max loan = member's total savings × {config.loan_multiplier}×
                  </small>
                </div>

                {/* Max Repayment */}
                <div>
                  <label className="mlabel" style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                    <Clock size={12} /> Max Repayment Period (months)
                  </label>
                  <input
                    type="number"
                    min="1" max="60"
                    className="minput"
                    value={config.max_repayment_months}
                    onChange={e => setConfig(p => ({ ...p, max_repayment_months: parseInt(e.target.value) || 12 }))}
                  />
                  <small style={{ color:"var(--lux-text-secondary)", fontSize:"0.72rem", marginTop:"4px", display:"block" }}>
                    Members cannot request a term longer than {config.max_repayment_months} months.
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* ── ALLOWED CATEGORIES ── */}
          <div className="msec" style={{ marginBottom:"1.5rem" }}>
            <div className="msec-header">
              <div className="msec-icon" style={{ background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.2)", color:"#10b981" }}>
                <CheckSquare size={20} />
              </div>
              <div>
                <p className="msec-title">Allowed Loan Categories</p>
                <p className="msec-sub">Members can only apply for loans in the checked categories</p>
              </div>
            </div>
            <div className="msec-body">
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.85rem" }}>
                {LOAN_CATEGORIES.map(({ value, label, icon: Icon, color, bg }) => {
                  const active = config.allowed_categories.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleCategory(value)}
                      style={{
                        display:"flex", alignItems:"center", gap:"0.75rem",
                        padding:"0.85rem 1rem", borderRadius:"14px", cursor:"pointer",
                        border:`1.5px solid ${active ? color : "var(--lux-border)"}`,
                        background: active ? bg : "var(--lux-bg-soft)",
                        transition:"all 0.2s",
                        textAlign:"left",
                      }}
                    >
                      <div style={{
                        width:34, height:34, borderRadius:"10px", flexShrink:0,
                        background: active ? bg : "var(--lux-card-bg)",
                        border:`1px solid ${active ? color : "var(--lux-border)"}`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>
                        <Icon size={16} style={{ color: active ? color : "var(--lux-text-secondary)" }} />
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:"0.85rem", color: active ? color : "var(--lux-text-primary)" }}>
                          {label}
                        </div>
                      </div>
                      {active
                        ? <CheckSquare size={16} style={{ color, flexShrink:0 }} />
                        : <Square     size={16} style={{ color:"var(--lux-text-secondary)", opacity:0.4, flexShrink:0 }} />
                      }
                    </button>
                  );
                })}
              </div>
              {config.allowed_categories.length === 0 && (
                <p style={{ color:"#ef4444", fontSize:"0.8rem", marginTop:"0.75rem" }}>
                  ⚠ At least one category must be enabled.
                </p>
              )}
            </div>
          </div>

          {/* ── LIVE PREVIEW ── */}
          <div style={{
            background:"var(--lux-bg-soft)", border:"1px solid var(--lux-border)",
            borderRadius:"20px", padding:"1.5rem", marginBottom:"1.75rem"
          }}>
            <p style={{ margin:"0 0 1rem", fontSize:"0.72rem", fontWeight:800, textTransform:"uppercase", letterSpacing:"1px", color:"var(--lux-gold)" }}>
              Live Preview — What members will see when applying for a loan
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"0.85rem" }}>
              {[
                { label:"Interest Rate",    value:`${config.interest_rate}% ${config.interest_type === "FLAT" ? "flat" : "reducing"}` },
                { label:"Max Loan",         value:`${config.loan_multiplier}× their savings`                                          },
                { label:"Max Term",         value:`${config.max_repayment_months} months`                                             },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:"var(--lux-card-bg)", border:"1px solid var(--lux-border)", borderRadius:"12px", padding:"1rem", textAlign:"center" }}>
                  <div style={{ fontSize:"0.65rem", fontWeight:800, textTransform:"uppercase", letterSpacing:"1px", color:"var(--lux-text-secondary)", marginBottom:"6px" }}>{label}</div>
                  <div style={{ fontSize:"1rem", fontWeight:900, color:"var(--lux-text-primary)" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:"1rem", display:"flex", flexWrap:"wrap", gap:"0.5rem" }}>
              {config.allowed_categories.map(cat => {
                const found = LOAN_CATEGORIES.find(c => c.value === cat);
                return found ? (
                  <span key={cat} style={{ padding:"3px 10px", borderRadius:"20px", fontSize:"0.7rem", fontWeight:800, background:found.bg, color:found.color, border:`1px solid ${found.color}33` }}>
                    {found.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>

          {/* ── ACTIONS ── */}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:"0.75rem" }}>
            <button
              type="button"
              className="btn-lux btn-lux-outline"
              onClick={() => navigate(`/chamas/${id}`, { state:{ tab:"management" } })}
            >
              Discard
            </button>
            <button
              type="submit"
              className="btn-lux btn-lux-primary"
              disabled={saving || config.allowed_categories.length === 0}
              style={{ minWidth:"180px", display:"flex", alignItems:"center", gap:"0.5rem", justifyContent:"center" }}
            >
              <Save size={16} />
              {saving ? "Saving…" : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
