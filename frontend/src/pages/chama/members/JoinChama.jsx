import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { inviteAPI } from "../../../services/api";
import { Button, PageHeader } from "../../../components/ui";

export default function JoinChama() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState((searchParams.get("code") || "").toUpperCase());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Joining only happens when the person presses the button, never automatically from a link.
  const submit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError("Enter the invitation code."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await inviteAPI.join(trimmed);
      const chamaId = res.data?.data?.chama_id;
      toast.success(`You joined ${res.data?.data?.chama_name || "the chama"}.`);
      navigate(chamaId ? `/chamas/${chamaId}` : "/chamas");
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't use that code. Check it and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="Join with a code" subtitle="Enter the invitation code an official gave you." />
        <form className="cs-card" onSubmit={submit}>
          <div className="cs-field">
            <label className="cs-label" htmlFor="invite-code">Invitation code</label>
            <input
              id="invite-code" className="cs-input" value={code} autoComplete="off" autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={20}
              aria-invalid={!!error} aria-describedby={error ? "invite-err" : undefined}
              style={{ fontFamily: "monospace", letterSpacing: 2 }}
            />
          </div>
          {error && <div id="invite-err" className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}><span>{error}</span></div>}
          <div className="cs-actions">
            <Button type="submit" variant="primary" loading={loading}>Join chama</Button>
            <Link to="/browse-chamas" className="cs-btn cs-btn--secondary">Browse public chamas</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
