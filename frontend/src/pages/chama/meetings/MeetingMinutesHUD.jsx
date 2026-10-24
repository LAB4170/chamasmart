import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { meetingAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, Skeleton, Dialog } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";

export default function MeetingMinutesHUD() {
  const { id: chamaId, meetingId } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [minutes, setMinutes] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const m = (await meetingAPI.getById(chamaId, meetingId)).data?.data;
      setMeeting(m);
      setMinutes(m?.minutes || "");
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [chamaId, meetingId]);

  useEffect(() => { load(); }, [load]);

  const locked = meeting && (meeting.status === "COMPLETED" || meeting.status === "CANCELLED");

  const save = async () => {
    setSaving(true);
    try {
      await meetingAPI.update(chamaId, meetingId, { minutes });
      toast.success("Draft saved.");
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't save the draft.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (minutes.trim().length < 10) { setConfirm(false); toast.error("Write the minutes before publishing them."); return; }
    setPublishing(true);
    try {
      await meetingAPI.update(chamaId, meetingId, { minutes });
      await meetingAPI.publishMinutes(chamaId, meetingId);
      toast.success("Minutes published.");
      navigate(`/chamas/${chamaId}/meetings/${meetingId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't publish the minutes.");
      setConfirm(false);
    } finally {
      setPublishing(false);
    }
  };

  if (loading) return <div className="cs-shell"><main className="cs-page"><div className="cs-card" aria-busy="true" aria-label="Loading minutes"><Skeleton height={20} width="50%" /><Skeleton height={120} style={{ marginTop: 12 }} /></div></main></div>;
  if (failed || !meeting) return (
    <div className="cs-shell"><main className="cs-page">
      <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span>We couldn&apos;t load this meeting. Only officials can record minutes.</span>
        <span className="cs-actions"><Button size="sm" onClick={load}>Try again</Button><Link to={`/chamas/${chamaId}/meetings`} className="cs-btn cs-btn--secondary cs-btn--sm">Back</Link></span>
      </div>
    </main></div>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Meeting minutes"
          subtitle={`${meeting.title} · ${formatDateTime(meeting.scheduled_date)}`}
          actions={(<><StatusBadge status={meeting.status} label={locked ? (meeting.status === "COMPLETED" ? "Published" : "Cancelled") : "Draft"} /><Link to={`/chamas/${chamaId}/meetings/${meetingId}`} className="cs-btn cs-btn--secondary">Back to meeting</Link></>)}
        />
        <section className="cs-card" style={{ maxWidth: 800 }}>
          <div className="cs-field">
            <label className="cs-label" htmlFor="mm-text">Minutes</label>
            <textarea id="mm-text" className="cs-textarea" rows={14} value={minutes} onChange={(e) => setMinutes(e.target.value)} readOnly={locked} placeholder="Who was there, what was decided, who does what and by when." />
            {!locked && <span className="cs-help">Publishing marks the meeting as held and locks the minutes. Attendance isn&apos;t recorded in the app yet.</span>}
          </div>
          {!locked && (
            <div className="cs-actions">
              <Button onClick={save} loading={saving}>Save draft</Button>
              <Button variant="primary" onClick={() => setConfirm(true)} disabled={saving}>Publish minutes</Button>
            </div>
          )}
        </section>
        <Dialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Publish these minutes?"
          actions={(<><Button onClick={() => setConfirm(false)}>Keep editing</Button><Button variant="primary" loading={publishing} onClick={publish}>Publish</Button></>)}
        >
          <p>The meeting is marked as held and the minutes can no longer be edited.</p>
        </Dialog>
      </main>
    </div>
  );
}
