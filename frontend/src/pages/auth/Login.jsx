import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
        <motion.div 
          className="auth-split-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* Left: Form Side */}
          <div className="auth-form-side">
            {/* Brand Header */}
            <div className="auth-brand-header">
              <div className="auth-brand-icon">
                <ShieldCheck size={32} strokeWidth={2} />
              </div>
              <h1 className="auth-title">Welcome Back</h1>
              <p className="auth-subtitle">Login securely to your ChamaSmart account</p>
            </div>

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

            <div className="auth-divider" style={{ margin: "24px 0" }}>
              <div className="divider-line" />
              <span className="divider-text">NEW TO CHAMASMART?</span>
              <div className="divider-line" />
            </div>

            <Link to="/register" className="btn-google-auth" style={{ textDecoration: "none", color: "inherit", background: "transparent", border: "1.5px solid var(--border)" }}>
              Create an Account
            </Link>

            <p className="auth-footer" style={{ marginTop: "24px", fontSize: "12px" }}>
              By continuing, you agree to our{" "}
              <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy</Link>
            </p>
          </div>

          {/* Right: Visual Side */}
          <div className="auth-visual-side">
            <div className="auth-visual-inner">
              <img src="https://images.unsplash.com/photo-1633158829585-23ba8f7c8caf?auto=format&fit=crop&w=1200&q=80" alt="Finance Dashboard" />
              <div className="auth-visual-overlay">
                <h2 className="auth-quote">"Wealth is the ability to fully experience life."</h2>
                <div className="auth-author">
                  <div style={{ width: "24px", height: "2px", background: "#D4AF37" }}></div>
                  ChamaSmart Finance
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
