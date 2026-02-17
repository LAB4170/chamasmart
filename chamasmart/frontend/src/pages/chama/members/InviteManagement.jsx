import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Copy, X, Trash2, Calendar,
    ArrowLeft, User, Link as LinkIcon,
    AlertCircle, CheckCircle2, Loader,
    RefreshCw, Share2
} from "lucide-react";
import { chamaAPI, inviteAPI } from "../../../services/api";
import "./MemberManagement.css";

const InviteManagement = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [chamaRes, invitesRes] = await Promise.all([
                chamaAPI.getById(id),
                inviteAPI.getAll(id)
            ]);
            setChama(chamaRes.data.data);
            setInvites(invitesRes.data.data);
        } catch (err) {
            setError('Failed to load invite data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleGenerateInvite = async () => {
        setError('');
        setSuccess('');
        setGenerating(true);

        try {
            await inviteAPI.generate(id, {
                maxUses: 1, // Default to single use for management screen
                expiresInDays: 7
            });
            setSuccess('New invite code generated successfully!');
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to generate invite');
        } finally {
            setGenerating(false);
        }
    };

    const handleDeactivate = async (inviteId) => {
        if (!window.confirm('Are you sure you want to deactivate this invite?')) return;

        try {
            await inviteAPI.deactivate(inviteId);
            setSuccess('Invite revoked successfully');
            fetchData();
        } catch (err) {
            setError('Failed to revoke invite');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess(`Code ${text} copied!`);
        setTimeout(() => setSuccess(''), 3000);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-KE', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    }

    if (loading && invites.length === 0) {
        return (
            <div className="add-member-container d-flex flex-column align-center justify-center" style={{ minHeight: '60vh' }}>
                <Loader size={48} className="spinner-sm" style={{ borderTopColor: 'var(--primary)' }} />
                <p className="mt-3 text-muted">Securing invite data...</p>
            </div>
        );
    }

    return (
        <div className="add-member-container">
            {/* Header */}
            <div className="add-member-header">
                <div>
                    <h1 className="d-flex align-center gap-2">
                        <Share2 size={32} style={{ color: 'var(--primary)' }} />
                        Invite Management
                    </h1>
                    <p className="add-member-subtitle">Access control for <strong>{chama?.chama_name}</strong></p>
                </div>
                <button
                    className="btn btn-outline btn-sm d-flex align-center gap-1"
                    onClick={() => navigate(`/chamas/${id}`)}
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            {error && (
                <div className="alert alert-error d-flex align-center gap-2 mb-3">
                    <AlertCircle size={18} /> {error}
                </div>
            )}
            {success && (
                <div className="alert alert-success d-flex align-center gap-2 mb-3">
                    <CheckCircle2 size={18} /> {success}
                </div>
            )}

            {/* Quick Actions */}
            <div className="card shadow-sm mb-4 d-flex justify-between align-center" style={{ padding: '1.25rem 2rem' }}>
                <div>
                    <h4 className="mb-1">Generate Quick Invite</h4>
                    <p className="small text-muted mb-0">Single-use code valid for 7 days</p>
                </div>
                <button
                    className="btn btn-primary d-flex align-center gap-2"
                    onClick={handleGenerateInvite}
                    disabled={generating}
                >
                    {generating ? <Loader size={18} className="spinner-sm" /> : <Plus size={18} />}
                    Create Code
                </button>
            </div>

            {/* Management Table */}
            <div className="management-card shadow-sm">
                <div className="m-card-title d-flex justify-between align-center">
                    <h3>Active Invite Codes</h3>
                    <button onClick={fetchData} className="btn btn-sm btn-outline"><RefreshCw size={14} /></button>
                </div>

                <div className="table-responsive">
                    <table className="m-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Created By</th>
                                <th>Usage</th>
                                <th>Expires</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invites.filter(i => i.is_active).length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-5 text-muted">
                                        No active invite codes found
                                    </td>
                                </tr>
                            ) : invites.filter(i => i.is_active).map(invite => (
                                <tr key={invite.invite_id}>
                                    <td>
                                        <div
                                            className="d-flex align-center gap-2"
                                            style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 700 }}
                                            onClick={() => copyToClipboard(invite.invite_code)}
                                        >
                                            {invite.invite_code} <Copy size={14} opacity={0.5} />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="d-flex align-center gap-2">
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                                                {invite.created_by_name?.charAt(0) || 'U'}
                                            </div>
                                            {invite.created_by_name}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="small font-bold">{invite.uses_count} / {invite.max_uses}</span>
                                    </td>
                                    <td className="text-muted small">
                                        {formatDate(invite.expires_at)}
                                    </td>
                                    <td>
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-sm btn-outline text-danger"
                                                onClick={() => handleDeactivate(invite.invite_id)}
                                                title="Revoke Invite"
                                            >
                                                <Trash2 size={14} /> Revoke
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* History Table */}
            {invites.some(i => !i.is_active) && (
                <div className="management-card shadow-sm" style={{ opacity: 0.7 }}>
                    <div className="m-card-title">
                        <h4 className="text-muted mb-0">Inactive / Revoked History</h4>
                    </div>
                    <div className="table-responsive">
                        <table className="m-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Status</th>
                                    <th>Uses</th>
                                    <th>Expired On</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invites.filter(i => !i.is_active).map(invite => (
                                    <tr key={invite.invite_id}>
                                        <td className="text-muted">{invite.invite_code}</td>
                                        <td><span className="m-badge badge-gray">Inactive</span></td>
                                        <td className="small">{invite.uses_count} / {invite.max_uses}</td>
                                        <td className="text-muted small">{formatDate(invite.expires_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InviteManagement;
