
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { chamaAPI, inviteAPI } from "../../../services/api";


const InviteManagement = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newInvite, setNewInvite] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                if (isMounted) setLoading(true);
                const [chamaRes, invitesRes] = await Promise.all([
                    chamaAPI.getById(id),
                    inviteAPI.getAll(id)
                ]);
                if (isMounted) {
                    setChama(chamaRes.data.data);
                    setInvites(invitesRes.data.data);
                }
            } catch (err) {
                if (isMounted) {
                    setError('Failed to load invite data');
                    console.error(err);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [id]);

    const handleGenerateInvite = async () => {
        setError('');
        setSuccess('');
        setGenerating(true);

        try {
            const response = await inviteAPI.generate(id, {
                maxUses: 1,
                expiresInDays: 7
            });

            const invite = response.data.data;
            setNewInvite(invite);
            setSuccess('Invite code generated successfully!');

            // Refresh invites list
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate invite');
        } finally {
            setGenerating(false);
        }
    };

    const handleDeactivate = async (inviteId) => {
        if (!window.confirm('Are you sure you want to deactivate this invite?')) {
            return;
        }

        try {
            await inviteAPI.deactivate(inviteId);
            setSuccess('Invite deactivated');
            fetchData();
        } catch (err) {
            setError('Failed to deactivate invite');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess('Invite code copied to clipboard!');
        setTimeout(() => setSuccess(''), 3000);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-KE', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Invite Management</h1>
                        <p className="text-muted">{chama?.chama_name}</p>
                    </div>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/ chamas / ${id} `)}
                    >
                        ← Back to Chama
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {/* Generate New Invite */}
                <div className="card">
                    <h3>Generate New Invite Code</h3>
                    <p className="text-muted mb-3">
                        Create a unique code that new members can use to join this chama
                    </p>

                    <button
                        className="btn btn-primary"
                        onClick={handleGenerateInvite}
                        disabled={generating}
                    >
                        {generating ? 'Generating...' : '+ Generate Invite Code'}
                    </button>

                    {newInvite && (
                        <div className="invite-display">
                            <div className="invite-code-box">
                                <label className="form-label">New Invite Code</label>
                                <div className="code-display">
                                    <span className="invite-code">{newInvite.invite_code}</span>
                                    <button
                                        className="btn btn-sm btn-outline"
                                        onClick={() => copyToClipboard(newInvite.invite_code)}
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                                <small className="text-muted">
                                    Share this code with the person you want to invite.
                                    Expires: {formatDate(newInvite.expires_at)}
                                </small>
                            </div>

                            <div className="alert alert-info mt-2">
                                <strong>How to share:</strong> Send this code via WhatsApp, SMS, or tell them in person.
                                They should enter it in the "Join Chama" section of the app.
                            </div>
                        </div>
                    )}
                </div>

                {/* Active Invites */}
                <div className="card">
                    <h3>Active Invite Codes</h3>
                    {invites.filter(inv => inv.is_active).length === 0 ? (
                        <p className="text-muted">No active invite codes</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Created By</th>
                                        <th>Uses</th>
                                        <th>Expires</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invites.filter(inv => inv.is_active).map((invite) => (
                                        <tr key={invite.invite_id}>
                                            <td>
                                                <strong className="invite-code-small">{invite.invite_code}</strong>
                                            </td>
                                            <td>{invite.created_by_name}</td>
                                            <td>
                                                {invite.uses_count} / {invite.max_uses}
                                            </td>
                                            <td className="text-muted">
                                                {formatDate(invite.expires_at)}
                                            </td>
                                            <td>
                                                <span className="badge badge-success">Active</span>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-outline"
                                                    onClick={() => copyToClipboard(invite.invite_code)}
                                                >
                                                    Copy
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-danger ml-1"
                                                    onClick={() => handleDeactivate(invite.invite_id)}
                                                >
                                                    Deactivate
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Inactive Invites */}
                {invites.filter(inv => !inv.is_active).length > 0 && (
                    <div className="card">
                        <h3>Inactive Invite Codes</h3>
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Created By</th>
                                        <th>Uses</th>
                                        <th>Expired</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invites.filter(inv => !inv.is_active).map((invite) => (
                                        <tr key={invite.invite_id} style={{ opacity: 0.6 }}>
                                            <td>{invite.invite_code}</td>
                                            <td>{invite.created_by_name}</td>
                                            <td>{invite.uses_count} / {invite.max_uses}</td>
                                            <td className="text-muted">
                                                {formatDate(invite.expires_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InviteManagement;
