import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { payoutAPI, chamaAPI, meetingAPI } from "../../../services/api";
import {
    AlertTriangle, DollarSign, User, Calendar,
    ArrowLeft, CheckCircle2, FileText, Send
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";

const ProcessPayout = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [eligibleMembers, setEligibleMembers] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [payouts, setPayouts] = useState([]);

    const [formData, setFormData] = useState({
        userId: "",
        amount: "",
        meetingId: "",
        notes: "",
    });

    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [chamaRes, eligibleRes, meetingsRes, payoutsRes] = await Promise.all([
                    chamaAPI.getById(id),
                    payoutAPI.getEligible(id),
                    meetingAPI.getAll(id),
                    payoutAPI.getAll(id),
                ]);

                const chamaData = chamaRes.data.data;
                const eligibleData = eligibleRes.data.data;
                const membersCount = eligibleData.length;

                setChama(chamaData);
                setEligibleMembers(eligibleData);
                setMeetings(meetingsRes.data.data);
                setPayouts(payoutsRes.data.data);

                // Auto-select next recipient logic
                const receivedPayouts = payoutsRes.data.data.map((p) => p.user_id);
                const nextRecipient = eligibleData.find((m) => !receivedPayouts.includes(m.user_id));

                if (nextRecipient) {
                    const expectedAmount = parseFloat(chamaData.contribution_amount) * membersCount;
                    setFormData(prev => ({
                        ...prev,
                        userId: nextRecipient.user_id,
                        amount: expectedAmount.toFixed(2),
                    }));
                }

                setPageLoading(false);
            } catch (err) {
                console.error("Failed to load data", err);
                toast.error("Failed to load payout details");
                setPageLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await payoutAPI.process(id, formData);
            setSuccess(true);
            toast.success("Payout processed successfully!");

            setTimeout(() => {
                navigate(`/chamas/${id}/payouts`);
            }, 2000);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to process payout");
            setLoading(false);
        }
    };

    const selectedMember = eligibleMembers.find(m => m.user_id === parseInt(formData.userId));

    if (pageLoading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Processing configuration...
            </div>
        );
    }

    if (success) {
        return (
            <div style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                    <CheckCircle2 size={80} style={{ color: 'var(--success)', marginBottom: '1.5rem' }} />
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Payout Successful!</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                        Funds have been disbursed to {selectedMember?.first_name} {selectedMember?.last_name}.
                    </p>
                    <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '12px', display: 'inline-block' }}>
                        Redirecting to history...
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-primary)' }}>

            <button
                onClick={() => navigate(`/chamas/${id}/payouts`)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.95rem', fontWeight: 500
                }}
            >
                <ArrowLeft size={18} /> Back to Financial Center
            </button>

            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Process Payout</h1>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Confirm details and maximize disbursement.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', alignItems: 'start' }}>

                {/* Recipient Card */}
                <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--border)', textAlign: 'center', boxShadow: 'var(--shadow)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #1e40af)', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2rem', fontWeight: 700, boxShadow: '0 8px 20px -5px rgba(37, 99, 235, 0.4)' }}>
                        {selectedMember ? selectedMember.first_name[0] : <User size={32} />}
                    </div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                        {selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : "Select Member"}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {selectedMember ? "Next Eligible Recipient" : "Pending Selection"}
                    </p>

                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-light)' }}>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Amount to Pay</p>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                            <span style={{ fontSize: '1rem', verticalAlign: 'top', marginRight: '4px' }}>KES</span>
                            {parseFloat(formData.amount || 0).toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Recipient</label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <select
                                name="userId"
                                value={formData.userId}
                                onChange={handleChange}
                                required
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
                                    borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                    fontSize: '1rem', outline: 'none'
                                }}
                            >
                                <option value="">Select Member</option>
                                {eligibleMembers.map(member => (
                                    <option key={member.user_id} value={member.user_id}>
                                        {member.first_name} {member.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Amount (KES)</label>
                            <div style={{ position: 'relative' }}>
                                <DollarSign size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    required
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
                                        borderRadius: '10px', border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                        fontSize: '1rem', outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Meeting</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={18} style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <select
                                    name="meetingId"
                                    value={formData.meetingId}
                                    onChange={handleChange}
                                    style={{
                                        width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
                                        borderRadius: '10px', border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                        fontSize: '1rem', outline: 'none'
                                    }}
                                >
                                    <option value="">No Meeting</option>
                                    {meetings.map(meeting => (
                                        <option key={meeting.meeting_id} value={meeting.meeting_id}>
                                            {new Date(meeting.meeting_date).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes (Optional)</label>
                        <div style={{ position: 'relative' }}>
                            <FileText size={18} style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'var(--text-secondary)' }} />
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                                style={{
                                    width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
                                    borderRadius: '10px', border: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                    fontSize: '1rem', outline: 'none', resize: 'vertical'
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            opacity: loading ? 0.7 : 1,
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                        }}
                    >
                        {loading ? <RefreshCw className="spin" /> : <Send size={20} />}
                        {loading ? "Processing..." : "Confirm Disbursement"}
                    </button>

                </form>
            </div>
        </div>
    );
};

export default ProcessPayout;
