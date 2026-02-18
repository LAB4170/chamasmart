import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { welfareAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import {
    FileText, CheckCircle2, XCircle,
    BarChart3, Clock, AlertCircle, ArrowLeft,
    ShieldCheck, Filter
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

const WelfareAdmin = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [claims, setClaims] = useState([]);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [filter, setFilter] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED

    useEffect(() => {
        let isMounted = true;

        const fetchClaims = async () => {
            try {
                const response = await welfareAPI.getChamaClaims(id);
                if (isMounted) {
                    setClaims(response.data);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error loading claims:", err);
                const errorMsg = err.response?.data?.message || "Failed to load claims.";
                if (isMounted) {
                    setError(errorMsg);
                    toast.error(errorMsg);
                    setLoading(false);
                }
            }
        };

        fetchClaims();

        return () => {
            isMounted = false;
        };
    }, [id]);

    const handleApproval = async (claimId, status) => {
        try {
            setActionLoading(claimId);
            await welfareAPI.approveClaim(claimId, {
                approverId: user.user_id,
                status: status,
                comments: status === 'APPROVED' ? "Approved via Admin Dashboard" : "Rejected"
            });
            toast.success(`Claim ${status.toLowerCase()} successfully`);

            // Optimistic update
            setClaims(prev => prev.map(c =>
                c.id === claimId ? { ...c, status: status } : c
            ));
        } catch (err) {
            console.error("Error processing approval:", err);
            toast.error(err.response?.data?.message || "Failed to process approval");
        } finally {
            setActionLoading(null);
        }
    };

    const stats = {
        pending: claims.filter(c => c.status === 'PENDING').length,
        approved: claims.filter(c => c.status === 'APPROVED').length,
        disbursed: claims.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + parseFloat(c.claim_amount), 0)
    };

    const filteredClaims = filter === 'ALL'
        ? claims
        : claims.filter(c => c.status === filter);

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-primary)' }}>
                <div className="animate-spin" style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
                    <ShieldCheck size={40} />
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>Loading admin dashboard...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <button
                    onClick={() => navigate(`/chamas/${id}/welfare`)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1rem', background: 'transparent',
                        border: '1px solid var(--border)', borderRadius: '8px',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        fontSize: '0.9rem', fontWeight: 500, marginBottom: '1.5rem',
                        transition: 'all 0.2s'
                    }}
                >
                    <ArrowLeft size={16} /> Back to Welfare
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            <div style={{ padding: '0.5rem', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--primary)' }}>
                                <ShieldCheck size={28} />
                            </div>
                            Welfare Administration
                        </h1>
                        <p style={{ margin: '0.5rem 0 0 3.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>
                            Review and manage member welfare claims.
                        </p>
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: filter === f ? 'var(--card-bg)' : 'transparent',
                                    color: filter === f ? 'var(--primary)' : 'var(--text-secondary)',
                                    fontWeight: filter === f ? 600 : 500,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {f.charAt(0) + f.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Review</p>
                            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning)' }}>{stats.pending}</h3>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '10px', color: 'var(--warning)' }}>
                            <Clock size={20} />
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Approved</p>
                            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)' }}>{stats.approved}</h3>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', color: 'var(--success)' }}>
                            <CheckCircle2 size={20} />
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Disbursed</p>
                            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 500, marginRight: '4px' }}>KES</span>
                                {stats.disbursed.toLocaleString()}
                            </h3>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', color: 'var(--primary)' }}>
                            <BarChart3 size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Claims Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
                <AnimatePresence>
                    {filteredClaims.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', background: 'var(--bg-secondary)', borderRadius: '16px', border: '2px dashed var(--border)' }}>
                            <Filter size={48} style={{ opacity: 0.2, marginBottom: '1rem', color: 'var(--text-primary)' }} />
                            <p style={{ color: 'var(--text-secondary)' }}>No claims found matching this filter.</p>
                        </div>
                    ) : (
                        filteredClaims.map(claim => (
                            <motion.div
                                key={claim.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                style={{
                                    background: 'var(--card-bg)',
                                    borderRadius: '16px',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: 'var(--shadow)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <span style={{
                                                display: 'inline-block',
                                                fontSize: '0.75rem', fontWeight: 700,
                                                padding: '4px 8px', borderRadius: '6px',
                                                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                                                marginBottom: '0.5rem', textTransform: 'uppercase'
                                            }}>
                                                {claim.event_type.replace(/_/g, ' ')}
                                            </span>
                                            <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{claim.member_name}</h4>
                                        </div>
                                        {claim.status === 'PENDING' ? (
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--warning)', background: 'rgba(234, 179, 8, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>PENDING</span>
                                        ) : claim.status === 'APPROVED' ? (
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(34, 197, 94, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>APPROVED</span>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '6px' }}>REJECTED</span>
                                        )}
                                    </div>
                                    <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                                        KES {Number(claim.claim_amount).toLocaleString()}
                                    </h3>
                                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        occurred on {new Date(claim.date_of_occurrence).toLocaleDateString()}
                                    </p>
                                </div>

                                <div style={{ padding: '1.5rem', flex: 1 }}>
                                    <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {claim.description}
                                    </p>

                                    {claim.proof_document_url && (
                                        <a
                                            href={claim.proof_document_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                                padding: '0.5rem 1rem', borderRadius: '8px',
                                                background: 'var(--bg-secondary)', color: 'var(--primary)',
                                                textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500,
                                                marginBottom: '1rem'
                                            }}
                                        >
                                            <FileText size={16} /> View Proof Document
                                        </a>
                                    )}
                                </div>

                                {claim.status === 'PENDING' && (
                                    <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <button
                                            onClick={() => handleApproval(claim.id, 'APPROVED')}
                                            disabled={actionLoading === claim.id}
                                            style={{
                                                padding: '0.75rem', borderRadius: '8px', border: 'none',
                                                background: 'var(--success)', color: 'white', fontWeight: 600,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                opacity: actionLoading === claim.id ? 0.7 : 1
                                            }}
                                        >
                                            <CheckCircle2 size={18} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleApproval(claim.id, 'REJECTED')}
                                            disabled={actionLoading === claim.id}
                                            style={{
                                                padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--danger)',
                                                background: 'transparent', color: 'var(--danger)', fontWeight: 600,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                                opacity: actionLoading === claim.id ? 0.7 : 1
                                            }}
                                        >
                                            <XCircle size={18} /> Reject
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WelfareAdmin;
