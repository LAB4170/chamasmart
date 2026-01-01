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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetchChamaDetails();
    }, [id]);

    const fetchChamaDetails = async () => {
        try {
            const response = await chamaAPI.getById(id);
            const data = response.data.data;

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
            </div>
        </div>
    );
};

export default ManageChama;
