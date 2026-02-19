import { useState, useEffect } from "react";
import { roscaAPI, chamaAPI } from "../services/api";

const CreateCycleModal = ({ chama, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        cycle_name: `Cycle ${new Date().getFullYear()}`,
        contribution_amount: chama.contribution_amount,
        frequency: chama.contribution_frequency,
        start_date: new Date().toISOString().split("T")[0],
        roster_method: "RANDOM", // RANDOM, TRUST, MANUAL
    });

    const [members, setMembers] = useState([]);
    const [manualRoster, setManualRoster] = useState([]); // Array of user objects in order

    const [loading, setLoading] = useState(false);
    const [fetchingMembers, setFetchingMembers] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    useEffect(() => {
        if (formData.roster_method === "MANUAL" && members.length === 0) {
            fetchMembers();
        }
    }, [formData.roster_method]);

    const fetchMembers = async () => {
        setFetchingMembers(true);
        try {
            const res = await chamaAPI.getMembers(chama.chama_id);
            const activeMembers = (res.data.data || res.data).filter(m => m.is_active);
            setMembers(activeMembers);
            // Initialize manual roster with current member order
            setManualRoster(activeMembers);
        } catch (err) {
            console.error("Failed to fetch members:", err);
            setError("Failed to load members for manual sequencing");
        } finally {
            setFetchingMembers(false);
        }
    };

    const moveMember = (index, direction) => {
        const newRoster = [...manualRoster];
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= newRoster.length) return;

        const temp = newRoster[index];
        newRoster[index] = newRoster[newIndex];
        newRoster[newIndex] = temp;
        setManualRoster(newRoster);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const payload = {
                chama_id: chama.chama_id,
                ...formData,
            };

            if (formData.roster_method === "MANUAL") {
                payload.manual_roster = manualRoster.map(m => m.user_id);
            }

            await roscaAPI.createCycle(payload);
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

                    <div className="form-group-premium">
                        <label>Cycle Name</label>
                        <input
                            type="text"
                            name="cycle_name"
                            className="input-premium"
                            value={formData.cycle_name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-row-premium">
                        <div className="form-group-premium">
                            <label>Amount (per person)</label>
                            <input
                                type="number"
                                name="contribution_amount"
                                className="input-premium"
                                value={formData.contribution_amount}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="form-group-premium">
                            <label>Frequency</label>
                            <select
                                name="frequency"
                                className="input-premium"
                                value={formData.frequency}
                                onChange={handleChange}
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
                            name="start_date"
                            className="input-premium"
                            value={formData.start_date}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group-premium">
                        <label>Roster Generation Method</label>
                        <div className="selection-grid-premium">
                            <div
                                className={`selection-card-premium ${formData.roster_method === "RANDOM" ? "active" : ""
                                    }`}
                                onClick={() => setFormData({ ...formData, roster_method: "RANDOM" })}
                            >
                                <div className="selection-icon-premium">🎲</div>
                                <div className="selection-name-premium">Random</div>
                            </div>
                            <div
                                className={`selection-card-premium ${formData.roster_method === "TRUST" ? "active" : ""
                                    }`}
                                onClick={() => setFormData({ ...formData, roster_method: "TRUST" })}
                            >
                                <div className="selection-icon-premium">🤝</div>
                                <div className="selection-name-premium">Trust Score</div>
                            </div>
                            <div
                                className={`selection-card-premium ${formData.roster_method === "MANUAL" ? "active" : ""}`}
                                onClick={() => setFormData({ ...formData, roster_method: "MANUAL" })}
                            >
                                <div className="selection-icon-premium">📝</div>
                                <div className="selection-name-premium">Manual</div>
                            </div>
                        </div>

                        {formData.roster_method === "MANUAL" && (
                            <div className="manual-sequencing-section mt-4">
                                <h4 className="text-sm font-bold mb-3">Set Payout Sequence</h4>
                                {fetchingMembers ? (
                                    <div className="text-center py-4">
                                        <div className="spinner-mini mx-auto mb-2" style={{ borderColor: 'var(--primary-color)', borderTopColor: 'transparent' }}></div>
                                        <p className="text-xs text-muted">Loading members...</p>
                                    </div>
                                ) : (
                                    <div className="manual-member-list">
                                        {manualRoster.map((member, index) => (
                                            <div key={member.user_id} className="manual-member-item">
                                                <div className="member-pos">{index + 1}</div>
                                                <div className="member-info-mini">
                                                    <span className="member-name-mini">{member.first_name} {member.last_name}</span>
                                                    {member.user_id === chama.created_by && <span className="admin-tag">Organizer</span>}
                                                </div>
                                                <div className="member-move-controls">
                                                    <button
                                                        type="button"
                                                        className="move-btn"
                                                        onClick={() => moveMember(index, -1)}
                                                        disabled={index === 0}
                                                    >
                                                        ↑
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="move-btn"
                                                        onClick={() => moveMember(index, 1)}
                                                        disabled={index === manualRoster.length - 1}
                                                    >
                                                        ↓
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-muted mt-3">
                                    💡 Use the arrows to set the order in which members will receive their payout.
                                </p>
                            </div>
                        )}
                        {formData.roster_method === "TRUST" && (
                            <p className="text-sm text-muted mt-2">
                                🤝 <strong>Trust-Based:</strong> High trust scores (&gt;80) get priority slots (1-3). Low scores (&lt;60) get last slots.
                            </p>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-activate-mini btn-full" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-create-premium btn-full" disabled={loading}>
                            {loading ? "Starting..." : "Start Cycle"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCycleModal;
