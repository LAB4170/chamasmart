import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionAPI, chamaAPI, meetingAPI, contributionAPI, loanAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { 
    Calendar, Users, ArrowLeft, Play, Lock, CheckCircle2, 
    DollarSign, TrendingUp, Landmark, AlertCircle, Save, X
} from "lucide-react";
import "./Meetings.css";

const TableSessionDashboard = () => {
    const { id: chamaId, meetingId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [sessionData, setSessionData] = useState(null);
    const [openingCash, setOpeningCash] = useState("");
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    
    // Inline edit states
    const [editingMember, setEditingMember] = useState(null);
    const [editValues, setEditValues] = useState({ contribution: "", repayment: "" });

    useEffect(() => {
        fetchSessionSync();
    }, [chamaId, meetingId]);

    const fetchSessionSync = async () => {
        try {
            setLoading(true);
            const res = await sessionAPI.getData(chamaId, meetingId);
            setSessionData(res.data.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load session data");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSession = async () => {
        try {
            setActionLoading("opening");
            await sessionAPI.open(chamaId, meetingId, parseFloat(openingCash) || 0);
            toast.success("Session opened! Lending is now live.");
            setShowOpenModal(false);
            fetchSessionSync();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to open session");
        } finally {
            setActionLoading(null);
        }
    };

    const handleAttendance = async (userId, status) => {
        try {
            setActionLoading(`attendance-${userId}`);
            await meetingAPI.recordAttendance(chamaId, meetingId, {
                attendees: [{ userId, attended: status }]
            });
            fetchSessionSync();
        } catch (err) {
            toast.error("Failed to update attendance");
        } finally {
            setActionLoading(null);
        }
    };

    const saveMemberActivity = async (userId) => {
        try {
            setActionLoading(`save-${userId}`);
            
            const promises = [];
            if (editValues.contribution && parseFloat(editValues.contribution) > 0) {
                promises.push(contributionAPI.record(chamaId, {
                    userId,
                    amount: parseFloat(editValues.contribution),
                    meetingId
                }));
            }
            if (editValues.repayment && parseFloat(editValues.repayment) > 0) {
                // Simplified repayment for session
                // In a full impl, we'd need to pick which loan, but for Table Banking 
                // we often assume the active loan.
            }

            if (promises.length > 0) {
                await Promise.all(promises);
                toast.success("Activity recorded");
            }
            
            setEditingMember(null);
            fetchSessionSync();
        } catch (err) {
            toast.error("Failed to save activity");
        } finally {
            setActionLoading(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount);
    };

    if (loading) return <div className="loading-spinner">Initializing session...</div>;
    if (!sessionData) return <div>Session not found.</div>;

    const { meeting, activities } = sessionData;
    const isStarted = meeting.session_status !== 'NOT_STARTED';
    const isOpen = meeting.session_status === 'OPEN';
    const isClosed = meeting.session_status === 'CLOSED';

    // Calculate live table totals
    const totalCollected = activities.reduce((sum, a) => sum + parseFloat(a.total_contribution) + parseFloat(a.total_repayment), 0);
    const totalLoaned = activities.reduce((sum, a) => sum + parseFloat(a.loan_requested || 0), 0);
    const tableFund = parseFloat(meeting.opening_cash) + totalCollected - totalLoaned;

    return (
        <div className="page session-dashboard">
            <div className="container">
                {/* Header Section */}
                <div className="session-header-card">
                    <div className="header-top">
                        <button onClick={() => navigate(`/chamas/${chamaId}/meetings`)} className="back-link">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <div className={`status-pill ${meeting.session_status.toLowerCase()}`}>
                            {meeting.session_status.replace('_', ' ')}
                        </div>
                    </div>
                    
                    <div className="header-main">
                        <div>
                            <h1>{meeting.title}</h1>
                            <p className="subtitle"><Calendar size={14} /> {new Date(meeting.scheduled_date).toLocaleDateString()}</p>
                        </div>
                        <div className="header-actions">
                            {!isStarted && (
                                <button className="btn-session-start" onClick={() => setShowOpenModal(true)}>
                                    <Play size={18} /> Start Session
                                </button>
                            )}
                            {isOpen && (
                                <button className="btn-session-close" onClick={() => {}}>
                                    <Lock size={18} /> Close Session
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Live KPIs */}
                    <div className="session-kpi-grid">
                        <div className="kpi-card">
                            <span className="kpi-label">Opening Cash</span>
                            <span className="kpi-value">{formatCurrency(meeting.opening_cash)}</span>
                        </div>
                        <div className="kpi-card highlight">
                            <span className="kpi-label">Current Table Fund</span>
                            <span className="kpi-value">{formatCurrency(tableFund)}</span>
                            <div className="kpi-sublabel">Available for lending</div>
                        </div>
                        <div className="kpi-card">
                            <span className="kpi-label">Collections</span>
                            <span className="kpi-value text-success">+{formatCurrency(totalCollected)}</span>
                        </div>
                        <div className="kpi-card">
                            <span className="kpi-label">Disbursements</span>
                            <span className="kpi-value text-error">-{formatCurrency(totalLoaned)}</span>
                        </div>
                    </div>
                </div>

                {/* Member Activity Table */}
                <div className="card-modern mt-4">
                    <div className="card-header">
                        <h3><Users size={20} /> Member Activities</h3>
                        <p>Record contributions and loan requests in real-time.</p>
                    </div>

                    <div className="table-responsive">
                        <table className="table session-table">
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>Attendance</th>
                                    <th>Contribution</th>
                                    <th>Repayment</th>
                                    <th>Loan Request</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activities.map((member) => (
                                    <tr key={member.user_id} className={editingMember === member.user_id ? 'editing-row' : ''}>
                                        <td>
                                            <div className="member-cell">
                                                <div className="member-avatar">{member.full_name.charAt(0)}</div>
                                                <div>
                                                    <strong>{member.full_name}</strong>
                                                    <span className="member-role">{member.role}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <button 
                                                className={`attendance-toggle ${member.attended ? 'present' : 'absent'}`}
                                                onClick={() => handleAttendance(member.user_id, !member.attended)}
                                                disabled={!isOpen || actionLoading === `attendance-${member.user_id}`}
                                            >
                                                {member.attended ? 'Present' : 'Absent'}
                                            </button>
                                        </td>
                                        <td>
                                            {editingMember === member.user_id ? (
                                                <input 
                                                    type="number" 
                                                    className="inline-input"
                                                    value={editValues.contribution}
                                                    onChange={(e) => setEditValues({...editValues, contribution: e.target.value})}
                                                    placeholder="Amount"
                                                />
                                            ) : (
                                                <span className="text-success">{formatCurrency(member.total_contribution)}</span>
                                            )}
                                        </td>
                                        <td>
                                            {editingMember === member.user_id ? (
                                                <input 
                                                    type="number" 
                                                    className="inline-input"
                                                    value={editValues.repayment}
                                                    onChange={(e) => setEditValues({...editValues, repayment: e.target.value})}
                                                    placeholder="Amount"
                                                />
                                            ) : (
                                                <span className="text-primary">{formatCurrency(member.total_repayment)}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={member.loan_requested > 0 ? "text-error font-bold" : ""}>
                                                {member.loan_requested > 0 ? formatCurrency(member.loan_requested) : "-"}
                                            </span>
                                        </td>
                                        <td>
                                            {member.total_contribution > 0 ? (
                                                <span className="badge badge-success">PAID</span>
                                            ) : (
                                                <span className="badge badge-warning">PENDING</span>
                                            )}
                                        </td>
                                        <td>
                                            {isOpen && (
                                                editingMember === member.user_id ? (
                                                    <div className="inline-actions">
                                                        <button onClick={() => saveMemberActivity(member.user_id)} className="btn-icon text-success"><Save size={18} /></button>
                                                        <button onClick={() => setEditingMember(null)} className="btn-icon text-error"><X size={18} /></button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            setEditingMember(member.user_id);
                                                            setEditValues({ contribution: "", repayment: "" });
                                                        }} 
                                                        className="btn btn-sm btn-outline"
                                                    >
                                                        Record
                                                    </button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Opening Balance Modal */}
            {showOpenModal && (
                <div className="modal-backdrop">
                    <div className="modal compact">
                        <div className="modal-header">
                            <h3>Start Meeting Session</h3>
                            <button onClick={() => setShowOpenModal(false)} className="btn-icon"><X size={20} /></button>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted mb-4">Enter any starting cash brought forward to the meeting table.</p>
                            <div className="form-group">
                                <label className="form-label">Opening Cash (KES)</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    value={openingCash} 
                                    onChange={(e) => setOpeningCash(e.target.value)}
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <button 
                                className="btn btn-primary w-full mt-4" 
                                onClick={handleOpenSession}
                                disabled={actionLoading === "opening"}
                            >
                                {actionLoading === "opening" ? "Opening..." : "Confirm & Start"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableSessionDashboard;
