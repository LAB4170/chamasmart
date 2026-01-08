import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import "./SubmitClaim.css";

const SubmitClaim = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [config, setConfig] = useState([]);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        event_type_id: "",
        date_of_occurrence: "",
        description: "",
        proof_document: null
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${import.meta.env.VITE_API_URL}/welfare/${id}/config`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setConfig(response.data);
            } catch (err) {
                console.error("Error loading config:", err);
                setError("Failed to load event types.");
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, [id]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, proof_document: e.target.files[0] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem("token");
            const data = new FormData();
            data.append("event_type_id", formData.event_type_id);
            data.append("date_of_occurrence", formData.date_of_occurrence);
            data.append("description", formData.description);
            if (formData.proof_document) {
                data.append("proof_document", formData.proof_document);
            }

            await axios.post(
                `${import.meta.env.VITE_API_URL}/welfare/${id}/members/${user.user_id}/claims`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "multipart/form-data"
                    }
                }
            );

            alert("Claim submitted successfully!");
            navigate(`/chamas/${id}/welfare`);
        } catch (err) {
            console.error("Error submitting claim:", err);
            setError(err.response?.data?.message || "Failed to submit claim.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;

    const selectedEvent = config.find(c => c.id.toString() === formData.event_type_id);

    return (
        <div className="submit-claim-container">
            <button className="btn-back" onClick={() => navigate(`/chamas/${id}/welfare`)}>
                ← Back to Dashboard
            </button>

            <div className="claim-card">
                <h2>Report a Welfare Incident</h2>
                <p className="subtitle">Submit a claim for support during an emergency.</p>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Event Type</label>
                        <select
                            name="event_type_id"
                            value={formData.event_type_id}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Select Event Type</option>
                            {config.map(type => (
                                <option key={type.id} value={type.id}>
                                    {type.event_type.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedEvent && (
                        <div className="entitlement-info">
                            <span className="icon">ℹ️</span>
                            <span>
                                Standard Payout: <strong>KES {Number(selectedEvent.payout_amount).toLocaleString()}</strong>
                            </span>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Date of Occurrence</label>
                        <input
                            type="date"
                            name="date_of_occurrence"
                            value={formData.date_of_occurrence}
                            onChange={handleInputChange}
                            required
                            max={new Date().toISOString().split("T")[0]}
                        />
                    </div>

                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Briefly describe what happened..."
                            rows="3"
                            required
                        ></textarea>
                    </div>

                    <div className="form-group">
                        <label>Proof Document (Required)</label>
                        <p className="hint">Upload official documents (e.g., Burial Permit, Medical Report). PDF or Image.</p>
                        <input
                            type="file"
                            name="proof_document"
                            onChange={handleFileChange}
                            accept=".pdf,image/*"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-submit"
                        disabled={submitting}
                    >
                        {submitting ? "Submitting..." : "Submit Claim"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SubmitClaim;
