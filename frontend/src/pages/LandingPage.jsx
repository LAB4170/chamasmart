import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Wallet, Landmark, RefreshCw, HeartHandshake, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { title: "Contributions", text: "Members report a payment, officials verify it, and the fund updates only after that.", Icon: Wallet, color: "#16a34a" },
  { title: "Loans", text: "Set the rate and limit, collect guarantors and track every repayment.", Icon: Landmark, color: "#2563eb" },
  { title: "Merry-go-round", text: "Rotating cycles with a clear payout order, each payout recorded.", Icon: RefreshCw, color: "#ea580c" },
  { title: "Welfare", text: "A claim is paid only after two different officials approve it.", Icon: HeartHandshake, color: "#db2777" },
  { title: "Roles and records", text: "Everyone sees only what their role allows, and money movements are logged.", Icon: ShieldCheck, color: "#475569" },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (isAuthenticated) navigate("/dashboard"); }, [isAuthenticated, navigate]);

  return (
    <div className="cs-shell">
      <div className="cs-page cs-landing">
        <main>
          <section className="cs-landing-hero">
            <div className="cs-landing-icon" aria-hidden="true">CS</div>
            <h1>Your chama, with clear books</h1>
            <p>Contributions, loans, merry-go-round and welfare for your savings group, all in one place.</p>
            <div className="cs-landing-cta">
              <Link to="/register" className="cs-btn cs-btn--primary">Create an account</Link>
              <Link to="/login" className="cs-landing-signin">I already have an account</Link>
            </div>
          </section>
          <h2 className="cs-landing-label">What you can do</h2>
          <ul className="cs-landing-group">
            {FEATURES.map(({ title, text, Icon, color }) => (
              <li key={title} className="cs-landing-row">
                <span className="cs-landing-row-icon" style={{ background: color }} aria-hidden="true"><Icon size={20} /></span>
                <div>
                  <h3 style={{ margin: "0 0 2px", fontSize: "1.0625rem", fontWeight: 600 }}>{title}</h3>
                  <p style={{ margin: 0 }}>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </main>
        <p className="cs-landing-foot">&copy; {new Date().getFullYear()} ChamaSmart</p>
      </div>
    </div>
  );
}
