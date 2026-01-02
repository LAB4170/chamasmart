import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI } from "../../services/api";

const RepayLoan = () => {
    const { id, loanId } = useParams();
    const navigate = useNavigate();

    const [loan, setLoan] = useState(null);
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetchLoan();
    }, [loanId]);

    const fetchLoan = async () => {
        try {
            setPageLoading(true);
            const response = await loanAPI.getAll(id);
            const foundLoan = response.data.data.find(
                (l) => l.loan_id === parseInt(loanId)
            );
            setLoan(foundLoan);

            // Auto-fill with remaining amount
            if (foundLoan) {
                const remaining = parseFloat(foundLoan.total_repayable) - parseFloat(foundLoan.amount_paid || 0);
                setAmount(remaining.toFixed(2));
            }
        } catch (err) {
            setError("Failed to load loan data");
            console.error(err);
        } finally {
            setPageLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const response = await loanAPI.repay(loanId, { amount });
            const status = response.data.status || response.data.loanStatus;
            const components = response.data.components || {};
            setSuccess(
                `Repayment recorded successfully! Loan status: ${status}. ` +
                (components.principal || components.interest || components.penalty
                    ? `Breakdown - Principal: KES ${Number(components.principal || 0).toFixed(2)}, Interest: KES ${Number(components.interest || 0).toFixed(2)}, Penalty: KES ${Number(components.penalty || 0).toFixed(2)}.`
                    : "")
            );

            setTimeout(() => {
                navigate(`/chamas/${id}/loans`);
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to record repayment");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-KE", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const getRemainingAmount = () => {
        if (!loan) return 0;
        return parseFloat(loan.total_repayable) - parseFloat(loan.amount_paid || 0);
    };

    const getProgress = () => {
        if (!loan) return 0;
        return (parseFloat(loan.amount_paid || 0) / parseFloat(loan.total_repayable)) * 100;
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

    if (!loan) {
        return (
            <div className="page">
                <div className="container">
                    <div className="alert alert-error">Loan not found</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Repay Loan</h1>
                        <p className="text-muted">Loan #{loan.loan_id}</p>
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

                {/* Loan Details */}
                <div className="card">
                    <h3>Loan Details</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="info-label">Original Amount</span>
                            <span className="info-value">{formatCurrency(loan.loan_amount)}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Interest Rate</span>
                            <span className="info-value">{loan.interest_rate}%</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Total Repayable</span>
                            <span className="info-value">{formatCurrency(loan.total_repayable)}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Amount Paid</span>
                            <span className="info-value text-success">
                                {formatCurrency(loan.amount_paid || 0)}
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Remaining</span>
                            <span className="info-value text-error">
                                {formatCurrency(getRemainingAmount())}
                            </span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Due Date</span>
                            <span className="info-value">{formatDate(loan.due_date)}</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: "1rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                            <span className="text-muted">Repayment Progress</span>
                            <span className="text-muted">{getProgress().toFixed(0)}%</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${getProgress()}%`, backgroundColor: "#10b981" }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Repayment Form */}
                <div className="card">
                    <h3>Make Repayment</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Repayment Amount (KES) *</label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="Enter amount"
                                min="1"
                                step="0.01"
                                max={getRemainingAmount()}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                            />
                            <small className="text-muted">
                                Maximum: {formatCurrency(getRemainingAmount())}
                            </small>
                            <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                                Repayments are allocated to penalties, then interest, then principal.
                            </small>
                        </div>

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
                                {loading ? "Processing..." : "Submit Repayment"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RepayLoan;
