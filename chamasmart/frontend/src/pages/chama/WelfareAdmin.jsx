import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import "./WelfareAdmin.css";

const WelfareAdmin = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState([]);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        fetchClaims();
    }, [id]);

    const fetchClaims = async () => {
        try {
            const token = localStorage.getItem("token");
            // Fetch all claims for the chama using the new Admin endpoint
            const response = await axios.get(
                `${import.meta.env.VITE_API_URL}/welfare/${id}/claims`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setClaims(response.data);
            setLoading(false);
        } catch (err) {
            console.error("Error loading claims:", err);
            setError("Failed to load claims. Please try again.");
            setLoading(false);
        }
    };

    const handleApproval = async (claimId, status) => {
        try {
            setActionLoading(claimId);
            const token = localStorage.getItem("token");
            await axios.post(
                `${import.meta.env.VITE_API_URL}/welfare/claims/${claimId}/approve`,
                {
                    approverId: user.user_id,
                    status: status,
                    comments: status === 'APPROVED' ? "Approved via Admin Dashboard" : "Rejected"
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`Claim ${status.toLowerCase()} successfully`);
            fetchClaims(); // Refresh list
        } catch (err) {
            console.error("Error processing approval:", err);
            alert("Failed to process approval");
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="loading-spinner">Loading Admin Dashboard...</div>;

    return (
        <div className="welfare-admin-container">
            <button className="btn-back" onClick={() => navigate(`/chamas/${id}/welfare`)}>
                ← Back to Member View
            </button>

            <h2>Welfare Administration</h2>
            <p className="subtitle">Verify and approve member claims.</p>

            <div className="claims-list">
                {claims.length === 0 ? (
                    <div className="empty-state">No pending claims found.</div>
                ) : (
                    claims.map(claim => (
                        <div key={claim.id} className="claim-card-admin">
                            <div className="claim-header">
                                <span className="claim-type">{claim.event_type}</span>
                                <span className="claim-date">{new Date(claim.date_of_occurrence).toLocaleDateString()}</span>
                            </div>
                            <div className="claim-body">
                                <p><strong>Member:</strong> {claim.member_name} (ID: {claim.member_id})</p>
                                <p><strong>Amount:</strong> KES {Number(claim.claim_amount).toLocaleString()}</p>
                                <p><strong>Description:</strong> {claim.description}</p>
                                {claim.proof_document_url && (
                                    <a href={claim.proof_document_url} target="_blank" rel="noopener noreferrer" className="view-proof-link">
                                        📄 View Proof Document
                                    </a>
                                )}
                            </div>
                            <div className="claim-actions">
                                <button
                                    className="btn-approve"
                                    onClick={() => handleApproval(claim.id, 'APPROVED')}
                                    disabled={actionLoading === claim.id}
                                >
                                    ✅ Approve
                                </button>
                                <button
                                    className="btn-reject"
                                    onClick={() => handleApproval(claim.id, 'REJECTED')}
                                    disabled={actionLoading === claim.id}
                                >
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default WelfareAdmin;
