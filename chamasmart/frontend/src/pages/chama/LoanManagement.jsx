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

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-KE", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    };

    const getStatusBadge = (status) => {
        const badges = {
            PENDING: "badge-warning",
            ACTIVE: "badge-success",
            PAID: "badge-primary",
            DEFAULTED: "badge-error",
        };
        return badges[status] || "badge-secondary";
    };

    const filteredLoans =
        filter === "ALL" ? loans : loans.filter((l) => l.status === filter);

    const stats = {
        total: loans.length,
        pending: loans.filter((l) => l.status === "PENDING").length,
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
                                                <span className={`badge ${getStatusBadge(loan.status)}`}>
                                                    {loan.status}
                                                </span>
                                            </td>
                                            <td>
                                                {loan.status === "PENDING" && isOfficial() && (
                                                    <div style={{ display: "flex", gap: "0.25rem" }}>
                                                        <button
                                                            className="btn btn-sm btn-success"
                                                            onClick={() => handleApproveLoan(loan.loan_id, "ACTIVE")}
                                                            disabled={actionLoading === loan.loan_id}
                                                        >
                                                            {actionLoading === loan.loan_id ? "..." : "Approve"}
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => handleApproveLoan(loan.loan_id, "REJECTED")}
                                                            disabled={actionLoading === loan.loan_id}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                                {loan.status === "ACTIVE" && (
                                                    <Link
                                                        to={`/chamas/${id}/loans/${loan.loan_id}/repay`}
                                                        className="btn btn-sm btn-primary"
                                                    >
                                                        Repay
                                                    </Link>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoanManagement;
