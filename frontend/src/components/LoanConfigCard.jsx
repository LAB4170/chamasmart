import { useState, useEffect } from "react";
import { loanAPI } from "../services/api";
import { toast } from "react-toastify";
import { CreditCard, Save, Lock } from "lucide-react";

const LOAN_CATEGORIES_CONFIG = [
  { value: "EMERGENCY",   label: "🚨 Emergency" },
  { value: "SCHOOL_FEES", label: "🎓 School Fees" },
  { value: "DEVELOPMENT", label: "🌱 Development" },
  { value: "BUSINESS",    label: "💼 Business" },
  { value: "MEDICAL",     label: "🏥 Medical" },
];

/**
 * LoanConfigCard — Officials-only card in the Management tab.
 * Lets Chairperson/Treasurer/Secretary set the chama's loan terms that
 * are enforced in the loan wizard for all members.
 */
export default function LoanConfigCard({ chamaId }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    interest_rate: 10,
    interest_type: "FLAT",
    loan_multiplier: 3,
    max_repayment_months: 12,
    allowed_categories: ["EMERGENCY", "SCHOOL_FEES", "DEVELOPMENT", "BUSINESS", "MEDICAL"],
  });

  useEffect(() => {
    loanAPI.getConfig(chamaId)
      .then(r => r.data.data && setConfig(prev => ({ ...prev, ...r.data.data })))
      .catch(() => {}); // Silent fail — defaults are safe
  }, [chamaId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await loanAPI.updateConfig(chamaId, config);
      toast.success("Loan configuration updated! Members will see the new terms immediately.");
      setOpen(false);
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

  return (
    <div className="dashboard-card-lux" style={{ gridColumn: "1 / -1" }}>
      <div
        className="flex items-center justify-between gap-4 cursor-pointer p-2 py-3 rounded-2xl transition-colors hover:bg-lux-bg-soft w-full"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-4 min-w-0" style={{ maxWidth: 'calc(100% - 130px)' }}>
          <div className="w-12 h-12 flex-shrink-0 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
            <CreditCard size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-lux-primary text-lg tracking-tight truncate" style={{ color: 'var(--lux-text-primary)', margin: 0 }}>Loan Configuration</h4>
            <p className="text-xs mt-1 truncate" style={{ color: 'var(--lux-text-secondary)' }}>
              Set interest rate, multipliers, and repayment caps · Current: 
              <span className="inline-block ml-1">
                <strong style={{ color: 'var(--lux-gold)', background: 'var(--lux-bg-soft)', padding: '2px 6px', borderRadius: '6px', border: '1px solid var(--lux-border)' }}>
                  {config.interest_rate}% {config.interest_type === "FLAT" ? "flat" : "reducing"}
                </strong>
              </span>
            </p>
          </div>
        </div>
        <button 
          className={`btn-lux btn-lux-outline flex-shrink-0 transition-all duration-300 ${
            open ? "opacity-50" : ""
          }`}
          style={{ width: 110, borderRadius: '12px', padding: '8px' }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(o => !o);
          }}
        >
          {open ? "Close ×" : "Configure"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSave} className="mt-6 space-y-6 border-t pt-6" style={{ borderColor: 'var(--lux-border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Interest Rate */}
            <div>
              <label className="block mb-2 flex items-center gap-2" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)' }}>
                <Lock size={13} /> Interest Rate (%)
              </label>
              <p className="text-xs mb-2" style={{ color: 'var(--lux-text-secondary)', opacity: 0.7 }}>Applied to ALL loan types equally. Members cannot change this.</p>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="form-input"
                style={{ width: '100%', background: 'var(--lux-bg-soft)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                value={config.interest_rate}
                onChange={e => setConfig(p => ({ ...p, interest_rate: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            {/* Interest Type */}
            <div>
              <label className="block mb-2" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)' }}>Interest Type</label>
              <p className="text-xs mb-2" style={{ color: 'var(--lux-text-secondary)', opacity: 0.7 }}>Flat rate applies once. Reducing balance applies monthly.</p>
              <select
                className="form-input"
                style={{ width: '100%', background: 'var(--lux-bg-soft)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                value={config.interest_type}
                onChange={e => setConfig(p => ({ ...p, interest_type: e.target.value }))}
              >
                <option value="FLAT">Flat Rate (recommended for chamas)</option>
                <option value="REDUCING_BALANCE">Reducing Balance</option>
              </select>
            </div>

            {/* Loan Multiplier */}
            <div>
              <label className="block mb-2" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)' }}>Loan Multiplier (×savings)</label>
              <p className="text-xs mb-2" style={{ color: 'var(--lux-text-secondary)', opacity: 0.7 }}>Max loan = member's savings × multiplier.</p>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                className="form-input"
                style={{ width: '100%', background: 'var(--lux-bg-soft)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                value={config.loan_multiplier}
                onChange={e => setConfig(p => ({ ...p, loan_multiplier: parseFloat(e.target.value) || 3 }))}
              />
            </div>

            <div>
              <label className="block mb-2" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)' }}>Max Period (months)</label>
              <p className="text-xs mb-2" style={{ color: 'var(--lux-text-secondary)', opacity: 0.7 }}>Members cannot request repayment longer than this cap.</p>
              <input
                type="number"
                min="1"
                max="60"
                className="form-input"
                style={{ width: '100%', background: 'var(--lux-bg-soft)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                value={config.max_repayment_months}
                onChange={e => setConfig(p => ({ ...p, max_repayment_months: parseInt(e.target.value) || 12 }))}
              />
            </div>
          </div>

          {/* Live Preview */}
          <div style={{ background: 'var(--lux-bg-soft)', border: '1px solid var(--lux-border)', borderRadius: '20px', padding: '24px' }}>
            <p className="font-bold mb-3" style={{ color: 'var(--lux-gold)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>📋 Protocol Preview — What members will see:</p>
            <ul className="space-y-2 m-0 p-0" style={{ listStyle: 'none', color: 'var(--lux-text-primary)', fontSize: '0.9rem' }}>
              <li className="flex items-center gap-2">· Interest Rate: <strong>{config.interest_rate}%</strong> ({config.interest_type === "FLAT" ? "flat, applied once" : "reducing balance, monthly"})</li>
              <li className="flex items-center gap-2">· Max Loan Limit: <strong>{config.loan_multiplier}×</strong> their registered savings</li>
              <li className="flex items-center gap-2">· Repayment Window: up to <strong>{config.max_repayment_months} months</strong></li>
            </ul>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-lux btn-lux-outline" onClick={() => setOpen(false)}>Dismiss</button>
            <button 
              type="submit" 
              className="btn-lux" 
              disabled={saving} 
              style={{ minWidth: 180 }}
            >
              {saving ? "Syncing…" : <><Save size={16} className="mr-2" /> Commit Protocols</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
