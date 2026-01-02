import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { loanAPI, chamaAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

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
    const [actionLoading, setActionLoading] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState(null);
    const [loanDetails, setLoanDetails] = useState(null);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [chamaRes, loansRes, membersRes] = await Promise.all([
                chamaAPI.getById(id),
                loanAPI.getAll(id),
                chamaAPI.getMembers(id),
            ]);

            setChama(chamaRes.data.data);
            setLoans(loansRes.data.data);
            setMembers(membersRes.data.data);
        } catch (err) {
            setError("Failed to load loan data");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleApproveLoan = async (loanId, status) => {
        try {
            setActionLoading(loanId);
            await loanAPI.approve(loanId, status);
            await fetchData();
            setActionLoading(null);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to process loan");
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
            const res = await loanAPI.getGuarantors(loan.loan_id);
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

    const handleExportReport = async () => {
        try {
            const res = await loanAPI.exportReport(id);
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `chama_${id}_loans_report.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to export loan report');
        }
    };

    const formatDate = (dateString) => {
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
            PENDING_GUARANTOR: "badge-warning",
            PENDING_APPROVAL: "badge-warning",
            ACTIVE: "badge-success",
            PAID: "badge-primary",
            COMPLETED: "badge-primary",
            DEFAULTED: "badge-error",
            CANCELLED: "badge-secondary",
        };
        return badges[normalized] || "badge-secondary";
    };

    const normalizedStatus = (status) => {
        if (!status) return "UNKNOWN";
        if (status === "PENDING_GUARANTOR") return "AWAITING GUARANTORS";
        if (status === "PENDING_APPROVAL") return "PENDING APPROVAL";
        if (status === "COMPLETED") return "PAID";
        return status;
    };

    const filteredLoans =
        filter === "ALL"
            ? loans
            : loans.filter((l) => {
                if (filter === "PENDING") {
                    return ["PENDING", "PENDING_GUARANTOR", "PENDING_APPROVAL"].includes(l.status);
                }
                if (filter === "PAID") {
                    return ["PAID", "COMPLETED"].includes(l.status);
                }
                return l.status === filter;
            });

    const stats = {
        total: loans.length,
        pending: loans.filter((l) => ["PENDING", "PENDING_GUARANTOR", "PENDING_APPROVAL"].includes(l.status)).length,
        active: loans.filter((l) => l.status === "ACTIVE").length,
        totalAmount: loans
            .filter((l) => l.status === "ACTIVE")
            .reduce((sum, l) => sum + parseFloat(l.loan_amount), 0),
    };

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading loans...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Loan Management</h1>
                        <p className="text-muted">{chama?.chama_name}</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={handleExportReport}
                        >
                            Export CSV
                        </button>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => navigate(`/chamas/${id}`)}
                        >
                            ← Back to Chama
                        </button>
                        <Link to={`/chamas/${id}/loans/apply`} className="btn btn-primary btn-sm">
                            + Apply for Loan
                        </Link>
                    </div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div>
                            <h3>{stats.total}</h3>
                            <p>Total Loans</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">⏳</div>
                        <div>
                            <h3>{stats.pending}</h3>
                            <p>Pending Approval</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">✅</div>
                        <div>
                            <h3>{stats.active}</h3>
                            <p>Active Loans</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">💰</div>
                        <div>
                            <h3>{formatCurrency(stats.totalAmount)}</h3>
                            <p>Total Loaned</p>
                        </div>
                    </div>
                </div>

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
                        Active ({loans.filter((l) => l.status === "ACTIVE").length})
                    </button>
                    <button
                        className={`filter-btn ${filter === "PAID" ? "active" : ""}`}
                        onClick={() => setFilter("PAID")}
                    >
                        Paid ({loans.filter((l) => l.status === "PAID").length})
                    </button>
                </div>

                {/* Loans List */}
                <div className="card">
                    <div className="card-header">
                        <h3>Loans</h3>
                    </div>

                    {filteredLoans.length === 0 ? (
                        <p className="text-muted text-center">No loans found</p>
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
                                                <span className={`badge ${getStatusBadge(loan.status)`}>
                                                    {normalizedStatus(loan.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: "0.25rem", flexWrap: 'wrap' }}>
                                                    <button
                                                        className="btn btn-sm btn-outline"
                                                        onClick={() => openLoanDetails(loan)}
                                                    >
                                                        Details
                                                    </button>
                                                    {loan.status === "PENDING_APPROVAL" && isOfficial() && (
                                                        <>
                                                            <button
                                                                className="btn btn-sm btn-success"
                                                                onClick={() => handleApproveLoan(loan.loan_id, "ACTIVE")}
                                                                disabled={actionLoading === loan.loan_id}
                                                            >
                                                                {actionLoading === loan.loan_id ? "..." : "Approve"}
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline"
                                                                onClick={() => handleApproveLoan(loan.loan_id, "CANCELLED")}
                                                                disabled={actionLoading === loan.loan_id}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    )}
                                                    {loan.status === "ACTIVE" && (
                                                        <Link
                                                            to={`/chamas/${id}/loans/${loan.loan_id}/repay`}
                                                            className="btn btn-sm btn-primary"
                                                        >
                                                            Repay
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {selectedLoan && loanDetails && (
                <div className="modal-backdrop" onClick={closeLoanDetails}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Loan Details</h3>
                            <button className="btn btn-sm btn-outline" onClick={closeLoanDetails}>
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            {detailsLoading ? (
                                <div className="loading">
                                    <div className="spinner"></div>
                                    <p>Loading details...</p>
                                </div>
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
                                            <span className="info-label">Outstanding Principal</span>
                                            <span className="info-value text-error">{formatCurrency(loanDetails.loan.principal_outstanding || 0)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Outstanding Interest</span>
                                            <span className="info-value text-error">{formatCurrency(loanDetails.loan.interest_outstanding || 0)}</span>
                                        </div>
                                        <div className="info-item">
                                            <span className="info-label">Outstanding Penalties</span>
                                            <span className="info-value text-error">{formatCurrency(loanDetails.loan.penalty_outstanding || 0)}</span>
                                        </div>
                                    </div>

                                    {loanDetails.installments && loanDetails.installments.length > 0 && (
                                        <div style={{ marginTop: "1.5rem" }}>
                                            <h4>Repayment Schedule</h4>
                                            <div className="table-responsive">
                                                <table className="table table-sm">
                                                    <thead>
                                                        <tr>
                                                            <th>Due Date</th>
                                                            <th>Amount</th>
                                                            <th>Principal</th>
                                                            <th>Interest</th>
                                                            <th>Penalty</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loanDetails.installments.map((inst) => (
                                                            <tr key={inst.id}>
                                                                <td>{new Date(inst.due_date).toLocaleDateString("en-KE")}</td>
                                                                <td>{formatCurrency(inst.amount)}</td>
                                                                <td>{formatCurrency(inst.principal_amount)}</td>
                                                                <td>{formatCurrency(inst.interest_amount)}</td>
                                                                <td>{formatCurrency(inst.penalty_amount)}</td>
                                                                <td>{inst.status}</td>
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
                                                            <th>Guaranteed Amount</th>
                                                            <th>Status</th>
                                                            <th>Requested At</th>
                                                            <th>Responded At</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loanDetails.guarantors.map((g) => (
                                                            <tr key={g.id}>
                                                                <td>{g.first_name} {g.last_name}</td>
                                                                <td>{formatCurrency(g.guaranteed_amount)}</td>
                                                                <td>{g.status}</td>
                                                                <td>{g.created_at ? new Date(g.created_at).toLocaleString("en-KE") : '-'}</td>
                                                                <td>{g.responded_at ? new Date(g.responded_at).toLocaleString("en-KE") : '-'}</td>
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
        </div>
    );
};

export default LoanManagement;
