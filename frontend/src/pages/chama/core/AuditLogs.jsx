import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auditAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { Download, ArrowLeft } from 'lucide-react';
import "../core/ChamaDetailsLux.css";

const AuditLogs = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState(null);
    const [filter, setFilter] = useState({
        action: "",
        user: "",
        startDate: "",
        endDate: ""
    });

    useEffect(() => {
        fetchAuditData();
    }, [id, filter]);

    const fetchAuditData = async () => {
        try {
            setLoading(true);
            const [logsRes, summaryRes] = await Promise.all([
                auditAPI.getChamaLogs(id, filter),
                auditAPI.getChamaSummary(id)
            ]);

            setLogs(logsRes.data.data || logsRes.data);
            setSummary(summaryRes.data.data || summaryRes.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load audit logs");
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilter(prev => ({ ...prev, [name]: value }));
    };

    const handleExport = async () => {
        try {
            const response = await auditAPI.exportChamaLogs(id, "csv");
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_logs_${id}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error(err);
            toast.error("Failed to export logs");
        }
    };

    if (loading) return <div className="loading-spinner">Loading Audit Logs...</div>;

    return (
        <div className="manage-page-root">
            <div className="container">
                <div className="page-frame-lux" style={{ background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)' }}>
                    <div className="flex flex-between align-center mb-8">
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: 'var(--lux-text-primary)' }}>Audit Trail</h1>
                            <p style={{ color: 'var(--lux-text-secondary)', marginTop: '4px', fontSize: '0.95rem' }}>Immutable record of all <strong style={{ color: 'var(--lux-text-primary)' }}>System Events</strong></p>
                        </div>
                        <div className="flex gap-4 items-center">
                            <button className="btn-return-lux" onClick={() => navigate(`/chamas/${id}`, { state: { tab: 'management' } })}>
                                <ArrowLeft size={16} /> Return to Vault
                            </button>
                            <button className="btn-lux flex items-center gap-2" onClick={handleExport} aria-label="Export audit logs">
                                <Download size={16} /> Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-4 gap-6 mb-8">
                            <div className="dashboard-card-lux" style={{ padding: '24px', textAlign: 'center', background: 'var(--lux-bg-soft)' }}>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--lux-gold)', margin: '0 0 4px 0' }}>{summary.total_actions || 0}</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Events</p>
                            </div>
                            <div className="dashboard-card-lux" style={{ padding: '24px', textAlign: 'center', background: 'var(--lux-bg-soft)' }}>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--lux-text-primary)', margin: '0 0 4px 0' }}>{summary.unique_users || 0}</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Operators</p>
                            </div>
                            <div className="dashboard-card-lux" style={{ padding: '24px', textAlign: 'center', background: 'var(--lux-bg-soft)' }}>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#3b82f6', margin: '0 0 4px 0' }}>{summary.today_actions || 0}</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Daily Activity</p>
                            </div>
                            <div className="dashboard-card-lux" style={{ padding: '24px', textAlign: 'center', background: 'var(--lux-bg-soft)' }}>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', margin: '0 0 4px 0' }}>{summary.critical_actions || 0}</h3>
                                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Critical Flags</p>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="dashboard-card-lux mb-8" style={{ padding: '24px', background: 'var(--lux-bg-soft)' }}>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="form-group mb-0">
                                <label style={{ color: 'var(--lux-text-secondary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Event Protocol</label>
                                <select
                                    name="action"
                                    className="form-input"
                                    style={{ width: '100%', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                                    value={filter.action}
                                    onChange={handleFilterChange}
                                >
                                    <option value="">All Protocols</option>
                                    <option value="CREATE">Creation</option>
                                    <option value="UPDATE">Modification</option>
                                    <option value="DELETE">Termination</option>
                                    <option value="APPROVE">Authorization</option>
                                    <option value="REJECT">Denial</option>
                                </select>
                            </div>
                            <div className="form-group mb-0">
                                <label style={{ color: 'var(--lux-text-secondary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>Start Sequence</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    className="form-input"
                                    style={{ width: '100%', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                                    value={filter.startDate}
                                    onChange={handleFilterChange}
                                />
                            </div>
                            <div className="form-group mb-0">
                                <label style={{ color: 'var(--lux-text-secondary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>End Sequence</label>
                                <input
                                    type="date"
                                    name="endDate"
                                    className="form-input"
                                    style={{ width: '100%', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                                    value={filter.endDate}
                                    onChange={handleFilterChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Logs Table */}
                    <div className="table-responsive-lux">
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--lux-text-secondary)', letterSpacing: '1px' }}>
                                    <th style={{ padding: '12px 20px' }}>Timestamp</th>
                                    <th>Operator</th>
                                    <th>Protocol</th>
                                    <th>Resource</th>
                                    <th>Metadata</th>
                                    <th style={{ paddingRight: '20px' }}>Network IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '60px', color: 'var(--lux-text-secondary)', background: 'var(--lux-bg-soft)', borderRadius: '16px' }}>
                                            No system logs detected within current filter parameters.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map(log => (
                                        <tr key={log.audit_id} style={{ background: 'var(--lux-bg-soft)' }}>
                                            <td style={{ padding: '16px 20px', borderRadius: '12px 0 0 12px', fontSize: '0.85rem', color: 'var(--lux-text-secondary)' }}>
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-lux-card-bg flex items-center justify-center border border-lux-border text-lux-gold font-bold text-xs">
                                                        {(log.user_name || "S").charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, color: 'var(--lux-text-primary)', fontSize: '0.9rem' }}>{log.user_name || "System"}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--lux-text-secondary)' }}>{log.user_email || "Automated Protocol"}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ 
                                                    display: 'inline-flex', padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800,
                                                    background: log.action?.includes('CREATE') ? 'rgba(16, 185, 129, 0.1)' : log.action?.includes('DELETE') ? 'rgba(239, 68, 68, 0.1)' : 'var(--lux-card-bg)',
                                                    color: log.action?.includes('CREATE') ? '#10b981' : log.action?.includes('DELETE') ? '#ef4444' : 'var(--lux-text-secondary)',
                                                    border: '1px solid var(--lux-border)', textTransform: 'uppercase'
                                                }}>
                                                    {log.action}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--lux-text-primary)', fontWeight: 600 }}>{log.entity_type || log.resource}</td>
                                            <td style={{ fontSize: '0.8rem', color: 'var(--lux-text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.details || log.metadata ? JSON.stringify(log.metadata) : ""}>
                                                {log.details || (log.metadata ? JSON.stringify(log.metadata) : "-")}
                                            </td>
                                            <td style={{ paddingRight: '20px', borderRadius: '0 12px 12px 0', fontSize: '0.8rem', color: 'var(--lux-text-secondary)', fontFamily: 'monospace' }}>
                                                {log.ip_address}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getActionColor = (action) => {
    switch (action) {
        case 'CREATE': return 'success';
        case 'UPDATE': return 'info';
        case 'DELETE': return 'danger';
        case 'APPROVE': return 'success';
        case 'REJECT': return 'warning';
        default: return 'secondary';
    }
};

export default AuditLogs;
