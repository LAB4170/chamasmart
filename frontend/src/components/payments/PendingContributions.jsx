import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Clock, RefreshCw, Image } from "lucide-react";
import { contributionAPI } from "../../services/api";
import { toast } from "react-toastify";
import "./PendingContributions.css";

const PendingContributions = ({ chamaId }) => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await contributionAPI.getPending(chamaId);
      setPending(res.data.data || []);
    } catch {
      toast.error("Failed to load pending contributions");
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleVerify = async (contributionId) => {
    setActionLoading(contributionId);
    try {
      await contributionAPI.verify(chamaId, contributionId, { status: "VERIFIED" });
      toast.success("Contribution verified!");
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (contributionId) => {
    if (!rejectionReason.trim()) return toast.error("Please enter a rejection reason");
    setActionLoading(contributionId);
    try {
      await contributionAPI.verify(chamaId, contributionId, {
        status: "REJECTED",
        verificationNotes: rejectionReason,
      });
      toast.success("Contribution rejected");
      setRejectingId(null);
      setRejectionReason("");
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return (
    <div className="pending-loading">
      <RefreshCw className="spin" size={20} />
      <span>Loading pending payments...</span>
    </div>
  );

  if (pending.length === 0) return (
    <div className="pending-empty">
      <CheckCircle size={36} color="#16a34a" />
      <p>No pending payments to review</p>
    </div>
  );

  return (
    <div className="pending-contributions">
      <div className="pending-header">
        <h4><Clock size={16} /> Pending Approvals ({pending.length})</h4>
        <button className="btn-icon" onClick={fetchPending} title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="pending-list">
        {pending.map((c) => (
          <div key={c.contribution_id} className="pending-card">
            <div className="pending-member">
              <div className="member-avatar">
                {(c.first_name?.[0] || "?")}
              </div>
              <div>
                <p className="member-name">{c.first_name} {c.last_name}</p>
                <p className="member-phone">{c.phone_number}</p>
              </div>
            </div>

            <div className="pending-details">
              <div className="pending-amount">KES {parseFloat(c.amount).toLocaleString()}</div>
              <div className="pending-meta">
                <span className="receipt-badge">📱 {c.receipt_number}</span>
                <span className="date-label">
                  {new Date(c.created_at).toLocaleDateString("en-KE", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
              {c.payment_proof && (
                <a href={c.payment_proof} target="_blank" rel="noreferrer" className="proof-link">
                  <Image size={14} /> View Screenshot
                </a>
              )}
            </div>

            {rejectingId === c.contribution_id ? (
              <div className="reject-form">
                <input
                  className="form-input"
                  placeholder="Reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
                <div className="reject-actions">
                  <button className="btn btn-sm btn-outline" onClick={() => { setRejectingId(null); setRejectionReason(""); }}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={actionLoading === c.contribution_id}
                    onClick={() => handleReject(c.contribution_id)}
                  >
                    {actionLoading === c.contribution_id ? "Rejecting..." : "Confirm Reject"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="pending-actions">
                <button
                  className="btn-verify"
                  disabled={actionLoading === c.contribution_id}
                  onClick={() => handleVerify(c.contribution_id)}
                >
                  <CheckCircle size={16} />
                  {actionLoading === c.contribution_id ? "..." : "Verify"}
                </button>
                <button
                  className="btn-reject"
                  onClick={() => { setRejectingId(c.contribution_id); setRejectionReason(""); }}
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingContributions;
