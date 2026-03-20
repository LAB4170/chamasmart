import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ArrowRight, Mail, Lock, ShieldCheck, Eye, EyeOff } from "lucide-react";
import googleLogo from "../../assets/images/google-logo.png";
import "./Auth.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Invalid email or password");
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    const result = await loginWithGoogle();
    setLoading(false);
    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Google sign-in failed");
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <ShieldCheck size={34} />
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Login securely to your ChamaSmart account</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group-auth" style={{ marginBottom: "20px" }}>
              <label className="form-label-auth">Email Address</label>
              <div className="auth-input-container">
                <div className="auth-input-icon">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => { setError(""); setEmail(e.target.value); }}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group-auth" style={{ marginBottom: "20px" }}>
              <label className="form-label-auth">Password</label>
              <div className="auth-input-container">
                <div className="auth-input-icon">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => { setError(""); setPassword(e.target.value); }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    background: "none",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: "4px"
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Link to="/forgot-password" style={{ 
              display: "block", 
              textAlign: "right", 
              fontSize: "13px", 
              color: "var(--text-secondary)", 
              marginBottom: "24px",
              marginTop: "-12px",
              fontWeight: "500",
              textDecoration: "none"
            }}>
              Forgot password?
            </Link>

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" style={{ width: "18px", height: "18px", borderWidth: "2px", margin: "0 8px 0 0" }} /><span>Signing in...</span></>
              ) : (
                <><span>Sign In</span><ArrowRight size={18} /></>
              )}
            </button>

            <div className="auth-divider" style={{ margin: "24px 0" }}>
              <div className="divider-line" />
              <span className="divider-text">OR CONTINUE WITH</span>
              <div className="divider-line" />
            </div>

            <button
              type="button"
              className="btn-google-auth"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <img src={googleLogo} alt="Google" />
              Continue with Google
            </button>
          </form>

          <div className="auth-divider" style={{ margin: "28px 0" }}>
            <div className="divider-line" />
            <span className="divider-text">NEW TO CHAMASMART?</span>
            <div className="divider-line" />
          </div>

          <Link to="/register" className="btn-google-auth" style={{ textDecoration: "none", color: "inherit", background: "none", border: "1px solid rgba(255,255,255,0.1)" }}>
            Create an Account
          </Link>
        </div>

        <p className="auth-footer">
          By continuing, you agree to our{" "}
          <Link to="/terms">Terms</Link>{" "}
          and{" "}
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
