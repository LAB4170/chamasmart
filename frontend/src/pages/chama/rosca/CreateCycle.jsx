import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { roscaAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader } from "../../../components/ui";

const today = () => new Date().toISOString().split("T")[0];

export default function CreateCycle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ name: "", amount: "", startDate: today(), order: "ROTATIONAL", lateFee: "", graceDays: "3" });
  const [members, setMembers] = useState([]); // for the "I choose the order" option

  useEffect(() => {
    let live = true;
    chamaAPI.getMembers(id).then((r) => {
      const list = (r.data?.data ?? []).filter((m) => m.is_active !== false && (m.status || "ACTIVE") !== "INACTIVE");
      if (live) setMembers(list.map((m) => ({ id: m.user_id ?? m.userId, name: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.member_name || "Member" })));
    }).catch(() => {});
    return () => { live = false; };
  }, [id]);

  const move = (i, d) => setMembers((list) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    const er = {};
    if (form.name.trim().length < 3) er.name = "Give the cycle a name of at least 3 characters.";
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) er.amount = "Enter the amount each member pays per round.";
    if (!form.startDate) er.startDate = "Choose a start date.";
    const fee = form.lateFee === "" ? 0 : Number(form.lateFee);
    if (!Number.isFinite(fee) || fee < 0 || (Number.isFinite(amt) && amt > 0 && fee > amt)) er.lateFee = "The late fee can't be more than one round's payment.";
    const grace = Number(form.graceDays);
    if (!Number.isInteger(grace) || grace < 0 || grace > 30) er.graceDays = "Enter 0 to 30 days.";
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
        payout_order: form.order,
        ...(Number(form.lateFee) > 0 ? { late_fee: Number(form.lateFee), grace_days: Number(form.graceDays) } : {}),
        ...(form.order === "MANUAL" ? { member_order: members.map((m) => m.id) } : {}),
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
          <div className="cs-field">
            <label className="cs-label" htmlFor="cc-order">Who receives first</label>
            <select className="cs-select" id="cc-order" name="order" value={form.order} onChange={set}>
              <option value="ROTATIONAL">In the order members joined</option>
              <option value="RANDOM">A random draw</option>
              <option value="MANUAL">I will choose the order</option>
            </select>
            <span className="cs-help">The order is fixed once the cycle starts. Members can swap turns with each other's consent.</span>
          </div>
          {form.order === "MANUAL" && (
            <ol className="cs-list" style={{ listStyle: "none", padding: 0, margin: "0 0 12px" }} aria-label="Payout order">
              {members.map((m, i) => (
                <li key={m.id} className="cs-list-item">
                  <div className="cs-list-main"><div className="cs-list-title">{i + 1}. {m.name}</div></div>
                  <span className="cs-actions">
                    <Button type="button" size="sm" variant="secondary" disabled={i === 0} aria-label={`Move ${m.name} up`} onClick={() => move(i, -1)}>Up</Button>
                    <Button type="button" size="sm" variant="secondary" disabled={i === members.length - 1} aria-label={`Move ${m.name} down`} onClick={() => move(i, 1)}>Down</Button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <div className="cs-form-grid">
            <div className="cs-field">
              <label className="cs-label" htmlFor="cc-lateFee">Late fee per round (KES, optional)</label>
              <input className="cs-input" type="number" inputMode="decimal" min="0" {...aria("lateFee")} value={form.lateFee} onChange={set} />
              {err("lateFee")}
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="cc-graceDays">Days of grace after the due date</label>
              <input className="cs-input" type="number" inputMode="numeric" min="0" max="30" {...aria("graceDays")} value={form.graceDays} onChange={set} />
              {err("graceDays")}
            </div>
          </div>
          <p className="cs-help">Leave the late fee empty for none. Members still behind after the grace days get one fine for that round, and officials can waive it.</p>
          <p className="cs-help">The cycle includes every active member. You can only have one active cycle at a time.</p>
          <div className="cs-actions">
            <Button type="submit" loading={saving}>Create cycle</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
