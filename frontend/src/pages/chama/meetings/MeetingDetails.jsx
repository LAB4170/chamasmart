import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, Skeleton, Dialog } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";

const OFFICIALS = ["CHAIRPERSON", "SECRETARY", "TREASURER"];
const LABELS = { SCHEDULED: "Scheduled", IN_PROGRESS: "In progress", COMPLETED: "Held", CANCELLED: "Cancelled" };

const toLocalParts = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

export default function MeetingDetails() {
  const { id: chamaId, meetingId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", date: "", time: "", location: "", type: "PHYSICAL", meetingLink: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [m, c] = await Promise.all([meetingAPI.getById(chamaId, meetingId), chamaAPI.getById(chamaId)]);
      const data = m.data?.data;
      setMeeting(data);
      setRole((c.data?.data?.role || "").toUpperCase());
      const { date, time } = toLocalParts(data.scheduled_date);
      setForm({ title: data.title || "", description: data.description || "", date, time, location: data.location || "", type: data.meeting_type || "PHYSICAL", meetingLink: data.meeting_link || "" });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [chamaId, meetingId]);

  useEffect(() => { load(); }, [load]);

  const set = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const isOfficial = OFFICIALS.includes(role);
  const locked = meeting && (meeting.status === "CANCELLED" || meeting.status === "COMPLETED");

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (form.title.trim().length < 3) return setError("Give the meeting a title of at least 3 characters.");
    if (!form.date || !form.time) return setError("Choose a date and time.");
    setSaving(true);
    try {
      await meetingAPI.update(chamaId, meetingId, {
        title: form.title.trim(),
        description: form.description.trim(),
        scheduledAt: new Date(`${form.date}T${form.time}`).toISOString(),
        location: form.location.trim(),
        type: form.type,
        meetingLink: form.meetingLink.trim(),
      });
      toast.success("Meeting updated.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't save the changes.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    setSaving(true);
    try {
      await meetingAPI.delete(chamaId, meetingId);
      toast.success("Meeting cancelled. Members will see it as cancelled.");
      setConfirmCancel(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't cancel the meeting.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="cs-shell"><main className="cs-page"><div className="cs-card" aria-busy="true" aria-label="Loading meeting"><Skeleton height={20} width="50%" /><Skeleton height={80} style={{ marginTop: 12 }} /></div></main></div>;
  if (failed || !meeting) return (
    <div className="cs-shell"><main className="cs-page">
      <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span>We couldn&apos;t load this meeting.</span>
        <span className="cs-actions"><Button size="sm" onClick={load}>Try again</Button><Button size="sm" variant="secondary" onClick={() => navigate(`/chamas/${chamaId}/meetings`)}>Back to meetings</Button></span>
      </div>
    </main></div>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title={meeting.title}
          subtitle={formatDateTime(meeting.scheduled_date)}
          actions={(
            <>
              <StatusBadge status={meeting.status} label={LABELS[meeting.status] || meeting.status} />
              <Link to={`/chamas/${chamaId}/meetings`} className="cs-btn cs-btn--secondary">All meetings</Link>
              {isOfficial && meeting.status !== "CANCELLED" && <Link to={`/chamas/${chamaId}/meetings/${meetingId}/minutes`} className="cs-btn cs-btn--primary">{meeting.status === "COMPLETED" ? "View minutes" : "Record minutes"}</Link>}
            </>
          )}
        />

        <section className="cs-card" aria-label="Meeting details" style={{ marginBottom: 16 }}>
          <dl className="cs-kv">
            <div><dt>Format</dt><dd>{(meeting.meeting_type || "").toLowerCase() || "—"}</dd></div>
            <div><dt>Where</dt><dd>{meeting.location || "—"}</dd></div>
            {meeting.meeting_link && <div><dt>Online</dt><dd><a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">Join online</a></dd></div>}
          </dl>
          {meeting.description && <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{meeting.description}</p>}
        </section>

        {meeting.status === "COMPLETED" && (
          <section className="cs-card" aria-label="Minutes" style={{ marginBottom: 16 }}>
            <h2 className="cs-card-title">Minutes</h2>
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{meeting.minutes || "No minutes were recorded for this meeting."}</p>
          </section>
        )}

        {isOfficial && !locked && (
          <form className="cs-card" onSubmit={save} noValidate style={{ maxWidth: 720 }}>
            <h2 className="cs-card-title">Edit meeting</h2>
            {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}>{error}</div>}
            <div className="cs-field"><label className="cs-label" htmlFor="md-title">Title</label><input id="md-title" name="title" className="cs-input" value={form.title} onChange={set} maxLength={120} /></div>
            <div className="cs-form-grid">
              <div className="cs-field"><label className="cs-label" htmlFor="md-date">Date</label><input id="md-date" type="date" name="date" className="cs-input" value={form.date} onChange={set} /></div>
              <div className="cs-field"><label className="cs-label" htmlFor="md-time">Time</label><input id="md-time" type="time" name="time" className="cs-input" value={form.time} onChange={set} /></div>
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="md-type">Format</label>
              <select id="md-type" name="type" className="cs-select" value={form.type} onChange={set}>
                <option value="PHYSICAL">In person</option><option value="VIRTUAL">Online</option><option value="HYBRID">In person and online</option>
              </select>
            </div>
            <div className="cs-field"><label className="cs-label" htmlFor="md-loc">Location</label><input id="md-loc" name="location" className="cs-input" value={form.location} onChange={set} /></div>
            <div className="cs-field"><label className="cs-label" htmlFor="md-link">Online link</label><input id="md-link" type="url" name="meetingLink" className="cs-input" value={form.meetingLink} onChange={set} placeholder="https://…" /></div>
            <div className="cs-field"><label className="cs-label" htmlFor="md-agenda">Agenda</label><textarea id="md-agenda" name="description" className="cs-textarea" rows={4} value={form.description} onChange={set} /></div>
            <div className="cs-actions">
              <Button type="button" variant="danger" onClick={() => setConfirmCancel(true)} disabled={saving}>Cancel meeting</Button>
              <Button type="submit" loading={saving}>Save changes</Button>
            </div>
          </form>
        )}

        <Dialog
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          title="Cancel this meeting?"
          actions={(<><Button onClick={() => setConfirmCancel(false)}>Keep it</Button><Button variant="danger" loading={saving} onClick={cancel}>Cancel meeting</Button></>)}
        >
          <p>Members will see it as cancelled. The record stays, and a cancelled meeting can&apos;t be edited again.</p>
        </Dialog>
      </main>
    </div>
  );
}
