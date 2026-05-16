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
import "../core/ChamaDetailsLux.css";

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
        <div className="manage-page-root">
            <div className="container">
                <div className="page-frame-lux">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {/* Header */}
                        <div className="flex flex-between align-center mb-10 pb-6 border-b border-white/5">
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <div style={{ background: 'var(--lux-bg-soft)', padding: '6px', borderRadius: '10px', border: '1px solid var(--lux-border)' }}>
                                        <ShieldCheck size={20} color="var(--lux-gold)" />
                                    </div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--lux-text-secondary)' }}>
                                        Vault Oversight
                                    </span>
                                </div>
                                <h1 style={{ fontSize: '2.2rem', fontWeight: 900, margin: 0, color: 'var(--lux-text-primary)', letterSpacing: '-0.03em' }}>Admission Control</h1>
                                <p style={{ color: 'var(--lux-text-secondary)', marginTop: '6px', fontSize: '1rem', fontWeight: 600 }}>
                                    Review membership applications for <strong style={{ color: 'var(--lux-gold)' }}>{chama?.chama_name}</strong>
                                </p>
                            </div>
                            <button
                                className="btn-return-lux"
                                onClick={() => navigate(`/chamas/${id}`)}
                            >
                                <ArrowLeft size={16} /> <span>Return to Vault</span>
                            </button>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: '32px' }}>{error}</div>}
                        {success && <div className="alert alert-success" style={{ marginBottom: '32px' }}>{success}</div>}

                        {/* Main Content Area */}
                        <div className="grid grid-cols-1 gap-12">
                            {/* Pending Queue Section */}
                            <section>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--lux-gold)', boxShadow: 'var(--gold-glow)' }} />
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--lux-text-primary)' }}>Pending Queue</h2>
                                        <span className="status-pill-lux" style={{ background: 'var(--lux-bg-soft)', color: 'var(--lux-text-secondary)', border: '1px solid var(--lux-border)' }}>
                                            {pendingRequests.length} Applications
                                        </span>
                                    </div>
                                </div>

                                {loading ? (
                                    <div style={{ padding: '80px', textAlign: 'center', background: 'var(--lux-bg-soft)', borderRadius: '32px', border: '1px dashed var(--lux-border)' }}>
                                        <Loader className="spinner" size={40} style={{ color: 'var(--lux-gold)', marginBottom: '16px' }} />
                                        <p style={{ fontWeight: 700, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Syncing Secure Data...</p>
                                    </div>
                                ) : pendingRequests.length === 0 ? (
                                    <div style={{ 
                                        padding: '100px 40px', textAlign: 'center', 
                                        background: 'var(--lux-bg-soft)', borderRadius: '32px', 
                                        border: '1px dashed var(--lux-border)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center'
                                    }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                            <Inbox size={40} style={{ opacity: 0.3, color: 'var(--lux-text-primary)' }} />
                                        </div>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '0 0 8px 0', color: 'var(--lux-text-primary)' }}>Queue Clear</h3>
                                        <p style={{ color: 'var(--lux-text-secondary)', fontSize: '1rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                                            All membership applications have been processed. New requests will appear here in real-time.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        <AnimatePresence>
                                            {pendingRequests.map((request, index) => (
                                                <motion.div
                                                    key={request.request_id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: index * 0.1 }}
                                                    className="dashboard-card-lux"
                                                    style={{ padding: '32px' }}
                                                >
                                                    <div className="flex flex-between align-start mb-8 flex-wrap gap-6">
                                                        <div className="flex gap-6 items-center">
                                                            <div style={{ 
                                                                width: '80px', height: '80px', borderRadius: '24px', 
                                                                background: 'var(--gold-gradient)', display: 'flex', 
                                                                alignItems: 'center', justifyContent: 'center',
                                                                color: 'white', fontWeight: 900, fontSize: '1.8rem',
                                                                boxShadow: 'var(--gold-glow)', border: '4px solid rgba(255,255,255,0.1)'
                                                            }}>
                                                                {request.first_name[0]}{request.last_name[0]}
                                                            </div>
                                                            <div>
                                                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: 'var(--lux-text-primary)' }}>
                                                                        {request.first_name} {request.last_name}
                                                                    </h3>
                                                                    <div className="flex gap-5 mt-2 flex-wrap">
                                                                        <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                                                            <Mail size={14} className="text-primary" /> {request.email}
                                                                        </span>
                                                                        <span className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                                                            <Phone size={14} className="text-primary" /> {request.phone_number}
                                                                        </span>
                                                                    </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800, marginBottom: '4px' }}>Submission Log</div>
                                                            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--lux-text-primary)' }}>{formatDate(request.created_at)}</div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                                                        <div style={{ background: 'var(--lux-bg-soft)', padding: '20px', borderRadius: '20px', border: '1.5px solid var(--lux-border)' }}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <Activity size={16} color={getTrustColor(request.trust_score || 50)} />
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Trust Rating</span>
                                                            </div>
                                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: getTrustColor(request.trust_score || 50) }}>{request.trust_score || 50}%</div>
                                                        </div>
                                                        <div style={{ background: 'var(--lux-bg-soft)', padding: '20px', borderRadius: '20px', border: '1.5px solid var(--lux-border)' }}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <Trophy size={16} color="var(--lux-gold)" />
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Chama Network</span>
                                                            </div>
                                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--lux-text-primary)' }}>{request.membership_count || 0} Groups</div>
                                                        </div>
                                                        <div style={{ background: 'var(--lux-bg-soft)', padding: '20px', borderRadius: '20px', border: '1.5px solid var(--lux-border)' }}>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <Calendar size={16} color="var(--lux-gold)" />
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Tenure</span>
                                                            </div>
                                                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--lux-text-primary)' }}>Est. {new Date(request.user_joined_at).getFullYear()}</div>
                                                        </div>
                                                    </div>

                                                    <div style={{ background: 'var(--lux-bg-soft)', padding: '24px', borderRadius: '24px', border: '1.5px solid var(--lux-border)', marginBottom: '32px' }}>
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <MessageSquare size={18} color="var(--lux-gold)" />
                                                            <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-primary)' }}>Statement of Purpose</h4>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.7, color: 'var(--lux-text-secondary)', fontWeight: 500 }}>
                                                            {request.message || "The applicant did not provide a custom statement for this group."}
                                                        </p>
                                                    </div>

                                                    <div className="flex justify-end gap-4">
                                                        <button 
                                                            className="btn-lux btn-lux-outline"
                                                            style={{ borderColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '14px 28px' }}
                                                            onClick={() => openConfirmDialog(request.request_id, "REJECTED", `${request.first_name} ${request.last_name}`)}
                                                        >
                                                            <UserX size={18} /> Deny Entry
                                                        </button>
                                                        <button 
                                                            className="btn-lux btn-lux-primary"
                                                            style={{ padding: '14px 40px' }}
                                                            onClick={() => openConfirmDialog(request.request_id, "APPROVED", `${request.first_name} ${request.last_name}`)}
                                                        >
                                                            <UserCheck size={18} /> Grant Access
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </section>

                            {/* Decision History Section */}
                            {reviewedRequests.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-4 mb-8">
                                        <History size={24} color="var(--lux-text-secondary)" />
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--lux-text-primary)' }}>Decision Logs</h2>
                                    </div>
                                    <div className="dashboard-card-lux" style={{ padding: '8px' }}>
                                        <div className="table-responsive-lux">
                                            <table className="table-lux">
                                                <thead>
                                                    <tr>
                                                        <th>Applicant Profile</th>
                                                        <th>Security Status</th>
                                                        <th>Action Date</th>
                                                        <th>Authorized Official</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reviewedRequests.map((request) => (
                                                        <tr key={request.request_id}>
                                                            <td style={{ padding: '1.25rem 1.5rem' }}>
                                                                <div style={{ fontWeight: 800, color: 'var(--lux-text-primary)' }}>{request.first_name} {request.last_name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--lux-text-secondary)', fontWeight: 600 }}>{request.email}</div>
                                                            </td>
                                                            <td>
                                                                <span className={`status-pill-lux ${request.status === "APPROVED" ? "status-verified" : "status-pending"}`}>
                                                                    {request.status === "APPROVED" ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                                                                    {request.status}
                                                                </span>
                                                            </td>
                                                            <td style={{ fontSize: '0.85rem', color: 'var(--lux-text-secondary)', fontWeight: 600 }}>{formatDate(request.updated_at)}</td>
                                                            <td>
                                                                <div className="flex items-center gap-3">
                                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--lux-bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--lux-border)' }}>
                                                                        <Shield size={14} color="var(--lux-gold)" />
                                                                    </div>
                                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--lux-text-primary)' }}>
                                                                        {request.reviewer_first_name} {request.reviewer_last_name}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Security Footer Notice */}
                            <div style={{ 
                                padding: '24px 32px', 
                                background: 'rgba(212, 175, 55, 0.03)', 
                                borderRadius: '24px', border: '1px dashed var(--lux-border)',
                                display: 'flex', alignItems: 'center', gap: '20px'
                            }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--lux-bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--lux-border)' }}>
                                    <Info size={24} color="var(--lux-gold)" />
                                </div>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--lux-text-secondary)', lineHeight: 1.6, fontWeight: 500 }}>
                                    Admission decisions are final and recorded in the immutable audit log. Ensure you have verified the applicant's 
                                    reputation and security credentials before granting access to the group's financial vault.
                                </p>
                            </div>
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
