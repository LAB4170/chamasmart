import { Link } from "react-router-dom";
import { PageHeader, EmptyState } from "../../components/ui";

/** API keys are not issued by the server yet. */
export default function ApiKeyManagement() {
  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="API keys" />
        <div className="cs-card">
          <EmptyState
            title="API keys aren't available yet"
            message="Programmatic access hasn't been switched on. Nothing here can create or revoke a key."
            action={<Link to="/dashboard" className="cs-btn cs-btn--secondary">Back to dashboard</Link>}
          />
        </div>
      </main>
    </div>
  );
}
