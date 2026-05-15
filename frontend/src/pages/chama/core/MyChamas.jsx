import { useState, useEffect, memo, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import { Building, RefreshCw, TrendingUp, Building2, Handshake, Sparkles, MapPin, Users, ArrowRight, Bell } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import "./MyChamas.css";

const TYPE_IMAGES = {
  'ROSCA': 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=800',
  'MERRY_GO_ROUND': 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800',
  'ASCA': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
  'INVESTMENT': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
  'TABLE_BANKING': 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=800',
  'WELFARE': 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=800',
  'DEFAULT': 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800'
};

const getChamaCoverImage = (chama) => {
  const type = (chama.chama_type || '').toUpperCase();
  if (chama.logo_url && chama.logo_url.startsWith('http')) return chama.logo_url;
  
  if (type.includes('MERRY')) return TYPE_IMAGES['MERRY_GO_ROUND'];
  if (type.includes('ROSCA')) return TYPE_IMAGES['ROSCA'];
  if (type.includes('ASCA') || type.includes('INVEST')) return TYPE_IMAGES['ASCA'];
  if (type.includes('TABLE')) return TYPE_IMAGES['TABLE_BANKING'];
  if (type.includes('WELFARE')) return TYPE_IMAGES['WELFARE'];
  
  return TYPE_IMAGES['DEFAULT'];
};

const MyChamaCard = memo(({ chama, getChamaTypeLabel, formatCurrency }) => {
  const coverImage = getChamaCoverImage(chama);
  const type = (chama.chama_type || '').toUpperCase();
  const getFallback = () => {
    if (type.includes('ASCA')) return TYPE_IMAGES['ASCA'];
    if (type.includes('TABLE')) return TYPE_IMAGES['TABLE_BANKING'];
    if (type.includes('WELFARE')) return TYPE_IMAGES['WELFARE'];
    return TYPE_IMAGES['ROSCA'];
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0 }
      }}
    >
      <Link
        to={`/chamas/${chama.chama_id}`}
        className="my-chama-card-lux"
      >
        <div className="chama-card-cover-lux">
          <img 
            src={coverImage} 
            alt={chama.chama_name} 
            className="chama-cover-img-lux" 
            onError={(e) => {
              e.target.onerror = null; 
              e.target.src = getFallback();
            }}
          />
          <div className="chama-cover-overlay-lux" />
        </div>

        <div className="chama-card-header-lux">
          <div className="chama-type-badge-lux">
            {getChamaTypeLabel(chama.chama_type)}
          </div>
          <div style={{ background: "rgba(212, 175, 55, 0.1)", padding: "8px", borderRadius: "12px" }}>
            <Building2 size={20} color="#D4AF37" />
          </div>
        </div>

        <h3 className="chama-name-lux">{chama.chama_name}</h3>

        <div className="chama-info-lux">
          <div className="chama-info-row-lux">
            <span className="info-label-lux">Your Role</span>
            <span style={{ color: "#D4AF37", fontWeight: 800, fontSize: "0.85rem" }}>{chama.role}</span>
          </div>

          <div className="chama-info-row-lux">
            <span className="info-label-lux">Members</span>
            <span className="info-value-lux">{chama.total_members}</span>
          </div>

          <div className="chama-info-row-lux">
            <span className="info-label-lux">Net Worth</span>
            <span className="info-value-lux" style={{ color: "var(--gold-text)" }}>
              {formatCurrency(chama.total_contributions || 0)}
            </span>
          </div>
        </div>

        <div className="card-footer-lux">
          View Group Details <ArrowRight size={18} />
        </div>
      </Link>
    </motion.div>
  );
});

const MyChamas = () => {
  const [chamas, setChamas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetchChamas();
  }, []);

  const fetchChamas = async () => {
    try {
      setLoading(true);
      const response = await chamaAPI.getMyChamas();
      const chamasData = response.data?.data;
      setChamas(Array.isArray(chamasData) ? chamasData : []);
    } catch (err) {
      setError("Failed to load your chamas");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  }, []);

  const getChamaTypeLabel = useCallback((type) => {
    const types = {
      ROSCA: "Merry-Go-Round",
      ASCA: "Investment",
      TABLE_BANKING: "Table Banking",
      WELFARE: "Welfare",
    };
    return types[type] || type;
  }, []);

  const filteredChamas = useMemo(() => {
    return filter === "ALL" ? chamas : chamas.filter((c) => c.chama_type === filter);
  }, [chamas, filter]);

  const categories = [
    { id: "ALL", label: "All", Icon: Building },
    { id: "ROSCA", label: "Merry-Go-Round", Icon: RefreshCw },
    { id: "ASCA", label: "Investment", Icon: TrendingUp },
    { id: "TABLE_BANKING", label: "Table Banking", Icon: Building2 },
    { id: "WELFARE", label: "Welfare", Icon: Handshake },
  ];

  return (
    <div className="page">
      <div className="ambient-blob blob-gold" />
      <div className="ambient-blob blob-blue" />

      <div className="container">
        <div className="page-frame-lux">
          <motion.div 
            className="my-chamas-lux-wrapper"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.15 }
              }
            }}
          >
            {/* Hero Section */}
            <motion.div 
              className="user-hero-lux"
              variants={{ hidden: { opacity: 0, y: 50 }, show: { opacity: 1, y: 0 } }}
              style={{ marginBottom: '40px' }}
            >
              <div className="user-hero-content">
                <h1 className="user-hero-title">Your Chamas</h1>
                <p className="user-hero-subtitle">
                  Explore your active investment groups. Manage your contributions, track community growth, 
                  and discover new opportunities for collective wealth.
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '32px' }}>
                  <Link to="/join-chama" className="btn-action-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: "16px", padding: "14px 28px", fontWeight: 700 }}>
                    <Users size={20} /><span>Join via Code</span>
                  </Link>
                  <Link to="/my-join-requests" className="btn-action-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: "16px", padding: "14px 28px", fontWeight: 700 }}>
                    <Bell size={20} /><span>Track Requests</span>
                  </Link>
                  <Link to="/chamas/create" className="btn-action-primary" style={{ background: "var(--gold-gradient)", border: "none", color: "white", borderRadius: "16px", padding: "14px 32px", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px" }}>
                    <Sparkles size={20} /><span>Create New Chama</span>
                  </Link>
                </div>
              </div>
              <div className="user-hero-visual">
                 <Building2 size={180} strokeWidth={0.5} style={{ opacity: 0.1, color: 'var(--gold-text)' }} />
              </div>
            </motion.div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* Filter Bar */}
            <div className="filter-bar-lux">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className={`filter-btn-lux ${filter === cat.id ? "active" : ""}`}
                  onClick={() => setFilter(cat.id)}
                >
                  <cat.Icon size={18} />
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Content Section */}
            {loading ? (
              <div className="chamas-grid-lux">
                <LoadingSkeleton type="card" count={3} />
              </div>
            ) : filteredChamas.length === 0 ? (
              <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }} className="report-card-lux text-center" style={{ padding: '5rem 2rem' }}>
                <div className="mb-4" style={{ color: 'var(--gold-text)', opacity: 0.5 }}><MapPin size={64} strokeWidth={1} /></div>
                <h2 style={{ fontWeight: 800 }}>No chamas found</h2>
                <p className="text-muted" style={{ fontSize: '1.1rem', maxWidth: '500px', margin: '1rem auto' }}>
                  {filter === "ALL"
                    ? "You haven't joined any groups yet. Start your financial journey today!"
                    : `You don't have any ${getChamaTypeLabel(filter)} chamas yet.`}
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                  <Link to="/chamas/create" className="btn-action-primary" style={{ background: "var(--gold-gradient)", border: "none" }}>
                    Start a Chama
                  </Link>
                  <Link to="/browse-chamas" className="btn-action-secondary">
                    Browse Public Chamas
                  </Link>
                  <Link to="/my-join-requests" className="btn-action-secondary">
                    View My Requests
                  </Link>
                </div>
              </motion.div>
            ) : (
              <div className="chamas-grid-lux">
                <AnimatePresence>
                  {filteredChamas.map((chama) => (
                    <MyChamaCard
                      key={chama.chama_id}
                      chama={chama}
                      getChamaTypeLabel={getChamaTypeLabel}
                      formatCurrency={formatCurrency}
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

export default MyChamas;
