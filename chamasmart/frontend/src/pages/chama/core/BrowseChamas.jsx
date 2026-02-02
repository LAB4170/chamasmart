import { useState, useEffect, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { chamaAPI, joinRequestAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import LoadingSkeleton from "../../../components/LoadingSkeleton";

// Memoized Chama card component to prevent unnecessary re-renders
const ChamaCard = memo(({ chama, onDetails, onRequest, requestingId, formatCurrency, getChamaTypeColor, isRequested }) => {
    return (
        <div className="card" style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                <div>
                    <h3 style={{ marginBottom: "0.5rem" }}>{chama.chama_name}</h3>
                    <span
                        className="badge"
                        style={{ backgroundColor: getChamaTypeColor(chama.chama_type), color: "white" }}
                    >
                        {chama.chama_type.replace("_", " ")}
                    </span>
                </div>
                <span className="badge badge-success">PUBLIC</span>
            </div>

            <p className="text-muted" style={{ marginBottom: "1rem", minHeight: "3rem" }}>
                {chama.description || "No description provided"}
            </p>

            <div className="info-grid" style={{ marginBottom: "1rem" }}>
                <div className="info-item">
                    <span className="info-label">Contribution</span>
                    <span className="info-value">{formatCurrency(chama.contribution_amount)}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Frequency</span>
                    <span className="info-value">{chama.contribution_frequency}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Members</span>
                    <span className="info-value">{chama.member_count || chama.total_members || 0}</span>
                </div>
                <div className="info-item">
                    <span className="info-label">Created By</span>
                    <span className="info-value">{chama.creator_name}</span>
                </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                    className="btn btn-outline"
                    onClick={() => onDetails(chama.chama_id)}
                    style={{ flex: 1 }}
                >
                    View Details
                </button>
                <button
                    className={`btn ${isRequested ? 'btn-success' : 'btn-primary'}`}
                    onClick={() => !isRequested && onRequest(chama.chama_id, chama.chama_name)}
                    disabled={requestingId === chama.chama_id || isRequested}
                    style={{ flex: 1 }}
                >
                    {requestingId === chama.chama_id ? "Sending..." : isRequested ? "Request Sent ✓" : "Request to Join"}
                </button>
            </div>
        </div>
    );
});

const BrowseChamas = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [chamas, setChamas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");
    const [chamaType, setChamaType] = useState("");
    const [requestingId, setRequestingId] = useState(null);
    const [requestedChamas, setRequestedChamas] = useState(new Set());

    // Debounced search effect
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            fetchPublicChamas();
        }, 500); // 500ms delay

        return () => clearTimeout(debounceTimer);
    }, [search, chamaType]);

    const fetchPublicChamas = async () => {
        try {
            setLoading(true);
            const response = await chamaAPI.getPublicChamas({ search, chamaType });
            setChamas(response.data.data);
        } catch (err) {
            setError("Failed to load public chamas");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestToJoin = async (chamaId, chamaName) => {
        const message = prompt(`Why do you want to join ${chamaName}?`);
        if (!message) return;

        try {
            setRequestingId(chamaId);

            // Optimistic update: mark as requested locally
            setRequestedChamas(prev => new Set(prev).add(chamaId));

            await joinRequestAPI.request(chamaId, message);
            setSuccess(`Join request sent to ${chamaName}!`);
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            // Rollback optimistic update
            setRequestedChamas(prev => {
                const next = new Set(prev);
                next.delete(chamaId);
                return next;
            });
            setError(err.response?.data?.message || "Failed to send join request");
            setTimeout(() => setError(""), 3000);
        } finally {
            setRequestingId(null);
        }
    };

    const formatCurrency = useCallback((amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount);
    }, []);

    const getChamaTypeColor = useCallback((type) => {
        const colors = {
            ROSCA: "#3b82f6",
            ASCA: "#10b981",
            TABLE_BANKING: "#f59e0b",
            WELFARE: "#8b5cf6",
        };
        return colors[type] || "#6b7280";
    }, []);

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Browse Public Chamas</h1>
                        <p className="text-muted">Discover and join chamas in your community</p>
                    </div>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate("/dashboard")}
                    >
                        ← Back to Dashboard
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {/* Search and Filter */}
                <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                        <div className="form-group" style={{ flex: "1", minWidth: "250px", marginBottom: 0 }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Search by name or description..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="form-group" style={{ minWidth: "200px", marginBottom: 0 }}>
                            <select
                                className="form-select"
                                value={chamaType}
                                onChange={(e) => setChamaType(e.target.value)}
                            >
                                <option value="">All Types</option>
                                <option value="ROSCA">ROSCA</option>
                                <option value="ASCA">ASCA</option>
                                <option value="TABLE_BANKING">Table Banking</option>
                                <option value="WELFARE">Welfare</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results */}
                {loading ? (
                    <LoadingSkeleton type="card" count={6} />
                ) : chamas.length === 0 ? (
                    <div className="card text-center">
                        <p className="text-muted">No public chamas found</p>
                        <p className="text-muted" style={{ fontSize: "0.9rem" }}>
                            Try adjusting your search or filters
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))" }}>
                        {chamas.map((chama) => (
                            <ChamaCard
                                key={chama.chama_id}
                                chama={chama}
                                onDetails={(id) => navigate(`/chamas/${id}`)}
                                onRequest={handleRequestToJoin}
                                requestingId={requestingId}
                                formatCurrency={formatCurrency}
                                getChamaTypeColor={getChamaTypeColor}
                                isRequested={requestedChamas.has(chama.chama_id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrowseChamas;
