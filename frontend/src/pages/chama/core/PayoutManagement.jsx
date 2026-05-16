import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { payoutAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import {
    DollarSign, RefreshCw, Clock, Target,
    ArrowRight, CheckCircle2, AlertCircle,
    Wallet, TrendingUp, Calendar
} from 'lucide-react';
import { motion } from "framer-motion";

const PayoutManagement = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [eligibleMembers, setEligibleMembers] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        totalPayouts: 0,
        totalDisbursed: 0,
        nextAmount: 0
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [chamaRes, payoutsRes, eligibleRes, membersRes] = await Promise.all([
                    chamaAPI.getById(id),
                    payoutAPI.getAll(id),
                    payoutAPI.getEligible(id),
                    chamaAPI.getMembers(id),
                ]);

                setChama(chamaRes.data.data);
                const payoutsData = payoutsRes.data.data;
                const membersData = membersRes.data.data;

                setPayouts(payoutsData);
                setEligibleMembers(eligibleRes.data.data);
                setMembers(membersData);

                // Calculate Stats
                const contributionAmount = parseFloat(chamaRes.data.data.contribution_amount || 0);
                const totalMembers = membersData.length;

                setStats({
                    totalPayouts: payoutsData.length,
                    totalDisbursed: payoutsData.reduce((sum, p) => sum + parseFloat(p.amount), 0),
                    nextAmount: contributionAmount * totalMembers
                });

                setLoading(false);
            } catch (err) {
                console.error("Failed to load payout data", err);
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const getUserRole = () => {
        const member = members.find((m) => m.user_id === user?.id);
        return member?.role || "MEMBER";
    };

    const isOfficial = ["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(getUserRole());

    const getNextRecipient = () => {
        const receivedPayouts = payouts.map((p) => p.user_id);
        return eligibleMembers.find((m) => !receivedPayouts.includes(m.user_id));
    };

    const nextRecipient = getNextRecipient();

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount);
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading payout center...
            </div>
        );
    }

    return (
        <div className="page-lux-wrapper">
            {/* Header */}
            <div className="chama-header-lux">
                <div className="chama-title-area">
                    <h1 className="flex align-center gap-3">
                        <Wallet size={32} /> Financial Center
                    </h1>
                    <div className="chama-badges mt-2">
                        <span className="badge-lux badge-gold">Disbursements</span>
                        <span className="badge-lux" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--lux-text-secondary)', border: '1px solid var(--lux-border)' }}>
                            {chama?.chama_name}
                        </span>
                    </div>
                </div>
                <button 
                    className="btn-lux btn-lux-outline"
                    onClick={() => navigate(`/chamas/${id}`)}
                >
                    <ArrowLeft size={18} /> Dashboard
                </button>
            </div>

            {/* Stats Overview */}
            <div className="stats-grid-lux mb-8">
                <div className="stat-card-lux">
                    <span className="stat-label-lux">Total Disbursed</span>
                    <div className="stat-value-lux" style={{ color: '#10b981' }}>
                        {formatCurrency(stats.totalDisbursed)}
                    </div>
                    <div className="stat-trend-lux stat-trend-up">
                        <TrendingUp size={12} /> Live Payout Audit
                    </div>
                </div>

                <div className="stat-card-lux">
                    <span className="stat-label-lux">Disbursement Count</span>
                    <div className="stat-value-lux">
                        {stats.totalPayouts}
                    </div>
                    <div className="stat-trend-lux" style={{ color: 'var(--lux-text-secondary)' }}>
                        Completed Cycles
                    </div>
                </div>

                <div className="stat-card-lux" style={{ borderLeftColor: 'var(--lux-gold)' }}>
                    <span className="stat-label-lux">Next Payout Amount</span>
                    <div className="stat-value-lux" style={{ color: 'var(--lux-gold)' }}>
                        {formatCurrency(stats.nextAmount)}
                    </div>
                    <div className="stat-trend-lux" style={{ color: 'var(--lux-gold)' }}>
                        Expected Capital Flow
                    </div>
                </div>
            </div>

            {/* Next Recipient Spotlight */}
            {isOfficial && nextRecipient ? (
                <div className="dashboard-card-lux" style={{ 
                    background: 'var(--gold-gradient)', 
                    padding: '2.5rem', 
                    marginBottom: '3rem',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '2rem',
                    boxShadow: 'var(--gold-glow)'
                }}>
                    <div>
                        <div className="flex align-center gap-2 mb-2">
                            <span className="badge-lux" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>Active Protocol</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px' }}>Next Eligible Recipient</span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>
                            {nextRecipient.first_name} {nextRecipient.last_name}
                        </h2>
                        <p style={{ margin: '0.5rem 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '1.1rem', fontWeight: 600 }}>
                            Authorized for disbursement of <strong style={{ color: '#fff' }}>{formatCurrency(stats.nextAmount)}</strong>
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(`/chamas/${id}/payouts/process`)}
                        className="btn-lux"
                        style={{
                            background: '#fff',
                            color: 'var(--lux-text-primary)',
                            padding: '1rem 2.5rem',
                            fontSize: '1rem',
                            fontWeight: 900,
                            borderRadius: '14px',
                            boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                        }}
                    >
                        Execute Payout <ArrowRight size={20} />
                    </button>
                </div>
            ) : isOfficial && !nextRecipient && stats.remaining === 0 ? (
                <div className="dashboard-card-lux text-center py-12 mb-12">
                    <CheckCircle2 size={48} style={{ color: '#10b981', marginBottom: '1.5rem' }} />
                    <h3 className="m-0" style={{ color: 'var(--lux-text-primary)', fontSize: '1.5rem' }}>Portfolio Fully Disbursed</h3>
                    <p style={{ color: 'var(--lux-text-secondary)', marginTop: '0.5rem' }}>All eligible members have received their allocated funds for this cycle.</p>
                </div>
            ) : null}

            {/* Payout History */}
            <div className="dashboard-card-lux">
                <div className="card-header pb-4 mb-6 border-b border-white/5 flex justify-between items-center">
                    <h3 className="card-title-lux m-0">
                        <Clock size={20} /> Disbursement Registry
                    </h3>
                    <span className="status-pill-lux status-verified">Audited History</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table className="table-lux">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Recipient</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-20 opacity-30">
                                        No historical disbursements found.
                                    </td>
                                </tr>
                            ) : (
                                payouts.map((payout) => (
                                    <motion.tr
                                        key={payout.payout_id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <td style={{ fontWeight: 700 }}>
                                            {new Date(payout.payment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 800, color: 'var(--lux-text-primary)' }}>{payout.first_name} {payout.last_name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--lux-text-secondary)', opacity: 0.7 }}>Validated Member</div>
                                        </td>
                                        <td style={{ fontWeight: 900, color: '#10b981' }}>
                                            {formatCurrency(payout.amount)}
                                        </td>
                                        <td>
                                            <span className="status-pill-lux status-verified">
                                                <CheckCircle2 size={12} /> Disbursed
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontFamily: 'monospace', opacity: 0.6, fontSize: '0.75rem' }}>
                                            PAY-AUD-{payout.payout_id.toString().padStart(4, '0')}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PayoutManagement;
