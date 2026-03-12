import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { userAPI } from "../../services/api";
import { User, Sparkles, ArrowRight, Mail } from "lucide-react";

const CompleteProfile = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If not authenticated, go to login
  if (!isAuthenticated) {
    navigate("/login");
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim()) {
      setError("Please enter your first name");
      return;
    }
    setLoading(true);
    try {
      await userAPI.updateProfile({ 
        firstName: firstName.trim(), 
        lastName: lastName.trim(),
        email: email.trim() || undefined 
      });

      // Update local storage user object with the new names and email
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      savedUser.first_name = firstName.trim();
      savedUser.last_name = lastName.trim();
      if (email.trim()) {
        savedUser.email = email.trim();
      }
      localStorage.setItem("user", JSON.stringify(savedUser));

      navigate("/dashboard");
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Failed to save profile";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "440px" }}>
        {/* Sparkle / Welcome Badge */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "100px",
              padding: "8px 20px",
              color: "#34d399",
              fontSize: "14px",
              fontWeight: "600",
              marginBottom: "24px",
            }}
          >
            <Sparkles size={16} />
            <span>Welcome to ChamaSmart!</span>
          </div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: "800",
              color: "white",
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
              marginBottom: "12px",
            }}
          >
            What should we <br />
            <span
              style={{
                background: "linear-gradient(135deg, #10b981, #3b82f6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              call you?
            </span>
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "16px", lineHeight: 1.5 }}>
            Just your name — that's all we need to get started.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "24px",
            padding: "40px 32px",
          }}
        >
          {error && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
                padding: "12px 16px",
                borderRadius: "12px",
                fontSize: "14px",
                marginBottom: "24px",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* First Name */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                First Name *
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                >
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setError(""); setFirstName(e.target.value); }}
                  placeholder="e.g. John"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "16px 16px 16px 48px",
                    fontSize: "16px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1.5px solid rgba(255,255,255,0.1)",
                    borderRadius: "14px",
                    color: "white",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Last Name */}
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Last Name <span style={{ color: "#475569", fontWeight: "400" }}>(optional)</span>
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                >
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Doe"
                  style={{
                    width: "100%",
                    padding: "16px 16px 16px 48px",
                    fontSize: "16px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1.5px solid rgba(255,255,255,0.1)",
                    borderRadius: "14px",
                    color: "white",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: "32px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#94a3b8",
                  marginBottom: "8px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Email Address <span style={{ color: "#475569", fontWeight: "400" }}>(optional)</span>
              </label>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "16px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                >
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. john@example.com"
                  style={{
                    width: "100%",
                    padding: "16px 16px 16px 48px",
                    fontSize: "16px",
                    background: "rgba(255,255,255,0.07)",
                    border: "1.5px solid rgba(255,255,255,0.1)",
                    borderRadius: "14px",
                    color: "white",
                    transition: "all 0.2s",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {/* CTA Buttons */}
            <button
              type="submit"
              disabled={loading || !firstName.trim()}
              style={{
                width: "100%",
                padding: "16px",
                background:
                  loading || !firstName.trim()
                    ? "rgba(16, 185, 129, 0.3)"
                    : "linear-gradient(135deg, #10b981, #059669)",
                color: "white",
                fontSize: "16px",
                fontWeight: "700",
                borderRadius: "16px",
                border: "none",
                cursor: loading || !firstName.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s",
                boxShadow:
                  loading || !firstName.trim()
                    ? "none"
                    : "0 10px 30px rgba(16, 185, 129, 0.4)",
                marginBottom: "16px",
              }}
            >
              {loading ? (
                <span
                  className="spinner"
                  style={{ width: "20px", height: "20px", borderWidth: "2px" }}
                ></span>
              ) : (
                <>
                  <span>Take Me to My Dashboard</span>
                  <ArrowRight size={18} style={{ marginLeft: "8px" }} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              style={{
                width: "100%",
                padding: "14px",
                background: "transparent",
                color: "#64748b",
                fontSize: "14px",
                fontWeight: "500",
                borderRadius: "14px",
                border: "1.5px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
