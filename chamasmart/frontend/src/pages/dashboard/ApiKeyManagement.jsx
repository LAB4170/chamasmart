import { useState, useEffect } from "react";
import { apiKeyAPI } from "../../services/api";
import { toast } from "react-toastify";
import "./ApiKeyManagement.css"; // We'll create this CSS file

const ApiKeyManagement = () => {
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");
    const [generatedKey, setGeneratedKey] = useState(null);

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            const response = await apiKeyAPI.list();
            setKeys(response.data.data || response.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching keys:", err);
            toast.error("Failed to load API keys");
            setLoading(false);
        }
    };

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        try {
            setCreating(true);
            const response = await apiKeyAPI.create({
                name: newKeyName,
                scopes: ["read:chama", "read:loans"] // Default scopes
            });

            const newKeyData = response.data.data || response.data;
            setGeneratedKey(newKeyData.key); // Only shown once
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
        if (!window.confirm("Are you sure you want to revoke this key? It will stop working immediately.")) {
            return;
        }

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
        if (!window.confirm("Delete this key permanently?")) return;

        try {
            await apiKeyAPI.delete(keyId);
            toast.success("API Key deleted");
            fetchKeys();
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete key");
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.info("Copied to clipboard!");
    };

    if (loading) return <div className="loading-spinner">Loading API Keys...</div>;

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Developer Settings</h1>
                        <p className="subtitle">Manage API keys for external integrations</p>
                    </div>
                </div>

                <div className="api-content-grid">
                    {/* Create New Key Section */}
                    <div className="card">
                        <h3>Generate New API Key</h3>
                        <p className="text-muted mb-3">Create a new key to access ChamaSmart APIs programmatically.</p>

                        <form onSubmit={handleCreateKey} className="create-key-form">
                            <div className="form-group">
                                <label>Key Name / Description</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="e.g. Mobile App Integration"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={creating}
                            >
                                {creating ? "Generating..." : "Generate Key"}
                            </button>
                        </form>
                    </div>

                    {/* Keys List Section */}
                    <div className="card">
                        <h3>Your API Keys</h3>
                        {keys.length === 0 ? (
                            <div className="empty-state">
                                <p>You haven't generated any API keys yet.</p>
                            </div>
                        ) : (
                            <div className="keys-list">
                                {keys.map(key => (
                                    <div key={key.id} className={`key-item ${key.status === 'revoked' ? 'revoked' : ''}`}>
                                        <div className="key-header">
                                            <span className="key-name">{key.name}</span>
                                            <span className={`badge badge-${key.status === 'active' ? 'success' : 'danger'}`}>
                                                {key.status}
                                            </span>
                                        </div>
                                        <div className="key-details">
                                            <code className="key-prefix">Prefix: {key.prefix}••••</code>
                                            <span className="key-date">Created: {new Date(key.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="key-actions">
                                            {key.status === 'active' && (
                                                <button
                                                    className="btn btn-sm btn-warning"
                                                    onClick={() => handleRevokeKey(key.id)}
                                                >
                                                    Revoke
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDeleteKey(key.id)}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Generated Key Modal */}
                {generatedKey && (
                    <div className="modal-backdrop">
                        <div className="modal">
                            <div className="modal-header">
                                <h3 className="text-success">API Key Generated!</h3>
                                <button className="btn-close" onClick={() => setGeneratedKey(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <p className="alert alert-warning">
                                    ⚠️ Copy this key now. You won't be able to see it again!
                                </p>
                                <div className="key-display">
                                    <code>{generatedKey}</code>
                                    <button
                                        className="btn btn-sm btn-outline"
                                        onClick={() => copyToClipboard(generatedKey)}
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setGeneratedKey(null)}
                                >
                                    I have saved it
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApiKeyManagement;
