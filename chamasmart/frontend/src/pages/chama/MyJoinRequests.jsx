import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { joinRequestAPI } from "../../services/api";

const MyJoinRequests = () => {
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchMyRequests();
    }, []);

    const fetchMyRequests = async () => {
        try {
            setLoading(true);
            const response = await joinRequestAPI.getMyRequests();
            setRequests(response.data.data);
        } catch (err) {
            setError("Failed to load your join requests");
            console.error(err);
        } finally {
            setLoading(false);
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
        const badges = {
            PENDING: "badge-warning",
            APPROVED: "badge-success",
            REJECTED: "badge-error",
        };
        return badges[status] || "badge-secondary";
    };

    const getStatusIcon = (status) => {
        const icons = {
            PENDING: "⏳",
            APPROVED: "✅",
            REJECTED: "❌",
        };
        return icons[status] || "📝";
    };

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading your requests...</p>
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
                        <h1>My Join Requests</h1>
                        <p className="text-muted">Track your chama join requests</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => navigate("/dashboard")}
                        >
                            ← Dashboard
                        </button>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate("/browse-chamas")}
                        >
                            Browse Chamas
                        </button>
                    </div>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {requests.length === 0 ? (
                    <div className="card text-center">
                        <h3>No Join Requests Yet</h3>
                        <p className="text-muted">
                            Browse public chamas and request to join to see your requests here
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate("/browse-chamas")}
                            style={{ marginTop: "1rem" }}
                        >
                            Browse Public Chamas
                        </button>
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: "1rem" }}>
                        {requests.map((request) => (
                            <div key={request.request_id} className="card">
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                            <h3 style={{ margin: 0 }}>{request.chama_name}</h3>
                                            <span className={`badge ${getStatusBadge(request.status)}`}>
                                                {getStatusIcon(request.status)} {request.status}
                                            </span>
                                        </div>

                                        <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                                            {request.chama_type.replace("_", " ")} • {request.description}
                                        </p>

                                        {request.message && (
                                            <div
                                                style={{
                                                    backgroundColor: "#f9fafb",
                                                    padding: "0.75rem",
                                                    borderRadius: "0.5rem",
                                                    marginTop: "0.75rem",
                                                }}
                                            >
                                                <p style={{ fontSize: "0.9rem", margin: 0 }}>
                                                    <strong>Your message:</strong> "{request.message}"
                                                </p>
                                            </div>
                                        )}

                                        <div style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                                            <p className="text-muted" style={{ margin: 0 }}>
                                                Requested on {formatDate(request.created_at)}
                                            </p>
                                            {request.reviewed_at && (
                                                <p className="text-muted" style={{ margin: 0 }}>
                                                    Reviewed on {formatDate(request.reviewed_at)} by{" "}
                                                    {request.reviewer_first_name} {request.reviewer_last_name}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginLeft: "1rem" }}>
                                        {request.status === "APPROVED" && (
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => navigate(`/chamas/${request.chama_id}`)}
                                            >
                                                View Chama
                                            </button>
                                        )}
                                        {request.status === "PENDING" && (
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => navigate(`/chamas/${request.chama_id}`)}
                                            >
                                                View Details
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyJoinRequests;
