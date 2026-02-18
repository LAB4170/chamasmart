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
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>Start New Cycle</h1>
                </div>

                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Cycle Name</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="e.g., Q1 2024 Rounds"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Contribution Amount (per person)</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    required
                                    min="100"
                                />
                            </div>
                            <div className="form-group">
                                <label>Frequency</label>
                                <select
                                    className="form-select"
                                    value={formData.frequency}
                                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                                >
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="BIWEEKLY">Bi-Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Start Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-actions">
                            <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={submitting}>
                                {submitting ? "Creating..." : "Start Cycle"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateCycle;
