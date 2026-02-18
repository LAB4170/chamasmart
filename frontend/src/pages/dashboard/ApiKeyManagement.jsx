import { useState, useEffect } from "react";
import { apiKeyAPI } from "../../services/api";
import { toast } from "react-toastify";
import {
    Key, Shield, Trash2, Copy, Plus,
    AlertTriangle, Check, Terminal, ShieldAlert,
    Loader, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

const ApiKeyManagement = () => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [generatedKey, setGeneratedKey] = useState(null);

    const fetchKeys = async () => {
        try {
            const response = await apiKeyAPI.list();
            setKeys(response.data.data || response.data);
        } catch (err) {
            console.error("Error fetching keys:", err);
            toast.error("Failed to load API keys");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        try {
            setCreating(true);
            const response = await apiKeyAPI.create({
                name: newKeyName,
                scopes: ["read:chama", "read:loans"]
            });

            const newKeyData = response.data.data || response.data;
            setGeneratedKey(newKeyData.key);
            fetchKeys();
            setNewKeyName("");
            toast.success("API Key created successfully");
        } catch (err) {
            console.error("Error creating key:", err);
            toast.error(err.response?.data?.message || "Failed to create API key");
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeKey = async (keyId) => {
        if (!window.confirm("Are you sure you want to revoke this key? It will stop working immediately.")) return;

        try {
            await apiKeyAPI.revoke(keyId);
            toast.success("API Key revoked");
            fetchKeys();
        } catch (err) {
            console.error(err);
            toast.error("Failed to revoke key");
        }
    };

    const handleDeleteKey = async (keyId) => {
        if (!window.confirm("Delete this key permanently? History will be lost.")) return;

        try {
            await apiKeyAPI.delete(keyId);
            toast.success("API Key deleted");
            // Optimistic update
            setKeys(prev => prev.filter(k => k.id !== keyId));
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete key");
            fetchKeys();
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard!");
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-primary)' }}>
                <Loader size={40} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading developer settings...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)' }}>

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--primary)' }}>
                        <Terminal size={28} />
                    </div>
                    Developer Access
                </h1>
                <p style={{ margin: '0.5rem 0 0 3.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>
                    Manage API keys for external integrations and mobile apps.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>

                {/* Left Column: Generate & Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* Generate Card */}
                    <div style={{
                        background: 'linear-gradient(135deg, var(--primary), #1e40af)', // Fallback to blue-800
                        borderRadius: '16px',
                        padding: '2rem',
                        color: 'white',
                        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.2)', borderRadius: '8px' }}>
                                <Plus size={24} color="white" />
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Generate New Key</h2>
                        </div>

                        <p style={{ color: 'rgba(255,255,255,0.9)', marginBottom: '1.5rem', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            Create a new secret key to access ChamaSmart APIs.
                            Treat this key like a password.
                        </p>

                        <form onSubmit={handleCreateKey}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'rgba(255,255,255,0.9)' }}>KEY NAME / DESCRIPTION</label>
                                <input
                                    type="text"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="e.g. Mobile App Integration"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'rgba(255,255,255,0.15)',
                                        color: 'white',
                                        fontSize: '1rem',
                                        outline: 'none',
                                        backdropFilter: 'blur(5px)'
                                    }}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={creating}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'white',
                                    color: 'var(--primary)',
                                    fontWeight: 700,
                                    fontSize: '1rem',
                                    cursor: creating ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'transform 0.1s'
                                }}
                            >
                                {creating ? <Loader size={18} className="animate-spin" /> : <Key size={18} />}
                                {creating ? "Generating..." : "Generate Secret Key"}
                            </button>
                        </form>
                    </div>

                    {/* Security Hint */}
                    <div style={{ padding: '1.5rem', borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border)', display: 'flex', gap: '1rem' }}>
                        <ShieldAlert size={24} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                        <div>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Security Best Practices</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                Never share your keys in public repositories or client-side code. Revoke keys immediately if compromised.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Key List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', placeItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>Active Keys</h3>
                        <button onClick={fetchKeys} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                            <RefreshCw size={18} />
                        </button>
                    </div>

                    <AnimatePresence mode="popLayout">
                        {/* New Key Modal / Display */}
                        {generatedKey && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '2px dashed var(--success)',
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    marginBottom: '1rem',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Check size={18} /> New Key Generated
                                    </h4>
                                    <button onClick={() => setGeneratedKey(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>Close</button>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    Copy this key now. It will not be shown again.
                                </p>
                                <div style={{
                                    background: 'var(--card-bg)',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '1rem'
                                }}>
                                    <code style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600, wordBreak: 'break-all' }}>{generatedKey}</code>
                                    <button
                                        onClick={() => copyToClipboard(generatedKey)}
                                        style={{ padding: '0.5rem', borderRadius: '6px', border: 'none', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-primary)' }}
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                                <button
                                    onClick={() => setGeneratedKey(null)}
                                    style={{ width: '100%', padding: '0.75rem', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    I have saved this key
                                </button>
                            </motion.div>
                        )}

                        {keys.length === 0 && !loading && (
                            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                <Key size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <p>No API keys found.</p>
                            </div>
                        )}

                        {keys.map(key => (
                            <motion.div
                                key={key.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                style={{
                                    background: 'var(--card-bg)',
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    border: '1px solid var(--border-color)',
                                    boxShadow: 'var(--shadow)',
                                    opacity: key.status === 'revoked' ? 0.7 : 1,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{key.name}</h4>
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            Prefix: <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{key.prefix}••••</code>
                                        </span>
                                    </div>
                                    <span style={{
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '20px',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        background: key.status === 'active' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        color: key.status === 'active' ? 'var(--success)' : 'var(--danger)',
                                        textTransform: 'uppercase'
                                    }}>
                                        {key.status}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                        Created: {new Date(key.created_at).toLocaleDateString()}
                                    </span>

                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {key.status === 'active' && (
                                            <button
                                                onClick={() => handleRevokeKey(key.id)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '8px',
                                                    border: '1px solid var(--border)',
                                                    background: 'transparent',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.85rem',
                                                    transition: 'all 0.2s'
                                                }}
                                                className="hover:bg-gray-100 dark:hover:bg-gray-800"
                                            >
                                                Revoke
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteKey(key.id)}
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: '8px',
                                                border: 'none',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                color: 'var(--danger)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Delete Key"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyManagement;
