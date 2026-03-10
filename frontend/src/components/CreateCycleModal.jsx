import { useState, useEffect } from "react";
import { roscaAPI, chamaAPI } from "../services/api";
import { Smartphone, Shield, TrendingUp, TrendingDown } from "lucide-react";

const TRUST_TIER_CONFIG = {
    HIGH:   { label: 'High Trust', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '🟢' },
    MEDIUM: { label: 'Mid Trust',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: '🟡' },
    LOW:    { label: 'Low Trust',  color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   icon: '🔴' },
};

const CreateCycleModal = ({ chama, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        cycle_name: `Cycle ${new Date().getFullYear()}`,
        contribution_amount: chama.contribution_amount,
        frequency: chama.contribution_frequency,
        start_date: new Date().toISOString().split("T")[0],
        roster_method: "RANDOM",
        autopilot_enabled: true,
    });

    const [members, setMembers] = useState([]);
    const [manualRoster, setManualRoster] = useState([]);
    const [rosterPreview, setRosterPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

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
        if (formData.roster_method === "TRUST") {
            fetchRosterPreview();
        }
    }, [formData.roster_method]);

    const fetchRosterPreview = async () => {
        setPreviewLoading(true);
        setRosterPreview(null);
        try {
            const res = await roscaAPI.getRosterPreview(chama.chama_id);
            setRosterPreview(res.data.data);
        } catch (err) {
            console.error("Failed to fetch roster preview:", err);
        } finally {
            setPreviewLoading(false);
        }
    };

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

                    <div className="form-group-premium mt-4 p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="flex items-center gap-2 m-0 text-primary font-bold">
                                    <Smartphone size={18} /> M-Pesa Autopilot
                                </h4>
                                <p className="text-xs text-muted m-0 mt-1">
                                    Automatically trigger payouts to members once fully funded via M-Pesa B2C.
                                </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={formData.autopilot_enabled}
                                    onChange={(e) => setFormData({ ...formData, autopilot_enabled: e.target.checked })}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                            </label>
                        </div>
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
                            <div className="mt-4 border rounded-xl overflow-hidden">
                                <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Shield size={16} className="text-indigo-600" />
                                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">Predicted Payout Order</span>
                                    </div>
                                    <button type="button" onClick={fetchRosterPreview} className="text-[10px] text-indigo-500 underline hover:no-underline">
                                        Refresh Preview
                                    </button>
                                </div>
                                {previewLoading ? (
                                    <div className="p-6 text-center">
                                        <div className="spinner-mini mx-auto mb-2" style={{ borderColor: 'var(--primary-color)', borderTopColor: 'transparent' }}></div>
                                        <p className="text-xs text-muted">Fetching trust scores...</p>
                                    </div>
                                ) : rosterPreview ? (
                                    <div>
                                        {rosterPreview.roster.map((m) => {
                                            const tier = TRUST_TIER_CONFIG[m.trust_tier] || TRUST_TIER_CONFIG.MEDIUM;
                                            return (
                                                <div key={m.user_id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0" style={{ background: tier.bg }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-lg font-black" style={{ color: tier.color, width: '24px', textAlign: 'center' }}>
                                                            {m.predicted_position}
                                                        </div>
                                                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{m.first_name} {m.last_name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.icon} {tier.label}</span>
                                                        <span className="text-xs text-gray-500 font-mono bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                            {m.trust_score}/100
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <p className="text-[10px] text-muted px-4 py-2 text-center italic">
                                            ⚡ Positions may vary within tiers for fairness. High scorers always go first.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted p-4 text-center">Could not load preview. Trust scores may not be available yet.</p>
                                )}
                            </div>
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
