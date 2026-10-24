import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { roscaAPI } from "../../../services/api";
import { Button, PageHeader } from "../../../components/ui";

const today = () => new Date().toISOString().split("T")[0];

export default function CreateCycle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ name: "", amount: "", startDate: today() });

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    const er = {};
    if (form.name.trim().length < 3) er.name = "Give the cycle a name of at least 3 characters.";
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) er.amount = "Enter the amount each member pays per round.";
    if (!form.startDate) er.startDate = "Choose a start date.";
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await roscaAPI.createCycle({
        chama_id: Number(id),
        cycle_name: form.name.trim(),
        contribution_amount: Number(form.amount),
        start_date: form.startDate,
      });
      toast.success("Cycle created.");
      navigate(`/chamas/${id}/rosca`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't create the cycle.");
    } finally {
      setSaving(false);
    }
  };

  const aria = (n) => ({ id: `cc-${n}`, name: n, "aria-invalid": errors[n] ? "true" : undefined, "aria-describedby": errors[n] ? `cc-${n}-err` : undefined });
  const err = (n) => errors[n] && <span className="cs-error" id={`cc-${n}-err`} role="alert">{errors[n]}</span>;

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Start a new round" subtitle="A rotating savings cycle for your active members." actions={<Link to={`/chamas/${id}/rosca`} className="cs-btn cs-btn--secondary">Cancel</Link>} />
        <form className="cs-card" onSubmit={submit} noValidate style={{ maxWidth: 560 }}>
          <div className="cs-field">
            <label className="cs-label" htmlFor="cc-name">Cycle name</label>
            <input className="cs-input" {...aria("name")} value={form.name} onChange={set} placeholder="Round 1" maxLength={80} />
            {err("name")}
          </div>
          <div className="cs-form-grid">
            <div className="cs-field">
              <label className="cs-label" htmlFor="cc-amount">Each member pays (KES)</label>
              <input className="cs-input" type="number" inputMode="decimal" min="1" {...aria("amount")} value={form.amount} onChange={set} />
              {err("amount")}
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="cc-startDate">Start date</label>
              <input className="cs-input" type="date" {...aria("startDate")} value={form.startDate} onChange={set} />
              {err("startDate")}
            </div>
          </div>
          <p className="cs-help">The cycle includes every active member. You can only have one active cycle at a time.</p>
          <div className="cs-actions">
            <Button type="submit" loading={saving}>Create cycle</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
