import { useState, useEffect, useCallback } from "react";
import { scoreAPI } from "../../../services/utils.service";
import { AlertTriangle, Info, Lightbulb, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const SEVERITY_CONFIG = {
    CRITICAL: {
        icon: <AlertTriangle size={18} />,
        color: "#ef4444",
        bg: "#fef2f2",
        border: "#fecaca",
        label: "Critical",
    },
    WARNING: {
        icon: <Info size={18} />,
        color: "#f59e0b",
        bg: "#fffbeb",
        border: "#fde68a",
        label: "Warning",
    },
    TIP: {
        icon: <Lightbulb size={18} />,
        color: "#3b82f6",
        bg: "#eff6ff",
        border: "#bfdbfe",
        label: "Tip",
    },
};

function AlertCard({ alert }) {
    const [open, setOpen] = useState(alert.severity === "CRITICAL");
    const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.TIP;

    return (
        <div
            className="health-alert-card"
            style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}` }}
        >
            <button
                className="health-alert-header"
                onClick={() => setOpen((o) => !o)}
                style={{ borderBottom: open ? `1px solid ${cfg.border}` : "none" }}
            >
                <span className="health-alert-icon" style={{ color: cfg.color }}>
                    <span style={{ fontSize: "16px", marginRight: "6px" }}>{alert.icon}</span> 
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
                        <strong>Next step:</strong> {alert.action}
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
                <h3 className="health-alerts-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    AI Financial Health Coach
                    <span style={{ 
                        fontSize: '11px', 
                        padding: '2px 8px', 
                        background: 'linear-gradient(90deg, #10b981, #0ea5e9)', 
                        color: 'white', 
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: '500'
                    }}>
                        <Sparkles size={10} /> Powered by Groq AI
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
