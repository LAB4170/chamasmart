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
    <div className="card-premium" style={{ gridColumn: "1 / -1" }}>
      <div
        className="flex items-center justify-between gap-4 cursor-pointer p-2 py-3 rounded-2xl transition-colors hover:bg-gray-50/50 w-full"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-4 min-w-0" style={{ maxWidth: 'calc(100% - 130px)' }}>
          <div className="w-12 h-12 flex-shrink-0 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shadow-sm">
            <CreditCard size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-gray-900 text-lg tracking-tight truncate">Loan Configuration</h4>
            <p className="text-xs text-gray-500 mt-1 truncate">
              Set the chama's interest rate, max months, and loan limits · Current: 
              <span className="inline-block ml-1">
                <strong className="text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded-md">
                  {config.interest_rate}% {config.interest_type === "FLAT" ? "flat" : "reducing"}
                </strong>
              </span>
            </p>
          </div>
        </div>
        <button 
          className={`btn btn-sm flex-shrink-0 transition-all duration-300 ${
            open 
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border-transparent shadow-none" 
              : "bg-violet-600 hover:bg-violet-700 text-white border-transparent shadow-md hover:shadow-lg hover:-translate-y-0.5"
          }`}
          style={{ width: 110, borderRadius: '12px' }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(o => !o);
          }}
        >
          {open ? "Close ×" : "Configure"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSave} className="mt-6 space-y-6 border-t pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                <Lock size={13} /> Interest Rate (%)
              </label>
              <p className="text-xs text-gray-500 mb-2">Applied to ALL loan types equally. Members cannot change this.</p>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="form-input"
                value={config.interest_rate}
                onChange={e => setConfig(p => ({ ...p, interest_rate: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            {/* Interest Type */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Interest Type</label>
              <p className="text-xs text-gray-500 mb-2">Flat rate applies once. Reducing balance applies monthly on outstanding.</p>
              <select
                className="form-input"
                value={config.interest_type}
                onChange={e => setConfig(p => ({ ...p, interest_type: e.target.value }))}
              >
                <option value="FLAT">Flat Rate (recommended for chamas)</option>
                <option value="REDUCING_BALANCE">Reducing Balance</option>
              </select>
            </div>

            {/* Loan Multiplier */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Loan Multiplier (×savings)</label>
              <p className="text-xs text-gray-500 mb-2">Max loan = member's savings × multiplier. E.g. 3× means KES 10,000 savings = KES 30,000 limit.</p>
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                className="form-input"
                value={config.loan_multiplier}
                onChange={e => setConfig(p => ({ ...p, loan_multiplier: parseFloat(e.target.value) || 3 }))}
              />
            </div>

            {/* Max Repayment Months */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Max Repayment Period (months)</label>
              <p className="text-xs text-gray-500 mb-2">Members cannot request repayment longer than this cap.</p>
              <input
                type="number"
                min="1"
                max="60"
                className="form-input"
                value={config.max_repayment_months}
                onChange={e => setConfig(p => ({ ...p, max_repayment_months: parseInt(e.target.value) || 12 }))}
              />
            </div>
          </div>

          {/* Live Preview */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-sm">
            <p className="font-bold text-violet-800 mb-2">📋 Preview — What members will see:</p>
            <ul className="text-violet-700 space-y-1">
              <li>· Interest Rate: <strong>{config.interest_rate}%</strong> ({config.interest_type === "FLAT" ? "flat, applied once" : "reducing balance, monthly"})</li>
              <li>· Max Loan: <strong>{config.loan_multiplier}×</strong> their savings</li>
              <li>· Repayment: up to <strong>{config.max_repayment_months} months</strong></li>
            </ul>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-sm btn-outline bg-white hover:bg-gray-50 border-gray-200 text-gray-700" onClick={() => setOpen(false)}>Cancel</button>
            <button 
              type="submit" 
              className="btn btn-sm bg-violet-600 hover:bg-violet-700 text-white border-transparent shadow-md hover:shadow-lg transition-all" 
              disabled={saving} 
              style={{ minWidth: 150 }}
            >
              {saving ? "Saving…" : <><Save size={15} className="mr-1.5" /> Save Loan Config</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
