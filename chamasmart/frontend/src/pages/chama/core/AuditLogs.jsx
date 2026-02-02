import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { auditAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import "./AuditLogs.css"; // Create this CSS file for styling

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
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Audit Trail</h1>
                        <p className="subtitle">Track all chama activities and changes</p>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-outline" onClick={() => navigate(`/chamas/${id}`)}>
                            ← Back to Chama
                        </button>
                        <button className="btn btn-primary" onClick={handleExport}>
                            📥 Export Logs
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                {summary && (
                    <div className="grid-4 mb-3">
                        <div className="stat-card">
                            <h3>{summary.total_actions}</h3>
                            <p>Total Actions</p>
                        </div>
                        <div className="stat-card">
                            <h3>{summary.unique_users}</h3>
                            <p>Active Users</p>
                        </div>
                        <div className="stat-card">
                            <h3>{summary.today_actions}</h3>
                            <p>Actions Today</p>
                        </div>
                        <div className="stat-card">
                            <h3>{summary.critical_actions || 0}</h3>
                            <p>Critical Actions</p>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="card mb-3 p-3">
                    <div className="grid-4">
                        <div className="form-group mb-0">
                            <label>Action Type</label>
                            <select
                                name="action"
                                className="form-select"
                                value={filter.action}
                                onChange={handleFilterChange}
                            >
                                <option value="">All Actions</option>
                                <option value="CREATE">Create</option>
                                <option value="UPDATE">Update</option>
                                <option value="DELETE">Delete</option>
                                <option value="APPROVE">Approve</option>
                                <option value="REJECT">Reject</option>
                            </select>
                        </div>
                        <div className="form-group mb-0">
                            <label>Start Date</label>
                            <input
                                type="date"
                                name="startDate"
                                className="form-input"
                                value={filter.startDate}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div className="form-group mb-0">
                            <label>End Date</label>
                            <input
                                type="date"
                                name="endDate"
                                className="form-input"
                                value={filter.endDate}
                                onChange={handleFilterChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Logs Table */}
                <div className="card">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>User</th>
                                <th>Action</th>
                                <th>Resource</th>
                                <th>Details</th>
                                <th>IP Address</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-4">No logs found matching your criteria</td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id}>
                                        <td>{new Date(log.created_at).toLocaleString()}</td>
                                        <td>
                                            <div className="user-info">
                                                <span className="font-bold">{log.user_name}</span>
                                                <span className="text-muted text-sm">{log.user_email}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td>{log.resource_type}</td>
                                        <td className="log-details">
                                            {log.details || "-"}
                                        </td>
                                        <td className="text-muted text-sm">{log.ip_address}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
