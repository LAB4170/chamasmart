import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { joinRequestAPI } from "../../../services/api";
import { useSocket } from "../../../context/SocketContext";
import { 
    Clock, CheckCircle2, XCircle, FileText, 
    ArrowLeft, Search, Building2, ShieldCheck,
    Bell, Zap, ArrowRight, ShieldAlert, Info
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

const MyJoinRequests = () => {
    const navigate = useNavigate();
    const { socket } = useSocket();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchMyRequests();
    }, []);

    useEffect(() => {
        if (socket) {
            const handleUpdate = (data) => {
                fetchMyRequests();
            };
            socket.on("join_request_responded", handleUpdate);
            return () => socket.off("join_request_responded", handleUpdate);
        }
    }, [socket]);

    const fetchMyRequests = async () => {
        try {
            setLoading(true);
            const response = await joinRequestAPI.getMyRequests();
            setRequests(response.data.data || []);
        } catch (err) {
            setError("Failed to load your join requests");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-KE", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const getStatusConfig = (status) => {
        switch(status) {
            case 'APPROVED': return { 
                icon: <CheckCircle2 size={16} />, 
                color: '#10b981', 
                bg: 'rgba(16, 185, 129, 0.1)',
                label: 'Access Granted'
            };
            case 'REJECTED': return { 
                icon: <XCircle size={16} />, 
                color: '#ef4444', 
                bg: 'rgba(239, 68, 68, 0.1)',
                label: 'Access Denied'
            };
            default: return { 
                icon: <Clock size={16} />, 
                color: '#f59e0b', 
                bg: 'rgba(245, 158, 11, 0.1)',
                label: 'Verification Pending'
            };
        }
    };

    return (
        <div className="page">
            <div className="ambient-blob blob-gold" />
            <div className="ambient-blob blob-blue" />

            <div className="container">
                <div className="page-frame-lux">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        {/* Header */}
                        <div className="user-hero-lux" style={{ marginBottom: "40px", padding: "40px" }}>
                            <div className="user-hero-content">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '8px', borderRadius: '12px' }}>
                                        <Bell size={24} color="#D4AF37" />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--gold-text)' }}>
                                        Status Terminal
                                    </span>
                                </div>
                                <h1 className="user-hero-title">Membership Track</h1>
                                <p className="user-hero-subtitle">
                                    Monitor your active applications across the ecosystem. Live updates will appear as officials review your profile.
                                </p>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
                                <button
                                    className="btn-action-secondary"
                                    onClick={() => navigate("/dashboard")}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
                                >
                                    <ArrowLeft size={18} /> <span>Dashboard</span>
                                </button>
                                <button
                                    className="btn-action-primary"
                                    onClick={() => navigate("/browse-chamas")}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
                                >
                                    <Search size={18} /> <span>Discover More</span>
                                </button>
                            </div>
                        </div>

                        {error && <div className="alert alert-error" style={{ marginBottom: '32px' }}>{error}</div>}

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <div className="spinner" style={{ margin: '0 auto 20px auto' }} />
                                <p style={{ color: 'var(--text-secondary)' }}>Syncing request status...</p>
                            </div>
                        ) : requests.length === 0 ? (
                            <div className="empty-state-card-premium" style={{ padding: '80px 40px' }}>
                                <div className="empty-illustration">
                                    <ShieldAlert size={64} style={{ opacity: 0.2 }} />
                                </div>
                                <h2 style={{ fontWeight: 800 }}>No Active Requests</h2>
                                <p style={{ maxWidth: '400px', margin: '16px auto', color: 'var(--text-secondary)' }}>
                                    You haven't submitted any membership applications yet. Start your journey by discovering a group.
                                </p>
                                <button className="btn-action-primary" onClick={() => navigate("/browse-chamas")} style={{ marginTop: '24px' }}>
                                    Launch Discovery Portal
                                </button>
                            </div>
                        ) : (
                            <div className="requests-grid-lux" style={{ display: 'grid', gap: '20px' }}>
                                <AnimatePresence>
                                    {requests.map((request, index) => {
                                        const status = getStatusConfig(request.status);
                                        return (
                                            <motion.div 
                                                key={request.request_id}
                                                className="request-card-lux"
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '24px',
                                                    padding: '24px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                                    <div style={{ 
                                                        width: '56px', 
                                                        height: '56px', 
                                                        background: 'rgba(212, 175, 55, 0.05)', 
                                                        borderRadius: '16px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--gold-text)'
                                                    }}>
                                                        <Building2 size={24} />
                                                    </div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{request.chama_name}</h4>
                                                            <div style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '6px', 
                                                                fontSize: '0.7rem', 
                                                                fontWeight: 800,
                                                                padding: '4px 10px',
                                                                borderRadius: '20px',
                                                                background: status.bg,
                                                                color: status.color,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '1px'
                                                            }}>
                                                                {status.icon} {status.label}
                                                            </div>
                                                        </div>
                                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                            {request.chama_type} • Requested on {formatDate(request.created_at)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                                    {request.reviewed_at && (
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Decision Date</div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{formatDate(request.reviewed_at)}</div>
                                                        </div>
                                                    )}
                                                    
                                                    <div style={{ height: '40px', width: '1px', background: 'var(--glass-border)' }} />

                                                    <button
                                                        className={request.status === 'APPROVED' ? "btn-action-primary" : "btn-action-secondary"}
                                                        onClick={() => navigate(`/chamas/${request.chama_id}`)}
                                                        style={{ padding: '10px 20px', fontSize: '0.85rem', borderRadius: '12px' }}
                                                    >
                                                        {request.status === 'APPROVED' ? 'Enter Group' : 'View Details'}
                                                        <ArrowRight size={16} style={{ marginLeft: '8px' }} />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Instructional Footer */}
                        {!loading && requests.length > 0 && (
                            <div style={{ 
                                marginTop: '40px', 
                                padding: '24px', 
                                background: 'rgba(59, 130, 246, 0.03)', 
                                borderRadius: '24px',
                                border: '1px dashed var(--glass-border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px'
                            }}>
                                <Info size={20} color="#3b82f6" />
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Applications are manually reviewed by group officials. If your application remains pending for more than 48 hours, 
                                    consider reaching out to the group coordinator directly.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default MyJoinRequests;

