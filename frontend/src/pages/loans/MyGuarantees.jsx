import { useEffect, useState } from "react";
import { loanAPI } from "../../services/api";

const MyGuarantees = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [items, setItems] = useState([]);
    const [actionLoading, setActionLoading] = useState(null);
    const [filter, setFilter] = useState("ALL");

    useEffect(() => {
        let isMounted = true;

        const fetchGuarantees = async () => {
            try {
                if (isMounted) {
                    setLoading(true);
                    setError("");
                }

                const res = await loanAPI.getMyGuarantees();

                if (isMounted) {
                    // Extract data array from paginated response
                    const dataArray = res.data.data?.data || res.data.data || [];
                    setItems(Array.isArray(dataArray) ? dataArray : []);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    setError("Failed to load your guarantees");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchGuarantees();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleRespond = async (loanId, decision) => {
        try {
            setActionLoading(loanId);
            await loanAPI.respondGuarantor(loanId, decision);
            await fetchGuarantees();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to respond to guarantee request");
        } finally {
            setActionLoading(null);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount || 0);
    };

    const filteredItems =
        filter === 'ALL'
            ? items
            : items.filter((loan) => loan.guarantee_status === filter);

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading your guarantees...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>My Guarantees</h1>
                    <p className="text-muted">Review and respond to loan guarantee requests.</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="filter-bar" style={{ marginBottom: '1rem' }}>
                    <button
                        className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setFilter('ALL')}
                    >
                        All ({items.length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'PENDING' ? 'active' : ''}`}
                        onClick={() => setFilter('PENDING')}
                    >
                        Pending ({items.filter((l) => l.guarantee_status === 'PENDING').length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'APPROVED' ? 'active' : ''}`}
                        onClick={() => setFilter('APPROVED')}
                    >
                        Accepted ({items.filter((l) => l.guarantee_status === 'APPROVED').length})
                    </button>
                    <button
                        className={`filter-btn ${filter === 'REJECTED' ? 'active' : ''}`}
                        onClick={() => setFilter('REJECTED')}
                    >
                        Rejected ({items.filter((l) => l.guarantee_status === 'REJECTED').length})
                    </button>
                </div>

                {filteredItems.length === 0 ? (
                    <div className="card">
                        <p className="text-muted">You currently have no guarantee requests.</p>
                    </div>
                ) : (
                    <div className="card">
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Borrower</th>
                                        <th>Loan Amount</th>
                                        <th>Your Guarantee</th>
                                        <th>Loan Status</th>
                                        <th>Guarantee Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((loan, idx) => (
                                        <tr key={loan.loan_id || idx}>
                                            <td>{loan.borrower_name || loan.borrower_id}</td>
                                            <td>{formatCurrency(loan.loan_amount)}</td>
                                            <td>{formatCurrency(loan.guaranteed_amount)}</td>
                                            <td>{loan.status}</td>
                                            <td>{loan.guarantee_status}</td>
                                            <td>
                                                {loan.status === 'PENDING_GUARANTOR' && (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            className="btn btn-sm btn-success"
                                                            onClick={() => handleRespond(loan.loan_id, 'ACCEPT')}
                                                            disabled={actionLoading === loan.loan_id}
                                                        >
                                                            {actionLoading === loan.loan_id ? '...' : 'Accept'}
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => handleRespond(loan.loan_id, 'REJECT')}
                                                            disabled={actionLoading === loan.loan_id}
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyGuarantees;
