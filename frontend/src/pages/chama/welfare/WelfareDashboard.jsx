import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { welfareAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import {
    HeartHandshake, Wallet, AlertTriangle, ShieldCheck,
    FileText, ArrowLeft, CheckCircle2, Clock, XCircle,
    Settings, Plus, Heart, Users, Target, Loader2
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
    const [emergencyDrives, setEmergencyDrives] = useState([]);
    const [error, setError] = useState(null);
    const [userRole, setUserRole] = useState(null);

    // Contribute Modal
    const [showContributeModal, setShowContributeModal] = useState(false);
    const [contributeAmount, setContributeAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [isContributing, setIsContributing] = useState(false);

    // Emergency Drive Contribute Modal
    const [activeDriveId, setActiveDriveId] = useState(null);
    const [driveContributeAmount, setDriveContributeAmount] = useState("");
    const [isDriveContributing, setIsDriveContributing] = useState(false);

    const fetchWelfareData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [fundRes, claimsRes, configRes, membersRes, drivesRes] = await Promise.allSettled([
                welfareAPI.getFund(id),
                welfareAPI.getMemberClaims(id, user.user_id),
                welfareAPI.getConfig(id),
                chamaAPI.getMembers(id),
                welfareAPI.getEmergencyDrives(id),
            ]);

            setFundValues(fundRes.status === "fulfilled" ? fundRes.value.data : null);
            setMyClaims(claimsRes.status === "fulfilled" ? (claimsRes.value.data?.data || claimsRes.value.data || []) : []);
            setConfig(configRes.status === "fulfilled" ? (configRes.value.data?.data || configRes.value.data || []) : []);
            setEmergencyDrives(drivesRes.status === "fulfilled" ? (drivesRes.value.data?.data || []) : []);

            if (membersRes.status === "fulfilled") {
                const members = membersRes.value.data?.data || membersRes.value.data || [];
                const currentMember = members.find(m => m.user_id === user.user_id);
                setUserRole(currentMember?.role || "MEMBER");
            }
        } catch (err) {
            const msg = err.response?.data?.message || "Failed to load welfare information.";
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [id, user.user_id]);

    useEffect(() => { fetchWelfareData(); }, [fetchWelfareData]);

    const handleContribute = async (e) => {
        e.preventDefault();
        const amount = parseFloat(contributeAmount);
        if (!amount || amount <= 0) return toast.error("Please enter a valid amount.");

        setIsContributing(true);
        try {
            const res = await welfareAPI.makeContribution(id, { amount, paymentMethod });
            const newBalance = res.data?.data?.new_balance;
            toast.success(`✅ KES ${amount.toLocaleString()} contributed to welfare fund!`);
            setShowContributeModal(false);
            setContributeAmount("");
            if (newBalance !== undefined) {
                setFundValues(prev => ({ ...prev, balance: newBalance }));
            } else {
                await fetchWelfareData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Contribution failed.");
        } finally {
            setIsContributing(false);
        }
    };

    const handleDriveContribute = async (e) => {
        e.preventDefault();
        const amount = parseFloat(driveContributeAmount);
        if (!amount || amount <= 0 || !activeDriveId) return;

        setIsDriveContributing(true);
        try {
            await welfareAPI.contributeToEmergencyDrive(activeDriveId, { amount });
            toast.success(`❤️ KES ${amount.toLocaleString()} contributed to the drive!`);
            setActiveDriveId(null);
            setDriveContributeAmount("");
            await fetchWelfareData();
        } catch (err) {
            toast.error(err.response?.data?.message || "Drive contribution failed.");
        } finally {
            setIsDriveContributing(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading Welfare Data...</div>;

    const getStatusIcon = (status) => {
        switch (status) {
            case "APPROVED": return <CheckCircle2 size={14} />;
            case "PAID": return <ShieldCheck size={14} />;
            case "REJECTED": return <XCircle size={14} />;
            default: return <Clock size={14} />;
        }
    };
    const getStatusClass = (status) => {
        switch (status) {
            case "APPROVED": return "badge-success";
            case "PAID": return "badge-info";
            case "REJECTED": return "badge-danger";
            default: return "badge-warning";
        }
    };

    const balance = Number(fundValues?.balance ?? 0);
    const isChairperson = ["CHAIRPERSON", "ADMIN"].includes(userRole?.toUpperCase());
    const maxCoverage = config.length > 0 ? Math.max(...config.map(c => Number(c.payout_amount))) : 0;
    const fundIsLow = balance < maxCoverage;

    return (
        <div className="page">
            <div className="container">
                {/* Page Header */}
                <div className="page-header-modern">
                    <Link to={`/chamas/${id}`} className="back-link">
                        <ArrowLeft size={18} /><span>Back to Chama</span>
                    </Link>
                    <div className="page-header-row">
                        <div className="page-header-info">
                            <div className="page-header-icon purple">
                                <HeartHandshake size={24} />
                            </div>
                            <div>
                                <h1>Welfare &amp; Benevolent Fund</h1>
                                <p className="page-subtitle">Support for members during difficult times</p>
                            </div>
                        </div>
                        <div className="page-header-actions">
                            <button
                                className="btn-action-primary"
                                onClick={() => setShowContributeModal(true)}
                            >
                                <Heart size={16} />
                                <span>Contribute</span>
                            </button>
                            <button
                                className="btn-action-secondary"
                                onClick={() => navigate(`/chamas/${id}/welfare/submit-claim`)}
                            >
                                <AlertTriangle size={16} />
                                <span>File Claim</span>
                            </button>
                            {isChairperson && (
                                <button
                                    className="btn-action-secondary"
                                    onClick={() => navigate(`/chamas/${id}/welfare/admin`)}
                                >
                                    <Settings size={16} />
                                    <span>Admin</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {error && <div className="error-banner"><AlertTriangle size={16} /> {error}</div>}

                {/* Low Fund Warning */}
                {fundIsLow && maxCoverage > 0 && (
                    <div className="alert-banner warning">
                        <AlertTriangle size={16} />
                        <span>
                            <strong>Low Fund Alert:</strong> The welfare fund balance (KES {balance.toLocaleString()}) is below the maximum coverage payout of KES {maxCoverage.toLocaleString()}. Please encourage members to contribute.
                        </span>
                    </div>
                )}

                {/* Stats */}
                <div className="stats-row">
                    <div className="mini-stat-card">
                        <div className={`mini-stat-icon ${fundIsLow ? "red" : "green"}`}>
                            <Wallet size={20} />
                        </div>
                        <div>
                            <div className={`mini-stat-value ${fundIsLow ? "text-danger" : ""}`}>
                                KES {balance.toLocaleString()}
                            </div>
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
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon purple">
                            <Target size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">
                                {emergencyDrives.filter(d => d.status === "ACTIVE").length}
                            </div>
                            <div className="mini-stat-label">Active Drives</div>
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
                                    <div className="coverage-name">{item.event_type.replace(/_/g, " ")}</div>
                                    <div className="coverage-amount">KES {Number(item.payout_amount).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Emergency Drives */}
                {emergencyDrives.length > 0 && (
                    <div className="card-modern">
                        <h3 className="card-modern-title">🆘 Emergency Drives</h3>
                        <div className="drives-list">
                            {emergencyDrives.map(drive => {
                                const raised = Number(drive.total_raised || 0);
                                const target = Number(drive.target_amount || 1);
                                const pct = Math.min(100, Math.round((raised / target) * 100));
                                return (
                                    <div key={drive.id} className="drive-card">
                                        <div className="drive-header">
                                            <div>
                                                <div className="drive-title">{drive.description}</div>
                                                <div className="drive-meta">
                                                    <Users size={12} /> {drive.contributor_count} contributor(s) · For: <strong>{drive.beneficiary_name}</strong>
                                                </div>
                                            </div>
                                            <span className={`status-pill ${drive.status === "ACTIVE" ? "badge-warning" : "badge-success"}`}>
                                                {drive.status}
                                            </span>
                                        </div>
                                        <div className="drive-progress-bar-wrap">
                                            <div className="drive-progress-bar" style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="drive-amounts">
                                            <span>KES {raised.toLocaleString()} raised</span>
                                            <span>Target: KES {target.toLocaleString()} ({pct}%)</span>
                                        </div>
                                        {drive.status === "ACTIVE" && (
                                            <button
                                                className="btn-action-primary btn-sm"
                                                onClick={() => { setActiveDriveId(drive.id); setDriveContributeAmount(""); }}
                                            >
                                                <Heart size={13} /> Donate
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Claims History */}
                <div className="card-modern">
                    <h3 className="card-modern-title">Your Claim History</h3>
                    {myClaims.length === 0 ? (
                        <div className="empty-state-modern compact">
                            <div className="empty-state-icon"><FileText size={36} strokeWidth={1.5} /></div>
                            <h3>No Claims Submitted</h3>
                            <p>You haven't submitted any welfare claims yet.</p>
                        </div>
                    ) : (
                        <div className="claims-list">
                            {myClaims.map(claim => (
                                <div key={claim.id} className="claim-row">
                                    <div className="claim-info">
                                        <div className="claim-event">{claim.event_type?.replace(/_/g, " ")}</div>
                                        <div className="claim-date">{new Date(claim.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div className="claim-amount">KES {Number(claim.claim_amount).toLocaleString()}</div>
                                    <span className={`status-pill ${getStatusClass(claim.status)}`}>
                                        {getStatusIcon(claim.status)} {claim.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Contribute to Fund Modal */}
            {showContributeModal && (
                <div className="modal-overlay" onClick={() => setShowContributeModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title"><Heart size={18} /> Contribute to Welfare Fund</h3>
                        <p className="modal-subtitle">Your contribution helps protect members during emergencies.</p>
                        <form onSubmit={handleContribute} className="modal-form">
                            <div className="form-group">
                                <label>Amount (KES)</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="e.g. 500"
                                    value={contributeAmount}
                                    onChange={e => setContributeAmount(e.target.value)}
                                    required
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Payment Method</label>
                                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="form-input">
                                    <option value="CASH">Cash</option>
                                    <option value="MPESA">M-Pesa</option>
                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowContributeModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={isContributing}>
                                    {isContributing ? <><Loader2 size={14} className="spin" /> Processing...</> : "Confirm Contribution"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Emergency Drive Donate Modal */}
            {activeDriveId && (
                <div className="modal-overlay" onClick={() => setActiveDriveId(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">🆘 Donate to Emergency Drive</h3>
                        <p className="modal-subtitle">Every shilling counts. Thank you for showing up for your member.</p>
                        <form onSubmit={handleDriveContribute} className="modal-form">
                            <div className="form-group">
                                <label>Amount (KES)</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    placeholder="e.g. 1000"
                                    value={driveContributeAmount}
                                    onChange={e => setDriveContributeAmount(e.target.value)}
                                    required
                                    className="form-input"
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setActiveDriveId(null)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={isDriveContributing}>
                                    {isDriveContributing ? <><Loader2 size={14} className="spin" /> Processing...</> : "Donate"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WelfareDashboard;
