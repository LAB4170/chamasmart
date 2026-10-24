import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { updateUser, isAuthenticated } = useAuth();
  const [state, setState] = useState(token ? "working" : "bad");
  const [message, setMessage] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // the link works once, so never fire it twice (React strict mode)
    authAPI.verifyEmail(token)
      .then(() => { setState("ok"); if (isAuthenticated) updateUser({ emailVerified: true, email_verified: true }); })
      .catch((err) => { setState("bad"); setMessage(err.response?.data?.message || ""); });
  }, [token, isAuthenticated, updateUser]);

  return (
    <div className="cs-auth">
      <main className="cs-auth-card">
        <div className="cs-auth-brand"><h1>Confirm your email</h1></div>
        <div className="cs-card" role="status">
          {state === "working" && <p>Confirming…</p>}
          {state === "ok" && <><p>Your email address is confirmed. Thank you.</p><Link to={isAuthenticated ? "/dashboard" : "/login"} className="cs-btn cs-btn--primary cs-btn--block">Continue</Link></>}
          {state === "bad" && <><p>{message || "This link has expired or was already used."}</p><p className="cs-help">Sign in and use “Resend confirmation” from your profile to get a new one.</p><Link to="/login">Go to sign in</Link></>}
        </div>
      </main>
    </div>
  );
}
