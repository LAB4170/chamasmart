import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI, chamaAPI } from "../../services/api";

const ApplyLoan = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [loanConfig, setLoanConfig] = useState(null);
    const [formData, setFormData] = useState({
        amount: "",
        purpose: "",
        termMonths: "",
    });
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const fetchInitialData = async () => {
        try {
            setPageLoading(true);
            const [chamaRes, configRes] = await Promise.all([
                chamaAPI.getById(id),
                loanAPI.getConfig(id),
            ]);
            setChama(chamaRes.data.data);
            setLoanConfig(configRes.data.data);
            setFormData((prev) => ({
                ...prev,
                termMonths: String(configRes.data.data.max_repayment_months || 6),
            }));
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load loan configuration");
            console.error(err);
        } finally {
            setPageLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const numericAmount = useMemo(
        () => (formData.amount ? parseFloat(formData.amount) : 0),
        [formData.amount]
    );
    const term = useMemo(
        () => (formData.termMonths ? parseInt(formData.termMonths, 10) : 0),
        [formData.termMonths]
    );

    const schedule = useMemo(() => {
        if (!loanConfig || !numericAmount || !term || term <= 0) return [];

        const type = loanConfig.interest_type || "FLAT";
        const rate = (loanConfig.interest_rate || 0) / 100;
        const items = [];

        if (type === "REDUCING") {
            const monthlyRate = rate;
            let monthlyPayment;
            if (monthlyRate > 0) {
                const r = monthlyRate;
                const n = term;
                const pow = Math.pow(1 + r, n);
                monthlyPayment = (numericAmount * r * pow) / (pow - 1);
            } else {
                monthlyPayment = numericAmount / term;
            }

            let remainingPrincipal = numericAmount;
            for (let i = 1; i <= term; i++) {
                const interestRaw = remainingPrincipal * monthlyRate;
                let interestAmt = Number(interestRaw.toFixed(2));
                let principalAmt = Number((monthlyPayment - interestAmt).toFixed(2));
                if (i === term) {
                    principalAmt = Number(remainingPrincipal.toFixed(2));
                    monthlyPayment = principalAmt + interestAmt;
                }
                remainingPrincipal = Math.max(0, remainingPrincipal - principalAmt);
                items.push({
                    month: i,
                    principal: principalAmt,
                    interest: interestAmt,
                    total: Number(monthlyPayment.toFixed(2)),
                });
            }
        } else {
            const totalInterest = numericAmount * rate;
            const principalPerMonth = numericAmount / term;
            const interestPerMonth = totalInterest / term;
            for (let i = 1; i <= term; i++) {
                const principal = Number(principalPerMonth.toFixed(2));
                const interest = Number(interestPerMonth.toFixed(2));
                items.push({
                    month: i,
                    principal,
                    interest,
                    total: principal + interest,
                });
            }
        }

        return items;
    }, [loanConfig, numericAmount, term]);

    const totalInterest = useMemo(
        () => schedule.reduce((sum, s) => sum + s.interest, 0),
        [schedule]
    );
    const totalRepayable = numericAmount + totalInterest;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await loanAPI.apply(id, {
                amount: numericAmount,
                purpose: formData.purpose,
                termMonths: term,
            });
            setSuccess("Loan application submitted successfully!");

            setTimeout(() => {
                navigate(`/chamas/${id}/loans`);
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to submit loan application");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount || 0);
    };

    if (pageLoading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Apply for Loan</h1>
                        <p className="text-muted">{chama?.chama_name}</p>
                    </div>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/chamas/${id}/loans`)}
                    >
                        ← Back to Loans
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Loan Amount (KES) *</label>
                            <input
                                type="number"
                                name="amount"
                                className="form-input"
                                placeholder="10000"
                                min="1"
                                step="0.01"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                            />
                            {formData.amount && (
                                <small className="text-muted">
                                    Available Chama Funds: {formatCurrency(chama?.current_fund || 0)}
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Purpose *</label>
                            <textarea
                                name="purpose"
                                className="form-textarea"
                                placeholder="Describe the purpose of this loan..."
                                value={formData.purpose}
                                onChange={handleChange}
                                rows="4"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Repayment Duration (Months) *</label>
                            <input
                                type="number"
                                name="termMonths"
                                className="form-input"
                                min="1"
                                max={loanConfig?.max_repayment_months || 60}
                                value={formData.termMonths}
                                onChange={handleChange}
                                required
                            />
                            {loanConfig && (
                                <small className="text-muted">
                                    Max allowed: {loanConfig.max_repayment_months} months
                                </small>
                            )}
                        </div>

                        {/* Loan Summary */}
                        {numericAmount > 0 && term > 0 && loanConfig && (
                            <div className="card" style={{ backgroundColor: "#f8f9fa", marginTop: "1rem" }}>
                                <h4>Loan Summary</h4>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Loan Amount</span>
                                        <span className="info-value">{formatCurrency(numericAmount)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Interest Type</span>
                                        <span className="info-value">{loanConfig.interest_type}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Interest Rate</span>
                                        <span className="info-value">{loanConfig.interest_rate}%</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Interest Amount</span>
                                        <span className="info-value">
                                            {formatCurrency(totalInterest)}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Total Repayable</span>
                                        <span className="info-value text-success">
                                            <strong>{formatCurrency(totalRepayable)}</strong>
                                        </span>
                                    </div>
                                </div>

                                {schedule.length > 0 && (
                                    <div style={{ marginTop: "1rem" }}>
                                        <h5>Repayment Schedule (Monthly)</h5>
                                        <div className="table-responsive">
                                            <table className="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>Month</th>
                                                        <th>Principal</th>
                                                        <th>Interest</th>
                                                        <th>Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {schedule.map((row) => (
                                                        <tr key={row.month}>
                                                            <td>{row.month}</td>
                                                            <td>{formatCurrency(row.principal)}</td>
                                                            <td>{formatCurrency(row.interest)}</td>
                                                            <td>{formatCurrency(row.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => navigate(`/chamas/${id}/loans`)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading ? "Submitting..." : "Submit Application"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ApplyLoan;
