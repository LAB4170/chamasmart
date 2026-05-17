import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    Users, Send, ArrowLeft, ArrowRight, Shield,
    FileText, CheckCircle2, AlertCircle, Info,
    Sparkles, ShieldCheck, HeartHandshake, UserPlus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { chamaAPI, joinRequestAPI } from "../../../services/api";
import "../core/ChamaDetailsLux.css";

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
            navigate("/browse-chamas", { state: { success: `Application for ${chama.chama_name} submitted successfully!` } });
        } catch (err) {
            setError(err.response?.data?.message || "Failed to submit application");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: '40px', height: '40px' }} />
        </div>
    );
    
    if (error && !chama) return (
        <div className="page">
            <div className="container">
                <div className="alert alert-error" style={{ marginTop: '40px' }}>{error}</div>
            </div>
        </div>
    );

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount || 0);
    };

    return (
        <div className="manage-page-root">
            <div className="ambient-blob blob-gold" />
            <div className="ambient-blob blob-blue" />

            <div className="container">
                <div className="page-frame-lux">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="application-wizard-lux"
                    >
                        {/* Wizard Header */}
                        <div className="user-hero-lux" style={{ marginBottom: "40px", padding: "32px 40px" }}>
                            <div className="user-hero-content">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '8px', borderRadius: '10px' }}>
                                        <UserPlus size={20} color="#D4AF37" />
                                    </div>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--gold-text)' }}>
                                        Membership Application
                                    </span>
                                </div>
                                <h1 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '8px' }}>
                                    Joining <span className="text-gold-gradient">{chama?.chama_name}</span>
                                </h1>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                                    Follow the verification steps below to submit your credentials to the group officials.
                                </p>
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                <button
                                    className="btn-action-secondary"
                                    onClick={() => navigate("/browse-chamas")}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}
                                >
                                    <ArrowLeft size={16} /> <span>Cancel</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-2-1 gap-5">
                            {/* Wizard Body */}
                            <div className="wizard-card-lux">
                                {/* Progress Indicator */}
                                <div className="wizard-progress-bar" style={{ display: 'flex', gap: '12px', marginBottom: '48px' }}>
                                    {[1, 2, 3].map(s => (
                                        <div key={s} style={{ flex: 1 }}>
                                            <div style={{ 
                                                height: '6px', 
                                                background: step >= s ? 'var(--gold-gradient)' : 'var(--lux-border)',
                                                borderRadius: '3px',
                                                transition: '0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }} />
                                            <div style={{ 
                                                marginTop: '10px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 800, 
                                                textTransform: 'uppercase',
                                                color: step >= s ? 'var(--lux-gold)' : 'var(--lux-text-secondary)',
                                                letterSpacing: '1.5px'
                                            }}>
                                                Step 0{s}
                                            </div>
                                        </div>
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
                                                <div style={{ marginBottom: '36px' }}>
                                                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px', color: 'var(--lux-text-primary)' }}>Personal Profile</h3>
                                                    <p style={{ color: 'var(--lux-text-secondary)', fontSize: '1rem' }}>Introduce yourself to the group leadership.</p>
                                                </div>

                                                <div style={{ marginBottom: '36px' }}>
                                                    <label className="wizard-step-label">Identity & Background</label>
                                                    <textarea
                                                        name="introduction"
                                                        className="wizard-step-input"
                                                        rows="6"
                                                        placeholder="Provide a brief summary of your occupation, location, and professional background..."
                                                        value={formData.introduction}
                                                        onChange={handleInputChange}
                                                        style={{ resize: 'none' }}
                                                        required
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }}>
                                                    <button type="button" className="wizard-btn-next" onClick={nextStep} disabled={!formData.introduction}>
                                                        <span>Continue to Intent</span>
                                                        <ArrowRight size={18} />
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
                                                <div style={{ marginBottom: '36px' }}>
                                                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px', color: 'var(--lux-text-primary)' }}>Strategic Intent</h3>
                                                    <p style={{ color: 'var(--lux-text-secondary)', fontSize: '1rem' }}>What value do you bring and what are your goals?</p>
                                                </div>

                                                <div style={{ marginBottom: '36px' }}>
                                                    <label className="wizard-step-label">Motivation for Joining</label>
                                                    <textarea
                                                        name="reason"
                                                        className="wizard-step-input"
                                                        rows="6"
                                                        placeholder="Describe your motivation and how you plan to contribute to the group's success..."
                                                        value={formData.reason}
                                                        onChange={handleInputChange}
                                                        style={{ resize: 'none' }}
                                                        required
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
                                                    <button type="button" className="wizard-btn-prev" onClick={prevStep}>
                                                        <ArrowLeft size={18} /> Back
                                                    </button>
                                                    <button type="button" className="wizard-btn-next" onClick={nextStep} disabled={!formData.reason}>
                                                        <span>Review Terms</span>
                                                        <ArrowRight size={18} />
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
                                                <div style={{ marginBottom: '36px' }}>
                                                    <h3 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '8px', color: 'var(--lux-text-primary)' }}>Final Attestation</h3>
                                                    <p style={{ color: 'var(--lux-text-secondary)', fontSize: '1rem' }}>Acknowledge your commitments to the group architecture.</p>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                                    <div className="wizard-checkbox-card" onClick={() => handleInputChange({ target: { name: 'financialCommitment', type: 'checkbox', checked: !formData.financialCommitment } })}>
                                                        <div className={`wizard-checkbox-icon ${formData.financialCommitment ? 'checked' : ''}`}>
                                                            {formData.financialCommitment && <CheckCircle2 size={18} />}
                                                        </div>
                                                        <div className="wizard-checkbox-content">
                                                            <h6>Financial Liquidity</h6>
                                                            <p>I attest to meeting the <strong>{formatCurrency(chama.contribution_amount)} {chama.contribution_frequency}</strong> requirement.</p>
                                                        </div>
                                                    </div>

                                                    <div className="wizard-checkbox-card" onClick={() => handleInputChange({ target: { name: 'rulesAgreed', type: 'checkbox', checked: !formData.rulesAgreed } })}>
                                                        <div className={`wizard-checkbox-icon ${formData.rulesAgreed ? 'checked' : ''}`}>
                                                            {formData.rulesAgreed && <CheckCircle2 size={18} />}
                                                        </div>
                                                        <div className="wizard-checkbox-content">
                                                            <h6>Constitutional Adherence</h6>
                                                            <p>I agree to abide by the bylaws and governing constitution of this collective.</p>
                                                        </div>
                                                    </div>

                                                    <div className="wizard-checkbox-card" onClick={() => handleInputChange({ target: { name: 'dataDisclosureAgreed', type: 'checkbox', checked: !formData.dataDisclosureAgreed } })}>
                                                        <div className={`wizard-checkbox-icon ${formData.dataDisclosureAgreed ? 'checked' : ''}`}>
                                                            {formData.dataDisclosureAgreed && <CheckCircle2 size={18} />}
                                                        </div>
                                                        <div className="wizard-checkbox-content">
                                                            <h6>Data Verification</h6>
                                                            <p>I authorize the disclosure of my verified profile information to group officials.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {error && <div className="alert alert-error" style={{ marginTop: '24px' }}>{error}</div>}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
                                                    <button type="button" className="wizard-btn-prev" onClick={prevStep}>
                                                        <ArrowLeft size={18} /> Back
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="wizard-btn-next"
                                                        disabled={submitting || !formData.rulesAgreed || !formData.dataDisclosureAgreed || !formData.financialCommitment}
                                                    >
                                                        {submitting ? "Processing..." : (
                                                            <>
                                                                <span>Submit Attestation</span>
                                                                <Send size={18} />
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
                            <div className="wizard-sidebar">
                                <motion.div 
                                    className="wizard-summary-card"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <h4 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--lux-text-primary)' }}>
                                        <ShieldCheck size={24} color="var(--lux-gold)" />
                                        Summary
                                    </h4>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div className="wizard-summary-item">
                                            <span className="label">Group Type</span>
                                            <span className="value">{chama.chama_type}</span>
                                        </div>
                                        <div className="wizard-summary-item">
                                            <span className="label">Contribution</span>
                                            <span className="value">{formatCurrency(chama.contribution_amount)}</span>
                                        </div>
                                        <div className="wizard-summary-item">
                                            <span className="label">Cycle</span>
                                            <span className="value" style={{ textTransform: 'capitalize' }}>{chama.contribution_frequency}</span>
                                        </div>
                                    </div>

                                    <div className="wizard-security-box">
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', alignItems: 'center' }}>
                                            <Shield size={20} color="#3b82f6" />
                                            <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--lux-text-primary)' }}>Vault Security</h5>
                                        </div>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--lux-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                                            Your application is protected by enterprise encryption and will only be accessible to authorized officials of <strong>{chama.chama_name}</strong>.
                                        </p>
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .application-wizard-lux {
                    position: relative;
                }
            `}} />
        </div>
    );
};

export default ApplyChama;

