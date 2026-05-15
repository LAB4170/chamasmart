
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { inviteAPI } from '../../../services/api';
import { 
    ShieldCheck, Lock, ArrowRight, Sparkles, 
    Zap, CheckCircle2, Building2, KeyRound 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const JoinChama = () => {
    const [searchParams] = useSearchParams();
    const urlCode = searchParams.get('code');
    const [inviteCode, setInviteCode] = useState(urlCode || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const navigate = useNavigate();
    const attemptRef = useRef(false);

    useEffect(() => {
        const hasAttempted = sessionStorage.getItem(`joined_${urlCode}`);
        if (urlCode && !attemptRef.current && !hasAttempted) {
            setInviteCode(urlCode);
            attemptRef.current = true;
            sessionStorage.setItem(`joined_${urlCode}`, 'true');
            handleJoin(urlCode);
        }
    }, [urlCode]);

    const handleJoin = async (code) => {
        if (!code) return;
        setError('');
        setLoading(true);
        try {
            const response = await inviteAPI.join(code.trim().toUpperCase());
            const chamaId = response.data.data.chama.chama_id;
            toast.success("Identity Verified. Access Granted.");
            navigate(`/chamas/${chamaId}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Verification Failed. Invalid access code.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!inviteCode.trim()) {
            setError('Please enter a valid access code');
            return;
        }
        handleJoin(inviteCode);
    };

    return (
        <div className="page">
            <div className="ambient-blob blob-gold" />
            <div className="ambient-blob blob-blue" />

            <div className="container">
                <div className="page-frame-lux">
                    <motion.div 
                        className="join-vault-wrapper"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        {/* Split Layout: Input vs Info */}
                        <div className="grid grid-2-1 gap-5" style={{ alignItems: 'center' }}>
                            
                            {/* Left: Interactive Input Side */}
                            <div className="vault-input-section">
                                <div style={{ marginBottom: '40px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '10px', borderRadius: '12px' }}>
                                            <KeyRound size={24} color="#D4AF37" />
                                        </div>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--gold-text)' }}>
                                            Secure Access
                                        </span>
                                    </div>
                                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '16px', letterSpacing: '-1px' }}>
                                        Join via <span className="text-gold-gradient">Invite Code</span>
                                    </h1>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '450px' }}>
                                        Enter the unique 8-character verification code provided by your group official to initialize your membership.
                                    </p>
                                </div>

                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="alert alert-error" 
                                        style={{ marginBottom: '32px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                                    >
                                        <ShieldCheck size={18} /> {error}
                                    </motion.div>
                                )}

                                <form onSubmit={handleSubmit} className="vault-form-lux">
                                    <div className="form-group">
                                        <div className="vault-code-input-container">
                                            <input
                                                type="text"
                                                className="vault-code-input"
                                                placeholder="X X X X X X X X"
                                                value={inviteCode}
                                                onChange={(e) => {
                                                    setError("");
                                                    setInviteCode(e.target.value.toUpperCase());
                                                }}
                                                maxLength="20"
                                                autoFocus
                                            />
                                            <div className="vault-input-glow" />
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '16px', textAlign: 'center' }}>
                                            <Sparkles size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                                            Codes are case-insensitive and secure.
                                        </p>
                                    </div>

                                    <div style={{ display: 'flex', gap: '16px', marginTop: '40px' }}>
                                        <button
                                            type="submit"
                                            className="btn-action-primary"
                                            disabled={loading || !inviteCode}
                                            style={{ flex: 2, padding: '16px', fontSize: '1rem', fontWeight: 800 }}
                                        >
                                            {loading ? 'Verifying Identity...' : 'Initialize Membership'}
                                            {!loading && <ArrowRight size={20} style={{ marginLeft: '12px' }} />}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-action-secondary"
                                            onClick={() => navigate('/dashboard')}
                                            style={{ flex: 1, padding: '16px' }}
                                        >
                                            Back
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right: Security/Status Info */}
                            <div className="vault-info-section">
                                <motion.div 
                                    className="security-card-lux"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <ShieldCheck size={20} color="#D4AF37" />
                                        Verification Protocol
                                    </h3>
                                    
                                    <div className="protocol-list">
                                        <div className="protocol-item">
                                            <div className="protocol-icon"><Zap size={16} /></div>
                                            <div className="protocol-content">
                                                <h6>Single Use</h6>
                                                <p>Most codes are bound to your identity and expire after activation.</p>
                                            </div>
                                        </div>
                                        <div className="protocol-item">
                                            <div className="protocol-icon"><Building2 size={16} /></div>
                                            <div className="protocol-content">
                                                <h6>Group Sync</h6>
                                                <p>Upon activation, your dashboard will automatically sync with the group's ledger.</p>
                                            </div>
                                        </div>
                                        <div className="protocol-item">
                                            <div className="protocol-icon"><Lock size={16} /></div>
                                            <div className="protocol-content">
                                                <h6>End-to-End Encryption</h6>
                                                <p>Your joining process is secured by enterprise-grade cryptographic standards.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="vault-footer-note">
                                        <p>Don't have a code? <Link to="/browse-chamas" style={{ color: 'var(--gold-text)', fontWeight: 700, textDecoration: 'none' }}>Browse Public Groups</Link></p>
                                    </div>
                                </motion.div>
                            </div>

                        </div>
                    </motion.div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .vault-code-input-container {
                    position: relative;
                    background: rgba(255, 255, 255, 0.03);
                    border: 2px solid var(--glass-border);
                    border-radius: 24px;
                    padding: 24px;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
                }
                .vault-code-input-container:focus-within {
                    border-color: rgba(212, 175, 55, 0.5);
                    background: rgba(212, 175, 55, 0.05);
                    box-shadow: 0 0 30px rgba(212, 175, 55, 0.1), inset 0 2px 10px rgba(0,0,0,0.2);
                }
                .vault-code-input {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: var(--text-primary);
                    font-size: 2.5rem;
                    font-weight: 900;
                    text-align: center;
                    letter-spacing: 0.3em;
                    outline: none;
                    text-transform: uppercase;
                }
                .vault-code-input::placeholder {
                    color: rgba(255, 255, 255, 0.1);
                    letter-spacing: 0.1em;
                }
                .security-card-lux {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--glass-border);
                    border-radius: 32px;
                    padding: 32px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.1);
                }
                .protocol-list {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .protocol-item {
                    display: flex;
                    gap: 16px;
                }
                .protocol-icon {
                    width: 36px;
                    height: 36px;
                    background: rgba(212, 175, 55, 0.1);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--gold-text);
                    flex-shrink: 0;
                }
                .protocol-content h6 {
                    margin: 0 0 4px 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                }
                .protocol-content p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                    line-height: 1.4;
                }
                .vault-footer-note {
                    margin-top: 32px;
                    padding-top: 24px;
                    border-top: 1px solid var(--glass-border);
                    text-align: center;
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                }
            `}} />
        </div>
    );
};

export default JoinChama;

