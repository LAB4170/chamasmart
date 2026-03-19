import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ArrowRight, MessageSquare, ShieldCheck } from "lucide-react";
import googleLogo from "../../assets/images/google-logo.png";
import "./Auth.css";

// Shared frictionless auth UI for both Login and Register
const AuthFlow = ({ title = "Welcome Back", subtitle = "Login securely to ChamaSmart" }) => {
  const [step, setStep] = useState("PHONE"); // "PHONE" | "OTP"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]); // Array for individual digit inputs
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { loginWithPhone, verifyPhoneOTP, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard");
  }, [isAuthenticated, navigate]);

  // Format Kenyan phone to international format
  const formatPhone = (input) => {
    let cleaned = input.replace(/\D/g, "");
    if (cleaned.startsWith("0")) return `+254${cleaned.substring(1)}`;
    if (cleaned.startsWith("254")) return `+${cleaned}`;
    if (cleaned.startsWith("7") || cleaned.startsWith("1")) return `+254${cleaned}`;
    return input;
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError("");
    if (!phone || phone.replace(/\D/g, "").length < 9) {
      setError("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    const formattedPhone = formatPhone(phone);
    // loginWithPhone attaches invisible reCAPTCHA to #phone-submit-btn
    const result = await loginWithPhone(formattedPhone, "phone-submit-btn");
    setLoading(false);

    if (result.success) {
      setPhone(formattedPhone);
      setStep("OTP");
    } else {
      setError(result.error || "Failed to send OTP. Please try again.");
    }
  };

  // OTP box input handler — auto-advance to next box
  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return; // Only digits allowed
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-advance focus
    if (value && index < 5) {
      document.getElementById(`otp-box-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-box-${index - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").substring(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) newOtp[i] = pasted[i] || "";
      setOtp(newOtp);
      // Focus the last filled box
      const focusIdx = Math.min(pasted.length, 5);
      document.getElementById(`otp-box-${focusIdx}`)?.focus();
    }
    e.preventDefault();
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const otpCode = otp.join("");
    setError("");
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }
    setLoading(true);
    const result = await verifyPhoneOTP(otpCode);
    setLoading(false);

    if (result.success) {
      navigate(result.isNewUser ? "/complete-profile" : "/dashboard");
    } else {
      setError(result.error || "Invalid code. Please try again.");
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    const result = await loginWithGoogle();
    setLoading(false);
    if (result.success) navigate("/dashboard");
    else setError(result.error || "Google sign-in failed. Please try again.");
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">

        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <ShieldCheck size={34} />
          </div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
        </div>

        {/* Card */}
        <div className="auth-card">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          {step === "PHONE" ? (
            <form onSubmit={handleRequestOTP}>
              <div style={{ marginBottom: "20px" }}>
                <label className="form-label-auth">
                  Phone Number
                </label>
                <div className="phone-input-container">
                  <span className="phone-prefix">
                    🇰🇪 +254
                  </span>
                  <input
                    type="tel"
                    className="phone-input"
                    value={phone.replace(/^\+254/, "").replace(/^0/, "")}
                    onChange={(e) => { setError(""); setPhone(e.target.value); }}
                    placeholder="7XX XXX XXX"
                    autoFocus
                  />
                </div>
                <p className="phone-hint">
                  We'll send a 6-digit code via SMS
                </p>
              </div>

              {/* reCAPTCHA is invisibly attached to this button by Firebase */}
                <button
                id="phone-submit-btn"
                type="submit"
                className="btn-auth-submit"
                disabled={loading || !phone}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: "18px", height: "18px", borderWidth: "2px", margin: "0" }} /><span>Sending code...</span></>
                ) : (
                  <><span>Send Code</span><ArrowRight size={18} /></>
                )}
              </button>

              <div className="auth-divider">
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
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "60px", height: "60px", background: "var(--bg-primary-light)", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px auto", color: "var(--secondary)"
              }}>
                <MessageSquare size={26} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary)", marginBottom: "8px" }}>Check your messages</h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: "28px", fontSize: "14px", lineHeight: "1.6" }}>
                We sent a 6-digit code to <strong style={{ color: "var(--text-primary)" }}>{phone}</strong>
              </p>

              {/* 6-box OTP input */}
              <form onSubmit={handleVerifyOTP}>
                <div className="otp-box-container" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-box-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className={`otp-box ${digit ? "filled" : ""}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className="btn-auth-submit"
                  disabled={loading || otp.join("").length !== 6}
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("PHONE"); setOtp(["","","","","",""]); setError(""); }}
                  style={{
                    marginTop: "16px", background: "none", border: "none",
                    color: "var(--secondary)", fontWeight: "600", fontSize: "14px", cursor: "pointer"
                  }}
                >
                  ← Change number / Resend code
                </button>
              </form>
            </div>
          )}
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

// Export as Login (default export keeps /login route working)
export default AuthFlow;
