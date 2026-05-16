import { useState, useEffect, useCallback } from "react";
import { scoreAPI } from "../../../services/utils.service";
import { AlertTriangle, Info, Lightbulb, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const SEVERITY_CONFIG = {
    CRITICAL: {
        icon: <AlertTriangle size={16} />,
        color: "#ef4444",
        bg: "rgba(239, 68, 68, 0.05)",
        border: "rgba(239, 68, 68, 0.2)",
        label: "Critical",
    },
    WARNING: {
        icon: <Info size={16} />,
        color: "#f59e0b",
        bg: "rgba(245, 158, 11, 0.05)",
        border: "rgba(245, 158, 11, 0.2)",
        label: "Warning",
    },
    TIP: {
        icon: <Lightbulb size={16} />,
        color: "#3b82f6",
        bg: "rgba(59, 130, 246, 0.05)",
        border: "rgba(59, 130, 246, 0.2)",
        label: "Insight",
    },
};

function AlertCard({ alert }) {
    const [open, setOpen] = useState(alert.severity === "CRITICAL");
    const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.TIP;

    return (
        <div
            className="health-alert-card"
        >
            <button
                className="health-alert-header"
                onClick={() => setOpen((o) => !o)}
                style={{ borderBottom: open ? `1px solid ${cfg.border}` : "none" }}
            >
                <span className="health-alert-icon" style={{ color: cfg.color }}>
                    <span style={{ fontSize: "14px", marginRight: "8px", fontWeight: 800, textTransform: 'uppercase', opacity: 0.8 }}>{alert.icon}</span> 
                    {cfg.icon}
                </span>
                <span className="health-alert-title" style={{ color: cfg.color }}>
                    {alert.title}
                </span>
                <span
                    className="health-alert-severity-badge"
                    style={{ background: cfg.color + "20", color: cfg.color }}
                >
                    {cfg.label}
                </span>
                <span style={{ color: cfg.color, marginLeft: "auto" }}>
                    {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>

            {open && (
                <div className="health-alert-body">
                    <p className="health-alert-detail">{alert.detail}</p>
                    <div className="health-alert-action">
                        <strong style={{ color: 'var(--lux-gold)', textTransform: 'uppercase', fontSize: '0.75rem', marginRight: '8px' }}>Strategic Protocol:</strong>
                        <span style={{ color: 'var(--lux-text-primary)', fontWeight: 600 }}> {alert.action}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

const HealthAlerts = ({ chamaId }) => {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await scoreAPI.getAlerts(chamaId);
            setAlerts(res.data.data?.alerts || []);
        } catch (err) {
            console.error("Failed to fetch health alerts", err);
        } finally {
            setLoading(false);
        }
    }, [chamaId]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    if (loading || !alerts.length) return null;

    const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;

    return (
        <div className="health-alerts-container">
            <div className="health-alerts-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lightbulb size={18} color="#10b981" />
                <h3 className="health-alerts-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--lux-text-primary)', fontSize: '1.1rem', fontWeight: 900 }}>
                    Intelligent Audit
                    <span style={{ 
                        fontSize: '10px', 
                        padding: '3px 10px', 
                        background: 'var(--gold-gradient)', 
                        color: '#fff', 
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        boxShadow: '0 4px 10px rgba(212, 175, 55, 0.3)'
                    }}>
                        <Sparkles size={11} /> God Mode
                    </span>
                </h3>

                {criticalCount > 0 && (
                    <span className="health-alerts-critical-badge" style={{ marginLeft: 'auto' }}>
                        {criticalCount} Critical
                    </span>
                )}
            </div>
            <div className="health-alerts-list">
                {alerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                ))}
            </div>
        </div>
    );
};

export default HealthAlerts;
