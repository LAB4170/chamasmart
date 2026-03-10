import { useState } from "react";
import { roscaAPI } from "../services/api";

const SwapRequestModal = ({ cycle, targetMember, onClose, onSuccess }) => {
    const [reason, setReason] = useState("");
    const [swapFee, setSwapFee] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError("Please provide a reason for the swap request.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            await roscaAPI.requestSwap(cycle.cycle_id, {
                target_position: targetMember.position,
                reason: reason.trim(),
                swap_fee: swapFee ? parseInt(swapFee, 10) : 0
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to send swap request");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Request Slot Swap</h3>
                    <button className="close-btn" onClick={onClose}>
                        &times;
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                    {error && <div className="alert alert-error">{error}</div>}

                    <div className="info-box mb-4">
                        <p>
                            You are requesting to swap your slot with <strong>{targetMember.first_name} {targetMember.last_name}</strong> (Position {targetMember.position}).
                        </p>
                        <p className="text-sm text-muted mt-2">
                            They will be notified and must approve this request for the swap to happen.
                        </p>
                    </div>

                    <div className="form-group">
                        <label>Reason for Swap</label>
                        <textarea
                            className="form-textarea"
                            placeholder="e.g., I have a medical emergency in March..."
                            rows="3"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group mt-4 p-4 rounded-xl border border-indigo-100 bg-indigo-50/30">
                        <label className="flex items-center gap-2 text-indigo-700 font-bold mb-1">
                            Swap Fee (Optional)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 font-bold">KES</span>
                            <input
                                type="number"
                                className="form-input"
                                style={{ paddingLeft: '3.5rem' }}
                                placeholder="0"
                                value={swapFee}
                                onChange={(e) => setSwapFee(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-indigo-500 mt-2 italic">
                            💡 Offering a fee increases the chance of acceptance.
                        </p>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Sending..." : "Send Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SwapRequestModal;
