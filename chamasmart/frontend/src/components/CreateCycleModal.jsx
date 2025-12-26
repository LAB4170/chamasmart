import { useState, useEffect } from "react";
import { roscaAPI } from "../services/api";

const CreateCycleModal = ({ chama, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        cycle_name: `Cycle ${new Date().getFullYear()}`,
        contribution_amount: chama.contribution_amount,
        frequency: chama.contribution_frequency,
        start_date: new Date().toISOString().split("T")[0],
        roster_method: "RANDOM", // RANDOM, TRUST, MANUAL
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await roscaAPI.createCycle({
                chama_id: chama.chama_id,
                ...formData,
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to create cycle");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Start New Cycle</h3>
                    <button className="close-btn" onClick={onClose}>
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="form-group">
                        <label>Cycle Name</label>
                        <input
                            type="text"
                            name="cycle_name"
                            className="form-input"
                            value={formData.cycle_name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Amount (per person)</label>
                            <input
                                type="number"
                                name="contribution_amount"
                                className="form-input"
                                value={formData.contribution_amount}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Frequency</label>
                            <select
                                name="frequency"
                                className="form-select"
                                value={formData.frequency}
                                onChange={handleChange}
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
                            name="start_date"
                            className="form-input"
                            value={formData.start_date}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Roster Generation Method</label>
                        <div className="selection-grid grid-3">
                            <div
                                className={`selection-card compact ${formData.roster_method === "RANDOM" ? "active" : ""
                                    }`}
                                onClick={() => setFormData({ ...formData, roster_method: "RANDOM" })}
                            >
                                <div className="selection-icon small">🎲</div>
                                <div className="selection-name">Random</div>
                            </div>
                            <div
                                className={`selection-card compact ${formData.roster_method === "TRUST" ? "active" : ""
                                    }`}
                                onClick={() => setFormData({ ...formData, roster_method: "TRUST" })}
                            >
                                <div className="selection-icon small">🤝</div>
                                <div className="selection-name">Trust Score</div>
                            </div>
                            <div
                                className={`selection-card compact ${formData.roster_method === "MANUAL" ? "active disabled" : "disabled"
                                    }`}
                                title="Coming Soon"
                            // onClick={() => setFormData({ ...formData, roster_method: "MANUAL" })}
                            >
                                <div className="selection-icon small">📝</div>
                                <div className="selection-name">Manual</div>
                            </div>
                        </div>
                        {formData.roster_method === "TRUST" && (
                            <p className="text-sm text-muted mt-2">
                                <strong>Trust-Based:</strong> High trust scores ({">"}80) get priority slots (1-3). Low scores ({"<"}60) get last slots.
                            </p>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Starting..." : "Start Cycle"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCycleModal;
