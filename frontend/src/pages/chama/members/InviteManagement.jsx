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
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem', color: 'var(--text-primary)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        <div style={{ padding: '0.5rem', background: 'var(--bg-primary-light)', borderRadius: '10px', color: 'var(--primary)' }}>
                            <Share2 size={24} />
                        </div>
                        Invite Management
                    </h1>
                    <p style={{ color: 'var(--gray)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
                        Access control for <strong>{chama?.chama_name}</strong>
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
            <div style={{
                background: 'var(--card-bg)',
                borderRadius: '16px',
                padding: '1.5rem',
                border: '1px solid var(--border)',
                marginBottom: '2rem',
                boxShadow: 'var(--shadow)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ padding: '0.5rem', background: 'var(--bg-primary-light)', borderRadius: '8px', color: 'var(--primary)' }}>
                        <Plus size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Invite via Email</h3>
                        <p style={{ color: 'var(--gray)', fontSize: '0.85rem', margin: 0 }}>Send professional invitations powered by Resend</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                    <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
                        <textarea
                            placeholder="Enter emails separated by commas (e.g. member1@gmail.com, member2@gmail.com)"
                            style={{
                                width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)',
                                background: 'transparent', color: 'var(--text-primary)', minHeight: '80px',
                                resize: 'none', fontSize: '0.9rem'
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
                              padding: '0.75rem 1.5rem', background: 'var(--primary)',
                              color: 'white', border: 'none', borderRadius: '10px',
                              fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'
                          }}
                      >
                          {generating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                          {generating ? 'Sending...' : 'Send Invites'}
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray)', textAlign: 'center' }}>
                         {emailsCount || 0} emails detected
                      </p>
                    </div>
                </div>
            </div>

            <div style={{
                background: 'var(--primary)', 
                borderRadius: '16px',
                padding: '1.5rem',
                color: 'white',
                marginBottom: '2rem',
                boxShadow: 'var(--shadow-md)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem', color: 'white' }}>Generate Quick Invite Link</h2>
                        <p style={{ color: 'rgba(255, 255, 255, 0.9)', margin: 0, fontSize: '0.85rem', maxWidth: '400px' }}>
                            Create a single-use code for manual sharing.
                        </p>
                    </div>
                    <button
                        onClick={handleGenerateInvite}
                        disabled={generating}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.6rem 1.25rem', background: 'white',
                            color: 'var(--primary)', border: 'none', borderRadius: '10px',
                            fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}
                    >
                        {generating ? <Loader size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                        Create Code
                    </button>
                </div>
            </div>

            {/* Active Invites Section */}
            <div style={{
                background: 'var(--card-bg)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow)',
                overflow: 'hidden',
                marginBottom: '2rem'
            }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Active Invite Codes</h3>
                    <button onClick={fetchData} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '0.4rem', borderRadius: '6px', color: 'var(--gray)', cursor: 'pointer' }}>
                        <RefreshCw size={16} />
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                            <tr>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Code</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Created By</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Usage</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Expires</th>
                                <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontWeight: 600 }}>Actions</th>
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
                                <tr key={invite.invite_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div
                                            onClick={() => copyToClipboard(invite.invite_code)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700,
                                                color: 'var(--primary)', cursor: 'pointer', width: 'fit-content',
                                                padding: '0.25rem 0.5rem', borderRadius: '6px',
                                                background: 'rgba(37, 99, 235, 0.05)'
                                            }}
                                            title="Click to copy"
                                        >
                                            {invite.invite_code} <Copy size={12} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--text-primary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                {invite.created_by_name?.charAt(0) || <User size={14} />}
                                            </div>
                                            {invite.created_by_name}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{invite.uses_count}</span>
                                        <span style={{ opacity: 0.7 }}> / {invite.max_uses}</span>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Calendar size={14} />
                                            {formatDate(invite.expires_at)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <button
                                            onClick={() => handleDeactivate(invite.invite_id)}
                                            title="Revoke Invite"
                                            style={{
                                                background: 'transparent', border: '1px solid var(--danger)',
                                                color: 'var(--danger)', borderRadius: '6px', padding: '0.4rem 0.75rem',
                                                fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Trash2 size={14} /> Revoke
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
    );
};

export default InviteManagement;
