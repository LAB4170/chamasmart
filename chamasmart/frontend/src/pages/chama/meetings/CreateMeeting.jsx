import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { meetingAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Meetings.css";

const CreateMeeting = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        date: "",
        time: "",
        location: "",
        agenda: "",
        type: "PHYSICAL", // PHYSICAL, VIRTUAL, HYBRID
        meetingLink: ""
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (!formData.title || !formData.date || !formData.time) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            setLoading(true);

            // Combine date and time
            const scheduledAt = new Date(`${formData.date}T${formData.time}`);

            const payload = {
                title: formData.title,
                description: formData.agenda,
                scheduledAt: scheduledAt.toISOString(),
                location: formData.location,
                type: formData.type,
                meetingLink: formData.meetingLink,
                validUntil: scheduledAt.toISOString() // Default valid until meeting start
            };

            await meetingAPI.create(id, payload);
            toast.success("Meeting scheduled successfully!");
            navigate(`/chamas/${id}/meetings`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to schedule meeting");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page">
            <div className="container">
                <div className="meetings-page">
                    <div className="page-header">
                        <div>
                            <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm mb-2">
                                ← Back
                            </button>
                            <h1>Schedule Meeting</h1>
                            <p className="subtitle">Create a new meeting for your chama members.</p>
                        </div>
                    </div>

                    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Meeting Title *</label>
                                <input
                                    type="text"
                                    name="title"
                                    className="form-input"
                                    placeholder="e.g., Monthly Review Meeting"
                                    value={formData.title}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input
                                        type="date"
                                        name="date"
                                        className="form-input"
                                        value={formData.date}
                                        onChange={handleChange}
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Time *</label>
                                    <input
                                        type="time"
                                        name="time"
                                        className="form-input"
                                        value={formData.time}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Meeting Type</label>
                                    <select
                                        name="type"
                                        className="form-select"
                                        value={formData.type}
                                        onChange={handleChange}
                                    >
                                        <option value="PHYSICAL">Physical Location</option>
                                        <option value="VIRTUAL">Virtual (Online)</option>
                                        <option value="HYBRID">Hybrid</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">
                                        {formData.type === 'VIRTUAL' ? 'Meeting Link' : 'Location'}
                                    </label>
                                    {formData.type === 'VIRTUAL' ? (
                                        <input
                                            type="url"
                                            name="meetingLink"
                                            className="form-input"
                                            placeholder="https://zoom.us/..."
                                            value={formData.meetingLink}
                                            onChange={handleChange}
                                        />
                                    ) : (
                                        <input
                                            type="text"
                                            name="location"
                                            className="form-input"
                                            placeholder="e.g., Community Hall"
                                            value={formData.location}
                                            onChange={handleChange}
                                        />
                                    )}
                                </div>
                            </div>

                            {formData.type === 'HYBRID' && (
                                <div className="form-group">
                                    <label className="form-label">Meeting Link (Optional)</label>
                                    <input
                                        type="url"
                                        name="meetingLink"
                                        className="form-input"
                                        placeholder="https://zoom.us/..."
                                        value={formData.meetingLink}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Agenda / Description</label>
                                <textarea
                                    name="agenda"
                                    className="form-textarea"
                                    placeholder="What will be discussed?"
                                    value={formData.agenda}
                                    onChange={handleChange}
                                    rows="4"
                                ></textarea>
                            </div>

                            <div className="form-actions-modern">
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={() => navigate(-1)}
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-sm" style={{ marginRight: '8px' }}></span>
                                            Scheduling...
                                        </>
                                    ) : (
                                        'Schedule Meeting'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateMeeting;
