import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { chamaAPI } from "../../../services/api";
import { Button, PageHeader } from "../../../components/ui";

const TYPES = [
  { id: "ROSCA", name: "Merry-go-round", desc: "Members take turns receiving the pot." },
  { id: "ASCA", name: "Share-out savings group (ASCA)", desc: "Members buy shares during a cycle and share out the cash at the end." },
  { id: "TABLE_BANKING", name: "Table banking", desc: "Members lend to each other from pooled savings." },
  { id: "WELFARE", name: "Welfare fund", desc: "A shared fund for members' emergencies." },
];
const FREQUENCIES = [["DAILY", "Daily"], ["WEEKLY", "Weekly"], ["BIWEEKLY", "Every 2 weeks"], ["MONTHLY", "Monthly"]];
const PATTERNS = [["1st Saturday", "1st Saturday of the month"], ["Last Saturday", "Last Saturday of the month"], ["1st Sunday", "1st Sunday of the month"], ["Every Sunday", "Every Sunday"], ["Every 2 Weeks", "Every 2 weeks"], ["CUSTOM", "Something else"]];
const PAY_TYPES = [["", "I'll add this later"], ["PAYBILL", "M-Pesa Paybill"], ["TILL", "M-Pesa Till"], ["POCHI", "Pochi la Biashara"], ["SEND_MONEY", "Send money to a phone"], ["BANK", "Bank transfer"]];
const STEPS = ["Basics", "Contributions", "Meetings and payments"];

export default function CreateChama() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [f, setF] = useState({
    name: "", type: "ROSCA", visibility: "PRIVATE", description: "",
    amount: "", frequency: "MONTHLY",
    meetingKind: "PHYSICAL", pattern: "1st Saturday", customDay: "", location: "", time: "",
    payType: "", businessNumber: "", accountNumber: "", tillNumber: "", phoneNumber: "", recipientName: "",
    bankName: "", bankAccount: "", bankAccountName: "", bankBranch: "",
  });
  const set = (e) => setF((x) => ({ ...x, [e.target.name]: e.target.value }));

  const validate = (s) => {
    const er = {};
    if (s === 1 && f.name.trim().length < 3) er.name = "Give the chama a name of at least 3 characters.";
    if (s === 2) {
      const a = Number(f.amount);
      if (!Number.isFinite(a) || a <= 0) er.amount = "Enter the contribution amount in KES.";
    }
    if (s === 3) {
      if (f.pattern === "CUSTOM" && !f.customDay.trim()) er.customDay = "Say when you meet.";
      if (f.payType === "PAYBILL" && !f.businessNumber.trim()) er.businessNumber = "Enter the Paybill business number.";
      if (f.payType === "TILL" && !f.tillNumber.trim()) er.tillNumber = "Enter the Till number.";
      if (["POCHI", "SEND_MONEY"].includes(f.payType) && !/^\+?[0-9 ]{9,15}$/.test(f.phoneNumber.trim())) er.phoneNumber = "Enter a valid phone number.";
      if (f.payType === "BANK" && (!f.bankName.trim() || !f.bankAccount.trim())) er.bankAccount = "Enter the bank name and account number.";
    }
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const next = (e) => { e.preventDefault(); if (validate(step)) setStep(step + 1); };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate(3)) return;
    const kind = f.meetingKind === "ONLINE" ? "Online" : "In person";
    const meetingDay = f.pattern === "CUSTOM" ? f.customDay.trim() : `${f.pattern} (${kind})${f.location.trim() ? ` at ${f.location.trim()}` : ""}`;
    const body = {
      chama_name: f.name.trim(),
      chama_type: f.type,
      description: f.description.trim(),
      contribution_amount: Number(f.amount),
      contribution_frequency: f.frequency,
      visibility: f.visibility,
      meeting_day: meetingDay,
      meeting_time: f.time || null,
      // Members pay the group's own account and officials verify receipts. ChamaSmart does not hold money.
      custody_type: "SELF_MANAGED",
      payment_methods: f.payType ? {
        type: f.payType,
        businessNumber: f.businessNumber.trim(), accountNumber: f.accountNumber.trim(), tillNumber: f.tillNumber.trim(),
        phoneNumber: f.phoneNumber.trim(), recipientName: f.recipientName.trim(),
        bankName: f.bankName.trim(), bankAccount: f.bankAccount.trim(), bankAccountName: f.bankAccountName.trim(), bankBranch: f.bankBranch.trim(),
      } : null,
    };
    setSaving(true);
    try {
      const res = await chamaAPI.create(body);
      toast.success("Chama created.");
      navigate(`/chamas/${res.data.data.chama_id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't create the chama.");
    } finally {
      setSaving(false);
    }
  };

  const aria = (n) => ({ id: `cc-${n}`, name: n, "aria-invalid": errors[n] ? "true" : undefined, "aria-describedby": errors[n] ? `cc-${n}-err` : undefined });
  const err = (n) => errors[n] && <span className="cs-error" id={`cc-${n}-err`} role="alert">{errors[n]}</span>;
  const text = (n, label, props = {}) => (
    <div className="cs-field"><label className="cs-label" htmlFor={`cc-${n}`}>{label}</label><input className="cs-input" {...aria(n)} value={f[n]} onChange={set} {...props} />{err(n)}</div>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Create a chama" subtitle={`Step ${step} of ${STEPS.length}: ${STEPS[step - 1]}`} actions={<Link to="/dashboard" className="cs-btn cs-btn--secondary">Cancel</Link>} />
        <div role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step} style={{ height: 6, borderRadius: 3, background: "var(--cs-surface-2)", marginBottom: 16, maxWidth: 720 }}>
          <div style={{ height: "100%", width: `${(step / STEPS.length) * 100}%`, borderRadius: 3, background: "var(--cs-primary)" }} />
        </div>

        <form className="cs-card" onSubmit={step < 3 ? next : submit} noValidate style={{ maxWidth: 720 }}>
          {step === 1 && (
            <>
              {text("name", "Chama name", { placeholder: "Tumaini Savings Group", maxLength: 100, autoFocus: true })}
              <fieldset className="cs-field" style={{ border: 0, padding: 0 }}>
                <legend className="cs-label">What kind of chama is it?</legend>
                {TYPES.map((t) => (
                  <label key={t.id} className="cs-check">
                    <input type="radio" name="type" value={t.id} checked={f.type === t.id} onChange={set} />
                    <span><strong>{t.name}</strong><br /><span className="cs-help">{t.desc}</span></span>
                  </label>
                ))}
              </fieldset>
              <div className="cs-field">
                <label className="cs-label" htmlFor="cc-visibility">Who can find it?</label>
                <select className="cs-select" {...aria("visibility")} value={f.visibility} onChange={set}>
                  <option value="PRIVATE">Private: invite only</option>
                  <option value="PUBLIC">Public: anyone can find it and ask to join</option>
                </select>
              </div>
              <div className="cs-field"><label className="cs-label" htmlFor="cc-description">What is it for? (optional)</label><textarea className="cs-textarea" rows={3} {...aria("description")} value={f.description} onChange={set} /></div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="cs-form-grid">
                {text("amount", "Contribution (KES)", { type: "number", inputMode: "decimal", min: "1", placeholder: "1000", autoFocus: true })}
                <div className="cs-field">
                  <label className="cs-label" htmlFor="cc-frequency">How often?</label>
                  <select className="cs-select" {...aria("frequency")} value={f.frequency} onChange={set}>{FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
              </div>
              <p className="cs-help">Members pay the group directly, and an official records or verifies each payment. ChamaSmart keeps the books; it doesn&apos;t hold or move money.</p>
              {f.type === "ASCA" && <p className="cs-help">Share prices are set when an official starts a share cycle.</p>}
            </>
          )}

          {step === 3 && (
            <>
              <div className="cs-form-grid">
                <div className="cs-field">
                  <label className="cs-label" htmlFor="cc-meetingKind">Meetings are</label>
                  <select className="cs-select" {...aria("meetingKind")} value={f.meetingKind} onChange={set}><option value="PHYSICAL">In person</option><option value="ONLINE">Online</option></select>
                </div>
                <div className="cs-field">
                  <label className="cs-label" htmlFor="cc-pattern">When?</label>
                  <select className="cs-select" {...aria("pattern")} value={f.pattern} onChange={set}>{PATTERNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
              </div>
              {f.pattern === "CUSTOM" && text("customDay", "Describe when you meet", { placeholder: "Every 15th of the month" })}
              <div className="cs-form-grid">
                {f.pattern !== "CUSTOM" && text("location", f.meetingKind === "ONLINE" ? "Platform (optional)" : "Where? (optional)", { placeholder: f.meetingKind === "ONLINE" ? "Google Meet" : "Community hall" })}
                {text("time", "Time (optional)", { type: "time" })}
              </div>

              <h2 className="cs-card-title">Where members pay (optional)</h2>
              <div className="cs-field">
                <label className="cs-label" htmlFor="cc-payType">Payment method</label>
                <select className="cs-select" {...aria("payType")} value={f.payType} onChange={set}>{PAY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </div>
              {f.payType === "PAYBILL" && <div className="cs-form-grid">{text("businessNumber", "Business number")}{text("accountNumber", "Account number")}</div>}
              {f.payType === "TILL" && text("tillNumber", "Till number")}
              {["POCHI", "SEND_MONEY"].includes(f.payType) && <div className="cs-form-grid">{text("phoneNumber", "Phone number", { type: "tel" })}{text("recipientName", "Name on the number")}</div>}
              {f.payType === "BANK" && (
                <>
                  <div className="cs-form-grid">{text("bankName", "Bank")}{text("bankBranch", "Branch")}</div>
                  <div className="cs-form-grid">{text("bankAccount", "Account number")}{text("bankAccountName", "Account name")}</div>
                </>
              )}
            </>
          )}

          <div className="cs-actions">
            {step > 1 && <Button type="button" variant="secondary" onClick={() => { setErrors({}); setStep(step - 1); }} disabled={saving}>Back</Button>}
            <Button type="submit" loading={saving}>{step < 3 ? "Continue" : "Create chama"}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
