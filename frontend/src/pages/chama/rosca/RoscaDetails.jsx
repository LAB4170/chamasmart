import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { roscaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { ArrowLeft, Users, Calendar, CircleDot, CheckCircle2 } from "lucide-react";
import "./Rosca.css";

const RoscaDetails = () => {
    const { cycleId } = useParams();
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchRoster = async () => {
            try {
                const res = await roscaAPI.getRoster(cycleId);
                if (isMounted) {
                    setRoster(res.data.data || res.data);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to load roster");
                    setLoading(false);
                }
            }
        };

        fetchRoster();

        return () => {
            isMounted = false;
        };
    }, [cycleId]);

    if (loading) return (
        <div className="loading-container">
            <div className="spinner-modern"></div>
            <p>Fetching the payout path...</p>
        </div>
    );

    // Find current recipient (first one where is_paid is false)
    const currentRecipient = roster.find(item => !item.is_paid);
    const completedCount = roster.filter(item => item.is_paid).length;
    const progress = (completedCount / roster.length) * 100;

    return (
        <div className="page rosca-details-page">
            <div className="container">
                <div className="page-header-modern">
                    <button onClick={() => window.history.back()} className="back-link-premium">
                        <ArrowLeft size={16} />
                        <span>Back to Dashboard</span>
                    </button>
                    <div className="header-info">
                        <div className="header-icon-wrapper">
                            <Users size={28} />
                        </div>
                        <div>
                            <h1>Payout Timeline</h1>
                            <p>Track the rotation path and upcoming distributions</p>
                        </div>
                    </div>
                </div>

                {/* Progress Overview Card */}
                <div className="card-premium mb-4">
                    <div className="progress-header">
                        <h3 className="section-title mb-0">Cycle Progress</h3>
                        <span className="progress-percent">{Math.round(progress)}% Complete</span>
                    </div>
                    <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="progress-stats">
                        <span>{completedCount} Payouts Distributed</span>
                        <span>{roster.length - completedCount} Remaining</span>
                    </div>
                </div>

                <div className="dashboard-content-grid">
                    <div className="main-content">
                        <h2 className="section-title">
                            <Calendar size={20} className="text-primary" />
                            Distribution Sequence
                        </h2>

                        <div className="timeline-container">
                            {roster.map((item, index) => {
                                const isActive = currentRecipient?.roster_id === item.roster_id;
                                const isCompleted = item.is_paid;

                                return (
                                    <div key={item.roster_id} className={`timeline-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                                        <div className="timeline-marker"></div>
                                        <div className="timeline-card">
                                            <div className="member-detail">
                                                <div className="member-avatar-mini">
                                                    {(item.first_name?.[0] || 'U').toUpperCase()}
                                                </div>
                                                <div className="payout-info">
                                                    <span className="payout-name">{item.first_name} {item.last_name}</span>
                                                    <span className="payout-date-premium">
                                                        {isCompleted ? 'Paid on' : 'Scheduled for'}: {new Date(item.payout_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="turn-badge">
                                                Turn #{item.position}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="side-content">
                        {currentRecipient && (
                            <div className="card-premium current-recipient-card">
                                <h3 className="card-title-premium">Active Round</h3>
                                <div className="recipient-hero">
                                    <div className="recipient-avatar">
                                        {(currentRecipient.first_name?.[0] || 'U').toUpperCase()}
                                    </div>
                                    <div className="recipient-meta">
                                        <h4>{currentRecipient.first_name} {currentRecipient.last_name}</h4>
                                        <p>Current Recipient</p>
                                    </div>
                                </div>
                                <div className="payout-estimate">
                                    <div className="est-label">Estimated Payout</div>
                                    <div className="est-value">Next in line</div>
                                </div>
                                <button className="btn-action-primary w-100 mt-3" disabled>
                                    Awaiting Contributions
                                </button>
                            </div>
                        )}

                        <div className="card-premium mt-4">
                            <h3 className="card-title-premium">Round Insights</h3>
                            <ul className="insights-list">
                                <li>
                                    <CircleDot size={14} className="text-success" />
                                    <span>Verified Members Only</span>
                                </li>
                                <li>
                                    <CheckCircle2 size={14} className="text-primary" />
                                    <span>Automated Payout Engine</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoscaDetails;
