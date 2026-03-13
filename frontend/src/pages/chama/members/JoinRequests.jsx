import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Users, UserCheck, UserX, MessageSquare,
    Calendar, ArrowLeft, AlertCircle,
    CheckCircle2, Loader, Inbox, History,
    Shield, Briefcase, Clock, ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { joinRequestAPI, chamaAPI } from "../../../services/api";
import { useSocket } from "../../../context/SocketContext";
import ConfirmDialog from "../../../components/ConfirmDialog";
import "./MemberManagement.css";

const JoinRequests = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocket() || {}; // Guard against undefined context

    const [chama, setChama] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [processingId, setProcessingId] = useState(null);
    
    // Dialog State
    const [dialogConfig, setDialogConfig] = useState({
        isOpen: false,
        requestId: null,
        status: null,
        requesterName: "",
        title: "",
        message: "",
        variant: "info",
        confirmText: ""
    });

    const fetchData = async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError(""); // Clear previous errors
            const [chamaRes, requestsRes] = await Promise.all([
                chamaAPI.getById(id),
                joinRequestAPI.getAll(id),
            ]);
            setChama(chamaRes.data.data);
            setRequests(requestsRes.data.data);
        } catch (err) {
            console.error("Fetch data error:", err);
            const status = err.response?.status;
            if (status === 404) {
                setError("Chama not found. It may have been deleted or the ID is incorrect.");
            } else if (status === 403) {
                setError("Access Denied: You must be an official (Chairperson, Treasurer, or Secretary) to manage join requests.");
            } else if (status === 401) {
                setError("Session expired. Please log in again.");
            } else {
                setError("An unexpected error occurred while loading data. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    useEffect(() => {
        if (!socket || !id || typeof socket.emit !== 'function') return;

        console.log("Setting up join request socket listeners for chama:", id);
        socket.emit("join_chama", id);

        const handleNewRequest = (data) => {
            if (data.chamaId == id) {
                fetchData();
            }
        };

        socket.on("join_request_created", handleNewRequest);

        return () => {
            if (typeof socket.emit === 'function') {
                socket.emit("leave_chama", id);
            }
            socket.off("join_request_created", handleNewRequest);
        };
    }, [socket, id]);

    const openConfirmDialog = (requestId, status, requesterName) => {
        const isApprove = status === "APPROVED";
        setDialogConfig({
            isOpen: true,
            requestId,
            status,
            requesterName,
            title: isApprove ? "Approve Member" : "Reject Request",
            message: `Are you sure you want to ${isApprove ? 'approve' : 'reject'} ${requesterName}'s application to join ${chama?.chama_name}?`,
            variant: isApprove ? "success" : "danger",
            confirmText: isApprove ? "Confirm Approval" : "Confirm Rejection"
        });
    };

    const handleConfirmResponse = async () => {
        const { requestId, status, requesterName } = dialogConfig;
        
        try {
            setDialogConfig(prev => ({ ...prev, loading: true }));
            setProcessingId(requestId);
            
            await joinRequestAPI.respond(requestId, status);
            
            setSuccess(`${requesterName} has been ${status.toLowerCase()}!`);
            setDialogConfig(prev => ({ ...prev, isOpen: false }));
            fetchData();
            setTimeout(() => setSuccess(""), 5000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to process request");
            setTimeout(() => setError(""), 5000);
        } finally {
            setProcessingId(null);
            setDialogConfig(prev => ({ ...prev, loading: false }));
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("en-KE", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    };

    const formatShortDate = (dateString) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("en-KE", {
            month: "short", year: "numeric"
        });
    };

    const getTrustColor = (score) => {
        if (score >= 80) return "#22c55e"; // Success
        if (score >= 50) return "#f59e0b"; // Warning
        return "#ef4444"; // Danger
    };

    const pendingRequests = requests.filter((r) => r.status === "PENDING");
    const reviewedRequests = requests.filter((r) => r.status !== "PENDING");

    if (loading && requests.length === 0) {
        return (
            <div className="add-member-container d-flex flex-column align-center justify-center" style={{ minHeight: '60vh' }}>
                <Loader size={48} className="spinner-sm" style={{ borderTopColor: 'var(--primary)' }} />
                <p className="mt-3 text-muted">Retrieving join requests...</p>
            </div>
        );
    }

    return (
        <div className="add-member-container">
            {/* Header */}
            <div className="add-member-header">
                <div>
                    <h1 className="d-flex align-center gap-2">
                        <Users size={32} style={{ color: 'var(--primary)' }} />
                        Join Requests
                    </h1>
                    <p className="add-member-subtitle">Manage membership applications for <strong>{chama?.chama_name}</strong></p>
                </div>
                <button
                    className="btn btn-outline btn-sm d-flex align-center gap-1"
                    onClick={() => navigate(`/chamas/${id}`)}
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            {error && (
                <div className="alert alert-error d-flex align-center gap-2 mb-3">
                    <AlertCircle size={18} /> {error}
                </div>
            )}
            {success && (
                <div className="alert alert-success d-flex align-center gap-2 mb-3">
                    <CheckCircle2 size={18} /> {success}
                </div>
            )}

            {/* Pending Requests Section */}
            <div className="mb-5">
                <div className="d-flex align-center gap-2 mb-4">
                    <Inbox size={22} style={{ color: "var(--warning)" }} />
                    <h2 className="mb-0" style={{ fontSize: "1.4rem" }}>Pending Review ({pendingRequests.length})</h2>
                </div>

                {pendingRequests.length === 0 ? (
                    <div className="card text-center py-5 shadow-sm" style={{ opacity: 0.6, backgroundColor: "var(--surface-1)" }}>
                        <UserCheck size={40} className="mb-3 mx-auto" opacity={0.3} />
                        <p className="font-medium">No pending applications at the moment.</p>
                    </div>
                ) : (
                    <div className="grid grid-1 gap-4">
                        <AnimatePresence>
                            {pendingRequests.map((request) => (
                                <motion.div
                                    key={request.request_id}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="join-request-card"
                                >
                                    <div className="jr-card-content">
                                        {/* Profile Section */}
                                        <div className="jr-profile-row">
                                            <div className="user-avatar-large" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                                                {request.first_name[0]}{request.last_name[0]}
                                            </div>
                                            <div className="jr-user-main">
                                                <div className="d-flex justify-between align-start">
                                                    <div>
                                                        <h3 className="jr-name">{request.first_name} {request.last_name}</h3>
                                                        <p className="jr-contact">{request.email} • {request.phone_number}</p>
                                                    </div>
                                                    <div className="jr-time-tag">
                                                        <Clock size={12} /> {formatDate(request.created_at)}
                                                    </div>
                                                </div>

                                                <div className="jr-metrics-grid mt-3">
                                                    <div className="jr-metric">
                                                        <Shield size={16} style={{ color: getTrustColor(request.trust_score || 50) }} />
                                                        <div>
                                                            <span className="jr-metric-label">Trust Score</span>
                                                            <span className="jr-metric-value" style={{ color: getTrustColor(request.trust_score || 50) }}>
                                                                {request.trust_score || 50}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="jr-metric">
                                                        <Briefcase size={16} />
                                                        <div>
                                                            <span className="jr-metric-label">Other Chamas</span>
                                                            <span className="jr-metric-value">{request.membership_count || 0} Joined</span>
                                                        </div>
                                                    </div>
                                                    <div className="jr-metric">
                                                        <Calendar size={16} />
                                                        <div>
                                                            <span className="jr-metric-label">Member Since</span>
                                                            <span className="jr-metric-value">{formatShortDate(request.user_joined_at)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Application Content */}
                                        <div className="jr-application-body">
                                            {(() => {
                                                try {
                                                    const parsed = JSON.parse(request.message);
                                                    
                                                    // New Multi-Section Application Support
                                                    if (parsed.type === "STRUCTURED_APPLICATION" || (parsed.introduction && parsed.motivation)) {
                                                        const data = parsed.data || parsed;
                                                        return (
                                                            <div className="structured-application">
                                                                {data.introduction && (
                                                                    <div className="mb-4">
                                                                        <div className="jr-section-title">
                                                                            <Users size={14} /> Introduction
                                                                        </div>
                                                                        <p className="jr-message-text">{data.introduction}</p>
                                                                    </div>
                                                                )}
                                                                
                                                                {data.motivation && (
                                                                    <div className="mb-4">
                                                                        <div className="jr-section-title">
                                                                            <Briefcase size={14} /> Motivation & Background
                                                                        </div>
                                                                        <p className="jr-message-text">{data.motivation}</p>
                                                                    </div>
                                                                )}

                                                                {data.vows && (
                                                                    <div className="d-flex flex-wrap gap-2 mt-2">
                                                                        <div className={`vow-tag ${data.vows.financial ? 'active' : ''}`}>
                                                                            {data.vows.financial ? "✓ Commits to Financial Contributions" : "✗ No Financial Vow"}
                                                                        </div>
                                                                        <div className={`vow-tag ${data.vows.rules ? 'active' : ''}`}>
                                                                            {data.vows.rules ? "✓ Agrees to Chama Rules" : "✗ Rule Vow Mandatory"}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                } catch (e) {
                                                    // fallback to plain text if JSON parsing fails
                                                }

                                                // Clean display for plain text or fallback
                                                return (
                                                    <div className="plain-application">
                                                        <div className="jr-section-title">
                                                            <MessageSquare size={14} /> Application Statement
                                                        </div>
                                                        <div className="jr-message-text" style={{ borderLeft: '3px solid var(--primary-soft)' }}>
                                                            {request.message || "No message provided."}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Action Bar */}
                                        <div className="jr-actions">
                                            <button
                                                className="jr-btn jr-btn-reject"
                                                onClick={() => openConfirmDialog(request.request_id, "REJECTED", `${request.first_name} ${request.last_name}`)}
                                                disabled={processingId === request.request_id}
                                            >
                                                <UserX size={18} /> Reject
                                            </button>
                                            <button
                                                className="jr-btn jr-btn-approve"
                                                onClick={() => openConfirmDialog(request.request_id, "APPROVED", `${request.first_name} ${request.last_name}`)}
                                                disabled={processingId === request.request_id}
                                            >
                                                {processingId === request.request_id ? <Loader size={18} className="spinner-sm" /> : <UserCheck size={18} />}
                                                Approve Member
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* History Section */}
            {reviewedRequests.length > 0 && (
                <div className="management-card shadow-sm mt-5">
                    <div className="m-card-title d-flex justify-between align-center">
                        <div className="d-flex align-center gap-2">
                            <History size={18} className="text-muted" />
                            <h3 className="mb-0">Decision History</h3>
                        </div>
                        <span className="small text-muted">{reviewedRequests.length} records</span>
                    </div>
                    <div className="table-responsive">
                        <table className="m-table">
                            <thead>
                                <tr>
                                    <th>Applicant</th>
                                    <th>Status</th>
                                    <th>Decision Date</th>
                                    <th>Reviewer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reviewedRequests.map((request) => (
                                    <tr key={request.request_id}>
                                        <td>
                                            <div className="font-bold">{request.first_name} {request.last_name}</div>
                                            <div className="text-muted small">{request.email}</div>
                                        </td>
                                        <td>
                                            <span className={`m-badge ${request.status === "APPROVED" ? "badge-success" : "badge-gray"}`}>
                                                {request.status}
                                            </span>
                                        </td>
                                        <td className="small text-muted">{formatDate(request.updated_at || request.created_at)}</td>
                                        <td className="small">
                                            <div className="d-flex align-center gap-1">
                                                {request.reviewer_first_name ? (
                                                    <><Shield size={12} className="text-primary" /> {request.reviewer_first_name} {request.reviewer_last_name}</>
                                                ) : "-"}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={dialogConfig.isOpen}
                title={dialogConfig.title}
                message={dialogConfig.message}
                confirmText={dialogConfig.confirmText}
                variant={dialogConfig.variant}
                onConfirm={handleConfirmResponse}
                onCancel={() => setDialogConfig(prev => ({ ...prev, isOpen: false }))}
                loading={dialogConfig.loading}
            />
        </div>
    );
};

export default JoinRequests;
