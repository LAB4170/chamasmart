import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Users, UserCheck, UserX, MessageSquare,
    Calendar, ArrowLeft, AlertCircle,
    CheckCircle2, Loader, Inbox, History
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { joinRequestAPI, chamaAPI } from "../../../services/api";
import "./MemberManagement.css";

const JoinRequests = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [processingId, setProcessingId] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [chamaRes, requestsRes] = await Promise.all([
                chamaAPI.getById(id),
                joinRequestAPI.getAll(id),
            ]);
            setChama(chamaRes.data.data);
            setRequests(requestsRes.data.data);
        } catch (err) {
            setError("Failed to load join requests");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleRespond = async (requestId, status, requesterName) => {
        const actionLabel = status === "APPROVED" ? "approve" : "reject";
        if (!confirm(`Are you sure you want to ${actionLabel} ${requesterName}'s request?`)) return;

        try {
            setProcessingId(requestId);
            await joinRequestAPI.respond(requestId, status);
            setSuccess(`${requesterName} has been ${status.toLowerCase()}!`);
            fetchData();
            setTimeout(() => setSuccess(""), 4000);
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${actionLabel} request`);
            setTimeout(() => setError(""), 4000);
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-KE", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
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
                <div className="d-flex align-center gap-2 mb-3">
                    <Inbox size={20} style={{ color: "var(--warning)" }} />
                    <h3 className="mb-0">Pending Review ({pendingRequests.length})</h3>
                </div>

                {pendingRequests.length === 0 ? (
                    <div className="card text-center py-5 shadow-sm" style={{ opacity: 0.6 }}>
                        <UserCheck size={48} className="mb-3 mx-auto" opacity={0.3} />
                        <p>No pending applications at the moment.</p>
                    </div>
                ) : (
                    <div className="grid grid-1 gap-3">
                        <AnimatePresence>
                            {pendingRequests.map((request) => (
                                <motion.div
                                    key={request.request_id}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="user-result-card shadow-sm"
                                    style={{ borderLeft: "4px solid var(--warning)" }}
                                >
                                    <div className="user-avatar-large" style={{ background: "var(--warning-light)", color: "var(--warning-dark)" }}>
                                        {request.first_name[0]}{request.last_name[0]}
                                    </div>
                                    <div className="user-details">
                                        <div className="d-flex justify-between align-start">
                                            <div>
                                                <h3>{request.first_name} {request.last_name}</h3>
                                                <p className="text-muted small mb-3">{request.email} • {request.phone_number}</p>
                                            </div>
                                            <span className="small text-muted">{formatDate(request.created_at)}</span>
                                        </div>

                                        {request.message && (
                                            <div style={{ background: "var(--surface-3)", padding: "1rem", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "1.5rem" }}>
                                                {(() => {
                                                    try {
                                                        const parsed = JSON.parse(request.message);
                                                        if (parsed.type === "STRUCTURED_APPLICATION") {
                                                            const { introduction, motivation, vows } = parsed.data;
                                                            return (
                                                                <div className="structured-application">
                                                                    <div className="d-flex gap-2 text-primary small mb-2 font-bold uppercase letter-spacing-1">
                                                                        <CheckCircle2 size={14} /> Professional Application
                                                                    </div>

                                                                    <div className="mb-3">
                                                                        <span className="text-muted small uppercase font-bold d-block mb-1">Introduction & Background</span>
                                                                        <p className="mb-0" style={{ color: "var(--text-primary)" }}>{introduction}</p>
                                                                    </div>

                                                                    <div className="mb-3">
                                                                        <span className="text-muted small uppercase font-bold d-block mb-1">Motivation & Goals</span>
                                                                        <p className="mb-0" style={{ color: "var(--text-primary)" }}>{motivation}</p>
                                                                    </div>

                                                                    <div className="d-flex gap-3">
                                                                        <div className={`badge ${vows.financial ? 'badge-success' : 'badge-gray'} small`}>
                                                                            {vows.financial ? "✓ Financial Commitment" : "✗ No Financial Vow"}
                                                                        </div>
                                                                        <div className={`badge ${vows.rules ? 'badge-success' : 'badge-gray'} small`}>
                                                                            {vows.rules ? "✓ Rule Acceptance" : "✗ No Rule Vow"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    } catch (e) {
                                                        // Not JSON, fall back to plain text
                                                    }
                                                    return (
                                                        <>
                                                            <div className="d-flex gap-2 text-muted small mb-1">
                                                                <MessageSquare size={14} /> Application Message
                                                            </div>
                                                            <p className="mb-0" style={{ fontStyle: "italic", color: "var(--text-primary)" }}>"{request.message}"</p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        <div className="d-flex gap-3 justify-end mt-2">
                                            <button
                                                className="btn btn-outline btn-sm text-danger"
                                                onClick={() => handleRespond(request.request_id, "REJECTED", `${request.first_name} ${request.last_name}`)}
                                                disabled={processingId === request.request_id}
                                            >
                                                <UserX size={16} className="mr-1" /> Reject
                                            </button>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleRespond(request.request_id, "APPROVED", `${request.first_name} ${request.last_name}`)}
                                                disabled={processingId === request.request_id}
                                            >
                                                {processingId === request.request_id ? <Loader size={16} className="spinner-sm" /> : <UserCheck size={16} className="mr-1" />}
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
                <div className="management-card shadow-sm">
                    <div className="m-card-title d-flex align-center gap-2">
                        <History size={18} className="text-muted" />
                        <h3>Recent Decisions</h3>
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
                                            {request.reviewer_first_name ? `${request.reviewer_first_name} ${request.reviewer_last_name}` : "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoinRequests;
