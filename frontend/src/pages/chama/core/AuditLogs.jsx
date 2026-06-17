import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auditAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { Download, ArrowLeft, Activity, Users, Zap, AlertTriangle } from 'lucide-react';
import "../core/ChamaDetailsLux.css";

const ACTION_META = {
    CREATE:  { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Creation'     },
    UPDATE:  { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Modification' },
    DELETE:  { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Termination'  },
    APPROVE: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', label: 'Authorized'   },
    REJECT:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Denied'       },
};

const AuditLogs = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [logs, setLogs]       = useState([]);
    const [summary, setSummary] = useState(null);
    const [filter, setFilter]   = useState({ action: "", user: "", startDate: "", endDate: "" });

    useEffect(() => { fetchAuditData(); }, [id, filter]);

    const fetchAuditData = async () => {
        try {
            setLoading(true);
            const [logsRes, summaryRes] = await Promise.all([
                auditAPI.getChamaLogs(id, filter),
                auditAPI.getChamaSummary(id)
            ]);

            // Safely extract the logs array regardless of API envelope shape
            const raw = logsRes.data?.data ?? logsRes.data ?? [];
            setLogs(Array.isArray(raw) ? raw : Object.values(raw));

            const s = summaryRes.data?.data ?? summaryRes.data ?? {};
            setSummary(s);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load audit logs");
        } finally {
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
            const url  = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href  = url;
            link.setAttribute('download', `audit_logs_${id}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toast.error("Failed to export logs");
        }
    };

    if (loading) return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--lux-text-secondary)' }}>
            <Activity className="animate-spin" size={32} style={{ marginRight: '1rem', color: 'var(--lux-gold)' }} />
            Loading audit trail…
        </div>
    );

    return (
        <div className="manage-page-root">
            <div className="container">
                <div className="page-frame-lux" style={{ background:'var(--lux-card-bg)', border:'1px solid var(--lux-border)' }}>

                    {/* ── HEADER ── */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'2rem', flexWrap:'wrap', gap:'1rem' }}>
                        <div>
                            <h1 style={{ fontSize:'1.75rem', fontWeight:900, margin:0, color:'var(--lux-text-primary)', display:'flex', alignItems:'center', gap:'0.75rem' }}>
                                <span style={{ display:'inline-flex', padding:'0.45rem', borderRadius:'12px', background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.2)' }}>
                                    <Activity size={22} style={{ color:'#a78bfa' }} />
                                </span>
                                Audit Trail
                            </h1>
                            <p style={{ color:'var(--lux-text-secondary)', marginTop:'6px', fontSize:'0.9rem' }}>
                                Immutable, tamper-proof log of every action inside this chama.
                            </p>
                        </div>
                        <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                            <button className="btn-return-lux" onClick={() => navigate(`/chamas/${id}`, { state:{ tab:'management' } })}>
                                <ArrowLeft size={15} /> Back to Management
                            </button>
                            <button className="btn-lux btn-lux-primary" style={{ display:'flex', alignItems:'center', gap:'0.5rem' }} onClick={handleExport}>
                                <Download size={15} /> Export CSV
                            </button>
                        </div>
                    </div>

                    {/* ── SUMMARY STATS ── */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'2rem' }}>
                        {[
                            { icon: Activity,      value: summary?.total_actions   ?? 0, label:'Total Events',   color:'var(--lux-gold)'  },
                            { icon: Users,         value: summary?.unique_users    ?? 0, label:'Operators',      color:'#3b82f6'          },
                            { icon: Zap,           value: summary?.today_actions   ?? 0, label:'Today\'s Events',color:'#10b981'          },
                            { icon: AlertTriangle, value: summary?.critical_actions?? 0, label:'Critical Flags', color:'#ef4444'          },
                        ].map(({ icon: Icon, value, label, color }) => (
                            <div key={label} style={{ background:'var(--lux-bg-soft)', border:'1px solid var(--lux-border)', borderRadius:'16px', padding:'20px', textAlign:'center' }}>
                                <Icon size={20} style={{ color, marginBottom:'8px' }} />
                                <div style={{ fontSize:'1.75rem', fontWeight:900, color, lineHeight:1 }}>{value}</div>
                                <div style={{ fontSize:'0.7rem', fontWeight:800, color:'var(--lux-text-secondary)', textTransform:'uppercase', letterSpacing:'1px', marginTop:'4px' }}>{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* ── FILTERS ── */}
                    <div style={{ background:'var(--lux-bg-soft)', border:'1px solid var(--lux-border)', borderRadius:'16px', padding:'20px', marginBottom:'2rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>
                        <div>
                            <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', color:'var(--lux-text-secondary)', marginBottom:'8px' }}>Event Type</label>
                            <select name="action" className="form-input" style={{ width:'100%', background:'var(--lux-card-bg)', border:'1px solid var(--lux-border)', color:'var(--lux-text-primary)', borderRadius:'10px' }} value={filter.action} onChange={handleFilterChange}>
                                <option value="">All Types</option>
                                <option value="CREATE">Creation</option>
                                <option value="UPDATE">Modification</option>
                                <option value="DELETE">Termination</option>
                                <option value="APPROVE">Authorization</option>
                                <option value="REJECT">Denial</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', color:'var(--lux-text-secondary)', marginBottom:'8px' }}>From Date</label>
                            <input type="date" name="startDate" className="form-input" style={{ width:'100%', background:'var(--lux-card-bg)', border:'1px solid var(--lux-border)', color:'var(--lux-text-primary)', borderRadius:'10px' }} value={filter.startDate} onChange={handleFilterChange} />
                        </div>
                        <div>
                            <label style={{ display:'block', fontSize:'0.7rem', fontWeight:800, textTransform:'uppercase', letterSpacing:'1px', color:'var(--lux-text-secondary)', marginBottom:'8px' }}>To Date</label>
                            <input type="date" name="endDate" className="form-input" style={{ width:'100%', background:'var(--lux-card-bg)', border:'1px solid var(--lux-border)', color:'var(--lux-text-primary)', borderRadius:'10px' }} value={filter.endDate} onChange={handleFilterChange} />
                        </div>
                    </div>

                    {/* ── LOGS TABLE ── */}
                    <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:'0 6px' }}>
                            <thead>
                                <tr style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'1px', color:'var(--lux-text-secondary)' }}>
                                    {['Timestamp','Operator','Event','Resource','Details','IP Address'].map(h => (
                                        <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontWeight:800 }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign:'center', padding:'60px', color:'var(--lux-text-secondary)', background:'var(--lux-bg-soft)', borderRadius:'16px' }}>
                                            <Activity size={32} style={{ opacity:0.3, marginBottom:'1rem', display:'block', margin:'0 auto 1rem' }} />
                                            No audit events found for the current filters.
                                        </td>
                                    </tr>
                                ) : logs.map((log, i) => {
                                    const meta = ACTION_META[log.action] || { color:'var(--lux-text-secondary)', bg:'var(--lux-card-bg)', label: log.action };
                                    return (
                                        <tr key={log.audit_id ?? i} style={{ background:'var(--lux-bg-soft)' }}>
                                            <td style={{ padding:'14px 16px', borderRadius:'12px 0 0 12px', fontSize:'0.8rem', color:'var(--lux-text-secondary)', whiteSpace:'nowrap' }}>
                                                {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                                            </td>
                                            <td style={{ padding:'14px 16px' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                                                    <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--lux-card-bg)', border:'1px solid var(--lux-border)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'0.8rem', color:'var(--lux-gold)', flexShrink:0 }}>
                                                        {(log.user_name || 'S').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight:700, color:'var(--lux-text-primary)', fontSize:'0.85rem' }}>{log.user_name || 'System'}</div>
                                                        <div style={{ fontSize:'0.72rem', color:'var(--lux-text-secondary)' }}>{log.user_email || 'Automated'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding:'14px 16px' }}>
                                                <span style={{ display:'inline-flex', padding:'3px 10px', borderRadius:'20px', fontSize:'0.68rem', fontWeight:800, background:meta.bg, color:meta.color, border:`1px solid ${meta.color}33`, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td style={{ padding:'14px 16px', fontSize:'0.85rem', color:'var(--lux-text-primary)', fontWeight:600 }}>
                                                {log.entity_type || log.resource || '—'}
                                            </td>
                                            <td style={{ padding:'14px 16px', fontSize:'0.8rem', color:'var(--lux-text-secondary)', maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={log.details || (log.metadata ? JSON.stringify(log.metadata) : '')}>
                                                {log.details || (log.metadata ? JSON.stringify(log.metadata) : '—')}
                                            </td>
                                            <td style={{ padding:'14px 16px', borderRadius:'0 12px 12px 0', fontSize:'0.78rem', color:'var(--lux-text-secondary)', fontFamily:'monospace' }}>
                                                {log.ip_address || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditLogs;
