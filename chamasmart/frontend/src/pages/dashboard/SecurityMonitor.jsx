import { useState, useEffect } from "react";
import { auditAPI } from "../../services/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
    ShieldCheck, ShieldAlert, Activity, RefreshCw,
    Lock, AlertTriangle, Terminal, Eye, MoreHorizontal,
    CheckCircle, XCircle, Search
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const SecurityMonitor = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({
        total_events: 0,
        failed_logins: 0,
        suspicious_activities: 0
    });
    const [healthScore, setHealthScore] = useState(100);

    const calculateHealth = (stats) => {
        // Simple algorithm: Start at 100. Deduct 5 for each failed login, 15 for suspicious.
        let score = 100;
        score -= (stats.failed_logins || 0) * 2;
        score -= (stats.suspicious_activities || 0) * 10;
        return Math.max(0, score);
    };

    const fetchSecurityLogs = async () => {
        try {
            // Optimistic loading state only for manual refresh
            // setLoading(true); 
            const response = await auditAPI.getSecurityLogs();
            const data = response.data.data || response.data;

            setLogs(data.logs);
            setStats(data.stats);
            setHealthScore(calculateHealth(data.stats));
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to sync security logs");
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecurityLogs();
        // Real-time polling
        const interval = setInterval(fetchSecurityLogs, 15000);
        return () => clearInterval(interval);
    }, []);

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'CRITICAL': return '#ef4444'; // Red
            case 'HIGH': return '#f97316'; // Orange
            case 'MEDIUM': return '#eab308'; // Yellow
            default: return '#3b82f6'; // Blue
        }
    };

    const chartData = [
        { name: 'Normal', value: stats.total_events - (stats.failed_logins + stats.suspicious_activities), color: '#22c55e' },
        { name: 'Warnings', value: stats.failed_logins, color: '#eab308' },
        { name: 'Critical', value: stats.suspicious_activities, color: '#ef4444' },
    ].filter(d => d.value > 0);

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                        <div style={{ padding: '0.5rem', borderRadius: '12px', background: 'var(--bg-secondary)', color: 'var(--primary)' }}>
                            <ShieldCheck size={28} />
                        </div>
                        Security Center
                    </h1>
                    <p style={{ margin: '0.5rem 0 0 3.5rem', color: 'var(--text-secondary)', fontSize: '1rem' }}>
                        Real-time system integrity monitoring and threat detection.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={fetchSecurityLogs}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.75rem 1.25rem', borderRadius: '10px',
                            background: 'var(--card-bg)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', cursor: 'pointer',
                            fontWeight: 600, boxShadow: 'var(--shadow)'
                        }}
                    >
                        <RefreshCw size={18} className={loading ? "spin" : ""} /> Refresh
                    </button>
                    <button
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.75rem 1.25rem', borderRadius: '10px',
                            background: 'var(--primary)', border: 'none',
                            color: 'white', cursor: 'pointer',
                            fontWeight: 600, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                        }}
                    >
                        <Lock size={18} /> Security Policy
                    </button>
                </div>
            </div>

            {/* Top Grid: Health & Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

                {/* Health Score Card */}
                <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>System Health</h3>
                        <Activity size={20} color={healthScore > 80 ? 'var(--success)' : 'var(--warning)'} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                        <span style={{ fontSize: '3rem', fontWeight: 800, color: healthScore > 80 ? 'var(--success)' : healthScore > 50 ? 'var(--warning)' : 'var(--danger)' }}>
                            {healthScore}%
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>Secure</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', marginTop: '1rem' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${healthScore}%` }}
                            transition={{ duration: 1 }}
                            style={{ height: '100%', borderRadius: '3px', background: healthScore > 80 ? 'var(--success)' : healthScore > 50 ? 'var(--warning)' : 'var(--danger)' }}
                        />
                    </div>
                </div>

                {/* Threat Distribution */}
                <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Event Distribution</h3>
                        <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total_events}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Events</div>
                            </div>
                            <div style={{ width: '1px', background: 'var(--border)' }}></div>
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{stats.suspicious_activities}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Threats</div>
                            </div>
                        </div>
                    </div>
                    <div style={{ width: '100px', height: '100px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    innerRadius={30}
                                    outerRadius={40}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quick Alert */}
                <div style={{ background: 'linear-gradient(135deg, #1e1e2e, #2d2d44)', borderRadius: '16px', padding: '1.5rem', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <ShieldAlert size={24} color="#f87171" />
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Active Alerts</h3>
                    </div>
                    <p style={{ margin: 0, opacity: 0.8, fontSize: '0.95rem', lineHeight: 1.5 }}>
                        {stats.failed_logins > 0
                            ? `${stats.failed_logins} failed login attempts detected in the last 24 hours.`
                            : "No active security alerts at this time."}
                    </p>
                    {stats.failed_logins > 0 && (
                        <button style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                            Review Incidents
                        </button>
                    )}
                </div>
            </div>

            {/* Content Grid: Live Feed */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2rem' }}>
                <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Live Event Feed</h3>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                style={{
                                    padding: '0.5rem 0.5rem 0.5rem 2.25rem',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    width: '200px'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Timestamp</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Severity</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Event</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>User / IP</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Details</th>
                                    <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {logs.map((log) => (
                                        <motion.tr
                                            key={log.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            style={{ borderBottom: '1px solid var(--border)' }}
                                            className="hover:bg-gray-50 dark:hover:bg-gray-800"
                                        >
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{
                                                    padding: '4px 8px', borderRadius: '4px',
                                                    background: `${getSeverityColor(log.severity)}20`,
                                                    color: getSeverityColor(log.severity),
                                                    fontSize: '0.75rem', fontWeight: 700,
                                                    border: `1px solid ${getSeverityColor(log.severity)}40`
                                                }}>
                                                    {log.severity}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                {log.event_type.replace(/_/g, ' ')}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{log.user_name || 'System'}</span>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace' }}>{log.ip_address}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {JSON.stringify(log.details).replace(/[{}"]/g, '')}
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                                    <MoreHorizontal size={18} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                        {logs.length === 0 && !loading && (
                            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <ShieldCheck size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                                <p>No security events found in the selected period.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityMonitor;
