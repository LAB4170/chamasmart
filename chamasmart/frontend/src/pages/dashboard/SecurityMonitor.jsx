import { useState, useEffect } from "react";
import { auditAPI } from "../../services/api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import "./SecurityMonitor.css";

const SecurityMonitor = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({
        total_events: 0,
        failed_logins: 0,
        suspicious_activities: 0
    });

    useEffect(() => {
        let isMounted = true;

        const fetchSecurityLogs = async () => {
            try {
                const response = await auditAPI.getSecurityLogs();
                const data = response.data.data || response.data;
                if (isMounted) {
                    setLogs(data.logs);
                    setStats(data.stats);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to fetch security logs");
                    setLoading(false);
                }
            }
        };

        fetchSecurityLogs();
        // Set up polling for real-time updates every 30 seconds
        const interval = setInterval(fetchSecurityLogs, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    if (loading) return <div className="loading-spinner">Initializing Security Monitor...</div>;

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Security Monitor</h1>
                        <p className="subtitle">Real-time security event tracking</p>
                    </div>
                    <button className="btn btn-primary" onClick={fetchSecurityLogs}>
                        🔄 Refresh
                    </button>
                </div>

                <div className="grid-3 mb-3">
                    <div className="stat-card border-left-info">
                        <h3>{stats.total_events}</h3>
                        <p>Total Events (24h)</p>
                    </div>
                    <div className="stat-card border-left-warning">
                        <h3>{stats.failed_logins}</h3>
                        <p>Failed Logins</p>
                    </div>
                    <div className="stat-card border-left-danger">
                        <h3>{stats.suspicious_activities}</h3>
                        <p>Suspicious Activities</p>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3>Recent Security Events</h3>
                    </div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Severity</th>
                                <th>Event Type</th>
                                <th>User</th>
                                <th>IP Address</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} className={log.severity === 'HIGH' ? 'bg-error-light' : ''}>
                                    <td>{new Date(log.created_at).toLocaleString()}</td>
                                    <td>
                                        <span className={`badge badge-${getSeverityColor(log.severity)}`}>
                                            {log.severity}
                                        </span>
                                    </td>
                                    <td>{log.event_type}</td>
                                    <td>{log.user_email || 'System/Anonymous'}</td>
                                    <td>{log.ip_address}</td>
                                    <td>{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const getSeverityColor = (severity) => {
    switch (severity) {
        case 'HIGH': return 'danger';
        case 'MEDIUM': return 'warning';
        case 'LOW': return 'info';
        default: return 'secondary';
    }
};

export default SecurityMonitor;
