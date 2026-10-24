import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { userAPI } from "../../services/api";
import { Button } from "../../components/ui";

export default function CompleteProfile() {
  const { user, isAuthenticated, loading, updateUser } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const clean = (v) => (v && !v.includes("@") ? v : "");
    setFirstName(clean(user.firstName || user.first_name));
    setLastName(clean(user.lastName || user.last_name));
    setPhone(user.phoneNumber || user.phone_number || "");
  }, [user]);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loading, navigate]);

  if (loading || !isAuthenticated) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim()) { setError("Enter your first and last name."); return; }
    setSaving(true);
    try {
      await userAPI.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phoneNumber: phone.trim() || undefined });
      updateUser({
        firstName: firstName.trim(), first_name: firstName.trim(),
        lastName: lastName.trim(), last_name: lastName.trim(),
        ...(phone.trim() ? { phoneNumber: phone.trim(), phone_number: phone.trim() } : {}),
      });
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cs-auth">
      <main className="cs-auth-card">
        <div className="cs-auth-brand">
          <h1>Finish your profile</h1>
          <p>So your chama knows who you are</p>
        </div>
        <form className="cs-card" onSubmit={submit} noValidate>
          {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}><span>{error}</span></div>}
          <div className="cs-field">
            <label className="cs-label" htmlFor="cp-first">First name</label>
            <input id="cp-first" className="cs-input" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="cp-last">Last name</label>
            <input id="cp-last" className="cs-input" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="cp-phone">Phone (optional)</label>
            <input id="cp-phone" type="tel" className="cs-input" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <p className="cs-footnote">Signed in as {user?.email}</p>
          <div className="cs-actions">
            <Button type="submit" variant="primary" loading={saving}>Save and continue</Button>
            <Button onClick={() => navigate("/dashboard")} disabled={saving}>Skip for now</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
