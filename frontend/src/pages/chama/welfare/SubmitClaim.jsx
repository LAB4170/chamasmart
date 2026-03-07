import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { welfareAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import {
    Info, ArrowLeft, Shield, FileText,
    Upload, Loader, CheckCircle2, AlertCircle,
    Calendar, FileType
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

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
                const response = await welfareAPI.getConfig(id);
                // The response might be wrapped in .data or .data.data depending on formatters
                const configList = response.data?.data || response.data || [];
                setConfig(Array.isArray(configList) ? configList : []);
            } catch (err) {
                console.error("Error loading config:", err);
                const errorMsg = err.response?.data?.message || "Failed to load event types.";
                setError(errorMsg);
                toast.error(errorMsg);
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
            const claimData = {
                event_type_id: formData.event_type_id,
                date_of_occurrence: formData.date_of_occurrence,
                description: formData.description,
                proof_document: formData.proof_document
            };

            await welfareAPI.submitClaim(id, claimData);

            toast.success("Claim submitted successfully!");
            navigate(`/chamas/${id}/welfare`);
        } catch (err) {
            console.error("Error submitting claim:", err);
            const errorMsg = err.response?.data?.message || "Failed to submit claim.";
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-primary)' }}>
                <Loader size={48} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <p style={{ marginTop: '1rem', color: 'var(--gray)' }}>Loading claim configuration...</p>
            </div>
        );
    }

    const selectedEvent = Array.isArray(config) ? config.find(c => c.id?.toString() === formData.event_type_id) : null;

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem', color: 'var(--text-primary)' }}>
            <button
                onClick={() => navigate(`/chamas/${id}/welfare`)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    fontSize: '0.9rem', fontWeight: 500, marginBottom: '2rem',
                    transition: 'all 0.2s'
                }}
            >
                <ArrowLeft size={16} /> Back to Dashboard
            </button>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    background: 'var(--card-bg)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow)',
                    padding: '2.5rem'
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <Shield size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Report a Welfare Incident</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>Submit a new claim for support. Please ensure all details are accurate.</p>
                </div>

                {error && (
                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertCircle size={20} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Event Type</label>
                        <select
                            name="event_type_id"
                            value={formData.event_type_id}
                            onChange={handleInputChange}
                            required
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1rem',
                                background: 'var(--input-bg)',
                                border: '1px solid var(--input-border)',
                                borderRadius: '12px',
                                color: 'var(--input-text)',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="">Select the type of incident...</option>
                            {config.map(type => (
                                <option key={type.id} value={type.id}>
                                    {type.event_type.replace(/_/g, ' ')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <AnimatePresence>
                        {selectedEvent && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{ overflow: 'hidden', marginBottom: '1.5rem' }}
                            >
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(37, 99, 235, 0.05))',
                                    border: '1px solid rgba(37, 99, 235, 0.2)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}>
                                    <div style={{ padding: '0.5rem', background: 'var(--card-bg)', borderRadius: '8px', color: 'var(--primary)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <Info size={24} />
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Member Entitlement</p>
                                        <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Standard Payout: <span style={{ color: 'var(--primary)' }}>KES {Number(selectedEvent.payout_amount).toLocaleString()}</span>
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Date of Occurrence</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="date"
                                name="date_of_occurrence"
                                value={formData.date_of_occurrence}
                                onChange={handleInputChange}
                                required
                                max={new Date().toISOString().split("T")[0]}
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 3rem',
                                    fontSize: '1rem',
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    borderRadius: '12px',
                                    color: 'var(--input-text)',
                                    outline: 'none',
                                    fontFamily: 'inherit'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Description</label>
                        <div style={{ position: 'relative' }}>
                            <FileText size={20} style={{ position: 'absolute', left: '1rem', top: '1rem', color: 'var(--text-secondary)' }} />
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                placeholder="Briefly describe what happened..."
                                rows="3"
                                required
                                style={{
                                    width: '100%',
                                    padding: '1rem 1rem 1rem 3rem',
                                    fontSize: '1rem',
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    borderRadius: '12px',
                                    color: 'var(--input-text)',
                                    outline: 'none',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            ></textarea>
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Proof Document (Required)</label>
                        <div style={{
                            border: '2px dashed var(--border)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            textAlign: 'center',
                            background: 'var(--bg-secondary)',
                            cursor: 'pointer',
                            position: 'relative'
                        }}>
                            <Upload size={32} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 500, color: 'var(--text-primary)' }}>Click to upload document</p>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PDF or Image (e.g. Burial Permit, Medical Report)</p>

                            {formData.proof_document && (
                                <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'var(--success)', color: 'white', borderRadius: '6px', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle2 size={14} />
                                    {formData.proof_document.name}
                                </div>
                            )}

                            <input
                                type="file"
                                name="proof_document"
                                onChange={handleFileChange}
                                accept=".pdf,image/*"
                                required={!formData.proof_document}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0,
                                    cursor: 'pointer'
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.2)',
                            opacity: submitting ? 0.8 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        {submitting ? <Loader size={20} className="animate-spin" /> : <Shield size={20} />}
                        {submitting ? "Submitting Claim..." : "Submit Claim"}
                    </button>

                    <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Ensure all information is accurate. False claims may lead to penalty.
                    </p>
                </form>
            </motion.div>
        </div>
    );
};

export default SubmitClaim;
