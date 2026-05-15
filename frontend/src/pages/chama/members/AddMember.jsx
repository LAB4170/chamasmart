import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    UserPlus, Search, Mail, Link as LinkIcon,
    Copy, User, AlertCircle, Loader,
    CheckCircle2, ArrowLeft, Send, Sparkles,
    ShieldCheck, RefreshCw, ChevronRight,
    Building2, Users, ShieldAlert, Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { userAPI, memberAPI, inviteAPI, chamaAPI } from "../../../services/api";

const AddMember = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    // UI State
    const [activeTab, setActiveTab] = useState("SEARCH");
    const [chamaName, setChamaName] = useState("");
    const [loading, setLoading] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState(null);
    const [searchError, setSearchError] = useState("");
    const [selectedRole, setSelectedRole] = useState("MEMBER");

    // Invite State
    const [inviteEmail, setInviteEmail] = useState("");

    // Code State
    const [activeCode, setActiveCode] = useState(null);
    const [codeLoading, setCodeLoading] = useState(false);

    useEffect(() => {
        const fetchChamaDetails = async () => {
            try {
                const response = await chamaAPI.getById(id);
                setChamaName(response.data.data.chama_name);
            } catch (err) {
                console.error("Failed to fetch chama details:", err);
            }
        };
        fetchChamaDetails();
    }, [id]);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchError("");
        setSearchResult(null);

        try {
            const response = await userAPI.search(searchQuery);
            if (response.data.success) {
                setSearchResult(response.data.data);
            }
        } catch (err) {
            setSearchError(err.response?.data?.message || "User not found in the ecosystem. Try an email or phone number.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddMember = async () => {
        if (!searchResult) return;
        setLoading(true);
        try {
            await memberAPI.add(id, {
                userId: searchResult.user_id,
                role: selectedRole
            });
            toast.success(`${searchResult.first_name} has been added!`, {
                icon: <CheckCircle2 className="text-success" />
            });
            setSearchResult(null);
            setSearchQuery("");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to add member to chama");
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await inviteAPI.send(id, inviteEmail, selectedRole);
            const { isAdded, deliveryMode, message } = response.data;

            if (isAdded) {
                toast.success(message || `${inviteEmail} has been added directly!`);
            } else {
                toast.success(message || `Invitation sent to ${inviteEmail}`);
            }
            setInviteEmail("");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to send invitation");
        } finally {
            setLoading(false);
        }
    };

    const handleFetchCode = async () => {
        setCodeLoading(true);
        try {
            const listRes = await inviteAPI.getAll(id);
            const active = listRes.data.data.find(inv => new Date(inv.expires_at) > new Date() && inv.is_active);

            if (active) {
                setActiveCode(active);
            } else {
                const genRes = await inviteAPI.generate(id, {
                    maxUses: 10,
                    expiresInDays: 7,
                    role: selectedRole
                });
                setActiveCode(genRes.data.data);
            }
        } catch (err) {
            toast.error("Failed to handle invite codes");
        } finally {
            setCodeLoading(false);
        }
    };

    const copyCode = () => {
        if (!activeCode) return;
        navigator.clipboard.writeText(activeCode.invite_code);
        toast.info("Access code copied to clipboard!");
    };

    const TABS = [
        { id: "SEARCH", label: "Protocol Search", icon: Search, desc: "Direct ecosystem search" },
        { id: "INVITE", label: "External Invite", icon: Mail, desc: "Invite via email" },
        { id: "CODE", label: "Access Code", icon: LinkIcon, desc: "Shared vault access" },
    ];

    return (
        <div className="page">
            <div className="ambient-blob blob-gold" />
            <div className="ambient-blob blob-blue" />

            <div className="container">
                <div className="page-frame-lux">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        {/* Header */}
                        <div className="user-hero-lux" style={{ marginBottom: "40px", padding: "40px" }}>
                            <div className="user-hero-content">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '8px', borderRadius: '12px' }}>
                                        <UserPlus size={24} color="#D4AF37" />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--gold-text)' }}>
                                        Growth Terminal
                                    </span>
                                </div>
                                <h1 className="user-hero-title">Expand Member Base</h1>
                                <p className="user-hero-subtitle">
                                    Strategic expansion for <strong style={{ color: 'var(--gold-text)' }}>{chamaName}</strong>. 
                                    Select your preferred onboarding protocol below.
                                </p>
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                <button
                                    className="btn-action-secondary"
                                    onClick={() => navigate(`/chamas/${id}`)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
                                >
                                    <ArrowLeft size={18} /> <span>Return to Vault</span>
                                </button>
                            </div>
                        </div>

                        {/* Segmented Tab Controls */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--glass-border)',
                            padding: '6px',
                            borderRadius: '18px',
                            display: 'flex',
                            gap: '8px',
                            marginBottom: '32px'
                        }}>
                            {TABS.map(tab => {
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '12px',
                                            padding: '14px',
                                            borderRadius: '14px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: isActive ? 'var(--gold-gradient)' : 'transparent',
                                            color: isActive ? 'white' : 'var(--text-secondary)',
                                            fontWeight: 800,
                                            fontSize: '0.9rem',
                                            boxShadow: isActive ? 'var(--gold-glow)' : 'none',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        <tab.icon size={18} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Protocol Content */}
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.01)',
                            borderRadius: '32px',
                            border: '1px solid var(--glass-border)',
                            padding: '40px',
                            minHeight: '460px',
                            position: 'relative'
                        }}>
                            <AnimatePresence mode="wait">
                                {activeTab === "SEARCH" && (
                                    <motion.div
                                        key="SEARCH"
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.98 }}
                                    >
                                        <div style={{ marginBottom: '32px' }}>
                                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 800 }}>Protocol Search</h3>
                                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Identify existing users within the global financial ecosystem.</p>
                                        </div>

                                        <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: '32px' }}>
                                            <Search size={22} style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gold-text)' }} />
                                            <input
                                                type="text"
                                                placeholder="Enter registered email or mobile terminal number..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    padding: '20px 20px 20px 60px',
                                                    fontSize: '1.1rem',
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '16px',
                                                    color: 'white',
                                                    outline: 'none',
                                                    boxSizing: 'border-box'
                                                }}
                                            />
                                            {isSearching && (
                                                <div className="spinner" style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', width: '24px', height: '24px' }} />
                                            )}
                                        </form>

                                        {searchError && (
                                            <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <AlertCircle size={20} /> {searchError}
                                            </div>
                                        )}

                                        {searchResult && (
                                            <div style={{
                                                background: 'rgba(255, 255, 255, 0.02)',
                                                borderRadius: '24px',
                                                padding: '32px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                border: '1px solid var(--glass-border)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                    <div style={{ 
                                                        width: '64px', height: '64px', borderRadius: '20px', 
                                                        background: 'var(--gold-gradient)', color: 'white', 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                        fontSize: '1.5rem', fontWeight: 800,
                                                        boxShadow: 'var(--gold-glow)'
                                                    }}>
                                                        {searchResult.first_name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>{searchResult.first_name} {searchResult.last_name}</h4>
                                                        <div style={{ display: 'flex', gap: '20px', marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} /> {searchResult.email}</span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={14} /> Trusted Member</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <select
                                                        value={selectedRole}
                                                        onChange={(e) => setSelectedRole(e.target.value)}
                                                        style={{
                                                            padding: '12px 20px',
                                                            borderRadius: '12px',
                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                            border: '1px solid var(--glass-border)',
                                                            color: 'white',
                                                            outline: 'none',
                                                            fontWeight: 600,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="MEMBER">Member</option>
                                                        <option value="TREASURER">Treasurer</option>
                                                        <option value="SECRETARY">Secretary</option>
                                                        <option value="CHAIRPERSON">Chairperson</option>
                                                    </select>
                                                    <button
                                                        onClick={handleAddMember}
                                                        disabled={loading}
                                                        className="btn-action-primary"
                                                        style={{ padding: '12px 32px', borderRadius: '12px' }}
                                                    >
                                                        {loading ? <div className="spinner" style={{ width: '18px', height: '18px' }} /> : <UserPlus size={18} />}
                                                        <span>Add</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {!searchResult && !isSearching && !searchError && (
                                            <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.5 }}>
                                                <Sparkles size={64} style={{ color: 'var(--gold-text)', marginBottom: '20px', opacity: 0.2 }} />
                                                <h4 style={{ margin: '0 0 8px 0', fontWeight: 800 }}>Direct Integration</h4>
                                                <p style={{ margin: 0, fontSize: '0.9rem' }}>Search for established members to bypass admission protocols.</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {activeTab === "INVITE" && (
                                    <motion.div
                                        key="INVITE"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                    >
                                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)', color: 'var(--gold-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                                <Mail size={32} />
                                            </div>
                                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 800 }}>External Invitation</h3>
                                            <p style={{ color: 'var(--text-secondary)' }}>Securely invite prospective members via their external email terminal.</p>
                                        </div>

                                        <form onSubmit={handleSendInvite} style={{ maxWidth: '440px', margin: '0 auto' }}>
                                            <div style={{ marginBottom: '24px' }}>
                                                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 800, fontSize: '0.85rem', color: 'var(--gold-text)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                  Email Terminal
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                  <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gold-text)' }} />
                                                  <input
                                                    type="email"
                                                    required
                                                    placeholder="recipient@example.com"
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                    style={{
                                                      width: '100%',
                                                      padding: '16px 16px 16px 48px',
                                                      fontSize: '1rem',
                                                      background: 'rgba(255, 255, 255, 0.02)',
                                                      border: '1px solid var(--glass-border)',
                                                      borderRadius: '14px',
                                                      color: 'white',
                                                      outline: 'none',
                                                      boxSizing: 'border-box'
                                                    }}
                                                  />
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '32px' }}>
                                                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 800, fontSize: '0.85rem', color: 'var(--gold-text)', textTransform: 'uppercase', letterSpacing: '1px' }}>Designated Role</label>
                                                <select
                                                    value={selectedRole}
                                                    onChange={(e) => setSelectedRole(e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '16px',
                                                        fontSize: '1rem',
                                                        background: 'rgba(255, 255, 255, 0.02)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '14px',
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        outline: 'none',
                                                        cursor: 'pointer',
                                                        boxSizing: 'border-box'
                                                    }}
                                                >
                                                    <option value="MEMBER">Member</option>
                                                    <option value="TREASURER">Treasurer</option>
                                                    <option value="SECRETARY">Secretary</option>
                                                    <option value="CHAIRPERSON">Chairperson</option>
                                                </select>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="btn-action-primary"
                                                style={{ width: '100%', padding: '16px', borderRadius: '14px' }}
                                            >
                                                {loading ? <div className="spinner" style={{ width: '20px', height: '20px' }} /> : <Send size={20} />}
                                                <span>Initialize Invitation</span>
                                            </button>
                                        </form>
                                    </motion.div>
                                )}

                                {activeTab === "CODE" && (
                                    <motion.div
                                        key="CODE"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        onViewportEnter={handleFetchCode}
                                    >
                                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--gold-gradient)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: 'var(--gold-glow)' }}>
                                                <ShieldCheck size={36} />
                                            </div>
                                            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 800 }}>Vault Access Code</h3>
                                            <p style={{ color: 'var(--text-secondary)' }}>Generate a secure high-authority code for rapid group joining.</p>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                                            <div style={{ width: '100%', maxWidth: '320px' }}>
                                                <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.85rem', fontWeight: 800, color: 'var(--gold-text)', textTransform: 'uppercase', letterSpacing: '1px' }}>Authorized Role</label>
                                                <select
                                                    value={selectedRole}
                                                    onChange={(e) => setSelectedRole(e.target.value)}
                                                    style={{
                                                        width: '100%', padding: '14px', borderRadius: '12px',
                                                        border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)',
                                                        color: 'white', fontWeight: 600, outline: 'none', cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="MEMBER">Member</option>
                                                    <option value="TREASURER">Treasurer</option>
                                                    <option value="SECRETARY">Secretary</option>
                                                    <option value="CHAIRPERSON">Chairperson</option>
                                                </select>
                                            </div>
                                        </div>

                                        {codeLoading ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                                <div className="spinner" style={{ width: '48px', height: '48px' }} />
                                            </div>
                                        ) : activeCode ? (
                                            <div style={{ maxWidth: '440px', margin: '0 auto', textAlign: 'center' }}>
                                                <motion.div
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={copyCode}
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.02)',
                                                        border: '2px dashed var(--gold-soft)',
                                                        borderRadius: '24px',
                                                        padding: '32px',
                                                        marginBottom: '24px',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.3s'
                                                    }}
                                                >
                                                    <div style={{ fontSize: '3rem', fontWeight: 900, letterSpacing: '8px', color: 'var(--gold-text)', fontFamily: 'monospace' }}>
                                                        {activeCode.invite_code}
                                                    </div>
                                                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                        <Copy size={14} /> Click to secure copy
                                                    </div>
                                                </motion.div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Security Expiry</p>
                                                        <p style={{ margin: 0, fontWeight: 800, color: 'white' }}>{new Date(activeCode.expires_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Usage Quota</p>
                                                        <p style={{ margin: 0, fontWeight: 800, color: 'white' }}>{activeCode.uses_count} / {activeCode.max_uses}</p>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={handleFetchCode}
                                                    disabled={codeLoading}
                                                    style={{
                                                        background: 'transparent',
                                                        border: '1px solid var(--glass-border)',
                                                        padding: '10px 20px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.85rem',
                                                        color: 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        margin: '0 auto',
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    <RefreshCw size={14} /> Reset Protocol Code
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ textAlign: 'center', padding: '40px' }}>
                                                <p style={{ color: '#ef4444' }}>Terminal handoff failed</p>
                                                <button onClick={handleFetchCode} className="btn-action-secondary" style={{ marginTop: '16px' }}>Retry Protocol</button>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Security Notice */}
                        <div style={{ 
                            marginTop: '40px', padding: '24px', 
                            background: 'rgba(59, 130, 246, 0.03)', 
                            borderRadius: '24px', border: '1px dashed var(--glass-border)',
                            display: 'flex', alignItems: 'center', gap: '16px'
                        }}>
                            <ShieldAlert size={20} color="#3b82f6" />
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Member addition is a high-security event. All additions are logged and subject to audit by the board of trustees. 
                                Ensure you are onboarding verified participants to maintain vault integrity.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default AddMember;
