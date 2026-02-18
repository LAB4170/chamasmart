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
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                    <div style={{ padding: '0.5rem', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--primary)' }}>
                        <Wallet size={28} />
                    </div>
                    Financial Center
                </h1>
                <p style={{ margin: '0.5rem 0 0 3.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>
                    Manage disbursements and track payout history.
                </p>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Disbursed</p>
                            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatCurrency(stats.totalDisbursed)}
                            </h3>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', color: 'var(--success)' }}>
                            <DollarSign size={20} />
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Payouts</p>
                            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {stats.totalPayouts}
                            </h3>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', color: 'var(--primary)' }}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Next Payout</p>
                            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {formatCurrency(stats.nextAmount)}
                            </h3>
                        </div>
                        <div style={{ padding: '0.5rem', background: 'rgba(168, 85, 247, 0.1)', borderRadius: '10px', color: '#a855f7' }}>
                            <Target size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Next Recipient Spotlight */}
            {isOfficial && nextRecipient ? (
                <div style={{
                    background: 'linear-gradient(135deg, var(--primary), #1e40af)',
                    borderRadius: '20px',
                    padding: '2rem',
                    color: 'white',
                    marginBottom: '3rem',
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '2rem'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
                                Next in Line
                            </span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: 'white' }}>
                            {nextRecipient.first_name} {nextRecipient.last_name}
                        </h2>
                        <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '1.1rem' }}>
                            Eligible for <strong>{formatCurrency(stats.nextAmount)}</strong>
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(`/chamas/${id}/payouts/process`)}
                        style={{
                            background: 'white',
                            color: 'var(--primary)',
                            border: 'none',
                            padding: '1rem 2rem',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        Process Payout <ArrowRight size={20} />
                    </button>
                </div>
            ) : isOfficial && !nextRecipient && stats.remaining === 0 ? (
                <div style={{ padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '16px', textAlign: 'center', marginBottom: '3rem' }}>
                    <CheckCircle2 size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                    <h3>All members have been paid!</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Cycle complete. Start a new cycle to continue.</p>
                </div>
            ) : null}

            {/* Payout History */}
            <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Payout History</h3>

                <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Recipient</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Ref</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payouts.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No payouts recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                payouts.map((payout) => (
                                    <motion.tr
                                        key={payout.payout_id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        style={{ borderBottom: '1px solid var(--border)' }}
                                    >
                                        <td style={{ padding: '1rem 1.5rem', color: 'var(--text-primary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={16} className="text-muted" />
                                                {new Date(payout.payment_date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{payout.first_name} {payout.last_name}</div>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {formatCurrency(payout.amount)}
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem' }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: '20px',
                                                background: 'var(--success-light)', color: 'var(--success-dark)',
                                                fontSize: '0.85rem', fontWeight: 600
                                            }}>
                                                Completed
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                            #{payout.payout_id.toString().padStart(4, '0')}
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
