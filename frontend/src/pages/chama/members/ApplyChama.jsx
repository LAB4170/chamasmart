import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { chamaAPI, joinRequestAPI } from "../../../services/api";
import { Button, PageHeader, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

export default function ApplyChama() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chama, setChama] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [intro, setIntro] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await chamaAPI.getById(id);
        if (live) setChama(res.data?.data || null);
      } catch (err) {
        if (live) setLoadError(err.response?.status === 403 ? "This chama is private. You need an invitation to join." : "We couldn't load this chama.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [id]);

  const submit = async (e) => {
    e.preventDefault();
    if (!agreed) { setError("Please confirm you understand the commitment."); return; }
    setSubmitting(true);
    setError("");
    try {
      await joinRequestAPI.request(id, intro.trim());
      toast.success("Request sent. The officials will review it.");
      navigate("/my-join-requests");
    } catch (err) {
      setError(err.response?.data?.message || "We couldn't send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader
          title={chama ? `Join ${chama.chama_name}` : "Request to join"}
          subtitle="Officials review every request before you become a member."
          actions={<Link to="/browse-chamas" className="cs-btn cs-btn--secondary">Back</Link>}
        />

        {loading && <div className="cs-card" aria-busy="true"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>}
        {loadError && <div className="cs-notice cs-notice--danger" role="alert"><span>{loadError}</span></div>}

        {chama && (
          <form className="cs-card" onSubmit={submit}>
            <dl className="cs-kv" style={{ marginBottom: 16 }}>
              <div><dt>Contribution</dt><dd>{formatKES(chama.contribution_amount)} ({(chama.contribution_frequency || "").toLowerCase()})</dd></div>
              <div><dt>Members</dt><dd>{chama.total_members ?? 0}</dd></div>
            </dl>
            {chama.description && <p className="cs-list-meta">{chama.description}</p>}

            <div className="cs-field">
              <label className="cs-label" htmlFor="apply-intro">Tell the officials a little about yourself (optional)</label>
              <textarea id="apply-intro" className="cs-textarea" rows={4} maxLength={1000} value={intro} onChange={(e) => setIntro(e.target.value)} />
            </div>

            <label className="cs-check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I understand I will be expected to contribute {formatKES(chama.contribution_amount)} {(chama.contribution_frequency || "").toLowerCase()} and follow the group&apos;s rules.</span>
            </label>

            {error && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginTop: 12 }}><span>{error}</span></div>}

            <div className="cs-actions" style={{ marginTop: 16 }}>
              <Button type="submit" variant="primary" loading={submitting} disabled={!agreed}>Send request</Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
