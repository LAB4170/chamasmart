import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ArrowRight, MessageSquare, ShieldCheck } from "lucide-react";
import googleLogo from "../../assets/images/google-logo.png";

// Shared frictionless auth UI for both Login and Register
const AuthFlow = ({ title = "Create an Account", subtitle = "Join ChamaSmart securely" }) => {
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
    // loginWithPhone attaches invisible reCAPTCHA to #register-submit-btn
    const result = await loginWithPhone(formattedPhone, "register-submit-btn");
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
      if (focusIdx < 6) document.getElementById(`otp-box-${focusIdx}`)?.focus();
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
    <div style={{
      background: "linear-gradient(135deg, #f0fdf4 0%, #d1fae5 50%, #f0fdf4 100%)",
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "68px", height: "68px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            borderRadius: "22px", color: "white", marginBottom: "16px",
            boxShadow: "0 12px 28px rgba(16, 185, 129, 0.4)"
          }}>
            <ShieldCheck size={34} />
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#064e3b", letterSpacing: "-0.3px", margin: 0 }}>{title}</h1>
          <p style={{ color: "#6b7280", marginTop: "8px", fontSize: "15px" }}>{subtitle}</p>
        </div>

        {/* Card */}
        <div style={{
          background: "white", borderRadius: "24px", padding: "36px 32px",
          boxShadow: "0 20px 50px rgba(16, 185, 129, 0.08), 0 0 0 1px rgba(16, 185, 129, 0.06)"
        }}>
          {error && (
            <div style={{
              background: "#fef2f2", color: "#dc2626", padding: "12px 16px",
              borderRadius: "12px", fontSize: "14px", marginBottom: "20px",
              fontWeight: "500", border: "1px solid #fee2e2"
            }}>
              {error}
            </div>
          )}

          {step === "PHONE" ? (
            <form onSubmit={handleRequestOTP}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>
                  Phone Number
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "0", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "14px", overflow: "hidden", transition: "border-color 0.2s" }}>
                  <span style={{ padding: "0 14px", fontSize: "16px", fontWeight: "700", color: "#10b981", borderRight: "1.5px solid #e5e7eb", lineHeight: "54px", background: "#ecfdf5" }}>
                    🇰🇪 +254
                  </span>
                  <input
                    type="tel"
                    value={phone.replace(/^\+254/, "").replace(/^0/, "")}
                    onChange={(e) => { setError(""); setPhone(e.target.value); }}
                    placeholder="7XX XXX XXX"
                    style={{
                      flex: 1, padding: "15px 16px", fontSize: "17px", fontWeight: "600",
                      background: "transparent", border: "none", outline: "none", color: "#111827"
                    }}
                    autoFocus
                  />
                </div>
                <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>
                  We'll send a 6-digit code via SMS
                </p>
              </div>

              {/* reCAPTCHA is invisibly attached to this button by Firebase */}
                <button
                id="register-submit-btn"
                type="submit"
                disabled={loading || !phone}
                style={{
                  width: "100%", padding: "15px", fontSize: "16px", fontWeight: "700",
                  background: loading || !phone ? "#a7f3d0" : "linear-gradient(135deg, #10b981, #059669)",
                  color: "white", border: "none", borderRadius: "14px",
                  cursor: loading || !phone ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  boxShadow: loading || !phone ? "none" : "0 8px 20px rgba(16, 185, 129, 0.35)",
                  transition: "all 0.25s"
                }}
              >
                {loading ? (
                  <><span className="spinner" style={{ width: "18px", height: "18px", borderWidth: "2px" }} /><span>Sending code...</span></>
                ) : (
                  <><span>Send Code</span><ArrowRight size={18} /></>
                )}
              </button>

              <div style={{ display: "flex", alignItems: "center", margin: "28px 0", gap: "12px" }}>
                <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#9ca3af", letterSpacing: "0.5px" }}>OR CONTINUE WITH</span>
                <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                style={{
                  width: "100%", padding: "15px", fontSize: "15px", fontWeight: "600",
                  background: "white", border: "1.5px solid #e5e7eb", color: "#374151",
                  borderRadius: "14px", cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  transition: "all 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                }}
              >
                <img src={googleLogo} alt="Google" style={{ width: "20px", height: "20px" }} />
                Continue with Google
              </button>
            </form>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: "60px", height: "60px", background: "#d1fae5", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px auto", color: "#059669"
              }}>
                <MessageSquare size={26} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#064e3b", marginBottom: "8px" }}>Check your messages</h2>
              <p style={{ color: "#6b7280", marginBottom: "28px", fontSize: "14px", lineHeight: "1.6" }}>
                We sent a 6-digit code to <strong style={{ color: "#111827" }}>{phone}</strong>
              </p>

              {/* 6-box OTP input */}
              <form onSubmit={handleVerifyOTP}>
                <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "24px" }} onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-box-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      autoFocus={i === 0}
                      style={{
                        width: "48px", height: "56px", fontSize: "24px", fontWeight: "700",
                        textAlign: "center", fontFamily: "monospace",
                        background: digit ? "#d1fae5" : "#f9fafb",
                        border: `2px solid ${digit ? "#10b981" : "#e5e7eb"}`,
                        borderRadius: "12px", color: "#064e3b", outline: "none",
                        transition: "all 0.15s"
                      }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.join("").length !== 6}
                  style={{
                    width: "100%", padding: "15px", fontSize: "16px", fontWeight: "700",
                    background: loading || otp.join("").length !== 6 ? "#a7f3d0" : "linear-gradient(135deg, #10b981, #059669)",
                    color: "white", border: "none", borderRadius: "14px",
                    cursor: loading || otp.join("").length !== 6 ? "not-allowed" : "pointer",
                    boxShadow: loading || otp.join("").length !== 6 ? "none" : "0 8px 20px rgba(16, 185, 129, 0.35)",
                    transition: "all 0.25s"
                  }}
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("PHONE"); setOtp(["","","","","",""]); setError(""); }}
                  style={{
                    marginTop: "16px", background: "none", border: "none",
                    color: "#10b981", fontWeight: "600", fontSize: "14px", cursor: "pointer"
                  }}
                >
                  ← Change number / Resend code
                </button>
              </form>
            </div>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: "24px", color: "#9ca3af", fontSize: "13px" }}>
          By continuing, you agree to our{" "}
          <a href="#" style={{ color: "#10b981", fontWeight: "500", textDecoration: "none" }}>Terms</a>{" "}
          and{" "}
          <a href="#" style={{ color: "#10b981", fontWeight: "500", textDecoration: "none" }}>Privacy Policy</a>
        </p>
      </div>
    </div>
  );
};

// Export as Register (default export keeps /register route working)
export default AuthFlow;
