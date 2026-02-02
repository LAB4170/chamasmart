import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { payoutAPI, chamaAPI, meetingAPI } from "../../../services/api";

const ProcessPayout = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [eligibleMembers, setEligibleMembers] = useState([]);
    const [meetings, setMeetings] = useState([]);
    const [payouts, setPayouts] = useState([]);
    const [formData, setFormData] = useState({
        userId: "",
        amount: "",
        meetingId: "",
        notes: "",
    });
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setPageLoading(true);
            const [chamaRes, eligibleRes, meetingsRes, payoutsRes] = await Promise.all([
                chamaAPI.getById(id),
                payoutAPI.getEligible(id),
                meetingAPI.getAll(id),
                payoutAPI.getAll(id),
            ]);

            const chamaData = chamaRes.data.data;
            const eligibleData = eligibleRes.data.data;
            const membersCount = eligibleData.length;

            setChama(chamaData);
            setEligibleMembers(eligibleData);
            setMeetings(meetingsRes.data.data);
            setPayouts(payoutsRes.data.data);

            // Auto-select next recipient and calculate amount
            const receivedPayouts = payoutsRes.data.data.map((p) => p.user_id);
            const nextRecipient = eligibleData.find((m) => !receivedPayouts.includes(m.user_id));

            if (nextRecipient) {
                const expectedAmount = parseFloat(chamaData.contribution_amount) * membersCount;
                setFormData((prev) => ({
                    ...prev,
                    userId: nextRecipient.user_id,
                    amount: expectedAmount.toFixed(2),
                }));
            }
        } catch (err) {
            setError("Failed to load data");
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            await payoutAPI.process(id, formData);
            setSuccess("Payout processed successfully!");

            setTimeout(() => {
                navigate(`/chamas/${id}/payouts`);
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to process payout");
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

    const getAvailableFunds = () => {
        return chama?.current_fund || 0;
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

    const selectedMember = eligibleMembers.find(
        (m) => m.user_id === parseInt(formData.userId)
    );

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Process Payout</h1>
                        <p className="text-muted">{chama?.chama_name}</p>
                    </div>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/chamas/${id}/payouts`)}
                    >
                        ← Back to Payouts
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {/* Available Funds Warning */}
                {formData.amount && parseFloat(formData.amount) > getAvailableFunds() && (
                    <div className="alert alert-error">
                        ⚠️ Insufficient funds! Available: {formatCurrency(getAvailableFunds())}
                    </div>
                )}

                <div className="card">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Select Recipient *</label>
                            <select
                                name="userId"
                                className="form-select"
                                value={formData.userId}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Choose a member...</option>
                                {eligibleMembers.map((member) => {
                                    const hasReceived = payouts.some((p) => p.user_id === member.user_id);
                                    return (
                                        <option key={member.user_id} value={member.user_id}>
                                            {member.first_name} {member.last_name}
                                            {hasReceived ? " (Already received)" : ""}
                                        </option>
                                    );
                                })}
                            </select>
                            {selectedMember && (
                                <small className="text-muted">
                                    Position {selectedMember.rotation_position || eligibleMembers.indexOf(selectedMember) + 1} in rotation
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Payout Amount (KES) *</label>
                            <input
                                type="number"
                                name="amount"
                                className="form-input"
                                placeholder="Enter amount"
                                min="1"
                                step="0.01"
                                value={formData.amount}
                                onChange={handleChange}
                                required
                            />
                            <small className="text-muted">
                                Available Funds: {formatCurrency(getAvailableFunds())}
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Associated Meeting (Optional)</label>
                            <select
                                name="meetingId"
                                className="form-select"
                                value={formData.meetingId}
                                onChange={handleChange}
                            >
                                <option value="">No meeting selected</option>
                                {meetings.slice(0, 10).map((meeting) => (
                                    <option key={meeting.meeting_id} value={meeting.meeting_id}>
                                        {new Date(meeting.meeting_date).toLocaleDateString()} -{" "}
                                        {meeting.location || "No location"}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea
                                name="notes"
                                className="form-textarea"
                                placeholder="Any additional notes about this payout..."
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                            />
                        </div>

                        {/* Payout Summary */}
                        {formData.userId && formData.amount && (
                            <div className="card" style={{ backgroundColor: "#f0fdf4", marginTop: "1rem" }}>
                                <h4>Payout Summary</h4>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-label">Recipient</span>
                                        <span className="info-value">
                                            {selectedMember?.first_name} {selectedMember?.last_name}
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Amount</span>
                                        <span className="info-value text-success">
                                            <strong>{formatCurrency(formData.amount)}</strong>
                                        </span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Available Funds</span>
                                        <span className="info-value">{formatCurrency(getAvailableFunds())}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-label">Remaining After Payout</span>
                                        <span className="info-value">
                                            {formatCurrency(getAvailableFunds() - parseFloat(formData.amount))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => navigate(`/chamas/${id}/payouts`)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-success"
                                disabled={loading || parseFloat(formData.amount) > getAvailableFunds()}
                            >
                                {loading ? "Processing..." : "💰 Process Payout"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProcessPayout;
