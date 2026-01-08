import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import "./WelfareDashboard.css"; // We'll create this CSS file next

const WelfareDashboard = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [fundValues, setFundValues] = useState(null);
    const [myClaims, setMyClaims] = useState([]);
    const [config, setConfig] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchWelfareData();
    }, [id]);

    const fetchWelfareData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");
            const headers = { Authorization: `Bearer ${token}` };

            const [fundRes, claimsRes, configRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/welfare/${id}/fund`, { headers }),
                axios.get(`${import.meta.env.VITE_API_URL}/welfare/${id}/members/${user.user_id}/claims`, { headers }),
                axios.get(`${import.meta.env.VITE_API_URL}/welfare/${id}/config`, { headers })
            ]);

            setFundValues(fundRes.data);
            setMyClaims(claimsRes.data);
            setConfig(configRes.data);
        } catch (err) {
            console.error("Error loading welfare data:", err);
            setError("Failed to load welfare information.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading Welfare Data...</div>;

    const getStatusClass = (status) => {
        switch (status) {
            case 'APPROVED': return 'status-approved';
            case 'PAID': return 'status-paid';
            case 'REJECTED': return 'status-rejected';
            default: return 'status-pending';
        }
    };

    return (
        <div className="welfare-dashboard-container">
            <div className="welfare-header">
                <div>
                    <h2>Welfare & Benevolent Fund</h2>
                    <p>Support for members during difficult times</p>
                </div>
                <button
                    className="btn-report-incident"
                    onClick={() => navigate(`/chamas/${id}/welfare/claim`)}
                >
                    🚨 Report Incident
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="welfare-stats-grid">
                <div className="stat-card fund-balance-card">
                    <h3>Fund Balance</h3>
                    <div className="balance-amount">KES {Number(fundValues?.balance || 0).toLocaleString()}</div>
                    <p className="fund-status">
                        Status: <span className="healthy">Healthy</span>
                    </p>
                </div>

                <div className="stat-card coverage-card">
                    <h3>Your Coverage</h3>
                    <ul>
                        {config.map(item => (
                            <li key={item.id}>
                                <span>{item.event_type.replace(/_/g, ' ')}</span>
                                <span className="amount">KES {Number(item.payout_amount).toLocaleString()}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="claims-section">
                <h3>Your Claim History</h3>
                {myClaims.length === 0 ? (
                    <div className="empty-state">
                        <p>You haven't submitted any welfare claims.</p>
                    </div>
                ) : (
                    <div className="claims-table-container">
                        <table className="claims-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Event</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myClaims.map(claim => (
                                    <tr key={claim.id}>
                                        <td>{new Date(claim.created_at).toLocaleDateString()}</td>
                                        <td>{claim.event_type}</td>
                                        <td>KES {Number(claim.claim_amount).toLocaleString()}</td>
                                        <td>
                                            <span className={`status-badge ${getStatusClass(claim.status)}`}>
                                                {claim.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="admin-actions-link">
                <button onClick={() => navigate(`/chamas/${id}/welfare/admin`)}>
                    Stop viewing as Member (Switch to Admin View)
                </button>
            </div>
        </div>
    );
};

export default WelfareDashboard;
