import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const VerifyEmailPhone = () => {
  const {
    user,
    verifyEmail,
    verifyPhone,
    resendEmailVerification,
    resendPhoneVerification,
    error,
  } = useAuth();
  const [emailToken, setEmailToken] = useState("");
  const [emailStatus, setEmailStatus] = useState(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStatus, setPhoneStatus] = useState(null);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [submittingPhone, setSubmittingPhone] = useState(false);
  const [resendEmailStatus, setResendEmailStatus] = useState(null);
  const [resendPhoneStatus, setResendPhoneStatus] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Extract token from URL query if present (e.g. /verify-account?token=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get("token");
    if (tokenFromUrl) {
      setEmailToken(tokenFromUrl);
    }
  }, [location.search]);

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    if (!emailToken) return;
    setSubmittingEmail(true);
    setEmailStatus(null);

    const result = await verifyEmail(emailToken);
    if (result.success) {
      setEmailStatus({ type: "success", message: result.message });
    } else {
      setEmailStatus({ type: "error", message: result.error });
    }

    setSubmittingEmail(false);
  };

  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    if (!phoneCode) return;
    setSubmittingPhone(true);
    setPhoneStatus(null);

    const result = await verifyPhone(phoneCode);
    if (result.success) {
      setPhoneStatus({ type: "success", message: result.message });
    } else {
      setPhoneStatus({ type: "error", message: result.error });
    }

    setSubmittingPhone(false);
  };

  const handleResendEmail = async () => {
    setResendEmailStatus(null);
    const result = await resendEmailVerification();
    if (result.success) {
      setResendEmailStatus({ type: "success", message: result.message });
    } else {
      setResendEmailStatus({ type: "error", message: result.error });
    }
  };

  const handleResendPhone = async () => {
    setResendPhoneStatus(null);
    const result = await resendPhoneVerification();
    if (result.success) {
      setResendPhoneStatus({ type: "success", message: result.message });
    } else {
      setResendPhoneStatus({ type: "error", message: result.error });
    }
  };

  const handleContinue = () => {
    navigate("/dashboard");
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="text-center">Verify Your Account</h1>
          <p className="text-center text-muted">
            We sent verification links to your email and phone. Complete these steps
            to fully activate your ChamaSmart account.
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="verify-section">
            <h2>Email Verification</h2>
            <p className="text-muted">
              Check your inbox for a verification link. If you have a token, you can
              paste it below. You can also request a new email if needed.
            </p>
            {emailStatus && (
              <div
                className={`alert alert-${
                  emailStatus.type === "success" ? "success" : "error"
                }`}
              >
                {emailStatus.message}
              </div>
            )}
            <form onSubmit={handleVerifyEmail} className="form-inline">
              <input
                type="text"
                className="form-input"
                placeholder="Email verification token"
                value={emailToken}
                onChange={(e) => setEmailToken(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingEmail || !emailToken}
              >
                {submittingEmail ? "Verifying..." : "Verify Email"}
              </button>
            </form>
            {resendEmailStatus && (
              <div
                className={`alert alert-${
                  resendEmailStatus.type === "success" ? "success" : "error"
                }`}
              >
                {resendEmailStatus.message}
              </div>
            )}
            <button
              type="button"
              className="btn btn-link"
              onClick={handleResendEmail}
            >
              Resend verification email
            </button>
          </div>

          <hr />

          <div className="verify-section">
            <h2>Phone Verification</h2>
            <p className="text-muted">
              Enter the 6-digit code sent to your phone number
              {user?.phoneNumber ? ` (${user.phoneNumber})` : ""}.
            </p>
            {phoneStatus && (
              <div
                className={`alert alert-${
                  phoneStatus.type === "success" ? "success" : "error"
                }`}
              >
                {phoneStatus.message}
              </div>
            )}
            <form onSubmit={handleVerifyPhone} className="form-inline">
              <input
                type="text"
                className="form-input"
                placeholder="6-digit SMS code"
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                maxLength={6}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingPhone || phoneCode.length !== 6}
              >
                {submittingPhone ? "Verifying..." : "Verify Phone"}
              </button>
            </form>
            {resendPhoneStatus && (
              <div
                className={`alert alert-${
                  resendPhoneStatus.type === "success" ? "success" : "error"
                }`}
              >
                {resendPhoneStatus.message}
              </div>
            )}
            <button
              type="button"
              className="btn btn-link"
              onClick={handleResendPhone}
            >
              Resend SMS code
            </button>
          </div>

          <div className="mt-4 text-center">
            <button className="btn btn-secondary" onClick={handleContinue}>
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPhone;
