import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { meetingAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { Calendar, MapPin, Clock, Video, Users, ArrowLeft, Save, Trash2, Globe } from "lucide-react";
import "./Meetings.css";

const MeetingDetails = () => {
    const { id: chamaId, meetingId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [meeting, setMeeting] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        date: "",
        time: "",
        location: "",
        type: "PHYSICAL",
        meetingLink: "",
        status: "SCHEDULED"
    });

    useEffect(() => {
        const fetchMeeting = async () => {
            try {
                setLoading(true);
                const res = await meetingAPI.getById(chamaId, meetingId);
                const data = res.data.data.meeting;
                setMeeting(data);
                
                const scheduledDate = new Date(data.scheduled_date);
                setFormData({
                    title: data.title || "",
                    description: data.description || "",
                    date: scheduledDate.toISOString().split('T')[0],
                    time: scheduledDate.toTimeString().slice(0, 5),
                    location: data.location || "",
                    type: data.meeting_type || "PHYSICAL",
                    meetingLink: data.meeting_link || "",
                    status: data.status || "SCHEDULED"
                });
            } catch (err) {
                console.error(err);
                toast.error("Failed to load meeting details");
                navigate(`/chamas/${chamaId}/meetings`);
            } finally {
                setLoading(false);
            }
        };

        fetchMeeting();
    }, [chamaId, meetingId, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const scheduledAt = new Date(`${formData.date}T${formData.time}`);
            
            const payload = {
                title: formData.title,
                description: formData.description,
                scheduledAt: scheduledAt.toISOString(),
                location: formData.location,
                type: formData.type,
                meetingLink: formData.meetingLink,
                status: formData.status
            };

            await meetingAPI.update(chamaId, meetingId, payload);
            toast.success("Meeting updated successfully");
            navigate(`/chamas/${chamaId}/meetings`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to update meeting");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this meeting? This action cannot be undone.")) {
            return;
        }

        try {
            setSaving(true);
            await meetingAPI.delete(chamaId, meetingId);
            toast.success("Meeting deleted");
            navigate(`/chamas/${chamaId}/meetings`);
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete meeting");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="meetings-loading"><div className="spinner-modern"></div></div>;

    return (
        <div className="page meetings-page">
            <div className="container">
                <div className="meetings-header">
                    <div>
                        <button onClick={() => navigate(-1)} className="back-link-premium">
                            <ArrowLeft size={16} /> Back
                        </button>
                        <h1 className="meetings-title">Manage Meeting</h1>
                        {meeting && (
                            <p className="meetings-subtitle">Edit details for: <strong>{meeting.title}</strong></p>
                        )}
                    </div>
                </div>

                <div className="card-modern">
                    <form onSubmit={handleSave} className="meeting-form">
                        <div className="form-group">
                            <label className="form-label">Meeting Title</label>
                            <input
                                type="text"
                                name="title"
                                className="form-input"
                                value={formData.title}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    className="form-input"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Time</label>
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
                                    <option value="PHYSICAL">Physical</option>
                                    <option value="VIRTUAL">Virtual</option>
                                    <option value="HYBRID">Hybrid</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Meeting Status</label>
                                <select
                                    name="status"
                                    className="form-select"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value="SCHEDULED">Scheduled</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="CANCELLED">Cancelled</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                {formData.type === 'VIRTUAL' ? 'Meeting Link' : 'Location'}
                            </label>
                            <input
                                type="text"
                                name={formData.type === 'VIRTUAL' ? 'meetingLink' : 'location'}
                                className="form-input"
                                value={formData.type === 'VIRTUAL' ? formData.meetingLink : formData.location}
                                onChange={handleChange}
                                placeholder={formData.type === 'VIRTUAL' ? "https://link.com" : "e.g. Community Hall"}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Agenda / Minutes</label>
                            <textarea
                                name="description"
                                className="form-textarea"
                                rows="5"
                                value={formData.description}
                                onChange={handleChange}
                            ></textarea>
                        </div>

                        <div className="form-actions-premium">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="btn-danger-outline"
                                disabled={saving}
                            >
                                <Trash2 size={18} /> Delete Meeting
                            </button>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate(-1)}
                                    className="btn-hero-secondary"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-hero-primary"
                                    disabled={saving}
                                >
                                    <Save size={18} /> {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default MeetingDetails;
