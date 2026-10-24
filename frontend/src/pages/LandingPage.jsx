import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { title: "Contributions", text: "Members report payments, officials verify them, and the group fund updates only after verification." },
  { title: "Loans", text: "Set the interest rate and borrowing limit, collect guarantors, and track every repayment against a schedule." },
  { title: "Merry-go-round", text: "Run rotating cycles with a clear payout order, and record each payout in the books." },
  { title: "Welfare", text: "Configure events and handle claims. A claim is paid only after two different officials approve it." },
  { title: "Roles and records", text: "Chairperson, treasurer, secretary and members each see only what they should, and money movements are logged." },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (isAuthenticated) navigate("/dashboard"); }, [isAuthenticated, navigate]);

  return (
    <div className="cs-shell">
      <div className="cs-page">
        <nav className="cs-landing-nav" aria-label="Main">
          <strong>ChamaSmart</strong>
          <Link to="/login" className="cs-btn cs-btn--secondary cs-btn--sm">Sign in</Link>
        </nav>
        <main>
          <section className="cs-landing-hero">
            <h1>Run your chama with clear books</h1>
            <p>Contributions, loans, merry-go-round and welfare for your savings group, in one place on your phone.</p>
            <div className="cs-actions">
              <Link to="/register" className="cs-btn cs-btn--primary">Create an account</Link>
              <Link to="/login" className="cs-btn cs-btn--secondary">Sign in</Link>
            </div>
          </section>
          <section aria-label="What you can do" className="cs-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="cs-card">
                <h2 className="cs-card-title">{f.title}</h2>
                <p className="cs-list-meta" style={{ margin: 0 }}>{f.text}</p>
              </article>
            ))}
          </section>
        </main>
        <p className="cs-footnote" style={{ textAlign: "center", marginTop: 32 }}>&copy; {new Date().getFullYear()} ChamaSmart</p>
      </div>
    </div>
  );
}
