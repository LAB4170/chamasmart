import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { roscaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Rosca.css";

const CreateCycle = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        amount: "",
        frequency: "MONTHLY",
        startDate: ""
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await roscaAPI.createCycle({
                chama_id: id,
                ...formData
            });
            toast.success("Cycle created successfully");
            navigate(`/chamas/${id}/rosca`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to create cycle");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page rosca-create-page">
            <div className="container">
                <div className="page-header-modern">
                    <button onClick={() => navigate(-1)} className="back-link-premium">
                        <ArrowLeft size={16} />
                        <span>Cancel & Return</span>
                    </button>
                    <div className="header-info">
                        <div className="header-icon-wrapper">
                            <Plus size={28} />
                        </div>
                        <div>
                            <h1>Start New Round</h1>
                            <p>Initialize a new rotating savings cycle for your members</p>
                        </div>
                    </div>
                </div>

                <div className="card-premium max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit} className="premium-form">
                        <div className="form-group-premium">
                            <label>Cycle Name</label>
                            <input
                                type="text"
                                className="input-premium"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="e.g., Q1 2024 Rounds"
                            />
                        </div>

                        <div className="form-row-premium">
                            <div className="form-group-premium">
                                <label>Contribution Amount (per person)</label>
                                <div className="input-with-icon">
                                    <span className="input-icon">KES</span>
                                    <input
                                        type="number"
                                        className="input-premium with-icon"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                        min="100"
                                    />
                                </div>
                            </div>
                            <div className="form-group-premium">
                                <label>Frequency</label>
                                <select
                                    className="input-premium"
                                    value={formData.frequency}
                                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                                >
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="BIWEEKLY">Bi-Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group-premium">
                            <label>Start Date</label>
                            <input
                                type="date"
                                className="input-premium"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                required
                            />
                            <p className="form-help-text">
                                <Clock size={12} /> Rounds will automatically activate on this date.
                            </p>
                        </div>

                        <div className="form-actions-premium mt-4">
                            <button
                                type="submit"
                                className="btn-create-premium w-full justify-center"
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <>
                                        <div className="spinner-mini"></div>
                                        <span>Creating...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Initialize Cycle</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateCycle;
