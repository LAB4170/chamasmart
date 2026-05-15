import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Users, UserCheck, UserX, MessageSquare,
    Calendar, ArrowLeft, AlertCircle,
    CheckCircle2, Loader, Inbox, History,
    Shield, Briefcase, Clock, ExternalLink,
    ChevronRight, ShieldCheck, Mail, Phone,
    Trophy, Activity, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { joinRequestAPI, chamaAPI } from "../../../services/api";
import { useSocket } from "../../../context/SocketContext";
import ConfirmDialog from "../../../components/ConfirmDialog";

const JoinRequests = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { socket } = useSocket() || {}; 

    const [chama, setChama] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [processingId, setProcessingId] = useState(null);
    
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
            setError(""); 
            const [chamaRes, requestsRes] = await Promise.all([
                chamaAPI.getById(id),
                joinRequestAPI.getAll(id),
            ]);
            setChama(chamaRes.data.data);
            setRequests(requestsRes.data.data);
        } catch (err) {
            const status = err.response?.status;
            if (status === 404) {
                setError("Chama not found. It may have been deleted.");
            } else if (status === 403) {
                setError("Access Denied: High-level official credentials required.");
            } else {
                setError("Terminal connection unstable. Please retry.");
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
        socket.emit("join_chama", id);
        const handleNewRequest = (data) => {
            if (data.chamaId == id) fetchData();
        };
        socket.on("join_request_created", handleNewRequest);
        return () => {
            if (typeof socket.emit === 'function') socket.emit("leave_chama", id);
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
            title: isApprove ? "Grant Membership" : "Deny Application",
            message: `Are you certain you wish to ${isApprove ? 'admit' : 'reject'} ${requesterName} into the ${chama?.chama_name} vault?`,
            variant: isApprove ? "success" : "danger",
            confirmText: isApprove ? "Approve Admission" : "Deny Access"
        });
    };

    const handleConfirmResponse = async () => {
        const { requestId, status, requesterName } = dialogConfig;
        try {
            setDialogConfig(prev => ({ ...prev, loading: true }));
            setProcessingId(requestId);
            await joinRequestAPI.respond(requestId, status);
            setSuccess(`Admission protocol completed: ${requesterName} has been ${status.toLowerCase()}.`);
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

    const getTrustColor = (score) => {
        if (score >= 80) return "#10b981"; 
        if (score >= 50) return "#f59e0b"; 
        return "#ef4444"; 
    };

    const pendingRequests = requests.filter((r) => r.status === "PENDING");
    const reviewedRequests = requests.filter((r) => r.status !== "PENDING");

    return (
        <div className="page">
            <div className="ambient-blob blob-gold" />
            <div className="ambient-blob blob-blue" />

            <div className="container">
                <div className="page-frame-lux">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Header */}
                        <div className="user-hero-lux" style={{ marginBottom: "40px", padding: "40px" }}>
                            <div className="user-hero-content">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '8px', borderRadius: '12px' }}>
                                        <ShieldCheck size={24} color="#D4AF37" />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--gold-text)' }}>
                                        Vault Oversight
                                    </span>
                                </div>
                                <h1 className="user-hero-title">Admission Control</h1>
                                <p className="user-hero-subtitle">
                                    Review and manage membership applications for <strong style={{ color: 'var(--gold-text)' }}>{chama?.chama_name}</strong>. 
                                    Evaluate applicant trust scores and financial commitment statements.
                                </p>
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                <button
                                    className="btn-action-secondary"
                                    onClick={() => navigate(`/chamas/${id}`)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
                                >
                                    <ArrowLeft size={18} /> <span>Return to Vault</span>
                                </button>
                            </div>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: '32px' }}>{error}</div>}
                        {success && <div className="alert alert-success" style={{ marginBottom: '32px' }}>{success}</div>}

                        {/* Pending Queue */}
                        <div style={{ marginBottom: '60px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }} />
                                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Pending Queue</h2>
                                    <span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
                                        {pendingRequests.length} Applications
                                    </span>
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ padding: '60px', textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 20px auto' }} />
                                    <p style={{ color: 'var(--text-secondary)' }}>Syncing admission data...</p>
                                </div>
                            ) : pendingRequests.length === 0 ? (
                                <div className="empty-state-card-premium" style={{ padding: '60px 40px' }}>
                                    <Inbox size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                                    <h3 style={{ fontWeight: 800 }}>Queue Clear</h3>
                                    <p style={{ color: 'var(--text-secondary)' }}>All membership applications have been processed.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gap: '24px' }}>
                                    <AnimatePresence>
                                        {pendingRequests.map((request, index) => (
                                            <motion.div
                                                key={request.request_id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '24px',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                <div style={{ padding: '32px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
                                                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                                            <div style={{ 
                                                                width: '64px', height: '64px', borderRadius: '20px', 
                                                                background: 'var(--gold-gradient)', display: 'flex', 
                                                                alignItems: 'center', justifyContent: 'center',
                                                                color: 'white', fontWeight: 800, fontSize: '1.5rem',
                                                                boxShadow: 'var(--gold-glow)'
                                                            }}>
                                                                {request.first_name[0]}{request.last_name[0]}
                                                            </div>
                                                            <div>
                                                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{request.first_name} {request.last_name}</h3>
                                                                <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} /> {request.email}</span>
                                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> {request.phone_number}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Submitted On</div>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{formatDate(request.created_at)}</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                <Activity size={16} color={getTrustColor(request.trust_score || 50)} />
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Trust Rating</span>
                                                            </div>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: getTrustColor(request.trust_score || 50) }}>{request.trust_score || 50}%</div>
                                                        </div>
                                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                <Trophy size={16} color="var(--gold-text)" />
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Chama Network</span>
                                                            </div>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{request.membership_count || 0} Groups</div>
                                                        </div>
                                                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                <Calendar size={16} color="#3b82f6" />
                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Eco Tenure</span>
                                                            </div>
                                                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>Since {new Date(request.user_joined_at).getFullYear()}</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '20px', border: '1px solid var(--glass-border)', marginBottom: '32px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                            <MessageSquare size={16} color="var(--gold-text)" />
                                                            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Statement of Intent</span>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                                                            {request.message || "No specialized statement provided for this application."}
                                                        </p>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                                                        <button 
                                                            className="btn-action-secondary"
                                                            onClick={() => openConfirmDialog(request.request_id, "REJECTED", `${request.first_name} ${request.last_name}`)}
                                                            style={{ padding: '12px 24px', borderRadius: '12px', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
                                                        >
                                                            <UserX size={18} style={{ marginRight: '8px' }} /> Deny Admission
                                                        </button>
                                                        <button 
                                                            className="btn-action-primary"
                                                            onClick={() => openConfirmDialog(request.request_id, "APPROVED", `${request.first_name} ${request.last_name}`)}
                                                            style={{ padding: '12px 32px', borderRadius: '12px' }}
                                                        >
                                                            <UserCheck size={18} style={{ marginRight: '8px' }} /> Grant Admission
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        {/* History Table */}
                        {reviewedRequests.length > 0 && (
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '24px', padding: '32px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                    <History size={20} color="var(--text-secondary)" />
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Decision History</h3>
                                </div>
                                <div className="table-responsive-lux">
                                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '1px' }}>
                                                <th style={{ padding: '12px 20px' }}>Applicant</th>
                                                <th>Protocol Status</th>
                                                <th>Decision Date</th>
                                                <th>Reviewing Official</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reviewedRequests.map((request) => (
                                                <tr key={request.request_id} style={{ background: 'rgba(255,255,255,0.02)' }}>
                                                    <td style={{ padding: '16px 20px', borderRadius: '12px 0 0 12px' }}>
                                                        <div style={{ fontWeight: 800 }}>{request.first_name} {request.last_name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{request.email}</div>
                                                    </td>
                                                    <td>
                                                        <div style={{ 
                                                            display: 'inline-flex', alignItems: 'center', gap: '6px', 
                                                            padding: '4px 12px', borderRadius: '20px', 
                                                            fontSize: '0.75rem', fontWeight: 800,
                                                            background: request.status === "APPROVED" ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                                                            color: request.status === "APPROVED" ? '#10b981' : 'var(--text-secondary)'
                                                        }}>
                                                            {request.status === "APPROVED" ? <ShieldCheck size={12} /> : <XCircle size={12} />}
                                                            {request.status}
                                                        </div>
                                                    </td>
                                                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatDate(request.updated_at)}</td>
                                                    <td style={{ paddingRight: '20px', borderRadius: '0 12px 12px 0' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Shield size={12} color="#D4AF37" />
                                                            </div>
                                                            {request.reviewer_first_name} {request.reviewer_last_name}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Security Notice */}
                        <div style={{ 
                            marginTop: '40px', padding: '24px', 
                            background: 'rgba(212, 175, 55, 0.03)', 
                            borderRadius: '24px', border: '1px dashed var(--glass-border)',
                            display: 'flex', alignItems: 'center', gap: '16px'
                        }}>
                            <Info size={20} color="var(--gold-text)" />
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Admission decisions are final and recorded in the immutable audit log. Ensure you have verified the applicant's 
                                reputation before granting access to the group's financial vault.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>

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
