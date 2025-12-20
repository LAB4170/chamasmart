import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { payoutAPI, chamaAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const PayoutManagement = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [payouts, setPayouts] = useState([]);
    const [eligibleMembers, setEligibleMembers] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [chamaRes, payoutsRes, eligibleRes, membersRes] = await Promise.all([
                chamaAPI.getById(id),
                payoutAPI.getAll(id),
                payoutAPI.getEligible(id),
                chamaAPI.getMembers(id),
            ]);

            setChama(chamaRes.data.data);
            setPayouts(payoutsRes.data.data);
            setEligibleMembers(eligibleRes.data.data);
            setMembers(membersRes.data.data);
        } catch (err) {
            setError("Failed to load payout data");
            console.error(err);
        } finally {
            setLoading(false);
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

    const getNextRecipient = () => {
        // Find member who hasn't received payout yet
        const receivedPayouts = payouts.map((p) => p.user_id);
        return eligibleMembers.find((m) => !receivedPayouts.includes(m.user_id));
    };

    const expectedPayoutAmount = () => {
        if (!chama || !members.length) return 0;
        return parseFloat(chama.contribution_amount) * members.length;
    };

    const stats = {
        totalPayouts: payouts.length,
        totalDisbursed: payouts.reduce((sum, p) => sum + parseFloat(p.amount), 0),
        nextAmount: expectedPayoutAmount(),
        remaining: members.length - payouts.length,
    };

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading payouts...</p>
                    </div>
                </div>
            </div>
        );
    }

    const nextRecipient = getNextRecipient();

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Payout Management</h1>
                        <p className="text-muted">{chama?.chama_name} - ROSCA Cycle</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => navigate(`/chamas/${id}`)}
                        >
                            ← Back to Chama
                        </button>
                        {isOfficial() && nextRecipient && (
                            <Link
                                to={`/chamas/${id}/payouts/process`}
                                className="btn btn-primary btn-sm"
                            >
                                💰 Process Payout
                            </Link>
                        )}
                    </div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">🔄</div>
                        <div>
                            <h3>{stats.totalPayouts}</h3>
                            <p>Completed Payouts</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">💰</div>
                        <div>
                            <h3>{formatCurrency(stats.totalDisbursed)}</h3>
                            <p>Total Disbursed</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">⏳</div>
                        <div>
                            <h3>{stats.remaining}</h3>
                            <p>Remaining Members</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🎯</div>
                        <div>
                            <h3>{formatCurrency(stats.nextAmount)}</h3>
                            <p>Next Payout Amount</p>
                        </div>
                    </div>
                </div>

                {/* Next Recipient */}
                {nextRecipient && (
                    <div className="card" style={{ backgroundColor: "#f0fdf4", borderColor: "#10b981" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <h3 style={{ color: "#10b981", marginBottom: "0.5rem" }}>
                                    🎯 Next Recipient
                                </h3>
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                    <div>
                                        <h2 style={{ marginBottom: "0.25rem" }}>
                                            {nextRecipient.first_name} {nextRecipient.last_name}
                                        </h2>
                                        <p className="text-muted">
                                            Position {nextRecipient.rotation_position || eligibleMembers.indexOf(nextRecipient) + 1} in rotation
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <p className="text-muted">Expected Amount</p>
                                <h2 style={{ color: "#10b981" }}>{formatCurrency(expectedPayoutAmount())}</h2>
                                {isOfficial() && (
                                    <Link
                                        to={`/chamas/${id}/payouts/process`}
                                        className="btn btn-success"
                                        style={{ marginTop: "0.5rem" }}
                                    >
                                        Process Payout
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Rotation Order */}
                <div className="card">
                    <div className="card-header">
                        <h3>Rotation Order</h3>
                    </div>
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Position</th>
                                    <th>Member</th>
                                    <th>Status</th>
                                    <th>Payout Date</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eligibleMembers.map((member, index) => {
                                    const payout = payouts.find((p) => p.user_id === member.user_id);
                                    const isNext = nextRecipient?.user_id === member.user_id;

                                    return (
                                        <tr key={member.user_id} style={isNext ? { backgroundColor: "#f0fdf4" } : {}}>
                                            <td>
                                                <strong>#{index + 1}</strong>
                                            </td>
                                            <td>
                                                {member.first_name} {member.last_name}
                                                {isNext && (
                                                    <span className="badge badge-success" style={{ marginLeft: "0.5rem" }}>
                                                        Next
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {payout ? (
                                                    <span className="badge badge-primary">Received</span>
                                                ) : isNext ? (
                                                    <span className="badge badge-warning">Pending</span>
                                                ) : (
                                                    <span className="badge badge-secondary">Waiting</span>
                                                )}
                                            </td>
                                            <td>
                                                {payout ? formatDate(payout.payout_date) : "-"}
                                            </td>
                                            <td>
                                                {payout ? (
                                                    <span className="text-success">{formatCurrency(payout.amount)}</span>
                                                ) : (
                                                    "-"
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Payout History */}
                <div className="card">
                    <div className="card-header">
                        <h3>Payout History</h3>
                    </div>
                    {payouts.length === 0 ? (
                        <p className="text-muted text-center">No payouts processed yet</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Recipient</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payouts.map((payout) => (
                                        <tr key={payout.payout_id}>
                                            <td>{formatDate(payout.payout_date)}</td>
                                            <td>
                                                <strong>
                                                    {payout.first_name} {payout.last_name}
                                                </strong>
                                            </td>
                                            <td className="text-success">{formatCurrency(payout.amount)}</td>
                                            <td>
                                                <span className="badge badge-success">{payout.status}</span>
                                            </td>
                                            <td className="text-muted">{payout.notes || "-"}</td>
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

export default PayoutManagement;
