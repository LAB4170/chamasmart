import { useEffect, useState, useCallback } from "react";
import { loanAPI } from "../../services/api";
import { toast } from "react-toastify";
import {
    ShieldCheck, ShieldX, Clock, CheckCircle2, XCircle,
    Building2, User, DollarSign, Calendar, AlertTriangle, ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
        <div className="page">
            <div className="container" style={{ maxWidth: 860 }}>
                {/* Header */}
                <div className="page-header-modern">
                    <button className="back-link" onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                        <ArrowLeft size={16} /> Back
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
                <div className="filter-bar" style={{ marginBottom: "1.5rem" }}>
                    {["PENDING", "APPROVED", "REJECTED", "ALL"].map(f => (
                        <button
                            key={f}
                            className={`filter-btn ${filter === f ? "active" : ""}`}
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
                                key={g.loan_id || idx}
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

            <style>{`
                .gm-info-box {
                    display: flex; gap: 0.75rem; align-items: flex-start;
                    background: var(--primary-light, #EEF2FF); border: 1px solid var(--primary-border, #C7D2FE);
                    border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 1.5rem;
                    font-size: 0.9rem; color: var(--text-secondary);
                }
                .gm-card {
                    border: 1px solid var(--border); border-radius: 14px;
                    padding: 1.25rem; transition: box-shadow 0.2s;
                }
                .gm-card--pending {
                    border-color: #F59E0B;
                    box-shadow: 0 0 0 3px rgba(245,158,11,0.1);
                }
                .gm-card-header {
                    display: flex; align-items: flex-start;
                    justify-content: space-between; gap: 1rem;
                    margin-bottom: 1rem;
                }
                .gm-card-title {
                    display: flex; align-items: center; gap: 0.75rem;
                }
                .gm-avatar {
                    width: 40px; height: 40px; border-radius: 50%;
                    background: var(--primary-light, #EEF2FF);
                    display: flex; align-items: center; justify-content: center;
                    color: var(--primary); flex-shrink: 0;
                }
                .gm-sub {
                    display: flex; align-items: center; gap: 0.3rem;
                    font-size: 0.8rem; color: var(--text-muted); margin-top: 0.1rem;
                }
                .gm-badge {
                    display: inline-flex; align-items: center; gap: 0.3rem;
                    padding: 0.3rem 0.7rem; border-radius: 999px;
                    font-size: 0.75rem; font-weight: 700; white-space: nowrap;
                }
                .gm-badge-warn    { background: #FEF3C7; color: #92400E; }
                .gm-badge-success { background: #D1FAE5; color: #065F46; }
                .gm-badge-error   { background: #FEE2E2; color: #991B1B; }
                .gm-details-grid {
                    display: grid; grid-template-columns: 1fr 1fr;
                    gap: 0.75rem; margin-bottom: 0.9rem;
                }
                @media(min-width: 600px) { .gm-details-grid { grid-template-columns: repeat(4,1fr); } }
                .gm-detail-item {
                    display: flex; align-items: flex-start; gap: 0.5rem;
                    background: var(--surface-2, var(--bg-card)); border: 1px solid var(--border);
                    border-radius: 8px; padding: 0.6rem 0.75rem;
                }
                .gm-detail-icon { color: var(--text-muted); margin-top: 0.1rem; flex-shrink: 0; }
                .gm-detail-label { display: block; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.15rem; }
                .gm-detail-value { display: block; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
                .text-warning { color: #D97706 !important; }
                .gm-purpose {
                    font-size: 0.88rem; color: var(--text-secondary);
                    background: var(--surface-2, var(--bg-card));
                    border-radius: 8px; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem;
                }
                .gm-meta {
                    font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.9rem;
                }
                .gm-actions {
                    display: flex; gap: 0.75rem; flex-wrap: wrap;
                }
                .btn-danger-outline {
                    border-color: #EF4444; color: #EF4444;
                }
                .btn-danger-outline:hover {
                    background: #FEF2F2; border-color: #DC2626; color: #DC2626;
                }
            `}</style>
        </div>
    );
};

export default MyGuarantees;
