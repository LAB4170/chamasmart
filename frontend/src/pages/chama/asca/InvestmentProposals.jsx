import { useParams, Link } from "react-router-dom";
import { PageHeader, EmptyState } from "../../../components/ui";

/** Proposals and voting are not stored by the server yet. */
export default function InvestmentProposals() {
  const { id } = useParams();
  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="Investment proposals" />
        <div className="cs-card">
          <EmptyState
            title="Proposals aren't available yet"
            message="Proposing investments and voting on them hasn't been switched on, so nothing here can be created or counted."
            action={<Link to={`/chamas/${id}/asca`} className="cs-btn cs-btn--secondary">Back to shares</Link>}
          />
        </div>
      </main>
    </div>
  );
}
