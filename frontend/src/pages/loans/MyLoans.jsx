import { useEffect, useState, useCallback } from "react";
import { loanAPI } from "../../services/api";
import { toast } from "react-toastify";
import {
    Banknote, Clock, CheckCircle2, XCircle,
    Building2, DollarSign, Calendar, AlertTriangle, ArrowLeft,
    TrendingUp, ArrowUpRight, ArrowDownRight, LayoutDashboard
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

import "./MyLoans.css";

const MyLoans = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [loans, setLoans] = useState([]);
    const [summary, setSummary] = useState(null);
    const [filter, setFilter] = useState("ACTIVE");

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const [loansRes, summaryRes] = await Promise.all([
                loanAPI.getUserLoans(),
                loanAPI.getUnifiedSummary()
            ]);
            
            const rawData = loansRes.data.data || loansRes.data;
            const loansData = Array.isArray(rawData) ? rawData : (rawData?.loans || []);
            setLoans(loansData);
            setSummary(summaryRes.data.data || summaryRes.data || null);
        } catch (err) {
            console.error(err);
            setError("Failed to load your loan portfolio");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fmt = (amount) =>
        new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount || 0);

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "-";

    const filteredLoans = filter === "ALL" 
        ? loans 
        : loans.filter(l => {
            if (filter === "ACTIVE") return ["APPROVED", "DISBURSED", "DEFAULTED"].includes(l.status);
            if (filter === "PENDING") return l.status === "PENDING";
            if (filter === "PAID") return l.status === "COMPLETED" || l.status === "PAID_OFF";
            return l.status === filter;
        });

    const getStatusBadge = (status) => {
        const map = {
            PENDING:  { cls: "gm-badge-warn",    icon: <Clock size={12} />,         label: "Pending Review" },
            APPROVED: { cls: "gm-badge-info",    icon: <CheckCircle2 size={12} />,  label: "Approved" },
            DISBURSED:{ cls: "gm-badge-success", icon: <TrendingUp size={12} />,     label: "Active" },
            COMPLETED:{ cls: "gm-badge-primary", icon: <CheckCircle2 size={12} />,  label: "Paid Off" },
            DEFAULTED:{ cls: "gm-badge-error",   icon: <AlertTriangle size={12} />, label: "Defaulted" },
            REJECTED: { cls: "gm-badge-error",   icon: <XCircle size={12} />,       label: "Rejected" },
        };
        const s = map[status] || { cls: "gm-badge-secondary", icon: <Clock size={12} />, label: status };
        return (
            <span className={`gm-badge ${s.cls}`}>
                {s.icon} {s.label}
            </span>
        );
    };

    return (
        <div className="page">
            <div className="container">
                {/* Header */}
                <div className="page-header-modern">
                    <button className="back-link" onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="page-header-row">
                        <div className="page-header-info">
                            <div className="page-header-icon amber">
                                <Banknote size={24} />
                            </div>
                            <div>
                                <h1>Loan Management</h1>
                                <p className="page-subtitle">Manage all your active borrowings across different Chamas.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                {/* Summary Stats */}
                {!loading && summary && (
                    <div className="stats-row" style={{ marginBottom: "2.5rem" }}>
                        <motion.div 
                            className="mini-stat-card-lux"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div className="stat-icon-circle blue">
                                <TrendingUp size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-label">Total Debt</div>
                                <div className="stat-value">{fmt(summary.total_active_debt)}</div>
                                <div className="stat-sub-label">Across all chamas</div>
                            </div>
                        </motion.div>

                        <motion.div 
                            className="mini-stat-card-lux"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="stat-icon-circle green">
                                <ArrowDownRight size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-label">Total Repaid</div>
                                <div className="stat-value">{fmt(summary.total_repaid || 0)}</div>
                                <div className="stat-sub-label">Historical total</div>
                            </div>
                        </motion.div>

                        <motion.div 
                            className="mini-stat-card-lux"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="stat-icon-circle amber">
                                <LayoutDashboard size={20} />
                            </div>
                            <div className="stat-content">
                                <div className="stat-label">Active Loans</div>
                                <div className="stat-value">{summary.active_loans_count}</div>
                                <div className="stat-sub-label">Ongoing repayments</div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Filters */}
                <div className="filter-bar" style={{ marginBottom: "1.5rem" }}>
                    {[
                        { id: "ACTIVE", label: "Active" },
                        { id: "PENDING", label: "Pending" },
                        { id: "PAID", label: "Completed" },
                        { id: "ALL", label: "All History" }
                    ].map(f => (
                        <button
                            key={f.id}
                            className={`filter-btn ${filter === f.id ? "active" : ""}`}
                            onClick={() => setFilter(f.id)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="loading-state-lux">
                        <div className="spinner" />
                        <p>Loading your loan portfolio...</p>
                    </div>
                ) : filteredLoans.length === 0 ? (
                    <div className="empty-state-lux">
                        <Banknote size={64} className="empty-icon" />
                        <h3>No {filter !== "ALL" ? filter.toLowerCase() : ""} loans found</h3>
                        <p>You don't have any loans matching this criteria.</p>
                        <Link to="/browse-chamas" className="btn-action-primary" style={{ marginTop: "1.5rem" }}>
                            Explore Chamas
                        </Link>
                    </div>
                ) : (
                    <div className="loan-grid-lux">
                        {filteredLoans.map((loan, idx) => (
                            <motion.div
                                key={`loan-${String(loan.loan_id || idx)}`}
                                className="loan-card-lux"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <div className="loan-card-header">
                                    <div className="loan-chama-info">
                                        <div className="loan-avatar">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <h3>{loan.chama_name}</h3>
                                            <span className="loan-purpose">{loan.purpose || "General Purpose"}</span>
                                        </div>
                                    </div>
                                    {getStatusBadge(loan.status)}
                                </div>

                                <div className="loan-stats-grid">
                                    <div className="loan-stat-item">
                                        <span className="label">Borrowed</span>
                                        <span className="value">{fmt(loan.loan_amount)}</span>
                                    </div>
                                    <div className="loan-stat-item">
                                        <span className="label">Remaining</span>
                                        <span className="value balance">{fmt(loan.balance || 0)}</span>
                                    </div>
                                    <div className="loan-stat-item">
                                        <span className="label">Interest</span>
                                        <span className="value">{loan.interest_rate}%</span>
                                    </div>
                                    <div className="loan-stat-item">
                                        <span className="label">Due Date</span>
                                        <span className="value date">{fmtDate(loan.due_date)}</span>
                                    </div>
                                </div>

                                <div className="loan-progress-area">
                                    <div className="progress-header">
                                        <span>Repayment Progress</span>
                                        <span>{((parseFloat(loan.amount_paid || 0) / parseFloat(loan.total_repayable)) * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="progress-bar-bg">
                                        <div 
                                            className="progress-bar-fill" 
                                            style={{ width: `${(parseFloat(loan.amount_paid || 0) / parseFloat(loan.total_repayable)) * 100}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="loan-card-actions">
                                    <Link to={`/chamas/${loan.chama_id}/loans`} className="btn-secondary-lux">
                                        View Details
                                    </Link>
                                    {(loan.status === "APPROVED" || loan.status === "DISBURSED" || loan.status === "DEFAULTED") && (
                                        <Link to={`/chamas/${loan.chama_id}/loans/${loan.loan_id}/repay`} className="btn-primary-lux">
                                            Repay Now
                                        </Link>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyLoans;
