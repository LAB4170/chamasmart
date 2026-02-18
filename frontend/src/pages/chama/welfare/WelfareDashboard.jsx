import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { welfareAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import {
    HeartHandshake, Wallet, AlertTriangle, ShieldCheck,
    FileText, ArrowLeft, ArrowRight, CheckCircle2,
    Clock, XCircle, Settings, Plus
} from "lucide-react";
import "./WelfareDashboard.css";

const WelfareDashboard = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [fundValues, setFundValues] = useState(null);
    const [myClaims, setMyClaims] = useState([]);
    const [config, setConfig] = useState([]);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchWelfareData = async () => {
            try {
                if (isMounted) { setLoading(true); setError(null); }

                const [fundRes, claimsRes, configRes, membersRes] = await Promise.all([
                    welfareAPI.getFund(id),
                    welfareAPI.getMemberClaims(id, user.user_id),
                    welfareAPI.getConfig(id),
                    chamaAPI.getMembers(id)
                ]);

                if (isMounted) {
                    setFundValues(fundRes.data);
                    setMyClaims(claimsRes.data);
                    setConfig(configRes.data);
                    const members = membersRes.data.data || membersRes.data;
                    const currentMember = members.find(m => m.user_id === user.user_id);
                    setUserRole(currentMember?.role || 'MEMBER');
                }
            } catch (err) {
                console.error("Error loading welfare data:", err);
                const errorMsg = err.response?.data?.message || "Failed to load welfare information.";
                if (isMounted) { setError(errorMsg); toast.error(errorMsg); }
            } finally {
                if (isMounted) { setLoading(false); }
            }
        };

        fetchWelfareData();
        return () => { isMounted = false; };
    }, [id, user.user_id]);

    if (loading) return <div className="loading-spinner">Loading Welfare Data...</div>;

    const getStatusIcon = (status) => {
        switch (status) {
            case 'APPROVED': return <CheckCircle2 size={14} />;
            case 'PAID': return <ShieldCheck size={14} />;
            case 'REJECTED': return <XCircle size={14} />;
            default: return <Clock size={14} />;
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'APPROVED': return 'badge-success';
            case 'PAID': return 'badge-info';
            case 'REJECTED': return 'badge-danger';
            default: return 'badge-warning';
        }
    };

    const balance = Number(fundValues?.balance || 0);

    return (
        <div className="page">
            <div className="container">
                {/* Page Header */}
                <div className="page-header-modern">
                    <Link to={`/chamas/${id}`} className="back-link">
                        <ArrowLeft size={18} />
                        <span>Back to Chama</span>
                    </Link>
                    <div className="page-header-row">
                        <div className="page-header-info">
                            <div className="page-header-icon purple">
                                <HeartHandshake size={24} />
                            </div>
                            <div>
                                <h1>Welfare & Benevolent Fund</h1>
                                <p className="page-subtitle">Support for members during difficult times</p>
                            </div>
                        </div>
                        <div className="page-header-actions">
                            <button
                                className="btn-action-primary"
                                onClick={() => navigate(`/chamas/${id}/welfare/claim`)}
                            >
                                <AlertTriangle size={18} />
                                <span>Report Incident</span>
                            </button>
                            {userRole === 'CHAIRPERSON' && (
                                <button
                                    className="btn-action-secondary"
                                    onClick={() => navigate(`/chamas/${id}/welfare/admin`)}
                                >
                                    <Settings size={18} />
                                    <span>Admin</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {error && <div className="error-banner"><AlertTriangle size={16} /> {error}</div>}

                {/* Stats */}
                <div className="stats-row">
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon green">
                            <Wallet size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">KES {balance.toLocaleString()}</div>
                            <div className="mini-stat-label">Fund Balance</div>
                        </div>
                    </div>
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon blue">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{myClaims.length}</div>
                            <div className="mini-stat-label">Your Claims</div>
                        </div>
                    </div>
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon amber">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{config.length}</div>
                            <div className="mini-stat-label">Coverage Types</div>
                        </div>
                    </div>
                </div>

                {/* Coverage Config */}
                {config.length > 0 && (
                    <div className="card-modern">
                        <h3 className="card-modern-title">Your Coverage</h3>
                        <div className="coverage-grid">
                            {config.map(item => (
                                <div key={item.id} className="coverage-item">
                                    <div className="coverage-name">{item.event_type.replace(/_/g, ' ')}</div>
                                    <div className="coverage-amount">KES {Number(item.payout_amount).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Claims History */}
                <div className="card-modern">
                    <h3 className="card-modern-title">Your Claim History</h3>
                    {myClaims.length === 0 ? (
                        <div className="empty-state-modern compact">
                            <div className="empty-state-icon">
                                <FileText size={36} strokeWidth={1.5} />
                            </div>
                            <h3>No Claims Submitted</h3>
                            <p>You haven't submitted any welfare claims yet.</p>
                        </div>
                    ) : (
                        <div className="claims-list">
                            {myClaims.map(claim => (
                                <div key={claim.id} className="claim-row">
                                    <div className="claim-info">
                                        <div className="claim-event">{claim.event_type.replace(/_/g, ' ')}</div>
                                        <div className="claim-date">{new Date(claim.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div className="claim-amount">KES {Number(claim.claim_amount).toLocaleString()}</div>
                                    <span className={`status-pill ${getStatusClass(claim.status)}`}>
                                        {getStatusIcon(claim.status)}
                                        {claim.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WelfareDashboard;
