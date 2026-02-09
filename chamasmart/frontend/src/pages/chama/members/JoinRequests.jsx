import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { joinRequestAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";

const JoinRequests = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [chama, setChama] = useState(null);
    const [requests, setRequests] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                if (isMounted) setLoading(true);
                const [chamaRes, requestsRes, membersRes] = await Promise.all([
                    chamaAPI.getById(id),
                    joinRequestAPI.getAll(id),
                    chamaAPI.getMembers(id),
                ]);

                if (isMounted) {
                    setChama(chamaRes.data.data);
                    setRequests(requestsRes.data.data);
                    setMembers(membersRes.data.data);
                }
            } catch (err) {
                if (isMounted) {
                    setError("Failed to load join requests");
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

    const handleRespond = async (requestId, status, requesterName) => {
        const action = status === "APPROVED" ? "approve" : "reject";
        if (!confirm(`Are you sure you want to ${action} ${requesterName}'s request?`)) {
            return;
        }

        try {
            setProcessingId(requestId);
            await joinRequestAPI.respond(requestId, status);
            setSuccess(`Request ${status.toLowerCase()} successfully!`);
            await fetchData();
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${action} request`);
            setTimeout(() => setError(""), 3000);
        } finally {
            setProcessingId(null);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("en-KE", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
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

    const pendingRequests = requests.filter((r) => r.status === "PENDING");
    const reviewedRequests = requests.filter((r) => r.status !== "PENDING");

    if (loading) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading join requests...</p>
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
                        <h1>Join Requests</h1>
                        <p className="text-muted">{chama?.chama_name}</p>
                    </div>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/chamas/${id}`)}
                    >
                        ← Back to Chama
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {/* Pending Requests */}
                <div className="card">
                    <div className="card-header">
                        <h3>Pending Requests ({pendingRequests.length})</h3>
                    </div>

                    {pendingRequests.length === 0 ? (
                        <p className="text-muted text-center">No pending requests</p>
                    ) : (
                        <div style={{ display: "grid", gap: "1rem" }}>
                            {pendingRequests.map((request) => (
                                <div
                                    key={request.request_id}
                                    className="card"
                                    style={{ backgroundColor: "#fffbeb", borderColor: "#fbbf24" }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ marginBottom: "0.5rem" }}>
                                                {request.first_name} {request.last_name}
                                            </h4>
                                            <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                                                {request.email} • {request.phone_number}
                                            </p>
                                            {request.message && (
                                                <div
                                                    style={{
                                                        backgroundColor: "white",
                                                        padding: "0.75rem",
                                                        borderRadius: "0.5rem",
                                                        marginTop: "0.5rem",
                                                    }}
                                                >
                                                    <p style={{ fontSize: "0.9rem", fontStyle: "italic" }}>
                                                        "{request.message}"
                                                    </p>
                                                </div>
                                            )}
                                            <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
                                                Requested {formatDate(request.created_at)}
                                            </p>
                                        </div>
                                        <div style={{ display: "flex", gap: "0.5rem", marginLeft: "1rem" }}>
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() =>
                                                    handleRespond(
                                                        request.request_id,
                                                        "APPROVED",
                                                        `${request.first_name} ${request.last_name}`
                                                    )
                                                }
                                                disabled={processingId === request.request_id}
                                            >
                                                {processingId === request.request_id ? "..." : "✓ Approve"}
                                            </button>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() =>
                                                    handleRespond(
                                                        request.request_id,
                                                        "REJECTED",
                                                        `${request.first_name} ${request.last_name}`
                                                    )
                                                }
                                                disabled={processingId === request.request_id}
                                            >
                                                ✗ Reject
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Reviewed Requests */}
                {reviewedRequests.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <h3>Request History ({reviewedRequests.length})</h3>
                        </div>
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Requester</th>
                                        <th>Message</th>
                                        <th>Requested</th>
                                        <th>Reviewed By</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reviewedRequests.map((request) => (
                                        <tr key={request.request_id}>
                                            <td>
                                                <strong>
                                                    {request.first_name} {request.last_name}
                                                </strong>
                                                <div className="text-muted" style={{ fontSize: "0.85rem" }}>
                                                    {request.email}
                                                </div>
                                            </td>
                                            <td className="text-muted" style={{ maxWidth: "300px" }}>
                                                {request.message || "-"}
                                            </td>
                                            <td>{formatDate(request.created_at)}</td>
                                            <td>
                                                {request.reviewer_first_name
                                                    ? `${request.reviewer_first_name} ${request.reviewer_last_name}`
                                                    : "-"}
                                            </td>
                                            <td>
                                                <span className={`badge ${getStatusBadge(request.status)}`}>
                                                    {request.status}
                                                </span>
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

export default JoinRequests;
