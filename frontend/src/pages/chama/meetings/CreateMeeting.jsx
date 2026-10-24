import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingAPI } from "../../../services/api";
import { Button, PageHeader } from "../../../components/ui";

const today = () => new Date().toISOString().split("T")[0];

export default function CreateMeeting() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", agenda: "", type: "PHYSICAL", meetingLink: "" });

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const validate = () => {
    const e = {};
    if (form.title.trim().length < 3) e.title = "Give the meeting a title of at least 3 characters.";
    if (!form.date) e.date = "Choose a date.";
    if (!form.time) e.time = "Choose a time.";
    if (form.date && form.time && new Date(`${form.date}T${form.time}`) < new Date()) e.time = "The meeting must be in the future.";
    if (form.type !== "VIRTUAL" && !form.location.trim()) e.location = "Say where the meeting will be held.";
    if (form.type === "VIRTUAL" && !form.meetingLink.trim()) e.meetingLink = "Add the online meeting link.";
    if (form.meetingLink && !/^https?:\/\//i.test(form.meetingLink.trim())) e.meetingLink = "The link must start with http:// or https://";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    const at = new Date(`${form.date}T${form.time}`).toISOString();
    setSaving(true);
    try {
      await meetingAPI.create(id, {
        title: form.title.trim(),
        description: form.agenda.trim(),
        scheduledAt: at,
        location: form.location.trim(),
        type: form.type,
        meetingLink: form.meetingLink.trim(),
        validUntil: at,
      });
      toast.success("Meeting scheduled.");
      navigate(`/chamas/${id}/meetings`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't schedule the meeting.");
    } finally {
      setSaving(false);
    }
  };

  const field = (name, label, input, hint) => (
    <div className="cs-field">
      <label className="cs-label" htmlFor={`m-${name}`}>{label}</label>
      {input}
      {hint && !errors[name] && <span className="cs-help">{hint}</span>}
      {errors[name] && <span className="cs-error" id={`m-${name}-err`} role="alert">{errors[name]}</span>}
    </div>
  );
  const aria = (name) => ({ id: `m-${name}`, name, "aria-invalid": errors[name] ? "true" : undefined, "aria-describedby": errors[name] ? `m-${name}-err` : undefined });

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Schedule a meeting" subtitle="Members will see it under Meetings." actions={<Button variant="secondary" onClick={() => navigate(-1)}>Back</Button>} />
        <form className="cs-card" onSubmit={submit} noValidate style={{ maxWidth: 720 }}>
          {field("title", "Title", <input className="cs-input" {...aria("title")} value={form.title} onChange={set} placeholder="Monthly review meeting" maxLength={120} />)}
          <div className="cs-form-grid">
            {field("date", "Date", <input className="cs-input" type="date" {...aria("date")} value={form.date} onChange={set} min={today()} />)}
            {field("time", "Time", <input className="cs-input" type="time" {...aria("time")} value={form.time} onChange={set} />)}
          </div>
          {field("type", "Format", (
            <select className="cs-select" {...aria("type")} value={form.type} onChange={set}>
              <option value="PHYSICAL">In person</option>
              <option value="VIRTUAL">Online</option>
              <option value="HYBRID">In person and online</option>
            </select>
          ))}
          {form.type !== "VIRTUAL" && field("location", "Location", <input className="cs-input" {...aria("location")} value={form.location} onChange={set} placeholder="Community hall" />)}
          {form.type !== "PHYSICAL" && field("meetingLink", form.type === "HYBRID" ? "Online link (optional)" : "Online link", <input className="cs-input" type="url" {...aria("meetingLink")} value={form.meetingLink} onChange={set} placeholder="https://meet.google.com/…" />)}
          {field("agenda", "Agenda", <textarea className="cs-textarea" {...aria("agenda")} value={form.agenda} onChange={set} rows={4} placeholder="What will be discussed?" />)}
          <div className="cs-actions">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>Schedule meeting</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
