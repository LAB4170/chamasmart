import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI } from "../../services/api";

const ManageChama = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        chamaName: "",
        description: "",
        visibility: "PRIVATE",
        contributionAmount: "",
        contributionFrequency: "",
        meetingDay: "",
        meetingTime: "",
    });
    const [loanConfig, setLoanConfig] = useState(null);
    const [chamaType, setChamaType] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingLoanConfig, setSavingLoanConfig] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetchChamaDetails();
    }, [id]);

    const fetchChamaDetails = async () => {
        try {
            const response = await chamaAPI.getById(id);
            const data = response.data.data;

            setChamaType(data.chama_type);
            if (data.constitution_config && data.constitution_config.loan) {
                setLoanConfig({
                    interest_rate: data.constitution_config.loan.interest_rate ?? 10,
                    interest_type: data.constitution_config.loan.interest_type ?? "FLAT",
                    loan_multiplier: data.constitution_config.loan.loan_multiplier ?? 3,
                    max_repayment_months: data.constitution_config.loan.max_repayment_months ?? 6,
                    max_concurrent_loans: data.constitution_config.loan.max_concurrent_loans ?? 1,
                });
            } else {
                setLoanConfig({
                    interest_rate: 10,
                    interest_type: "FLAT",
                    loan_multiplier: 3,
                    max_repayment_months: 6,
                    max_concurrent_loans: 1,
                });
            }

            // Parse meeting string: "1st Saturday (Physical) at Westlands"
            let type = "PHYSICAL";
            let pattern = data.meeting_day || "";
            let location = "";

            if (data.meeting_day) {
                if (data.meeting_day.includes("(Online)")) type = "ONLINE";

                // Simple parsing attempt
                const parts = data.meeting_day.split('(');
                if (parts.length > 0) pattern = parts[0].trim();

                if (data.meeting_day.includes(" at ")) {
                    location = data.meeting_day.split(" at ")[1];
                }
            }

            setFormData({
                chamaName: data.chama_name,
                description: data.description || "",
                visibility: data.visibility,
                contributionAmount: data.contribution_amount,
                contributionFrequency: data.contribution_frequency,
                meetingDayPattern: pattern,
                meetingType: type,
                meetingLocation: location,
                meetingTime: data.meeting_time || "",
            });
        } catch (err) {
            setError("Failed to fetch chama details");
            console.error(err);
        } finally {
            setLoading(false);
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
        setSaving(true);
        setError("");
        setSuccess("");

        // Reconstruct meeting day string
        const typeLabel = formData.meetingType === "ONLINE" ? "Online" : "Physical";
        const locationPart = formData.meetingLocation ? ` at ${formData.meetingLocation}` : "";
        const finalMeetingDay = `${formData.meetingDayPattern} (${typeLabel})${locationPart}`;

        const payload = {
            ...formData,
            meetingDay: finalMeetingDay
        };

        try {
            await chamaAPI.update(id, payload);
            setSuccess("Chama updated successfully!");
            setTimeout(() => navigate(`/chamas/${id}`), 1500);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update chama");
        } finally {
            setSaving(false);
        }
    };

    const handleLoanConfigChange = (e) => {
        if (!loanConfig) return;
        setLoanConfig({
            ...loanConfig,
            [e.target.name]: e.target.name === 'interest_rate' || e.target.name === 'loan_multiplier'
                ? parseFloat(e.target.value || 0)
                : e.target.name === 'max_repayment_months' || e.target.name === 'max_concurrent_loans'
                    ? parseInt(e.target.value || 0, 10)
                    : e.target.value,
        });
    };

    const handleSaveLoanConfig = async (e) => {
        e.preventDefault();
        if (!loanConfig) return;
        setSavingLoanConfig(true);
        setError("");
        setSuccess("");
        try {
            await loanAPI.updateConfig(id, loanConfig);
            setSuccess("Loan configuration updated successfully!");
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update loan configuration");
        } finally {
            setSavingLoanConfig(false);
        }
    };

    if (loading) return <div className="page"><div className="container"><div className="spinner"></div></div></div>;

    return (
        <div className="page">
            <div className="container container-sm">
                <div className="card">
                    <div className="card-header">
                        <h2>Manage Chama Settings</h2>
                    </div>

                    {error && <div className="alert alert-error">{error}</div>}
                    {success && <div className="alert alert-success">{success}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group mb-4">
                            <label className="form-label">Chama Name</label>
                            <input
                                type="text"
                                name="chamaName"
                                className="form-input"
                                value={formData.chamaName}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">Description</label>
                            <textarea
                                name="description"
                                className="form-textarea"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                            />
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">Visibility</label>
                            <select
                                name="visibility"
                                className="form-select"
                                value={formData.visibility}
                                onChange={handleChange}
                            >
                                <option value="PRIVATE">Private (Invite Only)</option>
                                <option value="PUBLIC">Public (Searchable)</option>
                            </select>
                            <p className="text-muted text-sm mt-1">
                                {formData.visibility === 'PRIVATE'
                                    ? "Only members with the invite code can join."
                                    : "Anyone can search and request to join."}
                            </p>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Contribution Amount</label>
                                <input
                                    type="number"
                                    name="contributionAmount"
                                    className="form-input"
                                    value={formData.contributionAmount}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Frequency</label>
                                <select
                                    name="contributionFrequency"
                                    className="form-select"
                                    value={formData.contributionFrequency}
                                    onChange={handleChange}
                                >
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="BI_WEEKLY">Bi-Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                </select>
                            </div>
                        </div>


                        {/* Split Meeting Configuration */}
                        <div className="form-section mt-4">
                            <h3>Meeting Schedule</h3>
                            <div className="form-group mb-3">
                                <label className="form-label">Meeting Type</label>
                                <div className="meeting-type-toggle" style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                        type="button"
                                        className={`btn ${formData.meetingType === "PHYSICAL" ? "btn-primary" : "btn-outline"}`}
                                        onClick={() => setFormData({ ...formData, meetingType: "PHYSICAL" })}
                                    >
                                        📍 Physical Meeting
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn ${formData.meetingType === "ONLINE" ? "btn-primary" : "btn-outline"}`}
                                        onClick={() => setFormData({ ...formData, meetingType: "ONLINE" })}
                                    >
                                        💻 Online / Virtual
                                    </button>
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Meeting Day/Pattern</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. 1st Saturday, Every Sunday"
                                        value={formData.meetingDayPattern || ''}
                                        onChange={(e) => setFormData({ ...formData, meetingDayPattern: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{formData.meetingType === 'ONLINE' ? 'Meeting Link' : 'Venue / Location'}</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={formData.meetingType === 'ONLINE' ? 'zoom.us/j/...' : 'e.g. Community Hall'}
                                        value={formData.meetingLocation || ''}
                                        onChange={(e) => setFormData({ ...formData, meetingLocation: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group mt-3">
                                <label className="form-label">Time</label>
                                <input
                                    type="time"
                                    name="meetingTime"
                                    className="form-input"
                                    value={formData.meetingTime}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-actions mt-6">
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => navigate(`/chamas/${id}`)}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>

                {chamaType === 'TABLE_BANKING' && loanConfig && (
                    <div className="container container-sm" style={{ marginTop: '2rem' }}>
                        <div className="card">
                            <div className="card-header">
                                <h2>Table Banking Loan Settings</h2>
                                <p className="text-muted text-sm">
                                    Configure interest, limits, and concurrency for this chama's lending engine.
                                </p>
                            </div>
                            <form onSubmit={handleSaveLoanConfig}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Interest Type</label>
                                        <select
                                            name="interest_type"
                                            className="form-select"
                                            value={loanConfig.interest_type}
                                            onChange={handleLoanConfigChange}
                                        >
                                            <option value="FLAT">Flat Rate</option>
                                            <option value="REDUCING">Reducing Balance (per month)</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Interest Rate (%)</label>
                                        <input
                                            type="number"
                                            name="interest_rate"
                                            className="form-input"
                                            min="0.1"
                                            max="100"
                                            step="0.1"
                                            value={loanConfig.interest_rate}
                                            onChange={handleLoanConfigChange}
                                            required
                                        />
                                        <small className="text-muted">
                                            For FLAT, this is total % over the loan; for REDUCING, monthly % rate.
                                        </small>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Loan Multiplier (x Savings)</label>
                                        <input
                                            type="number"
                                            name="loan_multiplier"
                                            className="form-input"
                                            min="1"
                                            max="10"
                                            step="0.1"
                                            value={loanConfig.loan_multiplier}
                                            onChange={handleLoanConfigChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Max Repayment Period (months)</label>
                                        <input
                                            type="number"
                                            name="max_repayment_months"
                                            className="form-input"
                                            min="1"
                                            max="60"
                                            value={loanConfig.max_repayment_months}
                                            onChange={handleLoanConfigChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Max Concurrent Loans per Member</label>
                                        <input
                                            type="number"
                                            name="max_concurrent_loans"
                                            className="form-input"
                                            min="1"
                                            max="5"
                                            value={loanConfig.max_concurrent_loans}
                                            onChange={handleLoanConfigChange}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-actions mt-4">
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        disabled={savingLoanConfig}
                                    >
                                        {savingLoanConfig ? "Saving..." : "Save Loan Settings"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManageChama;
