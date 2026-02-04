import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Helper function to format Kenyan phone numbers
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Handle different input formats
  if (cleaned.startsWith("254")) {
    // Already in international format (2547...)
    return `+${cleaned}`;
  } else if (cleaned.startsWith("07") && cleaned.length === 10) {
    // Local format with leading 0 (07...)
    return `+254${cleaned.substring(1)}`;
  } else if (cleaned.startsWith("7") && cleaned.length === 9) {
    // Local format without leading 0 (7...)
    return `+254${cleaned}`;
  } else if (cleaned.startsWith("254") && cleaned.length === 12) {
    // Already in international format without +
    return `+${cleaned}`;
  }

  // Return as is if format is not recognized
  return phone;
};

// Function to validate Kenyan phone number
const isValidKenyanNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, "");

  // Check for mobile numbers (7, 1, or 0 followed by 7)
  const mobileRegex = /^(?:254|0)?(7[0-9]{8})$/;

  // Check for landlines (20, 40, 41, 42, 43, 44, 45, 46, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69)
  const landlineRegex = /^(?:254|0)?(2[0-9]|4[0-6]|5[0-9]|6[0-9])[0-9]{6,7}$/;

  return mobileRegex.test(cleaned) || landlineRegex.test(cleaned);
};

const Register = () => {
  // Step 1: Registration form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });

  // Step 2: OTP verification state
  const [otp, setOtp] = useState("");
  const [currentStep, setCurrentStep] = useState(1); // 1 = registration, 2 = OTP verification
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registrationData, setRegistrationData] = useState(null);

  const { register, registerWithFirebase, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleOtpChange = (e) => {
    // Only allow numbers and limit to 6 digits
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
  };

  const validateForm = () => {
    // Validate required fields
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phoneNumber ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError("All fields are required");
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }

    // Format and validate Kenyan phone number
    const formattedPhone = formatPhoneNumber(formData.phoneNumber);
    if (!isValidKenyanNumber(formattedPhone)) {
      setError(
        "Please enter a valid Kenyan phone number (e.g., 0712345678 or +254712345678)",
      );
      return false;
    }

    // Update the phone number with formatted version
    formData.phoneNumber = formattedPhone;

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordRegex.test(formData.password)) {
      setError(
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      );
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    try {
      const result = await registerWithFirebase(formData.email, formData.password, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber
      });

      if (result.success) {
        navigate("/dashboard");
      } else {
        setError(result.error || "Registration failed");
      }
    } catch (err) {
      setError(err.message || "Registration failed");
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError("");
    setLoading(true);

    const result = await loginWithGoogle();

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);

    try {
      // Call the verifyOTP function from AuthContext
      const result = await verifyOTP(registrationData.email, otp);

      if (result.success) {
        // Redirect to login or dashboard
        navigate("/login", {
          state: {
            message: "Registration successful! Please log in.",
            email: registrationData.email,
          },
        });
      } else {
        setError(result.error || "Verification failed. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again later.");
      console.error("OTP verification error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setLoading(true);

    try {
      const result = await resendOTP(registrationData.email);
      if (result.success) {
        setError("New OTP has been sent to your email/phone.");
      } else {
        setError(result.error || "Failed to resend OTP. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again later.");
      console.error("Resend OTP error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Render OTP verification step
  if (currentStep === 2) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card">
            <h1 className="text-center">Verify Your Account</h1>
            <p className="text-center text-muted">
              We've sent a 6-digit verification code to {registrationData.email}{" "}
              and {registrationData.phoneNumber}
            </p>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  type="text"
                  name="otp"
                  className="form-input text-center"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={handleOtpChange}
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify Account"}
              </button>

              <div className="text-center mt-4">
                <p>
                  Didn't receive a code?{" "}
                  <button
                    type="button"
                    className="text-primary"
                    onClick={handleResendOtp}
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Resend Code"}
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Render registration form (step 1)
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="text-center">Create Account</h1>
          <p className="text-center text-muted">
            Join ChamaSmart to manage your groups
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  className="form-input"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  className="form-input"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                name="phoneNumber"
                className="form-input"
                placeholder="0712345678 or +254712345678"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
              />
              <small className="text-muted">
                Enter your Kenyan number (e.g., 0712345678 or +254712345678)
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-input"
                  placeholder="Create a password (min 8 characters, uppercase, lowercase, number)"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  className="form-input"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-block google-login"
            onClick={handleGoogleRegister}
            disabled={loading}
          >
            <img src="/google-icon.svg" alt="" className="btn-icon" />
            Sign up with Google
          </button>

          <div className="text-center mt-4">
            <p>
              Already have an account?{" "}
              <Link to="/login" className="text-primary">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
