import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    UserPlus, Search, Mail, Link as LinkIcon,
    Copy, User, AlertCircle, Loader,
    CheckCircle2, ArrowLeft, Send, Sparkles,
    ShieldCheck, RefreshCw
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
            console.log(`[Senior Audit] Searching for user: ${searchQuery}`);
            const response = await userAPI.search(searchQuery);
            if (response.data.success) {
                setSearchResult(response.data.data);
            }
        } catch (err) {
            console.warn(`[Senior Audit] Search failed:`, err);
            setSearchError(err.response?.data?.message || "User not found. Try another email or phone number.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddMember = async () => {
        if (!searchResult) return;
        setLoading(true);
        try {
            console.log(`[Senior Audit] Adding member ${searchResult.user_id} with role ${selectedRole}`);
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
            console.error(`[Senior Audit] Add member failed:`, err);
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
                toast.success(message || `${inviteEmail} has been added to the chama directly!`, {
                    icon: <CheckCircle2 className="text-success" />
                });
            } else if (deliveryMode === 'CONSOLE') {
                toast.warning(`Email simulated for ${inviteEmail} (Console Mode). Check backend terminal.`, {
                    icon: <AlertCircle className="text-warning" />,
                    autoClose: 10000
                });
            } else {
                toast.success(message || `Invitation email sent to ${inviteEmail}`);
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
            // Check if there's an active code first
            const listRes = await inviteAPI.getAll(id);
            const active = listRes.data.data.find(inv => new Date(inv.expires_at) > new Date() && inv.is_active);

            if (active) {
                setActiveCode(active);
            } else {
                // Generate new one
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7);

                const genRes = await inviteAPI.generate(id, {
                    maxUses: 10,
                    expiresInDays: 7,
                    role: selectedRole.toLowerCase()
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
        toast.info("Invite code copied to clipboard!");
    };

    const TABS = [
        { id: "SEARCH", label: "Search & Add", icon: Search, desc: "Add existing members directly" },
        { id: "INVITE", label: "Email Invite", icon: Mail, desc: "Invite new users via email" },
        { id: "CODE", label: "Share Code", icon: LinkIcon, desc: "Generate a group join code" },
    ];

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem', color: 'var(--text-primary)' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        <div style={{ padding: '0.5rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '10px', color: 'var(--primary)' }}>
                            <UserPlus size={24} />
                        </div>
                        Add New Member
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
                        Growth strategy for <strong style={{ color: 'var(--text-primary)' }}>{chamaName || "your group"}</strong>
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/chamas/${id}`)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1rem', background: 'transparent',
                        border: '1px solid var(--border)', borderRadius: '8px',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s'
                    }}
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            {/* Premium Tabs - Segmented Control */}
            <div style={{
                background: 'var(--bg-secondary)',
                padding: '4px',
                borderRadius: '12px',
                display: 'flex',
                gap: '4px',
                marginBottom: '2rem'
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
                                gap: '0.5rem',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                background: isActive ? 'var(--card-bg)' : 'transparent',
                                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                                fontWeight: isActive ? 600 : 500,
                                boxShadow: isActive ? 'var(--shadow)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div style={{
                background: 'var(--card-bg)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow)',
                padding: '2rem',
                minHeight: '400px',
                position: 'relative' // For loader positioning if needed
            }}>
                <AnimatePresence mode="wait">
                    {activeTab === "SEARCH" && (
                        <motion.div
                            key="SEARCH"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Search Existing Users</h3>
                            <form onSubmit={handleSearch} style={{ position: 'relative', marginBottom: '2rem' }}>
                                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    placeholder="Enter registered email or phone number..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '1rem 1rem 1rem 3rem',
                                        fontSize: '1rem',
                                        background: 'var(--input-bg)',
                                        border: '1px solid var(--input-border)',
                                        borderRadius: '12px',
                                        color: 'var(--input-text)',
                                        outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                />
                                {isSearching && <Loader size={20} className="animate-spin" style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }} />}
                            </form>

                            {searchError && (
                                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: 'var(--danger)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <AlertCircle size={20} /> {searchError}
                                </div>
                            )}

                            {searchResult && (
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                    padding: '1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '1rem',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 600 }}>
                                            {searchResult.first_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>{searchResult.first_name} {searchResult.last_name}</h4>
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={12} /> {searchResult.email}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><User size={12} /> {searchResult.phone_number}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <select
                                            value={selectedRole}
                                            onChange={(e) => setSelectedRole(e.target.value)}
                                            style={{
                                                padding: '0.6rem 1rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border)',
                                                background: 'var(--input-bg)',
                                                color: 'var(--input-text)',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem'
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
                                            style={{
                                                background: 'var(--primary)',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.6rem 1.5rem',
                                                borderRadius: '8px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.95rem'
                                            }}
                                        >
                                            {loading ? <Loader size={18} className="animate-spin" /> : <UserPlus size={18} />}
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!searchResult && !isSearching && !searchError && (
                                <div style={{ textAlign: 'center', padding: '3rem 0', opacity: 0.6 }}>
                                    <Sparkles size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.3 }} />
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Instant Member Addition</h4>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Search for an existing user to add them immediately.</p>
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
                            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                    <Mail size={30} />
                                </div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Send Email Invitation</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>Send a direct invitation link to their email address.</p>
                            </div>

                            <form onSubmit={handleSendInvite} style={{ maxWidth: '400px', margin: '0 auto' }}>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="friend@example.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                    />
                                </div>
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>Assigned Role</label>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => setSelectedRole(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.8rem',
                                            fontSize: '1rem',
                                            background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)',
                                            borderRadius: '8px',
                                            color: 'var(--input-text)',
                                            outline: 'none',
                                            cursor: 'pointer'
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
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        fontSize: '1rem'
                                    }}
                                >
                                    {loading ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                                    Send Invitation
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
                            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary), #9333ea)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                    <Sparkles size={30} />
                                </div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Share Join Code</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>Anyone with this code can join automatically.</p>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                <div style={{ width: '100%', maxWidth: '300px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Role for this code</label>
                                    <select
                                        value={selectedRole}
                                        onChange={(e) => {
                                            setSelectedRole(e.target.value);
                                            // Trigger refresh to update the underlying code if it exists or for next generation
                                        }}
                                        style={{
                                            width: '100%', padding: '0.6rem 1rem', borderRadius: '8px',
                                            border: '1px solid var(--border)', background: 'var(--input-bg)',
                                            color: 'var(--input-text)', outline: 'none', cursor: 'pointer'
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
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                                    <Loader size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
                                </div>
                            ) : activeCode ? (
                                <div style={{ maxWidth: '400px', margin: '1rem auto', textAlign: 'center' }}>
                                    <div
                                        onClick={copyCode}
                                        style={{
                                            background: 'var(--bg-secondary)',
                                            border: '2px dashed var(--primary)',
                                            borderRadius: '12px',
                                            padding: '2rem',
                                            marginBottom: '1.5rem',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            transition: 'transform 0.2s',
                                        }}
                                        title="Click to copy"
                                    >
                                        <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '4px', color: 'var(--primary)', fontFamily: 'monospace' }}>
                                            {activeCode.invite_code}
                                        </div>
                                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <Copy size={12} /> Click to copy
                                        </p>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'left' }}>
                                            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Expires On</p>
                                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(activeCode.expires_at).toLocaleDateString()}</p>
                                        </div>
                                        <div style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'left' }}>
                                            <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Usage</p>
                                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>{activeCode.uses_count} / {activeCode.max_uses}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleFetchCode}
                                        disabled={codeLoading}
                                        style={{
                                            background: 'transparent',
                                            border: '1px solid var(--border)',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '6px',
                                            fontSize: '0.85rem',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            margin: '0 auto'
                                        }}
                                    >
                                        <RefreshCw size={14} /> Refresh Code
                                    </button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <p style={{ color: 'var(--danger)' }}>Failed to load code</p>
                                    <button onClick={handleFetchCode} style={{ padding: '0.5rem 1rem', marginTop: '0.5rem', background: 'var(--bg-secondary)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retry</button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AddMember;
