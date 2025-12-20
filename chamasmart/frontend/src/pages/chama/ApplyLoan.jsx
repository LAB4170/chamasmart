import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loanAPI, chamaAPI } from "../../services/api";

const ApplyLoan = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [formData, setFormData] = useState({
        amount: "",
        purpose: "",
        repaymentDate: "",
    });
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const interestRate = 10; // Default 10%

    useEffect(() => {
        fetchChama();
    }, [id]);

    const fetchChama = async () => {
        try {
            setPageLoading(true);
            const response = await chamaAPI.getById(id);
            setChama(response.data.data);
        } catch (err) {
            setError("Failed to load chama data");
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

    const calculateTotal = () => {
        if (!formData.amount) return 0;
        return parseFloat(formData.amount) * (1 + interestRate / 100);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await loanAPI.apply(id, formData);
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
        }).format(amount);
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
                            <label className="form-label">Repayment Date *</label>
                            <input
                                type="date"
                                name="repaymentDate"
                                className="form-input"
                                value={formData.repaymentDate}
                                onChange={handleChange}
                                min={new Date().toISOString().split("T")[0]}
                                required
                            />
                        </div>

                        {/* Loan Summary */}
                        {formData.amount && (
                            <div className="card" style={{ backgroundColor: "#f8f9fa", marginTop: "1rem" }}>
                                <h4>Loan Summary</h4>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Loan Amount</span>
                                        <span className="info-value">{formatCurrency(formData.amount)}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Interest Rate</span>
                                        <span className="info-value">{interestRate}%</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Interest Amount</span>
                                        <span className="info-value">
                                            {formatCurrency(parseFloat(formData.amount) * (interestRate / 100))}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Total Repayable</span>
                                        <span className="info-value text-success">
                                            <strong>{formatCurrency(calculateTotal())}</strong>
                                        </span>
                                    </div>
                                </div>
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
