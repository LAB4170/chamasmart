import { useState, useEffect, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { toast } from "react-toastify";
import { chamaAPI, loanAPI } from "../../services/api";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, TrendingUp, Users, Wallet, ArrowRight,
  PieChart, Activity, DollarSign, ShieldCheck, CheckCircle2, AlertCircle, Target
} from "lucide-react";
import "./Dashboard.css";

// ─── StatCard ───────────────────────────────────────────────────────────────
const StatCard = memo(({ icon: Icon, value, label, image }) => {
  return (
    <motion.div
      className="portfolio-block-visual"
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.9 },
        show: { opacity: 1, y: 0, scale: 1 }
      }}
      whileHover={{ y: -10, transition: { duration: 0.3 } }}
    >
      <img src={image} alt="" className="portfolio-block-image" />
      <div className="portfolio-block-overlay" />
      <div className="portfolio-block-content">
        <div className="portfolio-block-icon-lux">
          <Icon size={20} />
        </div>
        <div>
          <div className="portfolio-block-value-lux">{value}</div>
          <div className="portfolio-block-label-lux">{label}</div>
        </div>
      </div>
    </motion.div>
  );
});

// ─── LoanCommitmentCard ───────────────────────────────────────────────────────
const LoanCommitmentCard = memo(({ loan, formatCurrency, formatDate }) => {
  const isBorrower = loan.user_role === "BORROWER";

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="commitment-card"
    >
      <div className={`commitment-indicator ${isBorrower ? "borrower" : "guarantor"}`} />

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              padding: "0.4rem",
              borderRadius: "0.5rem",
              background: isBorrower ? "#dbeafe" : "#ede9fe",
              color: isBorrower ? "#2563eb" : "#7c3aed"
            }}>
              {isBorrower ? <Wallet size={16} /> : <ShieldCheck size={16} />}
            </div>
            <div>
              <h4 style={{ fontWeight: 700, fontSize: "0.875rem", margin: 0 }}>{loan.chama_name}</h4>
              <p style={{ fontSize: "0.7rem", textTransform: "uppercase", color: "#94a3b8", margin: 0 }}>
                {isBorrower ? "Direct Loan" : `Guaranteeing: ${loan.borrower_name}`}
              </p>
            </div>
          </div>
          <span style={{
            fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: "999px",
            background: isBorrower ? "#eff6ff" : "#f5f3ff",
            color: isBorrower ? "#2563eb" : "#7c3aed"
          }}>
            {loan.user_role}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>Outstanding</div>
            <div style={{ fontSize: "0.875rem", fontWeight: 900 }}>
              {formatCurrency(isBorrower ? loan.balance : loan.my_guarantee_amount)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>
              {isBorrower ? "Next Payment" : "Status"}
            </div>
            <div style={{ fontSize: "0.875rem", fontWeight: 900, color: isBorrower ? "var(--primary)" : "inherit" }}>
              {isBorrower
                ? (loan.next_payment_date ? formatDate(loan.next_payment_date) : "N/A")
                : loan.my_guarantee_status}
            </div>
          </div>
        </div>
      </div>

      <Link
        to={`/chamas/${loan.chama_id}/loans`}
        style={{ marginLeft: "1rem", padding: "0.4rem", color: "#cbd5e1", textDecoration: "none" }}
      >
        <ArrowRight size={20} />
      </Link>
    </motion.div>
  );
});

// ─── Constants ──────────────────────────────────────────────────────────────
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

// ─── DashboardChamaCard ───────────────────────────────────────────────────────
const DashboardChamaCard = memo(({ chama, getChamaTypeLabel, formatCurrency }) => {
  const coverImage = getChamaCoverImage(chama);
  const type = (chama.chama_type || '').toUpperCase();
  const getFallback = () => {
    if (type.includes('ASCA')) return TYPE_IMAGES['ASCA'];
    if (type.includes('TABLE')) return TYPE_IMAGES['TABLE_BANKING'];
    if (type.includes('WELFARE')) return TYPE_IMAGES['WELFARE'];
    return TYPE_IMAGES['ROSCA'];
  };

  return (
    <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }}>
      <Link to={`/chamas/${chama.chama_id}`} className="chama-card-lux">
        <div className="chama-card-cover-lux">
          <img 
            src={coverImage} 
            alt={chama.chama_name} 
            className="chama-cover-img" 
            onError={(e) => {
              e.target.onerror = null; 
              e.target.src = getFallback();
            }}
          />
          <div className="chama-cover-overlay" />
        </div>
        <div className="chama-card-body-lux">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>{chama.chama_name}</h4>
              {chama.is_verified && <CheckCircle2 size={16} style={{ color: '#D4AF37' }} />}
            </div>
            <span className="chama-type-badge-lux" style={{ fontSize: "10px", padding: "4px 10px" }}>
              {getChamaTypeLabel(chama.chama_type)}
            </span>
          </div>
          
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-1px" }}>
              {formatCurrency(
                ['ASCA', 'TABLE_BANKING'].includes(chama.chama_type) 
                  ? chama.current_fund || 0 
                  : chama.total_contributions || 0
              )}
            </div>
            <div className="info-label-lux" style={{ marginTop: "4px" }}>
              {['ASCA', 'TABLE_BANKING'].includes(chama.chama_type) ? "Net Worth" : "Total Accumulated"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingTop: "16px", borderTop: "1px solid var(--glass-border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 700 }}>
              <Users size={14} color="#D4AF37" /> {chama.total_members}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 700 }}>
              <Wallet size={14} color="#D4AF37" /> {formatCurrency(chama.contribution_amount)}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [chamas, setChamas] = useState([]);
  const [loanSummary, setLoanSummary] = useState({
    borrowed: [], guaranteed: [], summary: { totalBorrowed: 0, totalGuaranteed: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboardData = async (isMounted = true) => {
    try {
      if (isMounted) setLoading(true);
      const [chamasRes, loansRes] = await Promise.all([
        chamaAPI.getMyChamas(),
        loanAPI.getUnifiedSummary()
      ]);
      if (isMounted) {
        setChamas(Array.isArray(chamasRes.data?.data) ? chamasRes.data.data : []);
        if (loansRes.data?.data) setLoanSummary(loansRes.data.data);
      }
    } catch (err) {
      if (isMounted) {
        setError("Failed to load dashboard data");
        console.error(err);
      }
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    const isPlaceholderName = (name) => {
      if (!name) return true;
      const placeholders = ["antigravityagent", "antigravity agent", "user", "chamasmarter"];
      return placeholders.includes(name.toLowerCase().trim());
    };

    if (user && isPlaceholderName(user.firstName || user.first_name)) {
      navigate("/complete-profile");
      return;
    }

    let isMounted = true;
    fetchDashboardData(isMounted);
    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    const handleDashboardUpdate = (data) => {
      if (data.type === 'MPESA_SUCCESS') {
        const formatAmt = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(data.amount || 0);
        toast.success(`M-Pesa payment of ${formatAmt} successfully processed! Portfolio updated.`);
      }
      fetchDashboardData(true);
    };
    socket.on("personal_dashboard_update", handleDashboardUpdate);
    return () => { socket.off("personal_dashboard_update", handleDashboardUpdate); };
  }, [socket]);

  const getChamaTypeLabel = (type) => ({
    ROSCA: "Merry-Go-Round", ASCA: "Investment",
    TABLE_BANKING: "Table Banking", WELFARE: "Welfare"
  }[type] || type);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount || 0);

  const formatDate = (dateString) =>
    dateString ? new Date(dateString).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "-";

  const allLoans = [...loanSummary.borrowed, ...loanSummary.guaranteed];

  return (
    <div className="page">
      <div className="ambient-blob blob-gold" />
      <div className="ambient-blob blob-blue" />

      <div className="container">
        <div className="page-frame-lux">
          <motion.div 
            className="dashboard-lux-wrapper"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.15 } }
            }}
          >
            {/* Hero Section */}
            <motion.div 
              className="user-hero-lux"
              variants={{ hidden: { opacity: 0, y: 50 }, show: { opacity: 1, y: 0 } }}
            >
              <div className="user-hero-content">
                <h1 className="user-hero-title">
                  {(user?.firstName || user?.first_name) && !["antigravityagent", "antigravity agent", "user"].includes((user?.firstName || user?.first_name).toLowerCase().trim())
                      ? `Welcome back, ${user.firstName || user.first_name}!`
                      : "Welcome to ChamaSmart!"}
                </h1>
                <p className="user-hero-subtitle">
                  Your high-end command center for collective prosperity. 
                </p>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '32px' }}>
                  <Link to="/join-chama" className="btn-action-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: "16px", padding: "14px 28px", fontWeight: 700 }}>
                    <Users size={20} /><span>Join Group</span>
                  </Link>
                  <Link to="/chamas/create" className="btn-action-primary" style={{ background: "var(--gold-gradient)", border: "none", color: "white", borderRadius: "16px", padding: "14px 32px", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px", boxShadow: "var(--gold-glow)" }}>
                    <Plus size={22} /><span>Create New Chama</span>
                  </Link>
                </div>
              </div>
              <div className="user-hero-visual">
                 <Activity size={180} strokeWidth={0.5} style={{ opacity: 0.1, color: 'var(--gold-text)' }} />
              </div>
            </motion.div>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
              <LoadingSkeleton type="card" count={3} />
            ) : chamas.length === 0 ? (
              <div className="card-modern text-center" style={{ padding: "4rem 2rem" }}>
                <Activity size={56} strokeWidth={1} style={{ marginBottom: "1rem" }} />
                <h2>Start Your Journey</h2>
                <Link to="/chamas/create" className="btn-action-primary" style={{ marginTop: "2rem" }}>
                  <Plus size={18} /> Create Your First Chama
                </Link>
              </div>
            ) : (
              <>
                <div className="portfolio-grid">
                  <StatCard icon={PieChart} value={chamas.length} label="Active Chamas" image="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=800" />
                  <StatCard icon={TrendingUp} value={formatCurrency(chamas.reduce((sum, c) => sum + parseFloat(c.total_interest_earned || 0), 0))} label="Interest Earned" image="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800" />
                  <StatCard icon={DollarSign} value={formatCurrency(loanSummary.summary.totalBorrowed)} label="Direct Debt" image="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800" />
                  <StatCard icon={ShieldCheck} value={formatCurrency(loanSummary.summary.totalGuaranteed)} label="Guarantee Risk" image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800" />
                </div>

                <div className="dashboard-grid-wrapper" style={{ marginTop: "3rem" }}>
                  <div className="report-card">
                    <div className="section-header-lux">
                      <Activity size={16} color="var(--gold-soft)" />
                      <h3>Portfolio Wealth</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chamas.map(c => ({ name: c.chama_name, total: parseFloat(c.total_contributions || 0) }))}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="total" stroke="#D4AF37" fillOpacity={1} fill="url(#colorTotal)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="report-card">
                    <div className="section-header-lux">
                      <Target size={16} color="#3b82f6" />
                      <h3>Annual Targets</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={chamas.map(c => ({ name: c.chama_name, actual: parseFloat(c.total_contributions || 0), target: parseFloat(c.contribution_amount || 0) * 12 }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="target" fill="rgba(59, 130, 246, 0.1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="dashboard-section" style={{ marginTop: "3rem" }}>
                  <div className="section-header-lux">
                    <Users size={20} color="var(--gold-text)" />
                    <h3>Your Chamas</h3>
                  </div>
                  <div className="rosca-grid">
                    <AnimatePresence>
                      {chamas.map(chama => (
                        <DashboardChamaCard key={chama.chama_id} chama={chama} getChamaTypeLabel={getChamaTypeLabel} formatCurrency={formatCurrency} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
