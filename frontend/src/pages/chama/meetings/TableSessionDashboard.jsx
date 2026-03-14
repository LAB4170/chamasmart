import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sessionAPI, chamaAPI, meetingAPI, contributionAPI, loanAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { useSocket } from "../../../context/SocketContext";
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
    
    // Close Session & Reconciliation States
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [physicalCash, setPhysicalCash] = useState("");
    const [discrepancyNote, setDiscrepancyNote] = useState("");
    const [discrepancyError, setDiscrepancyError] = useState(false);

    // Live Penalty States
    const [showPenaltyModal, setShowPenaltyModal] = useState(false);
    const [penalties, setPenalties] = useState([]);
    const [penaltyForm, setPenaltyForm] = useState({ memberId: "", amount: "", reason: "" });

    // Inline edit states
    const [editingMember, setEditingMember] = useState(null);
    const [editValues, setEditValues] = useState({ contribution: "", repayment: "" });

    const { socket, isConnected } = useSocket();

    // Socket.io Real-Time Listeners for Table Banking Sync
    useEffect(() => {
        if (!socket || !isConnected || !chamaId) return;

        socket.emit("join_chama", chamaId);

        socket.on("contribution_recorded", fetchSessionSync);
        socket.on("loan_updated", fetchSessionSync);
        socket.on("session_updated", fetchSessionSync);

        return () => {
            socket.off("contribution_recorded", fetchSessionSync);
            socket.off("loan_updated", fetchSessionSync);
            socket.off("session_updated", fetchSessionSync);
            socket.emit("leave_chama", chamaId);
        };
    }, [socket, isConnected, chamaId]);

    useEffect(() => {
        fetchSessionSync();
    }, [chamaId, meetingId]);

    const fetchSessionSync = async () => {
        try {
            setLoading(true);
            const res = await sessionAPI.getData(chamaId, meetingId);
            setSessionData(res.data.data);
            fetchPenalties();
        } catch (err) {
            console.error(err);
            toast.error("Failed to load session data");
        } finally {
            setLoading(false);
        }
    };

    const fetchPenalties = async () => {
        try {
            const res = await sessionAPI.getPenalties(chamaId, meetingId);
            setPenalties(res.data.data || []);
        } catch (err) {
            console.error("Failed to load penalties:", err);
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

    const handleCloseSession = async () => {
        try {
            if (!physicalCash) return toast.error("Physical cash count is required.");
            setActionLoading("closing");
            await sessionAPI.close(chamaId, meetingId, parseFloat(physicalCash), discrepancyNote);
            toast.success("Session closed and reconciled successfully.");
            setShowCloseModal(false);
            fetchSessionSync();
        } catch (err) {
            const errorMsg = err.response?.data?.message || "Failed to close session";
            if (errorMsg.includes("discrepancy")) {
                setDiscrepancyError(true);
                toast.warning("Cash discrepancy detected. Please provide a discrepancy note.");
            } else {
                toast.error(errorMsg);
            }
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddPenalty = async (e) => {
        e.preventDefault();
        try {
            setActionLoading("penalty");
            await sessionAPI.addLivePenalty(chamaId, meetingId, {
                memberId: penaltyForm.memberId,
                amount: parseFloat(penaltyForm.amount),
                reason: penaltyForm.reason
            });
            toast.success("Live penalty issued.");
            setPenaltyForm({ memberId: "", amount: "", reason: "" });
            fetchPenalties();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to issue penalty");
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
                try {
                    // Fetch loans to find the active one for this member
                    const loansRes = await loanAPI.getChamaLoans(chamaId);
                    const userLoans = loansRes.data.data.filter(l => l.borrower_id === userId && l.status === 'APPROVED');
                    
                    if (userLoans.length > 0) {
                        const activeLoan = userLoans[0]; // Apply to the first active loan found
                        promises.push(loanAPI.repay(chamaId, activeLoan.loan_id, {
                            amount: parseFloat(editValues.repayment),
                            paymentMethod: 'CASH',
                            notes: `Live meeting session payment`
                        }));
                    } else {
                        toast.warning("Member has no active loans. Repayment skipped.");
                    }
                } catch (err) {
                    console.error("Failed to fetch loans", err);
                }
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
                                <>
                                    <button className="btn btn-warning btn-sm" onClick={() => setShowPenaltyModal(true)} style={{ marginRight: '10px' }}>
                                        <AlertCircle size={18} className="mr-1" /> Fines & Penalties ({penalties.length})
                                    </button>
                                    <button className="btn-session-close" onClick={() => setShowCloseModal(true)}>
                                        <Lock size={18} /> Close Session
                                    </button>
                                </>
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

            {/* Hard-Lock Reconciliation Modal (Phase 21) */}
            {showCloseModal && (
                <div className="modal-backdrop">
                    <div className="modal compact">
                        <div className="modal-header bg-danger text-white">
                            <h3><Lock size={18} className="mr-2" /> End Session & Reconcile</h3>
                            <button onClick={() => { setShowCloseModal(false); setDiscrepancyError(false); setDiscrepancyNote(""); }} className="btn-icon text-white"><X size={20} /></button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="alert alert-warning mb-4">
                                <strong>System Computed Expected Fund: KES {tableFund.toLocaleString()}</strong><br />
                                The physical cash on the table MUST MATCH this expected value.
                            </div>
                            <div className="form-group">
                                <label className="form-label">Total Cash Counted (KES)</label>
                                <input 
                                    type="number" 
                                    className={`form-input focus-ring font-mono text-xl text-center pb-2 pt-2 form-input-lg ${discrepancyError ? 'border-danger' : ''}`}
                                    value={physicalCash} 
                                    onChange={(e) => { setPhysicalCash(e.target.value); setDiscrepancyError(false); }}
                                    placeholder="Count physical cash"
                                    autoFocus
                                />
                            </div>
                            
                            {discrepancyError && (
                                <div className="form-group mt-3">
                                    <label className="form-label text-danger">Discrepancy Detected! Explain Variance:</label>
                                    <textarea 
                                        className="form-input border-danger focus-ring"
                                        placeholder="Enter signed-off reason for why the physical cash does not match expected fund..."
                                        rows="3"
                                        value={discrepancyNote}
                                        onChange={(e) => setDiscrepancyNote(e.target.value)}
                                        required
                                    ></textarea>
                                    <small className="text-danger mt-1">This will be permanently logged in the digital minutes.</small>
                                </div>
                            )}

                            <button 
                                className={`btn w-full mt-4 ${discrepancyError ? 'btn-danger' : 'btn-primary'}`} 
                                onClick={handleCloseSession}
                                disabled={actionLoading === "closing"}
                            >
                                {actionLoading === "closing" ? "Closing..." : discrepancyError ? "Force Close with Discrepancy" : "Confirm Reconciliation & Close Session"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Live Penalty Modal (Phase 22) */}
            {showPenaltyModal && (
                <div className="modal-backdrop">
                    <div className="modal p-0" style={{ maxWidth: '600px', width: '100%' }}>
                        <div className="modal-header bg-warning text-dark border-bottom px-4 py-3">
                            <h3 className="m-0"><AlertCircle size={18} className="mr-2" /> Live Fines & Penalties</h3>
                            <button onClick={() => setShowPenaltyModal(false)} className="btn-icon"><X size={20} /></button>
                        </div>
                        <div className="modal-body p-4">
                            <div className="d-flex" style={{ gap: '20px' }}>
                                {/* Penalty Log */}
                                <div className="flex-1 border rounded p-3 bg-light" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    <h5 className="mb-3 text-muted text-uppercase" style={{ fontSize: '0.8rem' }}>Issued Fines ({penalties.length})</h5>
                                    {penalties.length === 0 ? (
                                        <div className="text-center text-muted text-sm py-4">No penalties tracked yet.</div>
                                    ) : (
                                        <div className="d-flex flex-column" style={{ gap: '10px' }}>
                                            {penalties.map(p => (
                                                <div key={p.penalty_id} className="p-2 border rounded bg-white" style={{ borderLeft: '4px solid var(--warning)'}}>
                                                    <div className="d-flex justify-between fw-bold mb-1">
                                                        <span>{p.member_name}</span>
                                                        <span className="text-danger">KES {p.amount}</span>
                                                    </div>
                                                    <span className="text-muted text-sm d-flex align-center gap-1 justify-between">
                                                        <span>{p.reason}</span>
                                                        <span className={`badge ${p.status === 'PAID' ? 'badge-success' : 'badge-warning'} px-1 py-0`}>{p.status}</span>
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Issue New Form */}
                                <div className="flex-1">
                                    <h5 className="mb-3">Issue New</h5>
                                    <form onSubmit={handleAddPenalty}>
                                        <div className="form-group mb-2">
                                            <label className="text-sm">Select Member</label>
                                            <select 
                                                className="form-input form-select" 
                                                value={penaltyForm.memberId}
                                                onChange={(e) => setPenaltyForm({...penaltyForm, memberId: e.target.value})}
                                                required
                                            >
                                                <option value="">-- Choose --</option>
                                                {activities.map(a => <option key={a.user_id} value={a.user_id}>{a.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group mb-2">
                                            <label className="text-sm">Amount (KES)</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                placeholder="e.g 100"
                                                value={penaltyForm.amount}
                                                onChange={(e) => setPenaltyForm({...penaltyForm, amount: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <div className="form-group mb-3">
                                            <label className="text-sm">Reason / Infraction</label>
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="e.g Late arrival, Phone ringing"
                                                value={penaltyForm.reason}
                                                onChange={(e) => setPenaltyForm({...penaltyForm, reason: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <button 
                                            type="submit" 
                                            className="btn btn-warning w-full"
                                            disabled={actionLoading === "penalty"}
                                        >
                                            <AlertCircle size={16} /> Issue Fine Now
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TableSessionDashboard;
