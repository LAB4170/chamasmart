import { useParams, Link } from "react-router-dom";
import { PageHeader, EmptyState } from "../../../components/ui";

/** Live table-banking sessions (opening cash, penalties, closing count) are not stored by the server yet. */
export default function TableSessionDashboard() {
  const { id, meetingId } = useParams();
  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="Meeting session" />
        <div className="cs-card">
          <EmptyState
            title="Live sessions aren't available yet"
            message="Opening and closing cash counts, and penalties recorded during a meeting, haven't been switched on. You can still write and publish the minutes."
            action={<Link to={`/chamas/${id}/meetings/${meetingId}`} className="cs-btn cs-btn--secondary">Back to meeting</Link>}
          />
        </div>
      </main>
    </div>
  );
}
