import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { welfareAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import {
    Info, ArrowLeft, Shield, FileText,
    Upload, Loader, CheckCircle2, AlertCircle, AlertTriangle,
    Calendar, Search, Sparkles, X, DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

// Common event suggestions
const COMMON_EVENTS = [
    { label: 'Bereavement — Parent', key: 'BEREAVEMENT_PARENT' },
    { label: 'Bereavement — Spouse / Child', key: 'BEREAVEMENT_SPOUSE' },
    { label: 'Hospitalization', key: 'HOSPITALIZATION' },
    { label: 'Wedding', key: 'WEDDING' },
    { label: 'Graduation', key: 'GRADUATION' },
    { label: 'Baby Shower / Newborn', key: 'BABY_SHOWER' },
    { label: 'Circumcision Ceremony', key: 'CIRCUMCISION' },
    { label: 'Church / Baby Dedication', key: 'CHURCH_DEDICATION' },
    { label: 'Road Accident', key: 'ACCIDENT' },
    { label: 'Permanent Disability', key: 'DISABILITY' },
    { label: 'Fire / Disaster', key: 'FIRE_DISASTER' },
    { label: 'Business Loss', key: 'BUSINESS_LOSS' },
];

const SubmitClaim = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const comboBoxRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [config, setConfig] = useState([]);
    const [fundBalance, setFundBalance] = useState(null);
    const [error, setError] = useState(null);

    // Premium Autocomplete State
    const [inputValue, setInputValue] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedConfigEvent, setSelectedConfigEvent] = useState(null);
    const [isCustomEvent, setIsCustomEvent] = useState(false);
    const [claimAmount, setClaimAmount] = useState('');

    const [formData, setFormData] = useState({
        date_of_occurrence: '',
        description: '',
        proof_document: null,
    });

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const [configRes, fundRes] = await Promise.allSettled([
                    welfareAPI.getConfig(id),
                    welfareAPI.getFund(id),
                ]);
                if (configRes.status === 'fulfilled') {
                    const configList = configRes.value.data?.data || configRes.value.data || [];
                    setConfig(Array.isArray(configList) ? configList : []);
                }
                if (fundRes.status === 'fulfilled') {
                    const fundData = fundRes.value.data?.data || fundRes.value.data;
                    setFundBalance(parseFloat(fundData?.balance ?? fundData?.fund_balance ?? 0));
                }
            } catch (err) {
                console.error('Error loading welfare data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [id]);

    useEffect(() => {
        const handler = (e) => {
            if (comboBoxRef.current && !comboBoxRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const query = inputValue.trim().toLowerCase();
    const configMatches = config.filter(c =>
        c.event_type.replace(/_/g, ' ').toLowerCase().includes(query)
    );
    const configKeys = new Set(config.map(c => c.event_type));
    const hintMatches = COMMON_EVENTS.filter(h =>
        !configKeys.has(h.key) && (query === '' || h.label.toLowerCase().includes(query) || h.key.toLowerCase().includes(query))
    );
    const hasExactConfigMatch = config.some(
        c => c.event_type.replace(/_/g, ' ').toLowerCase() === query
    );

    const handleComboInput = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setSelectedConfigEvent(null);
        setIsCustomEvent(val.trim().length > 0 && !hasExactConfigMatch);
        setShowDropdown(true);
    };

    const handleSelectConfig = (configItem) => {
        setInputValue(configItem.event_type.replace(/_/g, ' '));
        setSelectedConfigEvent(configItem);
        setIsCustomEvent(false);
        setShowDropdown(false);
        setClaimAmount(String(configItem.payout_amount || ''));
    };

    const handleSelectHint = (hint) => {
        setInputValue(hint.label);
        setSelectedConfigEvent(null);
        setIsCustomEvent(true);
        setShowDropdown(false);
    };

    const clearEvent = () => {
        setInputValue('');
        setSelectedConfigEvent(null);
        setIsCustomEvent(false);
        setClaimAmount('');
    };

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
        if (!inputValue.trim()) {
            toast.error('Please select or type an event type.');
            return;
        }

        setSubmitting(true);
        setError(null);

        const parsedAmount = parseFloat(claimAmount);
        if (!parsedAmount || parsedAmount <= 0) {
            toast.error('Please enter the amount you are claiming (must be greater than 0).');
            setSubmitting(false);
            return;
        }
        const ceiling = selectedConfigEvent ? parseFloat(selectedConfigEvent.payout_amount) : 0;
        if (ceiling > 0 && parsedAmount > ceiling) {
            toast.error(`Amount cannot exceed the KES ${ceiling.toLocaleString()} ceiling.`);
            setSubmitting(false);
            return;
        }

        try {
            const claimData = {
                claim_amount: parsedAmount,
                date_of_occurrence: formData.date_of_occurrence,
                description: formData.description,
                proof_document: formData.proof_document,
            };

            if (selectedConfigEvent) {
                claimData.event_type_id = selectedConfigEvent.id;
            } else {
                claimData.custom_event_name = inputValue.trim();
            }

            const res = await welfareAPI.submitClaim(id, claimData);
            const data = res.data;

            if (data?.is_custom_event) {
                toast.info('Custom event submitted! Admin will review and set the payout.', { autoClose: 6000 });
            } else {
                toast.success(data?.message || 'Claim submitted successfully!');
            }
            navigate(`/chamas/${id}`, { state: { tab: 'welfare', refresh: true } });
        } catch (err) {
            console.error('Error submitting claim:', err);
            const errorMsg = err.response?.data?.message || 'Failed to submit claim.';
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
                <p style={{ marginTop: '1rem', color: 'var(--gray)' }}>Loading claim form...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1.5rem', color: 'var(--text-primary)' }}>
            <button
                onClick={() => navigate(`/chamas/${id}`, { state: { tab: 'welfare' } })}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 1rem', background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    color: 'var(--text-secondary)', cursor: 'pointer',
                    fontSize: '0.9rem', fontWeight: 500, marginBottom: '2rem',
                    transition: 'all 0.2s'
                }}
            >
                <ArrowLeft size={16} /> Back to Welfare
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
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <Shield size={32} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Report a Welfare Incident</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto' }}>
                        Search for an event type or describe a custom incident.
                    </p>
                </div>

                {error && (
                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <AlertCircle size={20} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* ── PREMIUM AUTOCOMPLETE SEARCH ── */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Welfare Event Type
                        </label>

                        <div ref={comboBoxRef} style={{ position: 'relative' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0 1rem',
                                background: 'var(--input-bg)',
                                border: `2px solid ${showDropdown ? 'var(--primary)' : 'var(--input-border)'}`,
                                borderRadius: '12px',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                boxShadow: showDropdown ? '0 0 0 4px rgba(37,99,235,0.1)' : 'none'
                            }}>
                                <Search size={20} style={{ color: showDropdown ? 'var(--primary)' : 'var(--text-secondary)', transition: 'color 0.2s', flexShrink: 0 }} />
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={handleComboInput}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder="Search events (e.g. Wedding, Health) or type your own..."
                                    required
                                    autoComplete="off"
                                    style={{
                                        flex: 1,
                                        padding: '1rem 0',
                                        fontSize: '1.05rem',
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'var(--input-text)',
                                        fontFamily: 'inherit',
                                        fontWeight: 500
                                    }}
                                />
                                {inputValue && (
                                    <button type="button" onClick={clearEvent} style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: '50%', padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Suggestions */}
                            <AnimatePresence>
                                {showDropdown && (configMatches.length > 0 || hintMatches.length > 0 || query.length > 0) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 5, scale: 0.98 }}
                                        transition={{ duration: 0.15, ease: 'easeOut' }}
                                        style={{
                                            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 100,
                                            background: 'var(--card-bg)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '16px',
                                            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                                            maxHeight: '320px',
                                            overflowY: 'auto',
                                            padding: '0.5rem'
                                        }}
                                    >
                                        {/* Allow creating exact string implicitly */}
                                        {query.length > 0 && !hasExactConfigMatch && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsCustomEvent(true); setShowDropdown(false); }}
                                                style={{
                                                    width: '100%', textAlign: 'left', padding: '0.85rem 1rem',
                                                    background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: '10px',
                                                    color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 600,
                                                    marginBottom: '0.5rem',
                                                    transition: 'all 0.15s'
                                                }}
                                                onMouseOver={e => Object.assign(e.currentTarget.style, { background: 'rgba(37,99,235,0.12)', borderColor: 'rgba(37,99,235,0.3)' })}
                                                onMouseOut={e => Object.assign(e.currentTarget.style, { background: 'rgba(37,99,235,0.06)', borderColor: 'rgba(37,99,235,0.15)' })}
                                            >
                                                <div style={{ background: 'var(--primary)', color: 'white', padding: '0.3rem', borderRadius: '6px', display: 'flex' }}>
                                                    <Sparkles size={14} />
                                                </div>
                                                Create custom event: &ldquo;{inputValue}&rdquo;
                                            </button>
                                        )}

                                        {/* Predefined config entries */}
                                        {configMatches.length > 0 && (
                                            <div style={{ marginBottom: hintMatches.length > 0 ? '0.5rem' : '0' }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.5rem 0.75rem' }}>
                                                    Covered by Policy
                                                </div>
                                                {configMatches.map(item => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => handleSelectConfig(item)}
                                                        style={{
                                                            width: '100%', textAlign: 'left', padding: '0.75rem 0.85rem',
                                                            background: selectedConfigEvent?.id === item.id ? 'var(--bg-secondary)' : 'transparent',
                                                            border: 'none', cursor: 'pointer', borderRadius: '8px',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 500,
                                                            transition: 'background 0.15s',
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                        onMouseOut={e => e.currentTarget.style.background = selectedConfigEvent?.id === item.id ? 'var(--bg-secondary)' : 'transparent'}
                                                    >
                                                        <span>{item.event_type.replace(/_/g, ' ')}</span>
                                                        <span style={{ fontSize: '0.82rem', color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontWeight: 600 }}>
                                                            KES {Number(item.payout_amount).toLocaleString()}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Common event hints */}
                                        {hintMatches.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.5rem 0.75rem' }}>
                                                    Suggestions (Custom)
                                                </div>
                                                {hintMatches.map(h => (
                                                    <button
                                                        key={h.key}
                                                        type="button"
                                                        onClick={() => handleSelectHint(h)}
                                                        style={{
                                                            width: '100%', textAlign: 'left', padding: '0.75rem 0.85rem',
                                                            background: 'transparent',
                                                            border: 'none', cursor: 'pointer', borderRadius: '8px',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            color: 'var(--text-primary)', fontSize: '0.95rem',
                                                            transition: 'background 0.15s',
                                                        }}
                                                        onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <span>{h.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    <AnimatePresence>
                        {selectedConfigEvent && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, scale: 0.98 }}
                                animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                exit={{ opacity: 0, height: 0, scale: 0.98 }}
                                style={{ overflow: 'hidden', marginBottom: '1.5rem' }}
                            >
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '12px', padding: '1.25rem',
                                    display: 'flex', alignItems: 'center', gap: '1rem'
                                }}>
                                    <div style={{ padding: '0.5rem', background: 'var(--card-bg)', borderRadius: '8px', color: 'var(--primary)' }}>
                                        <Info size={24} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: '0 0 0.15rem 0', fontSize: '0.75rem', color: 'var(--gray)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Policy Ceiling</p>
                                        <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                            KES <span style={{ color: 'var(--primary)' }}>{Number(selectedConfigEvent.payout_amount).toLocaleString()}</span>
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Custom event warning */}
                    <AnimatePresence>
                        {isCustomEvent && !selectedConfigEvent && inputValue.trim().length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{ overflow: 'hidden', marginBottom: '1.5rem' }}
                            >
                                <div style={{
                                    background: 'rgba(245, 158, 11, 0.08)',
                                    border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '12px', padding: '1rem 1.25rem',
                                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem'
                                }}>
                                    <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <p style={{ margin: '0 0 0.2rem 0', fontWeight: 600, color: '#b45309', fontSize: '0.9rem' }}>Pending Admin Approval</p>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            You're filing a custom claim. Enter your requested amount below; an admin will review it.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── AMOUNT REQUESTED FIELD ── */}
                    <AnimatePresence>
                        {(selectedConfigEvent || (isCustomEvent && inputValue.trim().length > 0)) && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, y: 10 }}
                                animate={{ opacity: 1, height: 'auto', y: 0 }}
                                exit={{ opacity: 0, height: 0, y: -10 }}
                                style={{ overflow: 'hidden', marginBottom: '1.5rem' }}
                            >
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Amount Requested (KES)
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <DollarSign size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                    <input
                                        type="number"
                                        value={claimAmount}
                                        onChange={e => setClaimAmount(e.target.value)}
                                        placeholder={selectedConfigEvent ? `Max KES ${Number(selectedConfigEvent.payout_amount).toLocaleString()}` : 'How much are you claiming?'}
                                        required
                                        min="1"
                                        max={selectedConfigEvent ? selectedConfigEvent.payout_amount : undefined}
                                        step="1"
                                        style={{
                                            width: '100%', padding: '1.2rem 1rem 1.2rem 3rem',
                                            fontSize: '1.1rem', background: 'var(--input-bg)',
                                            border: `2px solid ${claimAmount && selectedConfigEvent && parseFloat(claimAmount) > parseFloat(selectedConfigEvent.payout_amount) ? 'var(--danger)' : 'var(--input-border)'}`,
                                            borderRadius: '12px', color: 'var(--input-text)',
                                            outline: 'none', fontFamily: 'inherit', fontWeight: 600,
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={e => { if(!e.target.style.borderColor.includes('danger')) e.target.style.borderColor = 'var(--primary)'; }}
                                        onBlur={e => { if(!e.target.style.borderColor.includes('danger')) e.target.style.borderColor = 'var(--input-border)'; }}
                                    />
                                </div>
                                {selectedConfigEvent && claimAmount && parseFloat(claimAmount) > parseFloat(selectedConfigEvent.payout_amount) && (
                                    <p style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500 }}>
                                        <AlertCircle size={14} /> Exceeds the KES {Number(selectedConfigEvent.payout_amount).toLocaleString()} ceiling.
                                    </p>
                                )}
                                {isCustomEvent && fundBalance !== null && claimAmount && (
                                    <p style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: parseFloat(claimAmount) <= fundBalance ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500 }}>
                                        {parseFloat(claimAmount) <= fundBalance ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                        Fund balance: KES {fundBalance.toLocaleString()}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Date of occurrence */}
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
                                max={new Date().toISOString().split('T')[0]}
                                style={{
                                    width: '100%', padding: '1rem 1rem 1rem 3.2rem',
                                    fontSize: '1rem', background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)', borderRadius: '12px',
                                    color: 'var(--input-text)', outline: 'none', fontFamily: 'inherit'
                                }}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>Description</label>
                        <div style={{ position: 'relative' }}>
                            <FileText size={20} style={{ position: 'absolute', left: '1rem', top: '1.2rem', color: 'var(--text-secondary)' }} />
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                placeholder="Tell us exactly what happened..."
                                rows="4"
                                required
                                style={{
                                    width: '100%', padding: '1rem 1rem 1rem 3.2rem',
                                    fontSize: '1rem', background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)', borderRadius: '12px',
                                    color: 'var(--input-text)', outline: 'none',
                                    resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5'
                                }}
                            />
                        </div>
                    </div>

                    {/* Proof document upload */}
                    <div style={{ marginBottom: '2.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Proof Document
                        </label>
                        <div style={{
                            border: `2px dashed ${formData.proof_document ? 'var(--success)' : 'var(--border)'}`,
                            borderRadius: '16px', padding: '2rem',
                            textAlign: 'center', background: formData.proof_document ? 'rgba(16,185,129,0.05)' : 'var(--bg-secondary)',
                            cursor: 'pointer', position: 'relative', transition: 'all 0.2s'
                        }}
                        onMouseOver={e => !formData.proof_document && (e.currentTarget.style.borderColor = 'var(--primary)')}
                        onMouseOut={e => !formData.proof_document && (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                            <Upload size={32} style={{ color: formData.proof_document ? 'var(--success)' : 'var(--text-secondary)', marginBottom: '1rem' }} />
                            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem' }}>Click or drag file to upload</p>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                PDF or Image (e.g. Receipt, Medical Report, Letter)
                            </p>

                            {formData.proof_document && (
                                <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: 'var(--success)', color: 'white', borderRadius: '8px', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, boxShadow: '0 4px 6px rgba(16,185,129,0.2)' }}>
                                    <CheckCircle2 size={18} />
                                    {formData.proof_document.name}
                                </div>
                            )}

                            <input
                                type="file"
                                name="proof_document"
                                onChange={handleFileChange}
                                accept=".pdf,image/*"
                                required={!formData.proof_document}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%', padding: '1.1rem',
                            background: 'var(--primary)', color: 'white',
                            border: 'none', borderRadius: '12px',
                            fontWeight: 700, fontSize: '1.1rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                            boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)',
                            opacity: submitting ? 0.8 : 1, transition: 'all 0.2s'
                        }}
                    >
                        {submitting ? <Loader size={22} className="animate-spin" /> : <Shield size={22} strokeWidth={2.5} />}
                        {submitting ? 'Securely Submitting...' : 'Submit Claim'}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default SubmitClaim;
