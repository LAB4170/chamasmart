import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ascaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Asca.css";

const InvestmentProposals = () => {
    const { id } = useParams();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchProposals = async () => {
        try {
            const res = await ascaAPI.getProposals(id);
            setProposals(res.data.data || res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch proposals");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProposals();
    }, [id]);

    const handleVote = async (proposalId, choice) => {
        try {
            const res = await ascaAPI.voteOnProposal(id, proposalId, choice.toUpperCase());
            toast.success(res.data.message || "Vote recorded successfully");
            fetchProposals(); // Refresh to show new vote counts
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to vote");
        }
    };

    if (loading) return <div className="loading-spinner">Loading proposals...</div>;

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>Investment Proposals</h1>
                    <p className="subtitle">Vote on how to invest Chama funds</p>
                </div>

                <div className="investments-grid">
                    {proposals.map(prop => (
                        <div key={prop.id} className="proposal-card">
                            <div className="proposal-header">
                                <h3>{prop.title}</h3>
                                <span className={`proposal-status status-${prop.status}`}>
                                    {prop.status}
                                </span>
                            </div>
                            <p className="proposal-desc">{prop.description}</p>
                            <div className="proposal-meta-grid">
                                <div className="cost-row">
                                    <span className="label">Amount Required:</span>
                                    <span className="value">KES {parseFloat(prop.amount_required || 0).toLocaleString()}</span>
                                </div>
                                <div className="date-row">
                                    <span className="label">Deadline:</span>
                                    <span className="value">{prop.deadline ? new Date(prop.deadline).toLocaleDateString() : 'No limit'}</span>
                                </div>
                            </div>
                            <div className="vote-stats">
                                <div className="stat-item">
                                    <span className="stat-label">👍 Yes</span>
                                    <span className="stat-value">{prop.yes_votes || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">👎 No</span>
                                    <span className="stat-value">{prop.no_votes || 0}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label" title="Abstain">😐 Abs</span>
                                    <span className="stat-value">{prop.abstain_votes || 0}</span>
                                </div>
                            </div>
                            <div className="vote-btns">
                                <button
                                    className="btn btn-outline btn-success"
                                    onClick={() => handleVote(prop.id, 'yes')}
                                    disabled={prop.status !== 'active'}
                                >
                                    Approve
                                </button>
                                <button
                                    className="btn btn-outline btn-danger"
                                    onClick={() => handleVote(prop.id, 'no')}
                                    disabled={prop.status !== 'active'}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InvestmentProposals;
