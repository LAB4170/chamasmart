import { useState } from "react";
import { Link } from "react-router-dom";
import { authAPI } from "../../services/api";
import { Button } from "../../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("Enter the email address you signed up with."); return; }
    setBusy(true); setError("");
    try {
      await authAPI.forgotPassword(email.trim());
      setDone(true);
    } catch (err) {
      setError(err.response?.status === 429 ? "Too many requests. Please try again in a while." : "We couldn't reach the server. Please try again in a moment.");
    } finally { setBusy(false); }
  };

  return (
    <div className="cs-auth">
      <main className="cs-auth-card">
        <div className="cs-auth-brand"><h1>Reset your password</h1><p>We'll email you a link</p></div>
        {done ? (
          <div className="cs-card">
            <p>If that address has an account, we've emailed a reset link. It works for one hour. Check your spam folder too.</p>
            <p className="cs-help">Signed up with Google? Just use Continue with Google on the sign-in page.</p>
            <Link to="/login" className="cs-btn cs-btn--primary cs-btn--block">Back to sign in</Link>
          </div>
        ) : (
          <form className="cs-card" onSubmit={submit} noValidate>
            {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}><span>{error}</span></div>}
            <div className="cs-field">
              <label className="cs-label" htmlFor="fp-email">Email</label>
              <input id="fp-email" type="email" className="cs-input" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setError(""); setEmail(e.target.value); }} />
            </div>
            <Button type="submit" variant="primary" className="cs-btn--block" loading={busy}>Send reset link</Button>
            <p className="cs-footnote" style={{ textAlign: "center", marginTop: 12 }}><Link to="/login">Back to sign in</Link></p>
          </form>
        )}
      </main>
    </div>
  );
}
