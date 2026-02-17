import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    UserPlus, Search, Mail, Link as LinkIcon,
    Copy, User, AlertCircle, Loader,
    CheckCircle2, ArrowLeft, Send, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { userAPI, memberAPI, inviteAPI, chamaAPI } from "../../../services/api";
import "./MemberManagement.css";

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
            await inviteAPI.send(id, inviteEmail);
            toast.success(`Invitation sent to ${inviteEmail}`);
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
                    role: 'member'
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
        <div className="add-member-container">
            {/* Header Area */}
            <div className="add-member-header">
                <div className="add-member-title">
                    <h1 className="d-flex align-center gap-2">
                        <span style={{ color: "var(--primary)" }}><UserPlus size={32} /></span>
                        Add New Member
                    </h1>
                    <p className="add-member-subtitle">
                        Growth strategy for <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{chamaName || "your group"}</span>
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/chamas/${id}`)}
                    className="btn btn-outline btn-sm d-flex align-center gap-2"
                >
                    <ArrowLeft size={16} />
                    Back to Chama
                </button>
            </div>

            {/* Custom Premium Tabs */}
            <div className="add-member-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`am-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    >
                        <tab.icon size={20} />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="add-member-content-wrapper">
                <AnimatePresence mode="wait">
                    {activeTab === "SEARCH" && (
                        <motion.div
                            key="SEARCH"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="search-section"
                        >
                            <div className="search-box-wrapper">
                                <form onSubmit={handleSearch} className="search-input-container">
                                    <Search size={18} className="search-icon-inside" />
                                    <input
                                        type="text"
                                        placeholder="Enter registered email or phone number..."
                                        className="am-search-input"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </form>
                                <button
                                    onClick={handleSearch}
                                    className="btn btn-primary"
                                    disabled={isSearching || !searchQuery.trim()}
                                    style={{ padding: "0 2rem" }}
                                >
                                    {isSearching ? <Loader size={20} className="spinner-sm" /> : "Find User"}
                                </button>
                            </div>

                            {searchError && (
                                <div className="alert alert-error d-flex align-center gap-3">
                                    <AlertCircle size={20} />
                                    <span>{searchError}</span>
                                </div>
                            )}

                            {searchResult && (
                                <div className="user-result-card shadow-lg">
                                    <div className="user-avatar-large">
                                        {searchResult.first_name[0]}{searchResult.last_name[0]}
                                    </div>
                                    <div className="user-details">
                                        <h3>{searchResult.first_name} {searchResult.last_name}</h3>
                                        <div className="user-info-row">
                                            <div className="user-info-item">
                                                <Mail size={14} /> {searchResult.email}
                                            </div>
                                            <div className="user-info-item">
                                                <User size={14} /> {searchResult.phone_number}
                                            </div>
                                        </div>

                                        <div className="add-action-area">
                                            <div className="role-select-box">
                                                <label>Member Role</label>
                                                <select
                                                    value={selectedRole}
                                                    onChange={(e) => setSelectedRole(e.target.value)}
                                                    className="form-select"
                                                >
                                                    <option value="MEMBER">Regular Member</option>
                                                    <option value="TREASURER">Treasurer</option>
                                                    <option value="SECRETARY">Secretary</option>
                                                    <option value="CHAIRPERSON">Chairperson</option>
                                                </select>
                                            </div>
                                            <button
                                                onClick={handleAddMember}
                                                disabled={loading}
                                                className="btn btn-primary"
                                                style={{ minWidth: "180px", height: "48px" }}
                                            >
                                                {loading ? <Loader size={20} className="spinner-sm" /> : (
                                                    <div className="d-flex align-center gap-2">
                                                        <UserPlus size={18} />
                                                        Add to Chama
                                                    </div>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!searchResult && !isSearching && !searchError && (
                                <div className="text-center" style={{ marginTop: "3rem", opacity: 0.6 }}>
                                    <Sparkles size={48} style={{ color: "var(--primary)", marginBottom: "1rem" }} />
                                    <h4>Instant Member Addition</h4>
                                    <p>Search for an existing user to add them to <strong>{chamaName}</strong> immediately.</p>
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
                            <div className="invite-form-card">
                                <div className="invite-icon-circle">
                                    <Mail size={32} />
                                </div>
                                <h3>Invite via Email</h3>
                                <p className="mb-3">New to ChamaSmart? Send them an invitation to join your group.</p>

                                <form onSubmit={handleSendInvite} className="mt-3">
                                    <div className="form-group text-left">
                                        <label className="form-label">Email Address</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            placeholder="colleague@example.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-block d-flex align-center gap-2"
                                        disabled={loading}
                                        style={{ height: "52px" }}
                                    >
                                        {loading ? <Loader size={20} className="spinner-sm" /> : <Send size={18} />}
                                        Send Official Invitation
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "CODE" && (
                        <motion.div
                            key="CODE"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="share-code-view"
                        >
                            {!activeCode ? (
                                <div className="card text-center" style={{ padding: "4rem 2rem" }}>
                                    <LinkIcon size={56} style={{ color: "var(--primary)", marginBottom: "1.5rem", opacity: 0.5 }} />
                                    <h3>Group Invite Codes</h3>
                                    <p className="mb-3 text-muted" style={{ maxWidth: "450px", margin: "0 auto 2rem" }}>
                                        Generate a unique 6-digit code. Anyone with this code can automatically join <strong>{chamaName}</strong>.
                                    </p>
                                    <button
                                        onClick={handleFetchCode}
                                        className="btn btn-primary"
                                        disabled={codeLoading}
                                        style={{ padding: "1rem 3rem" }}
                                    >
                                        {codeLoading ? "Accessing Secure Code..." : "Generate Invite Code"}
                                    </button>
                                </div>
                            ) : (
                                <div className="max-w-xl mx-auto">
                                    <div className="code-display-box" onClick={copyCode}>
                                        <p className="text-muted mb-2">Chama Invite Code</p>
                                        <span className="invite-code-text">{activeCode.invite_code}</span>
                                        <span className="copy-hint d-flex align-center gap-2 justify-center">
                                            <Copy size={16} /> Click anywhere to copy
                                        </span>
                                    </div>

                                    <div className="grid grid-2 mt-3" style={{ textAlign: "left" }}>
                                        <div className="card" style={{ marginBottom: 0, padding: "1rem" }}>
                                            <p className="text-muted small mb-1">Expires On</p>
                                            <p className="font-bold">{new Date(activeCode.expires_at).toLocaleDateString()}</p>
                                        </div>
                                        <div className="card" style={{ marginBottom: 0, padding: "1rem" }}>
                                            <p className="text-muted small mb-1">Usage Count</p>
                                            <p className="font-bold">{activeCode.uses_count} / {activeCode.max_uses} slots</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleFetchCode}
                                        className="mt-3 btn btn-outline btn-sm"
                                        disabled={codeLoading}
                                    >
                                        Renew/Refresh Code
                                    </button>
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
