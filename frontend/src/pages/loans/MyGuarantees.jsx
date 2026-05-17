import { useEffect, useState, useCallback } from "react";
import { loanAPI } from "../../services/api";
import { toast } from "react-toastify";
import {
    ShieldCheck, ShieldX, Clock, CheckCircle2, XCircle,
    Building2, User, DollarSign, Calendar, AlertTriangle, ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../chama/core/ChamaDetailsLux.css";

const MyGuarantees = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [items, setItems] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [filter, setFilter] = useState("PENDING");

    const fetchGuarantees = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const res = await loanAPI.getMyGuarantees();
            const dataArray = res.data.data?.data || res.data.data || res.data || [];
            setItems(Array.isArray(dataArray) ? dataArray : []);
        } catch (err) {
            console.error(err);
            setError("Failed to load your guarantees");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGuarantees();
    }, [fetchGuarantees]);

    const handleRespond = async (loanId, decision) => {
        try {
            setActionLoading(`${loanId}-${decision}`);
            await loanAPI.respondGuarantor(loanId, decision);
            toast.success(decision === 'ACCEPT'
                ? "✅ You have accepted the guarantee request."
                : "Guarantee request declined."
            );
            await fetchGuarantees();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to process response");
        } finally {
            setActionLoading(null);
        }
    };

    const fmt = (amount) =>
        new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount || 0);

    const fmtDate = (d) => new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

    const filteredItems =
        filter === "ALL"
            ? items
            : items.filter((g) => g.guarantee_status === filter);

    const pendingCount = items.filter((g) => g.guarantee_status === "PENDING").length;

    const StatusBadge = ({ status }) => {
        const map = {
            PENDING:  { cls: "gm-badge-warn",    icon: <Clock size={12} />,         label: "Awaiting Your Response" },
            APPROVED: { cls: "gm-badge-success",  icon: <CheckCircle2 size={12} />,  label: "Accepted"  },
            REJECTED: { cls: "gm-badge-error",    icon: <XCircle size={12} />,       label: "Declined"  },
        };
        const s = map[status] || map.PENDING;
        return (
            <span className={`gm-badge ${s.cls}`}>
                {s.icon} {s.label}
            </span>
        );
    };

    return (
        <div className="manage-page-root">
            <div className="container">
                <div className="page-frame-lux" style={{ maxWidth: 860, margin: '0 auto' }}>
                    {/* Header */}
                    <div className="page-header-modern">
                        <button className="btn-return-lux" onClick={() => navigate(-1)} style={{ marginBottom: "1.5rem" }}>
                            <ArrowLeft size={18} /> <span>Back</span>
                        </button>
                        <div className="page-header-row">
                            <div className="page-header-info">
                                <div className="page-header-icon green">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h1>My Guarantees</h1>
                                    <p className="page-subtitle">
                                        {pendingCount > 0
                                            ? `You have ${pendingCount} pending guarantee request${pendingCount > 1 ? 's' : ''} that need your response.`
                                            : "Review loan guarantee requests from your group members."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                            <AlertTriangle size={16} /> {error}
                        </div>
                    )}

                    {/* INFO BOX */}
                    <div className="gm-info-box">
                        <ShieldCheck size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
                        <p>
                            When you <strong>accept</strong> a guarantee, you pledge your savings as security for the borrower.
                            If they default, your savings may be used to recover the loan.
                            Only accept if you fully trust the borrower.
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="filter-bar" style={{ marginBottom: "2rem", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {["PENDING", "APPROVED", "REJECTED", "ALL"].map(f => (
                            <button
                                key={f}
                                className={`filter-btn-lux ${filter === f ? "active" : ""}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === "ALL" ? "All" : f === "PENDING" ? "Pending" : f === "APPROVED" ? "Accepted" : "Declined"}
                                {" "}
                                ({f === "ALL" ? items.length : items.filter(g => g.guarantee_status === f).length})
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    {loading ? (
                        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
                            <div className="spinner" style={{ margin: "0 auto 1rem" }} />
                            <p className="text-muted">Loading guarantee requests…</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
                            <ShieldCheck size={48} style={{ color: "var(--border)", margin: "0 auto 1rem" }} />
                            <h3 style={{ marginBottom: "0.5rem" }}>No {filter !== "ALL" ? filter.toLowerCase() : ""} guarantees</h3>
                            <p className="text-muted">No guarantee requests match this filter.</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {filteredItems.map((g, idx) => (
                                <div
                                    key={`guarantee-${g.loan_id || idx}`}
                                    className={`card gm-card ${g.guarantee_status === "PENDING" ? "gm-card--pending" : ""}`}
                                >
                                    {/* Card Header */}
                                    <div className="gm-card-header">
                                        <div className="gm-card-title">
                                            <div className="gm-avatar">
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <strong>{g.borrower_name || "Member"}</strong>
                                                <div className="gm-sub">
                                                    <Building2 size={12} /> {g.chama_name || "Chama"}
                                                </div>
                                            </div>
                                        </div>
                                        <StatusBadge status={g.guarantee_status} />
                                    </div>

                                    {/* Loan Details */}
                                    <div className="gm-details-grid">
                                        <div className="gm-detail-item">
                                            <DollarSign size={14} className="gm-detail-icon" />
                                            <div>
                                                <span className="gm-detail-label">Loan Amount</span>
                                                <span className="gm-detail-value">{fmt(g.loan_amount)}</span>
                                            </div>
                                        </div>
                                        <div className="gm-detail-item">
                                            <ShieldCheck size={14} className="gm-detail-icon" />
                                            <div>
                                                <span className="gm-detail-label">Your Guarantee</span>
                                                <span className="gm-detail-value text-warning">{fmt(g.guarantee_amount)}</span>
                                            </div>
                                        </div>
                                        <div className="gm-detail-item">
                                            <Calendar size={14} className="gm-detail-icon" />
                                            <div>
                                                <span className="gm-detail-label">Repayment Period</span>
                                                <span className="gm-detail-value">{g.term_months || "–"} months</span>
                                            </div>
                                        </div>
                                        <div className="gm-detail-item">
                                            <DollarSign size={14} className="gm-detail-icon" />
                                            <div>
                                                <span className="gm-detail-label">Monthly Payment</span>
                                                <span className="gm-detail-value">{fmt(g.monthly_payment)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Purpose */}
                                    {g.purpose && (
                                        <div className="gm-purpose">
                                            <strong>Purpose: </strong>{g.purpose}
                                        </div>
                                    )}

                                    {/* Date */}
                                    <div className="gm-meta">
                                        Requested on {fmtDate(g.created_at)}
                                    </div>

                                    {/* Action Buttons — only if PENDING */}
                                    {g.guarantee_status === "PENDING" && (
                                        <div className="gm-actions">
                                            <button
                                                className="btn btn-success"
                                                onClick={() => handleRespond(g.loan_id, "ACCEPT")}
                                                disabled={actionLoading !== null}
                                                style={{ flex: 1 }}
                                            >
                                                {actionLoading === `${g.loan_id}-ACCEPT`
                                                    ? <><span className="lw-spinner" /> Accepting…</>
                                                    : <><ShieldCheck size={16} /> Accept Guarantee</>
                                                }
                                            </button>
                                            <button
                                                className="btn btn-outline btn-danger-outline"
                                                onClick={() => handleRespond(g.loan_id, "REJECT")}
                                                disabled={actionLoading !== null}
                                                style={{ flex: 1 }}
                                            >
                                                {actionLoading === `${g.loan_id}-REJECT`
                                                    ? <><span className="lw-spinner" /> Declining…</>
                                                    : <><ShieldX size={16} /> Decline</>
                                                }
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .gm-info-box {
                    display: flex; gap: 1.25rem; align-items: flex-start;
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%);
                    border: 1.5px solid rgba(16, 185, 129, 0.3);
                    border-radius: 20px; padding: 1.5rem; margin-bottom: 2rem;
                    font-size: 0.95rem; color: var(--text-primary);
                    box-shadow: 0 10px 30px rgba(16, 185, 129, 0.05);
                }
                .gm-card {
                    background: var(--lux-card-bg, var(--bg-surface-glass));
                    backdrop-filter: blur(24px);
                    border: 1.5px solid var(--lux-border, var(--border));
                    border-radius: 24px;
                    padding: 1.8rem 2rem;
                    transition: all 0.3s ease;
                    box-shadow: 0 15px 40px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.1);
                }
                [data-theme='dark'] .gm-card {
                    box-shadow: 0 15px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
                }
                .gm-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.2);
                }
                .gm-card--pending {
                    border-color: rgba(245, 158, 11, 0.5);
                    box-shadow: 0 0 25px rgba(245, 158, 11, 0.15), inset 0 1px 0 rgba(255,255,255,0.1);
                }
                .gm-card-header {
                    display: flex; align-items: flex-start;
                    justify-content: space-between; gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .gm-card-title {
                    display: flex; align-items: center; gap: 1rem;
                }
                .gm-avatar {
                    width: 48px; height: 48px; border-radius: 16px;
                    background: linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(212, 175, 55, 0.05) 100%);
                    border: 1px solid rgba(212, 175, 55, 0.3);
                    display: flex; align-items: center; justify-content: center;
                    color: var(--lux-gold, #D4AF37); flex-shrink: 0;
                    box-shadow: 0 8px 20px rgba(212, 175, 55, 0.15);
                }
                .gm-sub {
                    display: flex; align-items: center; gap: 0.4rem;
                    font-size: 0.85rem; color: var(--gray); margin-top: 0.2rem;
                    font-weight: 600;
                }
                .gm-badge {
                    display: inline-flex; align-items: center; gap: 0.4rem;
                    padding: 0.5rem 1rem; border-radius: 999px;
                    font-size: 0.8rem; font-weight: 800; white-space: nowrap;
                    backdrop-filter: blur(8px);
                }
                .gm-badge-warn    { background: rgba(245, 158, 11, 0.15); color: #D97706; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1); }
                .gm-badge-success { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1); }
                .gm-badge-error   { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1); }
                .gm-details-grid {
                    display: grid; grid-template-columns: 1fr 1fr;
                    gap: 1rem; margin-bottom: 1.25rem;
                }
                @media(min-width: 600px) { .gm-details-grid { grid-template-columns: repeat(4,1fr); } }
                .gm-detail-item {
                    display: flex; align-items: flex-start; gap: 0.75rem;
                    background: var(--lux-bg-soft, var(--surface-2)); border: 1.5px solid var(--lux-border, var(--border));
                    border-radius: 16px; padding: 1rem;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                }
                .gm-detail-icon { color: var(--lux-gold, #D4AF37); margin-top: 0.1rem; flex-shrink: 0; }
                .gm-detail-label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray); margin-bottom: 0.25rem; font-weight: 800; }
                .gm-detail-value { display: block; font-size: 1.1rem; font-weight: 900; color: var(--text-primary); }
                .text-warning { color: var(--lux-gold, #D4AF37) !important; text-shadow: 0 2px 8px rgba(212, 175, 55, 0.2); }
                .gm-purpose {
                    font-size: 0.95rem; color: var(--text-secondary);
                    background: var(--lux-bg-soft, var(--surface-2));
                    border: 1.5px solid var(--lux-border, var(--border));
                    border-radius: 16px; padding: 1rem 1.25rem; margin-bottom: 1.25rem;
                    line-height: 1.6;
                }
                .gm-meta {
                    font-size: 0.85rem; color: var(--gray); margin-bottom: 1.5rem;
                    font-weight: 600;
                }
                .gm-actions {
                    display: flex; gap: 1rem; flex-wrap: wrap;
                    padding-top: 1.25rem; border-top: 1.5px solid var(--lux-border, var(--border));
                }
                .gm-actions .btn-success {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white; border: none; padding: 1rem 1.5rem;
                    border-radius: 16px; font-weight: 800; font-size: 1rem;
                    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
                    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
                    transition: all 0.2s; cursor: pointer;
                }
                .gm-actions .btn-success:hover {
                    transform: translateY(-2px); box-shadow: 0 15px 35px rgba(16, 185, 129, 0.4);
                }
                .gm-actions .btn-danger-outline {
                    background: transparent; border: 1.5px solid #EF4444;
                    color: #EF4444; padding: 1rem 1.5rem;
                    border-radius: 16px; font-weight: 800; font-size: 1rem;
                    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
                    transition: all 0.2s; cursor: pointer;
                }
                .gm-actions .btn-danger-outline:hover {
                    background: rgba(239, 68, 68, 0.1); border-color: #DC2626; color: #DC2626;
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
};

export default MyGuarantees;
