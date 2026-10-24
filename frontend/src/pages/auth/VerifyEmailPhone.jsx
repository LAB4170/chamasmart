import { Link } from "react-router-dom";
import { PageHeader, EmptyState } from "../../components/ui";

/** The server does not issue verification codes yet, so this page says so instead of pretending. */
export default function VerifyEmailPhone() {
  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="Verify your account" />
        <div className="cs-card">
          <EmptyState
            title="Verification isn't available yet"
            message="You don't need to verify your email or phone to use ChamaSmart right now. We'll tell you when it's switched on."
            action={<Link to="/dashboard" className="cs-btn cs-btn--primary">Go to dashboard</Link>}
          />
        </div>
      </main>
    </div>
  );
}
