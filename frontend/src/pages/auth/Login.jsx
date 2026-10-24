import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui";
import googleLogo from "../../assets/images/google-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (isAuthenticated) navigate("/dashboard"); }, [isAuthenticated, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) navigate("/dashboard");
      else setError(result.error || "That email or password isn't right.");
    } catch {
      setError("We couldn't reach the server. It may be waking up, so please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    setError("");
    const result = await loginWithGoogle();
    setLoading(false);
    if (result.success) navigate("/dashboard");
    else setError(result.error || "Google sign-in didn't work. Please try again.");
  };

  return (
    <div className="cs-auth">
      <main className="cs-auth-card">
        <div className="cs-auth-brand">
          <h1>Welcome back</h1>
          <p>Sign in to ChamaSmart</p>
        </div>
        <form className="cs-card" onSubmit={submit} noValidate>
          {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}><span>{error}</span></div>}
          <div className="cs-field">
            <label className="cs-label" htmlFor="login-email">Email</label>
            <input id="login-email" type="email" className="cs-input" autoComplete="email" inputMode="email" value={email} onChange={(e) => { setError(""); setEmail(e.target.value); }} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="login-password">Password</label>
            <div className="cs-pw">
              <input id="login-password" type={show ? "text" : "password"} className="cs-input" autoComplete="current-password" value={password} onChange={(e) => { setError(""); setPassword(e.target.value); }} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
            </div>
          </div>
          <Button type="submit" variant="primary" className="cs-btn--block" loading={loading}>Sign in</Button>
          <div className="cs-auth-divider">or</div>
          <button type="button" className="cs-btn cs-btn--secondary cs-btn--block" onClick={google} disabled={loading}>
            <img src={googleLogo} alt="" width="18" height="18" style={{ marginRight: 8 }} />Continue with Google
          </button>
        </form>
        <p className="cs-footnote" style={{ textAlign: "center", marginTop: 16 }}>New to ChamaSmart? <Link to="/register">Create an account</Link></p>
      </main>
    </div>
  );
}
