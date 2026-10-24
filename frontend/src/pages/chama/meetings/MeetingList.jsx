import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { meetingAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";

const OFFICIALS = ["CHAIRPERSON", "SECRETARY", "TREASURER"];
const LABELS = { SCHEDULED: "Scheduled", IN_PROGRESS: "In progress", COMPLETED: "Held", CANCELLED: "Cancelled" };
const FILTERS = [
  { id: "UPCOMING", label: "Upcoming" },
  { id: "PAST", label: "Past" },
  { id: "ALL", label: "All" },
];

export default function MeetingList() {
  const { id } = useParams();
  const [meetings, setMeetings] = useState([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("UPCOMING");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [m, c] = await Promise.all([meetingAPI.getAll(id), chamaAPI.getById(id)]);
      const raw = m.data?.data ?? [];
      setMeetings(Array.isArray(raw) ? raw : []);
      setRole((c.data?.data?.role || "").toUpperCase());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isUpcoming = (m) => m.status !== "CANCELLED" && m.status !== "COMPLETED" && new Date(m.scheduled_date) >= new Date(Date.now() - 6 * 3600 * 1000);
  const visible = useMemo(() => {
    const list = meetings.filter((m) => (filter === "ALL" ? true : filter === "UPCOMING" ? isUpcoming(m) : !isUpcoming(m)));
    const asc = filter === "UPCOMING";
    return [...list].sort((a, b) => (asc ? 1 : -1) * (new Date(a.scheduled_date) - new Date(b.scheduled_date)));
  }, [meetings, filter]);

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Meetings"
          subtitle="When your chama meets, and what was decided."
          actions={(
            <>
              <Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>
              {OFFICIALS.includes(role) && <Link to={`/chamas/${id}/meetings/create`} className="cs-btn cs-btn--primary">Schedule a meeting</Link>}
            </>
          )}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load the meetings.</span><Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading meetings"><Skeleton height={14} width="40%" /><Skeleton height={40} style={{ marginTop: 12 }} /></div>
        ) : !error && (
          <section aria-label="Meetings">
            <div className="cs-chips" role="group" aria-label="Filter meetings" style={{ marginBottom: 16 }}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className="cs-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            {visible.length === 0 ? (
              <div className="cs-card"><EmptyState title="No meetings here" message={filter === "UPCOMING" ? "Nothing is scheduled." : "No meetings match this view."} /></div>
            ) : (
              <div className="cs-loan-grid">
                {visible.map((m) => (
                  <article key={m.meeting_id} className="cs-card cs-loan">
                    <header className="cs-loan-head">
                      <div className="cs-list-main">
                        <h3 className="cs-loan-title">{m.title}</h3>
                        <div className="cs-list-meta">{formatDateTime(m.scheduled_date)}</div>
                      </div>
                      <StatusBadge status={m.status} label={LABELS[m.status] || m.status} />
                    </header>
                    <dl className="cs-kv">
                      <div><dt>Where</dt><dd>{m.location || "—"}</dd></div>
                      <div><dt>Type</dt><dd>{(m.meeting_type || "").toLowerCase() || "—"}</dd></div>
                    </dl>
                    {m.meeting_link && <p className="cs-list-meta" style={{ margin: 0 }}><a href={m.meeting_link} target="_blank" rel="noopener noreferrer">Join online</a></p>}
                    <footer className="cs-actions">
                      <Link to={`/chamas/${id}/meetings/${m.meeting_id}`} className="cs-btn cs-btn--secondary cs-btn--sm">Details</Link>
                    </footer>
                  </article>
                ))}
              </div>
            )}
            <p className="cs-footnote">{visible.length} of {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}</p>
          </section>
        )}
      </main>
    </div>
  );
}
