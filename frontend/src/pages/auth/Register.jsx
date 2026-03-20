import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ArrowRight, Mail, Lock, ShieldCheck, User, Phone, CheckCircle2, Eye, EyeOff } from "lucide-react";
import googleLogo from "../../assets/images/google-logo.png";
import "./Auth.css";

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { register, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const requirements = [
    { label: "At least 8 characters", met: formData.password.length >= 8 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(formData.password) },
    { label: "At least one lowercase letter", met: /[a-z]/.test(formData.password) },
    { label: "At least one number", met: /\d/.test(formData.password) },
    { label: "At least one special character", met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) }
  ];

  const allMet = requirements.every(r => r.met);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // Basic validation
    if (!allMet) {
      setError("Please meet all password security requirements");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    const result = await register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      password: formData.password
    });
    setLoading(false);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error || "Registration failed. Please try again.");
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
      <div className="auth-container" style={{ maxWidth: "480px" }}>
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <ShieldCheck size={34} />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join the modern way of managing Chamas</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister}>
            {/* Name Row */}
            <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <label className="form-label-auth">First Name</label>
                <div className="auth-input-container">
                  <div className="auth-input-icon">
                    <User size={18} />
                  </div>
                  <input
                    name="firstName"
                    type="text"
                    className="auth-input"
                    placeholder="Jane"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label-auth">Last Name</label>
                <div className="auth-input-container">
                  <input
                    name="lastName"
                    type="text"
                    className="auth-input"
                    placeholder="Doe"
                    style={{ paddingLeft: "16px" }}
                    value={formData.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group-auth" style={{ marginBottom: "20px" }}>
              <label className="form-label-auth">Email Address</label>
              <div className="auth-input-container">
                <div className="auth-input-icon">
                  <Mail size={18} />
                </div>
                <input
                  name="email"
                  type="email"
                  className="auth-input"
                  placeholder="jane@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group-auth" style={{ marginBottom: "20px" }}>
              <label className="form-label-auth">Phone Number</label>
              <div className="auth-input-container">
                <div className="auth-input-icon">
                  <Phone size={18} />
                </div>
                <input
                  name="phoneNumber"
                  type="tel"
                  className="auth-input"
                  placeholder="+2547XXXXXXXX"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group-auth" style={{ marginBottom: "20px" }}>
              <label className="form-label-auth">Password</label>
              <div className="auth-input-container" style={{ marginBottom: "12px" }}>
                <div className="auth-input-icon">
                  <Lock size={18} />
                </div>
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Create a secure password"
                  value={formData.password}
                  onChange={handleChange}
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

              {/* Password Requirements List */}
              <div className="password-requirements">
                {requirements.map((req, idx) => (
                  <div key={idx} className={`requirement-item ${req.met ? "met" : ""}`}>
                    <div className="dot" />
                    {req.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group-auth" style={{ marginBottom: "24px" }}>
              <label className="form-label-auth">Confirm Password</label>
              <div className="auth-input-container">
                <div className="auth-input-icon">
                  <CheckCircle2 size={18} />
                </div>
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="Repeat password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-auth-submit"
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" style={{ width: "18px", height: "18px", borderWidth: "2px", margin: "0 8px 0 0" }} /><span>Creating account...</span></>
              ) : (
                <><span>Get Started</span><ArrowRight size={18} /></>
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
            <span className="divider-text">ALREADY HAVE AN ACCOUNT?</span>
            <div className="divider-line" />
          </div>

          <Link to="/login" className="btn-google-auth" style={{ textDecoration: "none", color: "inherit", background: "none", border: "1px solid rgba(255,255,255,0.1)" }}>
            Sign In Instead
          </Link>
        </div>

        <p className="auth-footer">
          By registering, you agree to our{" "}
          <Link to="/terms">Terms</Link>{" "}
          and{" "}
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
