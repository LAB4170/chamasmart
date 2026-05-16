import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Plus, Copy, X, Trash2, Calendar,
    ArrowLeft, User, Link as LinkIcon,
    AlertCircle, CheckCircle2, Loader,
    RefreshCw, Share2, Shield
} from "lucide-react";
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
    const [bulkEmails, setBulkEmails] = useState('');

    const emailsCount = bulkEmails.split(',').map(e => e.trim()).filter(e => e).length;

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
            const response = await inviteAPI.generate(id, {
                maxUses: 1, // Default to single use for management screen
                expiresInDays: 7
            });
            setSuccess(response.data.message || 'New invite code generated successfully!');
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-primary)' }}>
                <Loader size={48} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <p style={{ marginTop: '1rem', color: 'var(--gray)' }}>Securing invite data...</p>
            </div>
        );
    }

    const activeInvites = invites.filter(i => i.is_active);
    const inactiveInvites = invites.filter(i => !i.is_active);

    return (
        <div className="page-lux-wrapper" style={{ background: 'var(--lux-bg-soft)', minHeight: '100vh', padding: '2rem 0' }}>
            <div className="container">
                <div className="page-frame-lux" style={{ background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)' }}>
                    {/* Header */}
                    <div className="flex flex-between align-center mb-8">
                        <div className="flex flex-col">
                            <h1 className="flex items-center gap-3 m-0" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--lux-text-primary)' }}>
                                <div className="p-3 rounded-xl" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <Share2 size={24} />
                                </div>
                                Invite Management
                            </h1>
                            <p className="m-0 mt-2" style={{ color: 'var(--lux-text-secondary)', fontSize: '0.95rem' }}>
                                Access control for <strong style={{ color: 'var(--lux-text-primary)' }}>{chama?.chama_name}</strong>
                            </p>
                        </div>
                        <button
                            onClick={() => navigate(`/chamas/${id}`, { state: { tab: 'management' } })}
                            className="btn-lux btn-lux-outline flex items-center gap-2"
                        >
                            <ArrowLeft size={16} /> Back to Management
                        </button>
                    </div>

            {error && (
                <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <AlertCircle size={20} /> {error}
                </div>
            )}
            {success && (
                <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '8px', color: 'var(--success)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <CheckCircle2 size={20} /> {success}
                </div>
            )}

            {/* Bulk Email Invitations - NEW */}
            <div className="dashboard-card-lux mb-8" style={{ padding: '2rem' }}>
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <Plus size={24} />
                    </div>
                    <div>
                        <h3 className="m-0" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--lux-text-primary)' }}>Invite via Email</h3>
                        <p className="m-0" style={{ color: 'var(--lux-text-secondary)', fontSize: '0.9rem' }}>Direct secure invitations to specific directors</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                    <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
                        <textarea
                            placeholder="Enter emails separated by commas (e.g. member1@gmail.com, member2@gmail.com)"
                            className="form-textarea"
                            style={{
                                width: '100%', padding: '1rem', borderRadius: '12px', border: '1px solid var(--lux-border)',
                                background: 'var(--lux-bg-soft)', color: 'var(--lux-text-primary)', minHeight: '100px',
                                resize: 'none', fontSize: '0.95rem'
                            }}
                            value={bulkEmails}
                            onChange={(e) => setBulkEmails(e.target.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                      <button
                          onClick={async () => {
                              const emails = bulkEmails.split(',').map(e => e.trim()).filter(e => e);
                              if (emails.length === 0) return setError('Please enter at least one email');
                              
                              setGenerating(true);
                              setError('');
                              setSuccess('');
                              
                              let successCount = 0;
                              let failCount = 0;

                              for (const email of emails) {
                                  try {
                                      await inviteAPI.send(id, email);
                                      successCount++;
                                  } catch (err) {
                                      console.error(`Failed to invite ${email}`, err);
                                      failCount++;
                                  }
                              }

                              setGenerating(false);
                              if (successCount > 0) {
                                  setSuccess(`Successfully sent ${successCount} invitation(s). ${failCount > 0 ? `${failCount} failed.` : ''}`);
                                  setBulkEmails('');
                                  fetchData();
                              } else if (failCount > 0) {
                                  setError(`Failed to send invitations. Ensure emails are valid and API is connected.`);
                              }
                          }}
                          disabled={generating}
                          style={{
                              padding: '0.75rem 1.5rem', 
                              background: 'var(--lux-gold)',
                              color: '#000', 
                              border: 'none', 
                              borderRadius: '12px',
                              fontWeight: 900, 
                              cursor: generating ? 'not-allowed' : 'pointer',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.5rem', 
                              fontSize: '0.9rem',
                              boxShadow: 'var(--lux-shadow)'
                          }}
                      >
                          {generating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                          {generating ? 'Sending...' : 'SEND INVITATIONS'}
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--lux-text-secondary)', textAlign: 'center', fontWeight: 600 }}>
                         {emailsCount || 0} DIRECTORS DETECTED
                      </p>
                    </div>
                </div>
            </div>

            <div className="dashboard-card-lux mb-8" style={{ background: 'var(--gold-gradient)', border: 'none', padding: '2rem' }}>
                <div className="flex flex-between align-center flex-wrap gap-6">
                    <div>
                        <h2 className="m-0 mb-1" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'white' }}>Generate Quick Invite Link</h2>
                        <p className="m-0" style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.95rem', maxWidth: '450px' }}>
                            Create a single-use code for manual sharing via WhatsApp, SMS or Signal.
                        </p>
                    </div>
                    <button
                        onClick={handleGenerateInvite}
                        disabled={generating}
                        className="btn-lux"
                        style={{ background: 'white', color: 'var(--lux-bg-dark)', padding: '0.8rem 1.5rem', borderRadius: '12px' }}
                    >
                        {generating ? <Loader size={18} className="animate-spin" /> : <LinkIcon size={18} />}
                        Create Code
                    </button>
                </div>
            </div>

            {/* Active Invites Section */}
            <div className="dashboard-card-lux mb-8" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="flex flex-between items-center p-6 border-b" style={{ borderColor: 'var(--lux-border)' }}>
                    <h3 className="m-0" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--lux-text-primary)' }}>Active Invite Codes</h3>
                    <button onClick={fetchData} className="tab-btn-lux">
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="table-responsive-lux">
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--lux-text-secondary)', letterSpacing: '1px' }}>
                                <th style={{ padding: '1rem 1.5rem' }}>Code</th>
                                <th>Created By</th>
                                <th>Usage</th>
                                <th>Expires</th>
                                <th style={{ paddingRight: '1.5rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeInvites.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                            <Shield size={32} style={{ opacity: 0.2 }} />
                                            <p>No active invite codes found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : activeInvites.map(invite => (
                                <tr key={invite.invite_id} style={{ background: 'var(--lux-bg-soft)' }}>
                                    <td style={{ padding: '1rem 1.5rem', borderRadius: '12px 0 0 12px' }}>
                                        <div
                                            onClick={() => copyToClipboard(invite.invite_code)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 800,
                                                color: 'var(--lux-gold)', cursor: 'pointer', width: 'fit-content',
                                                padding: '0.4rem 0.8rem', borderRadius: '8px',
                                                background: 'var(--lux-gold-dim)', border: '1px solid var(--lux-gold-border)'
                                            }}
                                            title="Click to copy"
                                        >
                                            {invite.invite_code} <Copy size={12} />
                                        </div>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-lux-bg-soft flex items-center justify-center border border-lux-border text-lux-primary font-bold text-xs">
                                                {invite.created_by_name?.charAt(0) || <User size={14} />}
                                            </div>
                                            <span style={{ color: 'var(--lux-text-primary)', fontWeight: 600 }}>{invite.created_by_name}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 800, color: 'var(--lux-text-primary)' }}>{invite.uses_count}</span>
                                        <span style={{ color: 'var(--lux-text-secondary)', opacity: 0.6 }}> / {invite.max_uses}</span>
                                    </td>
                                    <td style={{ color: 'var(--lux-text-secondary)' }}>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} />
                                            {formatDate(invite.expires_at)}
                                        </div>
                                    </td>
                                    <td style={{ paddingRight: '1.5rem', borderRadius: '0 12px 12px 0' }}>
                                        <button
                                            onClick={() => handleDeactivate(invite.invite_id)}
                                            className="p-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                            title="Revoke Invite"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Inactive History */}
            {inactiveInvites.length > 0 && (
                <div style={{ opacity: 0.8 }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray)', marginBottom: '1rem', marginLeft: '0.5rem' }}>History</h4>
                    <div style={{
                        background: 'var(--card-bg)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.85rem' }}>Code</th>
                                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.85rem' }}>Status</th>
                                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.85rem' }}>Expired On</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inactiveInvites.map(invite => (
                                    <tr key={invite.invite_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem 1.5rem', fontFamily: 'monospace', color: 'var(--gray)' }}>{invite.invite_code}</td>
                                        <td style={{ padding: '0.75rem 1.5rem' }}>
                                            <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                                                Inactive
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--gray)' }}>{formatDate(invite.expires_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                )}
            </div>
        </div>
    </div>
    );
};

export default InviteManagement;
