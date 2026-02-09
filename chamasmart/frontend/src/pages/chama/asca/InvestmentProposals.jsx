import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { ascaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Asca.css";

const InvestmentProposals = () => {
    const { id } = useParams();
    const [proposals, setProposals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchProposals = async () => {
            try {
                const res = await ascaAPI.getProposals(id);
                if (isMounted) {
                    setProposals(res.data.data || res.data);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to fetch proposals");
                    setLoading(false);
                }
            }
        };

        fetchProposals();

        return () => {
            isMounted = false;
        };
    }, [id]);

    const handleVote = async (proposalId, choice) => {
        try {
            await ascaAPI.voteOnProposal(proposalId, choice);
            toast.success("Vote recorded successfully");
            fetchProposals(); // Refresh to show new vote counts
        } catch (err) {
            console.error(err);
            toast.error("Failed to vote");
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
                        <div key={prop._id} className="proposal-card">
                            <div className="proposal-header">
                                <h3>{prop.title}</h3>
                                <span className="proposal-status status-active">{prop.status}</span>
                            </div>
                            <p>{prop.description}</p>
                            <div className="cost-row">
                                <span>Cost:</span>
                                <span>KES {prop.cost?.toLocaleString()}</span>
                            </div>
                            <div className="vote-stats">
                                <p>👍 Yes: {prop.votes?.yes || 0}</p>
                                <p>👎 No: {prop.votes?.no || 0}</p>
                            </div>
                            <div className="vote-btns">
                                <button
                                    className="btn btn-outline"
                                    onClick={() => handleVote(prop._id, 'yes')}
                                >
                                    Approve
                                </button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => handleVote(prop._id, 'no')}
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
