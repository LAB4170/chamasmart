import { useState, useEffect, memo, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { chamaAPI, joinRequestAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import { 
    CheckCircle2, Search, Filter, Users, Wallet, 
    Calendar, ArrowRight, Building2, ShieldCheck, 
    Globe, LayoutGrid, ListFilter, History
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./ChamaDetailsLux.css";

// Memoized Chama card component for the premium grid
const ChamaCard = memo(({ chama, onDetails, onRequest, requestingId, formatCurrency, getChamaTypeLabel, isRequested }) => {
    return (
        <motion.div 
            className="browse-chama-card-lux"
            variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
            }}
        >
            <div>
                <div className="browse-card-header">
                    <div className="browse-card-title-area">
                        <h4 className="browse-chama-title">
                            {chama.chama_name}
                        </h4>
                        {chama.is_verified && <ShieldCheck size={18} style={{ color: 'var(--lux-gold)' }} />}
                    </div>
                    <span className="browse-chama-badge">
                        {getChamaTypeLabel(chama.chama_type)}
                    </span>
                </div>

                <p className="browse-chama-desc">
                    {chama.description || "Join this collective to grow wealth and secure your financial future through community-driven savings."}
                </p>
                
                <div className="browse-metrics-box">
                    <div>
                        <div className="browse-metric-label">Contribution</div>
                        <div className="browse-metric-val">{formatCurrency(chama.contribution_amount)}</div>
                    </div>
                    <div>
                        <div className="browse-metric-label">Frequency</div>
                        <div className="browse-metric-val">{chama.contribution_frequency}</div>
                    </div>
                </div>

                <div className="browse-network-bar">
                    <div className="browse-network-item">
                        <Users size={16} color="var(--lux-gold)" /> {chama.member_count || chama.total_members || 0} Members
                    </div>
                    <div className="browse-network-item">
                        <Globe size={16} color="var(--lux-gold)" /> Public Access
                    </div>
                </div>
            </div>

            <div className="browse-actions-grid">
                <button
                    className="btn-browse-view"
                    onClick={() => onDetails(chama.chama_id)}
                >
                    View Details
                </button>
                <button
                    className={isRequested ? "btn-browse-requested" : "btn-browse-join"}
                    onClick={() => !isRequested && onRequest(chama.chama_id)}
                    disabled={requestingId === chama.chama_id || isRequested}
                >
                    {requestingId === chama.chama_id ? "Syncing..." : isRequested ? "Pending Approval" : "Request to Join"}
                </button>
            </div>
        </motion.div>
    );
});

const BrowseChamas = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [chamas, setChamas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [search, setSearch] = useState("");
    const [chamaType, setChamaType] = useState("");
    const [requestingId, setRequestingId] = useState(null);
    const [requestedChamas, setRequestedChamas] = useState(new Set());

    const fetchPublicChamas = useCallback(async () => {
        let isMounted = true;
        try {
            if (isMounted) setLoading(true);
            const [chamasRes, requestsRes] = await Promise.all([
                chamaAPI.getPublicChamas({ search, chamaType }),
                user ? joinRequestAPI.getMyRequests() : Promise.resolve({ data: { data: [] } })
            ]);
            if (isMounted) {
                const publicData = chamasRes.data?.data;
                setChamas(Array.isArray(publicData) ? publicData : []);
                if (requestsRes.data?.data) {
                    const pendingIds = new Set(
                        requestsRes.data.data
                            .filter(r => r.status === 'PENDING')
                            .map(r => String(r.chama_id))
                    );
                    setRequestedChamas(pendingIds);
                }
            }
        } catch (err) {
            if (isMounted) setError("Failed to load public chamas");
        } finally {
            if (isMounted) setLoading(false);
        }
        return () => { isMounted = false; };
    }, [search, chamaType, user]);

    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            fetchPublicChamas();
        }, 500);
        return () => clearTimeout(debounceTimer);
    }, [fetchPublicChamas]);

    useEffect(() => {
        if (location.state?.success) {
            setSuccess(location.state.success);
            window.history.replaceState({}, document.title);
            setTimeout(() => setSuccess(""), 4000);
        }
    }, [location.state]);

    const handleRequestToJoin = (chamaId) => {
        navigate(`/chamas/${chamaId}/apply`);
    };

    const formatCurrency = useCallback((amount) => {
        return new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
        }).format(amount || 0);
    }, []);

    const getChamaTypeLabel = (type) => ({
        ROSCA: "Merry-Go-Round", ASCA: "Investment",
        TABLE_BANKING: "Table Banking", WELFARE: "Welfare"
    }[type] || type);

    return (
        <div className="manage-page-root">
            <div className="ambient-blob blob-gold" />
            <div className="ambient-blob blob-blue" />

            <div className="container">
                <div className="page-frame-lux">
                    <motion.div 
                        initial="hidden"
                        animate="show"
                        variants={{
                            hidden: { opacity: 0 },
                            show: { opacity: 1, transition: { staggerChildren: 0.1 } }
                        }}
                    >
                        {/* Header Section */}
                        <div className="user-hero-lux" style={{ marginBottom: "40px", padding: "40px" }}>
                            <div className="user-hero-content">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ background: 'rgba(212, 175, 55, 0.1)', padding: '8px', borderRadius: '12px' }}>
                                        <Building2 size={24} color="#D4AF37" />
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--gold-text)' }}>
                                        Discovery Portal
                                    </span>
                                </div>
                                <h1 className="user-hero-title">Public Ecosystem</h1>
                                <p className="user-hero-subtitle">
                                    Browse high-performing savings groups. Join established communities or discovery emerging wealth circles.
                                </p>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
                                    <button
                                        className="btn-action-secondary"
                                        onClick={() => navigate("/dashboard")}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
                                    >
                                        <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} /> 
                                        <span>Return to Dashboard</span>
                                    </button>
                                    <button
                                        className="btn-action-secondary"
                                        onClick={() => navigate("/my-join-requests")}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '14px' }}
                                    >
                                        <History size={18} /> 
                                        <span>Track Requests</span>
                                    </button>
                                </div>
                            </div>
                            <div className="user-hero-visual">
                                <Globe size={180} strokeWidth={0.5} style={{ opacity: 0.1, color: 'var(--gold-text)' }} />
                            </div>
                        </div>

                        {error && <div className="alert alert-error">{error}</div>}
                        {success && <div className="alert alert-success">{success}</div>}

                        {/* Search & Filter Bar */}
                        <div className="filter-bar-lux" style={{ 
                            alignItems: "center",
                            marginBottom: "40px",
                            display: "grid",
                            gridTemplateColumns: "1fr auto auto",
                            gap: "20px",
                            padding: "20px 28px",
                            borderRadius: "24px"
                        }}>
                            <div className="input-with-icon" style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Search size={18} style={{ position: 'absolute', left: '16px', color: 'var(--lux-text-secondary)' }} />
                                <input
                                    type="text"
                                    className="filter-input-lux"
                                    placeholder="Search by name, objective, or keyword..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ width: '100%', paddingLeft: '48px', paddingRight: '20px', borderRadius: '16px', height: '52px', fontSize: '0.95rem' }}
                                />
                            </div>
                            
                            <div className="input-with-icon" style={{ minWidth: "220px", position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <Filter size={18} style={{ position: 'absolute', left: '16px', color: 'var(--lux-text-secondary)' }} />
                                <select
                                    className="filter-input-lux"
                                    value={chamaType}
                                    onChange={(e) => setChamaType(e.target.value)}
                                    style={{ width: '100%', paddingLeft: '48px', paddingRight: '20px', borderRadius: '16px', height: '52px', fontSize: '0.95rem', cursor: 'pointer' }}
                                >
                                    <option value="">All Architectures</option>
                                    <option value="ROSCA">Merry-Go-Round</option>
                                    <option value="ASCA">ASCA / Investment</option>
                                    <option value="TABLE_BANKING">Table Banking</option>
                                    <option value="WELFARE">Welfare</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', padding: '14px', borderRadius: '16px', color: 'var(--lux-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '52px', width: '52px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                    <LayoutGrid size={22} />
                                </div>
                            </div>
                        </div>

                        {/* Results Grid */}
                        {loading ? (
                            <div className="portfolio-grid">
                                <LoadingSkeleton type="card" count={6} />
                            </div>
                        ) : chamas.length === 0 ? (
                            <div className="empty-state-card-premium" style={{ padding: "80px 40px" }}>
                                <div className="empty-illustration">
                                    <Search size={64} style={{ opacity: 0.3 }} />
                                </div>
                                <h2 style={{ fontWeight: 800 }}>No results found</h2>
                                <p style={{ maxWidth: "400px", margin: "16px auto" }}>
                                    We couldn't find any groups matching your criteria. Try adjusting your filters or search terms.
                                </p>
                                <button className="btn-action-primary" onClick={() => { setSearch(""); setChamaType(""); }}>
                                    Reset Discovery Filters
                                </button>
                            </div>
                        ) : (
                            <div className="rosca-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px" }}>
                                <AnimatePresence>
                                    {chamas.map((chama) => (
                                        <ChamaCard
                                            key={chama.chama_id}
                                            chama={chama}
                                            onDetails={(id) => navigate(`/chamas/${id}`)}
                                            onRequest={handleRequestToJoin}
                                            requestingId={requestingId}
                                            formatCurrency={formatCurrency}
                                            getChamaTypeLabel={getChamaTypeLabel}
                                            isRequested={requestedChamas.has(String(chama.chama_id))}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default BrowseChamas;

