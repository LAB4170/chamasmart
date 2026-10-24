import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui";
import googleLogo from "../../assets/images/google-logo.png";

export default function Register() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phoneNumber: "", password: "", confirmPassword: "" });
  const [agreed, setAgreed] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { register, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const pw = form.password;
  const requirements = [
    { label: "At least 8 characters", met: pw.length >= 8 },
    { label: "An uppercase letter", met: /[A-Z]/.test(pw) },
    { label: "A lowercase letter", met: /[a-z]/.test(pw) },
    { label: "A number", met: /\d/.test(pw) },
    { label: "A special character", met: /[^A-Za-z0-9]/.test(pw) },
  ];
  const allMet = requirements.every((r) => r.met);

  useEffect(() => { if (isAuthenticated) navigate("/dashboard"); }, [isAuthenticated, navigate]);

  const set = (k) => (e) => { setError(""); setForm((f) => ({ ...f, [k]: e.target.value })); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) { setError("Fill in your name and email."); return; }
    if (!allMet) { setError("Your password doesn't meet all the requirements yet."); return; }
    if (pw !== form.confirmPassword) { setError("The two passwords don't match."); return; }
    if (!agreed) { setError("Please accept the terms and privacy notice to continue."); return; }
    setLoading(true);
    const result = await register({
      firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(), password: pw, termsAccepted: true,
    });
    setLoading(false);
    if (result.success) navigate("/dashboard");
    else setError(result.error || "We couldn't create your account. Please try again.");
  };

  const google = async () => {
    setLoading(true);
    setError("");
    const result = await loginWithGoogle();
    setLoading(false);
    if (result.success) {
      const u = result.user || {};
      let skipped = false;
      try { skipped = localStorage.getItem("cs_profile_skipped") === "1"; } catch { /* ignore */ }
      navigate(!u.phoneNumber && !u.phone_number && !skipped ? "/complete-profile" : "/dashboard");
    } else setError(result.error || "Google sign-in didn't work. Please try again.");
  };

  return (
    <div className="cs-auth">
      <main className="cs-auth-card">
        <div className="cs-auth-brand">
          <h1>Create your account</h1>
          <p>Run your chama from your phone</p>
        </div>
        <form className="cs-card" onSubmit={submit} noValidate>
          {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}><span>{error}</span></div>}
          <div className="cs-form-grid">
            <div className="cs-field">
              <label className="cs-label" htmlFor="reg-first">First name</label>
              <input id="reg-first" className="cs-input" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} />
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="reg-last">Last name</label>
              <input id="reg-last" className="cs-input" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} />
            </div>
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" className="cs-input" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="reg-phone">Phone (optional)</label>
            <input id="reg-phone" type="tel" className="cs-input" autoComplete="tel" inputMode="tel" value={form.phoneNumber} onChange={set("phoneNumber")} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="reg-pw">Password</label>
            <div className="cs-pw">
              <input id="reg-pw" type={show ? "text" : "password"} className="cs-input" autoComplete="new-password" aria-describedby="reg-reqs" value={pw} onChange={set("password")} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
            </div>
            <ul id="reg-reqs" className="cs-reqs">
              {requirements.map((r) => <li key={r.label} data-met={r.met}>{r.met ? "✓" : "○"} {r.label}</li>)}
            </ul>
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="reg-confirm">Confirm password</label>
            <input id="reg-confirm" type={show ? "text" : "password"} className="cs-input" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} />
          </div>
          <label className="cs-check" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={agreed} onChange={(e) => { setError(""); setAgreed(e.target.checked); }} />
            <span>I accept the <Link to="/terms" target="_blank" rel="noopener noreferrer">terms of use</Link> and the <Link to="/privacy" target="_blank" rel="noopener noreferrer">privacy notice</Link>.</span>
          </label>
          <Button type="submit" variant="primary" className="cs-btn--block" loading={loading}>Create account</Button>
          <div className="cs-auth-divider">or</div>
          <button type="button" className="cs-btn cs-btn--secondary cs-btn--block" onClick={google} disabled={loading}>
            <img src={googleLogo} alt="" width="18" height="18" style={{ marginRight: 8 }} />Continue with Google
          </button>
          <p className="cs-help" style={{ textAlign: "center" }}>By continuing with Google you accept the <Link to="/terms">terms</Link> and <Link to="/privacy">privacy notice</Link>.</p>
        </form>
        <p className="cs-footnote" style={{ textAlign: "center", marginTop: 16 }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </main>
    </div>
  );
}
