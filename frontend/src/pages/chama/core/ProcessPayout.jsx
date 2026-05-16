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
        <div className="page-lux-wrapper">
            <div className="chama-header-lux">
                <div className="chama-title-area">
                    <h1 className="flex align-center gap-3">
                        <Send size={32} /> Execute Payout
                    </h1>
                    <div className="chama-badges mt-2">
                        <span className="badge-lux badge-gold">Official Protocol</span>
                        <span className="badge-lux" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--lux-text-secondary)', border: '1px solid var(--lux-border)' }}>
                            Disbursement Execution
                        </span>
                    </div>
                </div>
                <button 
                    className="btn-lux btn-lux-outline"
                    onClick={() => navigate(`/chamas/${id}/payouts`)}
                >
                    <ArrowLeft size={18} /> Financial Center
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                {/* Recipient Card */}
                <div className="lg:col-span-2 dashboard-card-lux" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                    <div style={{ 
                        width: '100px', 
                        height: '100px', 
                        borderRadius: '50%', 
                        background: 'var(--gold-gradient)', 
                        margin: '0 auto 1.5rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        color: 'white', 
                        fontSize: '2.5rem', 
                        fontWeight: 900, 
                        boxShadow: 'var(--gold-glow)' 
                    }}>
                        {selectedMember ? selectedMember.first_name[0] : <User size={40} />}
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', color: 'var(--lux-text-primary)', fontWeight: 900 }}>
                        {selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}` : "Select Member"}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--lux-text-secondary)', fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                        {selectedMember ? "Next Eligible Recipient" : "Pending Protocol Selection"}
                    </p>

                    <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--lux-border)' }}>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', color: 'var(--lux-text-secondary)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '2px' }}>Authorized Amount</p>
                        <div style={{ fontSize: '2.5rem', fontWeight: 950, color: 'var(--lux-gold)', letterSpacing: '-0.05em' }}>
                            <span style={{ fontSize: '1.2rem', verticalAlign: 'top', marginRight: '6px', opacity: 0.7 }}>KES</span>
                            {parseFloat(formData.amount || 0).toLocaleString()}
                        </div>
                        <div className="status-pill-lux status-verified mx-auto mt-4" style={{ width: 'fit-content' }}>
                            Calculated Yield
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="lg:col-span-3 dashboard-card-lux" style={{ padding: '2.5rem' }}>
                    <div className="form-group mb-8">
                        <label className="form-label-lux">Target Recipient</label>
                        <div className="input-lux-wrapper">
                            <User size={18} className="input-lux-icon" />
                            <select
                                name="userId"
                                value={formData.userId}
                                onChange={handleChange}
                                required
                                className="form-select-lux"
                                style={{ paddingLeft: '3rem' }}
                            >
                                <option value="">Select Validated Member</option>
                                {eligibleMembers.map(member => (
                                    <option key={member.user_id} value={member.user_id}>
                                        {member.first_name} {member.last_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8">
                        <div className="form-group">
                            <label className="form-label-lux">Disbursement (KES)</label>
                            <div className="input-lux-wrapper">
                                <DollarSign size={18} className="input-lux-icon" />
                                <input
                                    type="number"
                                    name="amount"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    required
                                    className="form-input-lux"
                                    style={{ paddingLeft: '3rem' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label-lux">Associated Meeting</label>
                            <div className="input-lux-wrapper">
                                <Calendar size={18} className="input-lux-icon" />
                                <select
                                    name="meetingId"
                                    value={formData.meetingId}
                                    onChange={handleChange}
                                    className="form-select-lux"
                                    style={{ paddingLeft: '3rem' }}
                                >
                                    <option value="">No Linked Meeting</option>
                                    {meetings.map(meeting => (
                                        <option key={meeting.meeting_id} value={meeting.meeting_id}>
                                            {new Date(meeting.meeting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-group mb-10">
                        <label className="form-label-lux">Execution Notes</label>
                        <div className="input-lux-wrapper">
                            <FileText size={18} className="input-lux-icon" style={{ top: '1.2rem', transform: 'none' }} />
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="4"
                                className="form-input-lux"
                                style={{ paddingLeft: '3rem', resize: 'none' }}
                                placeholder="Add administrative notes for this disbursement..."
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-lux btn-lux-primary w-full py-4"
                        style={{ fontSize: '1.1rem', fontWeight: 900 }}
                    >
                        {loading ? <RefreshCw className="spin" /> : <Send size={20} />}
                        {loading ? "Authorizing Disbursement..." : "Confirm & Execute Payout"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ProcessPayout;
