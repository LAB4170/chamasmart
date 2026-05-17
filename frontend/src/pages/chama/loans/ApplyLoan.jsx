import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI, chamaAPI, userAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { BarChart2, ArrowLeft, Plus, X, ShieldCheck } from "lucide-react";
import "../core/ChamaDetailsLux.css";

const ApplyLoan = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);

    // Form state
    const [amount, setAmount] = useState("");
    const [type, setType] = useState("EMERGENCY");
    const [purpose, setPurpose] = useState("");
    const [repaymentPeriod, setRepaymentPeriod] = useState(1);
    const [guarantors, setGuarantors] = useState([]);

    // UI state
    const [showGuarantorModal, setShowGuarantorModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                // Fetch members for guarantor selection
                const res = await chamaAPI.getMembers(id);
                setMembers(res.data.data || []);
                setLoading(false);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load members for guarantor selection");
                setLoading(false);
            }
        };
        fetchMembers();
    }, [id]);

    const interestRate = useMemo(() => {
        switch (type) {
            case "EMERGENCY": return 0; // 0% interest
            case "DEVELOPMENT": return 5; // 5% interest
            case "SCHOOL_FEES": return 2; // 2% interest
            default: return 10;
        }
    }, [type]);

    const calculateRepayment = () => {
        const principal = parseFloat(amount) || 0;
        const interest = (principal * interestRate) / 100;
        const total = principal + interest;
        return {
            total,
            monthly: repaymentPeriod > 0 ? total / repaymentPeriod : 0
        };
    };

    const handleAddGuarantor = (memberId) => {
        if (guarantors.some(g => g.guarantorId === memberId)) {
            toast.warning("Member already added as guarantor");
            return;
        }
        setGuarantors([...guarantors, { guarantorId: memberId, amount: 0 }]);
        setShowGuarantorModal(false);
    };

    const handleGuarantorAmountChange = (idx, value) => {
        const newGuarantors = [...guarantors];
        newGuarantors[idx].amount = parseFloat(value) || 0;
        setGuarantors(newGuarantors);
    };

    const handleRemoveGuarantor = (idx) => {
        const newGuarantors = [...guarantors];
        newGuarantors.splice(idx, 1);
        setGuarantors(newGuarantors);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!amount || parseFloat(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        const stats = calculateRepayment();
        const totalGuaranteed = guarantors.reduce((sum, g) => sum + g.amount, 0);

        if (totalGuaranteed < stats.total) {
            toast.error(`Total guarantee amount (KES ${totalGuaranteed}) must cover the loan + interest (KES ${stats.total})`);
            return;
        }

        try {
            setSubmitting(true);
            await loanAPI.apply(id, {
                amount: parseFloat(amount),
                type,
                purpose,
                repaymentPeriod: parseInt(repaymentPeriod),
                guarantors
            });

            toast.success("Loan application submitted successfully!");
            navigate(`/chamas/${id}/loans`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to submit loan application");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;

    const repaymentStats = calculateRepayment();

    return (
        <div className="manage-page-root">
            <div className="container">
                <button onClick={() => navigate(-1)} className="btn-return-lux" style={{ marginBottom: "2rem" }}>
                    <ArrowLeft size={18} /> <span>Back to Loans</span>
                </button>

                <div className="user-hero-lux" style={{ marginBottom: "40px", padding: "32px 40px" }}>
                    <div className="user-hero-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '8px', borderRadius: '10px' }}>
                                <BarChart2 size={20} color="var(--lux-gold)" />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--lux-gold)' }}>
                                Financial Services
                            </span>
                        </div>
                        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '8px' }}>
                            Apply for a <span className="text-gold-gradient">Loan</span>
                        </h1>
                        <p style={{ color: 'var(--lux-text-secondary)', fontSize: '0.95rem', margin: 0 }}>
                            Configure your borrowing parameters and secure guarantor coverage.
                        </p>
                    </div>
                </div>

                <div className="grid grid-2 gap-5">
                    <div className="wizard-card-lux">
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: "28px" }}>
                                <label className="wizard-step-label">Loan Type</label>
                                <select
                                    className="wizard-step-input"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    <option value="EMERGENCY">Emergency Loan (0% Interest)</option>
                                    <option value="SCHOOL_FEES">School Fees (2% Interest)</option>
                                    <option value="DEVELOPMENT">Development Loan (5% Interest)</option>
                                </select>
                            </div>

                            <div style={{ marginBottom: "28px" }}>
                                <label className="wizard-step-label">Amount (KES)</label>
                                <input
                                    type="number"
                                    className="wizard-step-input"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Enter amount needed"
                                />
                            </div>

                            <div style={{ marginBottom: "28px" }}>
                                <label className="wizard-step-label">Purpose</label>
                                <textarea
                                    className="wizard-step-input"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    placeholder="Briefly explain why you need this loan..."
                                    rows="3"
                                    style={{ resize: "none" }}
                                ></textarea>
                            </div>

                            <div style={{ marginBottom: "36px" }}>
                                <label className="wizard-step-label">Repayment Period (Months)</label>
                                <input
                                    type="number"
                                    className="wizard-step-input"
                                    value={repaymentPeriod}
                                    onChange={(e) => setRepaymentPeriod(e.target.value)}
                                    min="1"
                                    max="24"
                                />
                            </div>

                            <div style={{ height: "1px", background: "var(--lux-border)", margin: "32px 0" }}></div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                                <h3 style={{ fontSize: "1.4rem", fontWeight: 900, margin: 0 }}>Guarantors</h3>
                                <button
                                    type="button"
                                    className="wizard-btn-prev"
                                    onClick={() => setShowGuarantorModal(true)}
                                    style={{ padding: "10px 20px" }}
                                >
                                    <Plus size={16} /> Add Guarantor
                                </button>
                            </div>

                            {guarantors.map((g, idx) => {
                                const member = members.find(m => m.user._id === g.guarantorId);
                                return (
                                    <div key={idx} style={{ background: "var(--lux-bg-soft)", border: "1.5px solid var(--lux-border)", borderRadius: "20px", padding: "24px", marginBottom: "16px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                            <strong style={{ fontSize: "1.1rem" }}>{member?.user.firstName} {member?.user.lastName}</strong>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveGuarantor(idx)}
                                                style={{ background: "none", border: "none", color: "#ef4444", fontWeight: 800, cursor: "pointer" }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <div>
                                            <label className="wizard-step-label" style={{ fontSize: "0.75rem" }}>Amount to Guarantee</label>
                                            <input
                                                type="number"
                                                className="wizard-step-input"
                                                value={g.amount}
                                                onChange={(e) => handleGuarantorAmountChange(idx, e.target.value)}
                                                style={{ padding: "14px 20px" }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {guarantors.length === 0 && (
                                <div style={{ textAlign: "center", padding: "32px", background: "var(--lux-bg-soft)", border: "1px dashed var(--lux-border)", borderRadius: "20px", color: "var(--lux-text-secondary)", marginBottom: "24px" }}>
                                    No guarantors added. You need guarantors to cover 100% of the loan.
                                </div>
                            )}

                            <button
                                type="submit"
                                className="wizard-btn-next"
                                disabled={submitting}
                                style={{ width: "100%", justifyContent: "center", marginTop: "32px", padding: "18px" }}
                            >
                                {submitting ? "Submitting..." : "Submit Application"}
                            </button>
                        </form>
                    </div>

                    <div className="wizard-summary-card" style={{ height: "fit-content" }}>
                        <h3 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "28px", display: "flex", alignItems: "center", gap: "10px" }}>
                            <ShieldCheck size={24} color="var(--lux-gold)" />
                            Loan Simulation
                        </h3>
                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div className="wizard-summary-item">
                                <span className="label">Principal</span>
                                <span className="value">KES {parseFloat(amount || 0).toLocaleString()}</span>
                            </div>
                            <div className="wizard-summary-item">
                                <span className="label">Interest Rate</span>
                                <span className="value">{interestRate}%</span>
                            </div>
                            <div className="wizard-summary-item">
                                <span className="label">Interest Amount</span>
                                <span className="value">KES {(repaymentStats.total - (parseFloat(amount) || 0)).toLocaleString()}</span>
                            </div>
                            <div className="wizard-summary-item" style={{ borderBottom: "none", paddingTop: "8px" }}>
                                <span className="label" style={{ fontSize: "1rem", color: "var(--lux-text-primary)" }}>Total Repayment</span>
                                <span className="value" style={{ fontSize: "1.2rem", color: "var(--lux-gold)" }}>KES {repaymentStats.total.toLocaleString()}</span>
                            </div>
                            <div className="wizard-summary-item" style={{ borderBottom: "none", paddingBottom: 0 }}>
                                <span className="label" style={{ color: "#10b981" }}>Monthly Installment</span>
                                <span className="value" style={{ color: "#10b981" }}>KES {repaymentStats.monthly.toLocaleString()} / mo</span>
                            </div>

                            <div className="wizard-security-box" style={{ marginTop: "24px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "#3b82f6" }}>
                                    <BarChart2 size={18} />
                                    <strong style={{ fontSize: "0.9rem" }}>ASCA Loyalty Pricing</strong>
                                </div>
                                <p style={{ fontSize: "0.8rem", color: "var(--lux-text-secondary)", margin: 0, lineHeight: 1.5 }}>
                                    Your final interest rate will be calculated upon approval based on your <strong>Trust Score</strong>.
                                    <br /><br />
                                    • Score &gt; 90: <span style={{ color: "#10b981", fontWeight: 700 }}>-2% Discount</span><br />
                                    • Score &lt; 70: <span style={{ color: "#ef4444", fontWeight: 700 }}>+1% Premium</span>
                                </p>
                            </div>
                        </div>

                        <div style={{ marginTop: "36px", borderTop: "1px solid var(--lux-border)", paddingTop: "28px" }}>
                            <h4 style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: "16px" }}>Guarantor Coverage</h4>
                            <div style={{ background: "var(--lux-border)", height: "8px", borderRadius: "4px", overflow: "hidden", marginBottom: "8px" }}>
                                <div
                                    style={{
                                        height: "100%",
                                        background: "var(--gold-gradient)",
                                        width: `${Math.min((guarantors.reduce((sum, g) => sum + g.amount, 0) / (repaymentStats.total || 1)) * 100, 100)}%`,
                                        transition: "width 0.3s ease"
                                    }}
                                ></div>
                            </div>
                            <div style={{ textAlign: "right", fontSize: "0.85rem", fontWeight: 800, color: "var(--lux-gold)" }}>
                                {Math.round((guarantors.reduce((sum, g) => sum + g.amount, 0) / (repaymentStats.total || 1)) * 100)}% Covered
                            </div>
                        </div>
                    </div>
                </div>

                {/* Guarantor Selection Modal */}
                {showGuarantorModal && (
                    <div className="modal-overlay-lux" onClick={() => setShowGuarantorModal(false)}>
                        <div className="modal-content-lux" onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                                <h3 style={{ fontSize: "1.5rem", fontWeight: 900, margin: 0 }}>Select a Guarantor</h3>
                                <button onClick={() => setShowGuarantorModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--lux-text-secondary)" }}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "400px", overflowY: "auto", marginBottom: "24px" }}>
                                {members.filter(m => !guarantors.some(g => g.guarantorId === m.user._id)).map(member => (
                                    <button
                                        key={member.user._id}
                                        onClick={() => handleAddGuarantor(member.user._id)}
                                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "var(--lux-bg-soft)", border: "1.5px solid var(--lux-border)", borderRadius: "16px", cursor: "pointer", color: "var(--lux-text-primary)", fontWeight: 700, transition: "var(--lux-transition)" }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--lux-gold)"; e.currentTarget.style.background = "var(--lux-card-bg)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--lux-border)"; e.currentTarget.style.background = "var(--lux-bg-soft)"; }}
                                    >
                                        <span>{member.user.firstName} {member.user.lastName}</span>
                                        <span style={{ fontSize: "0.75rem", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", padding: "6px 12px", borderRadius: "10px", fontWeight: 800 }}>{member.role}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                className="wizard-btn-prev"
                                onClick={() => setShowGuarantorModal(false)}
                                style={{ width: "100%", justifyContent: "center" }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApplyLoan;
