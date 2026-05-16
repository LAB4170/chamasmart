import { useState, useEffect, useCallback } from "react";
import { scoreAPI } from "../../../services/utils.service";
import { RefreshCw, TrendingUp, Award } from "lucide-react";
import "./ChamaCredit.css";

// Helper to get a tier's visual props
const TIER_CONFIG = {
    EXCELLENT: { label: "Elite Status", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", ring: "#10b981" },
    GOOD:      { label: "Prime Health",      color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", ring: "#3b82f6" },
    FAIR:      { label: "Standard",      color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", ring: "#f59e0b" },
    AT_RISK:   { label: "Critical Risk",   color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", ring: "#ef4444" },
};

// Circular SVG gauge
function ScoreGauge({ score, tier }) {
    const cfg = TIER_CONFIG[tier] || TIER_CONFIG.FAIR;
    const radius = 72;
    const circumference = 2 * Math.PI * radius;
    const filled = (score / 100) * circumference;

    return (
        <div className="credit-gauge-wrapper">
            <svg width="180" height="180" viewBox="0 0 180 180">
                {/* Track */}
                <circle cx="90" cy="90" r={radius} fill="none" stroke="var(--lux-bg-soft)" strokeWidth="14" />
                {/* Progress */}
                <circle
                    cx="90" cy="90" r={radius}
                    fill="none"
                    stroke={cfg.ring}
                    strokeWidth="14"
                    strokeDasharray={`${filled} ${circumference}`}
                    strokeLinecap="round"
                    transform="rotate(-90 90 90)"
                    style={{ 
                        transition: "stroke-dasharray 1.5s cubic-bezier(0.4, 0, 0.2, 1)", 
                        filter: `drop-shadow(0 0 12px ${cfg.ring}60)` 
                    }}
                />
                {/* Score text */}
                <text x="90" y="85" textAnchor="middle" fontSize="48" fontWeight="900" fill="var(--lux-text-primary)" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {score}
                </text>
                <text x="90" y="110" textAnchor="middle" fontSize="10" fill="var(--lux-text-secondary)" fontWeight="900" style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                    Elite Index
                </text>
            </svg>
        </div>
    );
}

// Dimension bar
function DimensionBar({ label, score, weight, color }) {
    return (
        <div className="dimension-item" style={{ marginBottom: '1rem' }}>
            <div className="dimension-header" style={{ marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="dimension-label" style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <span className="dimension-score" style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--lux-text-primary)' }}>{score}%</span>
            </div>
            <div className="dimension-track" style={{ height: '8px', background: 'var(--lux-card-bg)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--lux-border)' }}>
                <div
                    className="dimension-fill"
                    style={{
                        height: '100%',
                        width: `${score}%`,
                        background: `linear-gradient(90deg, ${color || '#d4af37'}, ${color || '#fcd34d'})`,
                        transition: "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
                        boxShadow: `0 0 10px ${color || '#d4af37'}40`
                    }}
                />
            </div>
        </div>
    );
}

// Sparkline using SVG polyline
function Sparkline({ history }) {
    if (!history || history.length < 2) return null;
    const scores = history.map(h => h.composite_score);
    const max = Math.max(...scores, 100);
    const min = Math.min(...scores, 0);
    const W = 120, H = 28;
    const pts = scores.map((s, i) => {
        const x = (i / (scores.length - 1)) * W;
        const y = H - ((s - min) / (max - min + 1)) * H;
        return `${x},${y}`;
    }).join(" ");

    const last = scores[scores.length - 1];
    const prev = scores[scores.length - 2];
    const up = last >= prev;

    return (
        <div className="sparkline-wrapper">
            <TrendingUp size={12} color={up ? "#10b981" : "#ef4444"} />
            <svg width={W} height={H}>
                <polyline
                    points={pts}
                    fill="none"
                    stroke={up ? "#10b981" : "#ef4444"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
            <span style={{ fontSize: "0.65rem", color: up ? "#10b981" : "#ef4444" }}>
                {up ? "▲" : "▼"} {Math.abs(last - prev)}pts
            </span>
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────
const ChamaCreditScore = ({ chamaId }) => {
    const [scoreData, setScoreData] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchScore = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const [scoreRes, histRes] = await Promise.all([
                scoreAPI.getScore(chamaId),
                scoreAPI.getHistory(chamaId),
            ]);
            setScoreData(scoreRes.data.data);
            setHistory(histRes.data.data || []);
        } catch (err) {
            console.error("Failed to fetch chama score", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [chamaId]);

    useEffect(() => { fetchScore(); }, [fetchScore]);

    if (loading) {
        return (
            <div className="credit-score-card credit-loading">
                <RefreshCw className="animate-spin" size={28} color="#10b981" />
                <p>Computing Health Score…</p>
            </div>
        );
    }

    if (!scoreData) return null;

    const { compositeScore, tier, breakdown, computedAt } = scoreData;
    const cfg = TIER_CONFIG[tier] || TIER_CONFIG.FAIR;

    return (
        <div className="credit-score-card">
            {/* Header */}
            <div className="credit-header">
                <div className="credit-title-group">
                    <Award size={20} color="#10b981" />
                    <h3 className="credit-title">Chama Health Score</h3>
                </div>
                <button
                    onClick={() => fetchScore(true)}
                    className="credit-refresh-btn"
                    disabled={refreshing}
                    title="Recompute score"
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                </button>
            </div>

            {/* Gauge + Tier */}
            <div className="credit-gauge-section">
                <ScoreGauge score={compositeScore} tier={tier} />
                <div className="credit-tier-info">
                    <span
                        className="credit-tier-badge"
                        style={{ background: cfg.bg, color: cfg.color, border: `1.5px solid ${cfg.color}` }}
                    >
                        {cfg.label}
                    </span>
                    <Sparkline history={history} />
                    <p className="credit-computed-at">
                        Updated {new Date(computedAt).toLocaleTimeString()}
                    </p>
                </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="credit-dimensions">
                {Object.values(breakdown).map(dim => (
                    <DimensionBar
                        key={dim.label}
                        label={dim.label}
                        score={dim.score}
                        weight={dim.weight}
                    />
                ))}
            </div>
        </div>
    );
};

export default ChamaCreditScore;
