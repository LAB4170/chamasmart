import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ascaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Asca.css";

const BuyShares = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [amount, setAmount] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await ascaAPI.buyShares(id, { amount });
            toast.success("Shares purchased successfully");
            navigate(`/chamas/${id}/asca`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to buy shares");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>Buy Shares</h1>
                </div>

                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Amount to Invest (KES)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                                min="100"
                                placeholder="Enter amount..."
                            />
                            <p className="form-text">Shares are calculated based on current unit price.</p>
                        </div>

                        <div className="form-actions">
                            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? "Processing..." : "Buy Shares"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BuyShares;
