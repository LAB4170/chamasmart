import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI, chamaAPI, userAPI } from "../../../services/api";
import { toast } from "react-toastify";

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
        <div className="page">
            <div className="container">
                <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm mb-4">
                    ← Back to Loans
                </button>

                <h1>Apply for a Loan</h1>

                <div className="grid grid-2">
                    <div className="card">
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Loan Type</label>
                                <select
                                    className="form-select"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    <option value="EMERGENCY">Emergency Loan (0% Interest)</option>
                                    <option value="SCHOOL_FEES">School Fees (2% Interest)</option>
                                    <option value="DEVELOPMENT">Development Loan (5% Interest)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Amount (KES)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Enter amount needed"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Purpose</label>
                                <textarea
                                    className="form-textarea"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    placeholder="Briefly explain why you need this loan..."
                                    rows="3"
                                ></textarea>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Repayment Period (Months)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={repaymentPeriod}
                                    onChange={(e) => setRepaymentPeriod(e.target.value)}
                                    min="1"
                                    max="24"
                                />
                            </div>

                            <div className="section-divider my-4"></div>

                            <div className="d-flex justify-between align-center mb-3">
                                <h3>Guarantors</h3>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline"
                                    onClick={() => setShowGuarantorModal(true)}
                                >
                                    + Add Guarantor
                                </button>
                            </div>

                            {guarantors.map((g, idx) => {
                                const member = members.find(m => m.user._id === g.guarantorId);
                                return (
                                    <div key={idx} className="card p-3 mb-2 bg-light">
                                        <div className="d-flex justify-between align-center mb-2">
                                            <strong>{member?.user.firstName} {member?.user.lastName}</strong>
                                            <button
                                                type="button"
                                                className="text-danger btn-link"
                                                onClick={() => handleRemoveGuarantor(idx)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <div className="form-group mb-0">
                                            <label className="text-sm">Amount to Guarantee</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={g.amount}
                                                onChange={(e) => handleGuarantorAmountChange(idx, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                );
                            })}

                            {guarantors.length === 0 && (
                                <div className="text-center p-4 bg-light rounded text-muted mb-4">
                                    No guarantors added. You need guarantors to cover 100% of the loan.
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary btn-block mt-4"
                                disabled={submitting}
                            >
                                {submitting ? "Submitting..." : "Submit Application"}
                            </button>
                        </form>
                    </div>

                    <div className="card h-fit">
                        <h3>Loan Simulation</h3>
                        <div className="p-4 bg-light rounded mt-3">
                            <div className="d-flex justify-between mb-2">
                                <span>Principal:</span>
                                <strong>KES {parseFloat(amount || 0).toLocaleString()}</strong>
                            </div>
                            <div className="d-flex justify-between mb-2">
                                <span>Interest Rate:</span>
                                <strong>{interestRate}%</strong>
                            </div>
                            <div className="d-flex justify-between mb-2">
                                <span>Interest Amount:</span>
                                <strong>KES {(repaymentStats.total - (parseFloat(amount) || 0)).toLocaleString()}</strong>
                            </div>
                            <div className="divider my-2"></div>
                            <div className="d-flex justify-between mb-2 text-lg">
                                <span>Total Repayment:</span>
                                <strong>KES {repaymentStats.total.toLocaleString()}</strong>
                            </div>
                            <div className="d-flex justify-between text-success font-bold">
                                <span>Monthly Installment:</span>
                                <span>KES {repaymentStats.monthly.toLocaleString()} / mo</span>
                            </div>
                        </div>

                        <div className="mt-4">
                            <h4>Guarantor Coverage</h4>
                            <div className="progress-bar-container mt-2 bg-gray-200 h-4 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-success transition-all"
                                    style={{
                                        width: `${Math.min((guarantors.reduce((sum, g) => sum + g.amount, 0) / repaymentStats.total) * 100, 100)}%`
                                    }}
                                ></div>
                            </div>
                            <div className="text-right text-sm mt-1">
                                {Math.round((guarantors.reduce((sum, g) => sum + g.amount, 0) / (repaymentStats.total || 1)) * 100)}% Covered
                            </div>
                        </div>
                    </div>
                </div>

                {/* Guarantor Selection Modal */}
                {showGuarantorModal && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Select a Guarantor</h3>
                            <div className="list-group mt-3 max-h-60 overflow-y-auto">
                                {members.filter(m => !guarantors.some(g => g.guarantorId === m.user._id)).map(member => (
                                    <button
                                        key={member.user._id}
                                        className="list-group-item list-group-item-action d-flex justify-between"
                                        onClick={() => handleAddGuarantor(member.user._id)}
                                    >
                                        <span>{member.user.firstName} {member.user.lastName}</span>
                                        <span className="badge badge-primary">{member.role}</span>
                                    </button>
                                ))}
                            </div>
                            <button
                                className="btn btn-outline mt-3 w-full"
                                onClick={() => setShowGuarantorModal(false)}
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
