import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { authAPI } from "../../services/api";
import { Button } from "../../components/ui";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 8) { setError("Use at least 8 characters."); return; }
    if (pw !== pw2) { setError("The two passwords don't match."); return; }
    setBusy(true); setError("");
    try {
      await authAPI.resetPassword(token, pw);
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't change the password. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="cs-auth">
      <main className="cs-auth-card">
        <div className="cs-auth-brand"><h1>Choose a new password</h1></div>
        {!token ? (
          <div className="cs-card"><p>This link is incomplete. <Link to="/forgot-password">Ask for a new one</Link>.</p></div>
        ) : done ? (
          <div className="cs-card"><p>Password changed. You've been signed out everywhere. Taking you to sign in…</p><Link to="/login">Sign in now</Link></div>
        ) : (
          <form className="cs-card" onSubmit={submit} noValidate>
            {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}><span>{error} {error.includes("expired") && <Link to="/forgot-password">Get a new link</Link>}</span></div>}
            <div className="cs-field">
              <label className="cs-label" htmlFor="rp-pw">New password</label>
              <div className="cs-pw">
                <input id="rp-pw" type={show ? "text" : "password"} className="cs-input" autoComplete="new-password" value={pw} onChange={(e) => { setError(""); setPw(e.target.value); }} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
              </div>
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="rp-pw2">Repeat password</label>
              <input id="rp-pw2" type={show ? "text" : "password"} className="cs-input" autoComplete="new-password" value={pw2} onChange={(e) => { setError(""); setPw2(e.target.value); }} />
            </div>
            <Button type="submit" variant="primary" className="cs-btn--block" loading={busy}>Change password</Button>
          </form>
        )}
      </main>
    </div>
  );
}
