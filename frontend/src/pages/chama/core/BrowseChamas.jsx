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

// Memoized Chama card component for the premium grid
const ChamaCard = memo(({ chama, onDetails, onRequest, requestingId, formatCurrency, getChamaTypeLabel, isRequested }) => {
    const type = (chama.chama_type || '').toUpperCase();
    
    return (
        <motion.div 
            className="chama-card-lux"
            variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
            }}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
        >
            <div className="chama-card-body-lux">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: 'var(--text-primary)' }}>
                            {chama.chama_name}
                        </h4>
                        {chama.is_verified && <ShieldCheck size={16} style={{ color: '#D4AF37' }} />}
                    </div>
                    <span className="chama-type-badge-lux" style={{ fontSize: "10px", padding: "4px 10px" }}>
                        {getChamaTypeLabel(chama.chama_type)}
                    </span>
                </div>

                <p style={{ 
                    fontSize: "0.875rem", 
                    color: "var(--text-secondary)", 
                    lineHeight: "1.6",
                    marginBottom: "20px",
                    display: "-webkit-box",
                    WebkitLineClamp: "3",
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: "4.8rem"
                }}>
                    {chama.description || "Join this collective to grow wealth and secure your financial future through community-driven savings."}
                </p>
                
                <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "1fr 1fr", 
                    gap: "16px", 
                    marginBottom: "24px",
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.03)",
                    borderRadius: "16px",
                    border: "1px solid var(--glass-border)"
                }}>
                    <div>
                        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)", marginBottom: "4px" }}>Contribution</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800 }}>{formatCurrency(chama.contribution_amount)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)", marginBottom: "4px" }}>Frequency</div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800 }}>{chama.contribution_frequency}</div>
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 700 }}>
                        <Users size={14} color="#D4AF37" /> {chama.member_count || chama.total_members || 0} Members
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 700 }}>
                        <Globe size={14} color="#D4AF37" /> Public Access
                    </div>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                    <button
                        className="btn-action-secondary"
                        onClick={() => onDetails(chama.chama_id)}
                        style={{ flex: 1, padding: "10px", fontSize: "0.85rem" }}
                    >
                        View Details
                    </button>
                    <button
                        className={isRequested ? "btn-action-secondary" : "btn-action-primary"}
                        onClick={() => !isRequested && onRequest(chama.chama_id)}
                        disabled={requestingId === chama.chama_id || isRequested}
                        style={{ 
                            flex: 1.5, 
                            padding: "10px", 
                            fontSize: "0.85rem",
                            background: isRequested ? "rgba(16, 185, 129, 0.1)" : "var(--gold-gradient)",
                            color: isRequested ? "#10b981" : "white",
                            border: isRequested ? "1px solid rgba(16, 185, 129, 0.2)" : "none",
                            fontWeight: 800
                        }}
                    >
                        {requestingId === chama.chama_id ? "Syncing..." : isRequested ? "Pending Approval" : "Request to Join"}
                    </button>
                </div>
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
        <div className="page">
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
                            background: "rgba(255, 255, 255, 0.02)", 
                            padding: "24px", 
                            borderRadius: "24px", 
                            border: "1px solid var(--glass-border)",
                            display: "grid",
                            gridTemplateColumns: "1fr auto auto",
                            gap: "20px",
                            alignItems: "center",
                            marginBottom: "40px"
                        }}>
                            <div className="input-with-icon" style={{ flex: 1 }}>
                                <Search size={18} className="input-prefix-icon" style={{ left: '16px', color: 'var(--text-secondary)' }} />
                                <input
                                    type="text"
                                    className="lux-input"
                                    placeholder="Search by name, objective, or keyword..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ paddingLeft: '48px', borderRadius: '16px' }}
                                />
                            </div>
                            
                            <div className="input-with-icon" style={{ minWidth: "200px" }}>
                                <Filter size={18} className="input-prefix-icon" style={{ left: '16px', color: 'var(--text-secondary)' }} />
                                <select
                                    className="lux-input"
                                    value={chamaType}
                                    onChange={(e) => setChamaType(e.target.value)}
                                    style={{ paddingLeft: '48px', borderRadius: '16px' }}
                                >
                                    <option value="">All Architectures</option>
                                    <option value="ROSCA">Merry-Go-Round</option>
                                    <option value="ASCA">ASCA / Investment</option>
                                    <option value="TABLE_BANKING">Table Banking</option>
                                    <option value="WELFARE">Welfare</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '12px', color: 'var(--text-primary)' }}>
                                    <LayoutGrid size={20} />
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

