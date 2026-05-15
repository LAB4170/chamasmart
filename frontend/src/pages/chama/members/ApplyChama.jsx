import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    Users, Send, ArrowLeft, ArrowRight, Shield,
    FileText, CheckCircle2, AlertCircle, Info,
    Sparkles, ShieldCheck, HeartHandshake, UserPlus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { chamaAPI, joinRequestAPI } from "../../../services/api";

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
        <div className="page">
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
                            <div className="wizard-form-container">
                                {/* Progress Indicator */}
                                <div className="wizard-progress-bar" style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
                                    {[1, 2, 3].map(s => (
                                        <div key={s} style={{ flex: 1 }}>
                                            <div style={{ 
                                                height: '4px', 
                                                background: step >= s ? 'var(--gold-gradient)' : 'rgba(255,255,255,0.05)',
                                                borderRadius: '2px',
                                                transition: '0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }} />
                                            <div style={{ 
                                                marginTop: '8px', 
                                                fontSize: '0.7rem', 
                                                fontWeight: 800, 
                                                textTransform: 'uppercase',
                                                color: step >= s ? 'var(--gold-text)' : 'var(--text-secondary)',
                                                letterSpacing: '1px'
                                            }}>
                                                Step 0{s}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <form onSubmit={handleSubmit} className="wizard-form-lux">
                                    <AnimatePresence mode="wait">
                                        {step === 1 && (
                                            <motion.div
                                                key="step1"
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                            >
                                                <div style={{ marginBottom: '32px' }}>
                                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Personal Profile</h3>
                                                    <p style={{ color: 'var(--text-secondary)' }}>Introduce yourself to the group leadership.</p>
                                                </div>

                                                <div className="form-group-lux">
                                                    <label className="lux-label">Identity & Background</label>
                                                    <textarea
                                                        name="introduction"
                                                        className="lux-input"
                                                        rows="6"
                                                        placeholder="Provide a brief summary of your occupation, location, and professional background..."
                                                        value={formData.introduction}
                                                        onChange={handleInputChange}
                                                        style={{ borderRadius: '16px', resize: 'none' }}
                                                        required
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }}>
                                                    <button type="button" className="btn-action-primary" onClick={nextStep} disabled={!formData.introduction} style={{ padding: '14px 28px' }}>
                                                        <span>Continue to Intent</span>
                                                        <ArrowRight size={18} style={{ marginLeft: '10px' }} />
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
                                                <div style={{ marginBottom: '32px' }}>
                                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Strategic Intent</h3>
                                                    <p style={{ color: 'var(--text-secondary)' }}>What value do you bring and what are your goals?</p>
                                                </div>

                                                <div className="form-group-lux">
                                                    <label className="lux-label">Motivation for Joining</label>
                                                    <textarea
                                                        name="reason"
                                                        className="lux-input"
                                                        rows="6"
                                                        placeholder="Describe your motivation and how you plan to contribute to the group's success..."
                                                        value={formData.reason}
                                                        onChange={handleInputChange}
                                                        style={{ borderRadius: '16px', resize: 'none' }}
                                                        required
                                                    />
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
                                                    <button type="button" className="btn-action-secondary" onClick={prevStep} style={{ padding: '14px 24px' }}>
                                                        <ArrowLeft size={18} style={{ marginRight: '10px' }} /> Back
                                                    </button>
                                                    <button type="button" className="btn-action-primary" onClick={nextStep} disabled={!formData.reason} style={{ padding: '14px 28px' }}>
                                                        <span>Review Terms</span>
                                                        <ArrowRight size={18} style={{ marginLeft: '10px' }} />
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
                                                <div style={{ marginBottom: '32px' }}>
                                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Final Attestation</h3>
                                                    <p style={{ color: 'var(--text-secondary)' }}>Acknowledge your commitments to the group architecture.</p>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    <div className="lux-checkbox-card" onClick={() => handleInputChange({ target: { name: 'financialCommitment', type: 'checkbox', checked: !formData.financialCommitment } })}>
                                                        <div className={`lux-checkbox-icon ${formData.financialCommitment ? 'checked' : ''}`}>
                                                            {formData.financialCommitment && <CheckCircle2 size={16} />}
                                                        </div>
                                                        <div className="lux-checkbox-content">
                                                            <h6>Financial Liquidity</h6>
                                                            <p>I attest to meeting the <strong>{formatCurrency(chama.contribution_amount)} {chama.contribution_frequency}</strong> requirement.</p>
                                                        </div>
                                                    </div>

                                                    <div className="lux-checkbox-card" onClick={() => handleInputChange({ target: { name: 'rulesAgreed', type: 'checkbox', checked: !formData.rulesAgreed } })}>
                                                        <div className={`lux-checkbox-icon ${formData.rulesAgreed ? 'checked' : ''}`}>
                                                            {formData.rulesAgreed && <CheckCircle2 size={16} />}
                                                        </div>
                                                        <div className="lux-checkbox-content">
                                                            <h6>Constitutional Adherence</h6>
                                                            <p>I agree to abide by the bylaws and governing constitution of this collective.</p>
                                                        </div>
                                                    </div>

                                                    <div className="lux-checkbox-card" onClick={() => handleInputChange({ target: { name: 'dataDisclosureAgreed', type: 'checkbox', checked: !formData.dataDisclosureAgreed } })}>
                                                        <div className={`lux-checkbox-icon ${formData.dataDisclosureAgreed ? 'checked' : ''}`}>
                                                            {formData.dataDisclosureAgreed && <CheckCircle2 size={16} />}
                                                        </div>
                                                        <div className="lux-checkbox-content">
                                                            <h6>Data Verification</h6>
                                                            <p>I authorize the disclosure of my verified profile information to group officials.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {error && <div className="alert alert-error" style={{ marginTop: '24px' }}>{error}</div>}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
                                                    <button type="button" className="btn-action-secondary" onClick={prevStep} style={{ padding: '14px 24px' }}>
                                                        <ArrowLeft size={18} style={{ marginRight: '10px' }} /> Back
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="btn-action-primary"
                                                        disabled={submitting || !formData.rulesAgreed || !formData.dataDisclosureAgreed || !formData.financialCommitment}
                                                        style={{ padding: '14px 32px' }}
                                                    >
                                                        {submitting ? "Processing..." : (
                                                            <>
                                                                <span>Submit Application</span>
                                                                <Send size={18} style={{ marginLeft: '10px' }} />
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
                                    className="security-card-lux"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <ShieldCheck size={20} color="#D4AF37" />
                                        Summary
                                    </h4>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <div className="summary-item-lux">
                                            <span className="label">Group Type</span>
                                            <span className="value">{chama.chama_type}</span>
                                        </div>
                                        <div className="summary-item-lux">
                                            <span className="label">Contribution</span>
                                            <span className="value">{formatCurrency(chama.contribution_amount)}</span>
                                        </div>
                                        <div className="summary-item-lux">
                                            <span className="label">Cycle</span>
                                            <span className="value" style={{ textTransform: 'capitalize' }}>{chama.contribution_frequency}</span>
                                        </div>
                                    </div>

                                    <div style={{ 
                                        marginTop: '32px', 
                                        padding: '20px', 
                                        background: 'rgba(59, 130, 246, 0.05)', 
                                        border: '1px solid rgba(59, 130, 246, 0.1)', 
                                        borderRadius: '16px' 
                                    }}>
                                        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                                            <Shield size={18} color="#3b82f6" />
                                            <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800 }}>Vault Security</h5>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
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
                .lux-checkbox-card {
                    display: flex;
                    gap: 16px;
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid var(--glass-border);
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .lux-checkbox-card:hover {
                    background: rgba(255, 255, 255, 0.05);
                    border-color: rgba(212, 175, 55, 0.3);
                }
                .lux-checkbox-icon {
                    width: 24px;
                    height: 24px;
                    border: 2px solid var(--glass-border);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    flex-shrink: 0;
                    transition: all 0.3s ease;
                }
                .lux-checkbox-icon.checked {
                    background: var(--gold-gradient);
                    border-color: transparent;
                }
                .lux-checkbox-content h6 {
                    margin: 0 0 4px 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                }
                .lux-checkbox-content p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }
                .summary-item-lux {
                    display: flex;
                    justify-content: space-between;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--glass-border);
                }
                .summary-item-lux .label {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }
                .summary-item-lux .value {
                    font-size: 0.85rem;
                    font-weight: 800;
                }
                .security-card-lux {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--glass-border);
                    border-radius: 32px;
                    padding: 32px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                }
            `}} />
        </div>
    );
};

export default ApplyChama;

