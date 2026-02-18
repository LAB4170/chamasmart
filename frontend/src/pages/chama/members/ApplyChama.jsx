import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Users, Send, ArrowLeft, ArrowRight, Shield,
    FileText, CheckCircle2, AlertCircle, Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { chamaAPI, joinRequestAPI } from "../../../services/api";
import "./MemberManagement.css";

const ApplyChama = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [step, setStep] = useState(1);

    const [formData, setFormData] = useState({
        introduction: "",
        reason: "",
        financialCommitment: false,
        rulesAgreed: false,
        dataDisclosureAgreed: false
    });

    useEffect(() => {
        const fetchChama = async () => {
            try {
                const response = await chamaAPI.getById(id);
                setChama(response.data.data);
            } catch (err) {
                setError("Failed to load chama details");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchChama();
    }, [id]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.rulesAgreed || !formData.dataDisclosureAgreed || !formData.financialCommitment) {
            setError("Please agree to all terms before submitting.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            // Construct the structured JSON message
            const applicationData = {
                type: "STRUCTURED_APPLICATION",
                version: "1.0",
                data: {
                    introduction: formData.introduction,
                    motivation: formData.reason,
                    vows: {
                        financial: formData.financialCommitment,
                        rules: formData.rulesAgreed
                    },
                    timestamp: new Date().toISOString()
                }
            };

            await joinRequestAPI.request(id, JSON.stringify(applicationData));
            navigate("/browse-chamas", { state: { success: `Your application to join ${chama.chama_name} has been submitted!` } });
        } catch (err) {
            setError(err.response?.data?.message || "Failed to submit application");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="loading-container">Loading application...</div>;
    if (error && !chama) return <div className="alert alert-error">{error}</div>;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount);
    };

    return (
        <div className="add-member-container">
            <div className="add-member-header">
                <div>
                    <h1 className="d-flex align-center gap-2">
                        <FileText size={32} style={{ color: 'var(--primary)' }} />
                        Membership Application
                    </h1>
                    <p className="add-member-subtitle">Join <strong>{chama?.chama_name}</strong></p>
                </div>
                <button
                    className="btn btn-outline btn-sm d-flex align-center gap-1"
                    onClick={() => navigate("/browse-chamas")}
                >
                    <ArrowLeft size={16} /> Cancel
                </button>
            </div>

            <div className="grid grid-2-1 gap-4">
                {/* Form Section */}
                <div className="card shadow-sm">
                    <div className="step-indicator mb-4 d-flex justify-between">
                        {[1, 2, 3].map(s => (
                            <div
                                key={s}
                                className={`step-dot ${step >= s ? 'active' : ''}`}
                                style={{
                                    flex: 1,
                                    height: '4px',
                                    backgroundColor: step >= s ? 'var(--primary)' : 'var(--border)',
                                    margin: '0 4px',
                                    borderRadius: '2px',
                                    transition: '0.3s'
                                }}
                            />
                        ))}
                    </div>

                    <form onSubmit={handleSubmit}>
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h3>Step 1: Introduction</h3>
                                    <p className="text-muted small mb-4">Tell the officials a bit about yourself.</p>

                                    <div className="form-group">
                                        <label>Tell us about yourself (Background/Occupation)</label>
                                        <textarea
                                            name="introduction"
                                            className="form-input"
                                            rows="4"
                                            placeholder="e.g. I am a software developer based in Nairobi with a keen interest in collective investments..."
                                            value={formData.introduction}
                                            onChange={handleInputChange}
                                            required
                                        ></textarea>
                                    </div>

                                    <div className="d-flex justify-end mt-4">
                                        <button type="button" className="btn btn-primary d-flex align-center gap-2" onClick={nextStep} disabled={!formData.introduction}>
                                            Next Step <ArrowRight size={18} />
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h3>Step 2: Intent & Motivation</h3>
                                    <p className="text-muted small mb-4">Why do you want to join <strong>{chama.chama_name}</strong>?</p>

                                    <div className="form-group">
                                        <label>What are your goals for joining this Chama?</label>
                                        <textarea
                                            name="reason"
                                            className="form-input"
                                            rows="4"
                                            placeholder="e.g. I am looking to grow my savings and participate in table banking loans..."
                                            value={formData.reason}
                                            onChange={handleInputChange}
                                            required
                                        ></textarea>
                                    </div>

                                    <div className="d-flex justify-between mt-4">
                                        <button type="button" className="btn btn-outline d-flex align-center gap-2" onClick={prevStep}>
                                            <ArrowLeft size={18} /> Back
                                        </button>
                                        <button type="button" className="btn btn-primary d-flex align-center gap-2" onClick={nextStep} disabled={!formData.reason}>
                                            Next Step <ArrowRight size={18} />
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h3>Step 3: Verification & Terms</h3>
                                    <p className="text-muted small mb-4">Finalize your application by agreeing to the terms.</p>

                                    <div className="card variant-soft mb-3" style={{ background: 'var(--surface-3)', border: '1px dashed var(--border)' }}>
                                        <div className="d-flex gap-3 mb-3">
                                            <input
                                                type="checkbox"
                                                id="financialCommitment"
                                                name="financialCommitment"
                                                checked={formData.financialCommitment}
                                                onChange={handleInputChange}
                                                style={{ width: '20px', height: '20px' }}
                                            />
                                            <label htmlFor="financialCommitment" className="small">
                                                I confirm that I am able to meet the contribution requirement of <strong>{formatCurrency(chama.contribution_amount)} {chama.contribution_frequency}</strong>.
                                            </label>
                                        </div>

                                        <div className="d-flex gap-3 mb-3">
                                            <input
                                                type="checkbox"
                                                id="rulesAgreed"
                                                name="rulesAgreed"
                                                checked={formData.rulesAgreed}
                                                onChange={handleInputChange}
                                                style={{ width: '20px', height: '20px' }}
                                            />
                                            <label htmlFor="rulesAgreed" className="small">
                                                I agree to abide by the rules and constitution of this Chama.
                                            </label>
                                        </div>

                                        <div className="d-flex gap-3">
                                            <input
                                                type="checkbox"
                                                id="dataDisclosureAgreed"
                                                name="dataDisclosureAgreed"
                                                checked={formData.dataDisclosureAgreed}
                                                onChange={handleInputChange}
                                                style={{ width: '20px', height: '20px' }}
                                            />
                                            <label htmlFor="dataDisclosureAgreed" className="small d-flex align-center gap-2">
                                                I understand my profile info will be shared with officials.
                                                <Info size={14} className="text-muted" title="Officials will see your Name, Email, and Phone Number to verify your application." />
                                            </label>
                                        </div>
                                    </div>

                                    {error && <div className="alert alert-error mb-3">{error}</div>}

                                    <div className="d-flex justify-between mt-4">
                                        <button type="button" className="btn btn-outline d-flex align-center gap-2" onClick={prevStep}>
                                            <ArrowLeft size={18} /> Back
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary d-flex align-center gap-2"
                                            disabled={submitting || !formData.rulesAgreed || !formData.dataDisclosureAgreed || !formData.financialCommitment}
                                        >
                                            {submitting ? "Submitting..." : (
                                                <>
                                                    Submit Application <Send size={18} />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </div>

                {/* Sidebar Info */}
                <div className="d-flex flex-column gap-3">
                    <div className="card shadow-sm" style={{ borderTop: '4px solid var(--primary)' }}>
                        <h4 className="mb-3 d-flex align-center gap-2">
                            <Shield size={18} className="text-primary" />
                            Group Summary
                        </h4>
                        <div className="small">
                            <div className="d-flex justify-between mb-2 pb-2 border-bottom">
                                <span className="text-muted">Type</span>
                                <span className="font-bold">{chama.chama_type}</span>
                            </div>
                            <div className="d-flex justify-between mb-2 pb-2 border-bottom">
                                <span className="text-muted">Contribution</span>
                                <span className="font-bold">{formatCurrency(chama.contribution_amount)}</span>
                            </div>
                            <div className="d-flex justify-between mb-2">
                                <span className="text-muted">Frequency</span>
                                <span className="font-bold text-uppercase">{chama.contribution_frequency}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card variant-soft" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div className="d-flex gap-2 mb-2">
                            <CheckCircle2 size={18} className="text-blue" />
                            <h5 className="mb-0">Secure Application</h5>
                        </div>
                        <p className="small text-muted mb-0">
                            Your application is private and only visible to authorized officials.
                            You will be notified via email and in-app once a decision is made.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ApplyChama;
