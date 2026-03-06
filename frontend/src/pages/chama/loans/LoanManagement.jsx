import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { loanAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import ConfirmDialog from "../../../components/ConfirmDialog";
import LoanAnalyticsDashboard from "./LoanAnalyticsDashboard";
import {
    ArrowLeft, Plus, BarChart2, Clock, CheckCircle2, Wallet,
    AlertCircle, FileText, X, Check, DollarSign, Calendar
} from "lucide-react";
import { toast } from "react-toastify";

const LoanManagement = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [loans, setLoans] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("ALL");
    const [activeTab, setActiveTab] = useState("LOANS");
    const [actionLoading, setActionLoading] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [loanDetails, setLoanDetails] = useState(null);

    // Dialog state
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [loanToReject, setLoanToReject] = useState(null);
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                if (isMounted) setLoading(true);
                const [chamaRes, loansRes, membersRes] = await Promise.all([
                    chamaAPI.getById(id),
                    loanAPI.getChamaLoans(id),
                    chamaAPI.getMembers(id),
                ]);

                if (isMounted) {
                    setChama(chamaRes.data.data || chamaRes.data);
                    const loansData = loansRes.data.data;
                    setLoans(Array.isArray(loansData) ? loansData : (loansData?.loans || []));
                    setMembers(membersRes.data.data || membersRes.data);
                }
            } catch (err) {
                if (isMounted) {
                    setError("Failed to load loan data");
                    console.error(err);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [id]);

    const handleApproveLoan = async (loanId) => {
        try {
            setActionLoading(loanId);
            const res = await loanAPI.approve(id, loanId);
            
            if (res.data?.message?.includes("already approved")) {
                toast.info("This loan was already approved.");
            } else {
                toast.success("Loan approved successfully!");
            }

            // Refresh data
            const loansRes = await loanAPI.getChamaLoans(id);
            const loansData = loansRes.data.data;
            setLoans(Array.isArray(loansData) ? loansData : (loansData?.loans || []));
            setActionLoading(null);
        } catch (err) {
            console.error(err);
            const message = err.response?.data?.message || "Failed to approve loan";
            
            if (err.response?.status === 403) {
                toast.error(`Security Block: ${message}`, { autoClose: 6000 });
            } else {
                toast.error(message);
            }
            
            setActionLoading(null);
        }
    };

    const initiateRejectLoan = (loanId) => {
        setLoanToReject(loanId);
        setRejectReason("");
        setRejectDialogOpen(true);
    };

    const handleConfirmReject = async () => {
        if (!loanToReject || !rejectReason.trim()) return;

        try {
            setActionLoading(loanToReject);
            setRejectDialogOpen(false);
            await loanAPI.reject(id, loanToReject, rejectReason);
            toast.success("Loan rejected successfully.");
            // Refresh data
            const loansRes = await loanAPI.getChamaLoans(id);
            const loansData2 = loansRes.data.data;
            setLoans(Array.isArray(loansData2) ? loansData2 : (loansData2?.loans || []));
            setActionLoading(null);
            setLoanToReject(null);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to reject loan");
            setActionLoading(null);
        }
    };

    const getUserRole = () => {
        const member = members.find((m) => m.user_id === user?.id);
        return member?.role || "MEMBER";
    };

    const isOfficial = () => {
        const role = getUserRole();
        return ["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(role);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount);
    };

    const openLoanDetails = async (loan) => {
        try {
            setSelectedLoan(loan);
            setDetailsLoading(true);
            const res = await loanAPI.getLoanById(id, loan.loan_id);
            setLoanDetails(res.data.data || res.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to load loan details");
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeLoanDetails = () => {
        setSelectedLoan(null);
        setLoanDetails(null);
    };

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleDateString("en-KE", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const getStatusBadge = (status) => {
        const normalized = status || "";
        const badges = {
            PENDING: "badge-warning",
            APPROVED: "badge-info",
            DISBURSED: "badge-success",
            COMPLETED: "badge-primary",
            DEFAULTED: "badge-error",
            REJECTED: "badge-error",
            CANCELLED: "badge-secondary",
        };
        return badges[normalized] || "badge-secondary";
    };

    const normalizedStatus = (status) => {
        if (!status) return "UNKNOWN";
        if (status === "PENDING") return "AWAITING REVIEW";
        if (status === "APPROVED") return "APPROVED";
        if (status === "DISBURSED") return "ACTIVE";
        if (status === "COMPLETED") return "PAID OFF";
        if (status === "DEFAULTED") return "DEFAULTED";
        if (status === "REJECTED") return "REJECTED";
        return status;
    };

    const filteredLoans =
        filter === "ALL"
            ? loans
            : loans.filter((l) => {
                if (filter === "PENDING") {
                    return l.status === "PENDING";
                }
                if (filter === "ACTIVE") {
                    return ["APPROVED", "DISBURSED", "DEFAULTED"].includes(l.status);
                }
                if (filter === "PAID") {
                    return ["COMPLETED", "PAID_OFF"].includes(l.status);
                }
                return l.status === filter;
            });

    const stats = {
        total: loans.length,
        pending: loans.filter((l) => l.status === "PENDING").length,
        active: loans.filter((l) => ["APPROVED", "DISBURSED", "DEFAULTED"].includes(l.status)).length,
        totalAmount: loans
            .filter((l) => ["APPROVED", "DISBURSED", "DEFAULTED"].includes(l.status))
            .reduce((sum, l) => sum + parseFloat(l.loan_amount || 0), 0),
    };

    if (loading) {
        return <div className="loading-spinner">Loading loans...</div>;
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header-modern">
                    <Link to={`/chamas/${id}`} className="back-link">
                        <ArrowLeft size={18} />
                        <span>Back to Chama</span>
                    </Link>
                    <div className="page-header-row">
                        <div className="page-header-info">
                            <div className="page-header-icon amber">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h1>Loan Management</h1>
                                <p className="page-subtitle">{chama?.chama_name}</p>
                            </div>
                        </div>
                        <Link to={`/chamas/${id}/loans/apply`} className="btn-action-primary">
                            <Plus size={18} />
                            <span>Apply for Loan</span>
                        </Link>
                    </div>
                </div>

                {isOfficial() && (
                    <div style={{
                        display: 'inline-flex',
                        background: 'var(--surface-5)',
                        border: '1px solid var(--border)',
                        padding: '0.4rem',
                        borderRadius: '999px',
                        marginBottom: '2rem',
                        gap: '0.5rem',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <button 
                            onClick={() => setActiveTab('LOANS')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.6rem 1.25rem',
                                borderRadius: '999px',
                                fontSize: '0.875rem',
                                fontWeight: 800,
                                transition: 'all 0.3s ease',
                                border: 'none',
                                cursor: 'pointer',
                                background: activeTab === 'LOANS' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'LOANS' ? '#fff' : 'var(--text-secondary)',
                                boxShadow: activeTab === 'LOANS' ? 'var(--shadow-md)' : 'none'
                            }}
                        >
                            <Wallet size={16} /> Active Loans
                        </button>
                        <button 
                            onClick={() => setActiveTab('DASHBOARD')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.6rem 1.25rem',
                                borderRadius: '999px',
                                fontSize: '0.875rem',
                                fontWeight: 800,
                                transition: 'all 0.3s ease',
                                border: 'none',
                                cursor: 'pointer',
                                background: activeTab === 'DASHBOARD' ? '#2563eb' : 'transparent',
                                color: activeTab === 'DASHBOARD' ? '#ffffff' : 'var(--text-secondary)',
                                boxShadow: activeTab === 'DASHBOARD' ? 'var(--shadow-md)' : 'none'
                            }}
                        >
                            <BarChart2 size={16} /> Loan Analytics
                        </button>
                    </div>
                )}

                {activeTab === 'DASHBOARD' && isOfficial() ? (
                    <LoanAnalyticsDashboard chamaId={id} />
                ) : (
                    <>
                        {/* Stats - Only visible in Loans tab */}
                        <div className="stats-row">
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon blue">
                            <BarChart2 size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{stats.total}</div>
                            <div className="mini-stat-label">Total Loans</div>
                        </div>
                    </div>
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon amber">
                            <Clock size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{stats.pending}</div>
                            <div className="mini-stat-label">Pending Approval</div>
                        </div>
                    </div>
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon green">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{stats.active}</div>
                            <div className="mini-stat-label">Active Loans</div>
                        </div>
                    </div>
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon purple">
                            <Wallet size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{formatCurrency(stats.totalAmount)}</div>
                            <div className="mini-stat-label">Total Loaned</div>
                        </div>
                    </div>
                </div>
                </>
                )}

                {/* Filter */}
                <div className="filter-bar">
                    <button
                        className={`filter-btn ${filter === "ALL" ? "active" : ""}`}
                        onClick={() => setFilter("ALL")}
                    >
                        All ({loans.length})
                    </button>
                    <button
                        className={`filter-btn ${filter === "PENDING" ? "active" : ""}`}
                        onClick={() => setFilter("PENDING")}
                    >
                        Pending ({loans.filter((l) => l.status === "PENDING").length})
                    </button>
                    <button
                        className={`filter-btn ${filter === "ACTIVE" ? "active" : ""}`}
                        onClick={() => setFilter("ACTIVE")}
                    >
                        Active ({loans.filter((l) => ["APPROVED", "DISBURSED"].includes(l.status)).length})
                    </button>
                    <button
                        className={`filter-btn ${filter === "PAID" ? "active" : ""}`}
                        onClick={() => setFilter("PAID")}
                    >
                        Paid ({loans.filter((l) => ["COMPLETED", "PAID_OFF"].includes(l.status)).length})
                    </button>
                </div>

                {/* Loans List */}
                <div className="card-modern">
                    <div className="card-header">
                        <h3>Loans</h3>
                    </div>

                    {filteredLoans.length === 0 ? (
                        <div className="empty-state-modern compact">
                            <div className="empty-state-icon">
                                <FileText size={36} strokeWidth={1.5} />
                            </div>
                            <h3>No loans found</h3>
                            <p>There are no loans matching your current filter.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Borrower</th>
                                        <th>Amount</th>
                                        <th>Interest</th>
                                        <th>Total Repayable</th>
                                        <th>Paid</th>
                                        <th>Due Date</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLoans.map((loan) => (
                                        <tr key={loan.loan_id}>
                                            <td>
                                                <strong>{loan.borrower_name}</strong>
                                                {loan.purpose && (
                                                    <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                                                        {loan.purpose}
                                                    </div>
                                                )}
                                            </td>
                                            <td>{formatCurrency(loan.loan_amount)}</td>
                                            <td>{loan.interest_rate}%</td>
                                            <td className="text-success">
                                                {formatCurrency(loan.total_repayable)}
                                            </td>
                                            <td>
                                                {formatCurrency(loan.amount_paid || 0)}
                                                <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                                                    {((parseFloat(loan.amount_paid || 0) / parseFloat(loan.total_repayable)) * 100).toFixed(0)}%
                                                </div>
                                            </td>
                                            <td>{formatDate(loan.due_date)}</td>
                                            <td>
                                                <span className={`badge ${getStatusBadge(loan.status)}`}>
                                                    {normalizedStatus(loan.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: "0.5rem", flexWrap: 'wrap' }}>
                                                    <button
                                                        className="btn btn-sm btn-outline"
                                                        onClick={() => openLoanDetails(loan)}
                                                    >
                                                        Details
                                                    </button>
                                                    {loan.status === "PENDING" && isOfficial() && (
                                                        <>
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                onClick={() => handleApproveLoan(loan.loan_id)}
                                                                disabled={actionLoading === loan.loan_id}
                                                                title="Approve"
                                                            >
                                                                {actionLoading === loan.loan_id ? "..." : <Check size={14} />}
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => initiateRejectLoan(loan.loan_id)}
                                                                disabled={actionLoading === loan.loan_id}
                                                                title="Reject"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {(loan.is_borrower && ["APPROVED", "DISBURSED", "DEFAULTED"].includes(loan.status)) || 
                                                     (loan.is_guarantor && loan.status === "DEFAULTED") ? (
                                                        <Link
                                                            to={`/chamas/${id}/loans/${loan.loan_id}/repay`}
                                                            className={`btn btn-sm ${loan.status === "DEFAULTED" ? "btn-danger" : "btn-primary"}`}
                                                            title={loan.is_guarantor ? "Settle Defaulted Loan" : "Make Repayment"}
                                                        >
                                                            {loan.is_guarantor ? "Settle Liability" : "Repay"}
                                                        </Link>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            {/* Loan Details Modal */}
            {selectedLoan && loanDetails && (
                <div className="modal-backdrop" onClick={closeLoanDetails}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Loan Details</h3>
                            <button className="btn-icon" onClick={closeLoanDetails}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {detailsLoading ? (
                                <div className="loading-spinner">Loading details...</div>
                            ) : (
                                <>
                                    <div className="info-grid">
                                        <div className="info-item">
                                            <span className="info-label">Borrower</span>
                                            <span className="info-value">{loanDetails.loan.borrower_name}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Amount</span>
                                            <span className="info-value">{formatCurrency(loanDetails.loan.loan_amount)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Interest Type</span>
                                            <span className="info-value">{loanDetails.loan.interest_type}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Interest Rate</span>
                                            <span className="info-value">{loanDetails.loan.interest_rate}%</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Total Repayable</span>
                                            <span className="info-value">{formatCurrency(loanDetails.loan.total_repayable)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Amount Paid</span>
                                            <span className="info-value text-success">{formatCurrency(loanDetails.loan.amount_paid || 0)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Balance Remaining</span>
                                            <span className="info-value text-error">{formatCurrency(loanDetails.loan.balance || 0)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Monthly Payment</span>
                                            <span className="info-value">{formatCurrency(loanDetails.loan.monthly_payment || 0)}</span>
                                        </div>
                                    </div>

                                    {loanDetails.schedule && loanDetails.schedule.length > 0 && (
                                        <div style={{ marginTop: "1.5rem" }}>
                                            <h4>Repayment Schedule</h4>
                                            <div className="table-responsive">
                                                <table className="table table-sm">
                                                    <thead>
                                                        <tr>
                                                            <th>#</th>
                                                            <th>Due Date</th>
                                                            <th>Total Due</th>
                                                            <th>Principal</th>
                                                            <th>Interest</th>
                                                            <th>Balance</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loanDetails.schedule.map((inst) => (
                                                            <tr key={inst.installment_number}>
                                                                <td>{inst.installment_number}</td>
                                                                <td>{new Date(inst.due_date).toLocaleDateString("en-KE")}</td>
                                                                <td><strong>{formatCurrency(inst.total_amount)}</strong></td>
                                                                <td>{formatCurrency(inst.principal_amount)}</td>
                                                                <td>{formatCurrency(inst.interest_amount)}</td>
                                                                <td className="text-muted">{formatCurrency(inst.balance)}</td>
                                                                <td><span className={`badge ${inst.status === 'PAID' ? 'badge-success' : 'badge-warning'}`}>{inst.status}</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {loanDetails.guarantors && loanDetails.guarantors.length > 0 && (
                                        <div style={{ marginTop: "1.5rem" }}>
                                            <h4>Guarantors</h4>
                                            <div className="table-responsive">
                                                <table className="table table-sm">
                                                    <thead>
                                                        <tr>
                                                            <th>Name</th>
                                                            <th>Covering</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loanDetails.guarantors.map((g, idx) => (
                                                            <tr key={g.guarantor_user_id || idx}>
                                                                <td><strong>{g.guarantor_name || `${g.first_name || ''} ${g.last_name || ''}`.trim() || 'Unknown'}</strong></td>
                                                                <td>{formatCurrency(g.guarantee_amount)}</td>
                                                                <td><span className={`badge ${g.status === 'ACCEPTED' ? 'badge-success' : g.status === 'REJECTED' ? 'badge-error' : 'badge-warning'}`}>{g.status || 'PENDING'}</span></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Dialog */}
            <ConfirmDialog
                isOpen={rejectDialogOpen}
                title="Reject Loan Application"
                message="Please provide a reason for rejecting this loan application."
                variant="danger"
                confirmText="Reject Loan"
                onConfirm={handleConfirmReject}
                onCancel={() => setRejectDialogOpen(false)}
                showInput={true}
                inputLabel="Rejection Reason"
                inputPlaceholder="e.g., Insufficient guarantors"
                inputValue={rejectReason}
                onInputChange={setRejectReason}
                loading={actionLoading === loanToReject}
            />
        </div>
        </div>
    );
};

export default LoanManagement;
