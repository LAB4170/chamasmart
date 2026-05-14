import { useState, useEffect, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { toast } from "react-toastify";
import { chamaAPI, loanAPI } from "../../services/api";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Plus, Search, TrendingUp, Users, Wallet, ArrowRight,
  PieChart, Activity, DollarSign, ShieldCheck, BarChart3, CheckCircle2, AlertCircle, Target
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
    // Redirect to complete profile if name is missing or placeholder
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
      // Silently re-fetch without mounting loaders if possible, or just refetch globally
      fetchDashboardData(true);
    };

    socket.on("personal_dashboard_update", handleDashboardUpdate);
    
    return () => {
      socket.off("personal_dashboard_update", handleDashboardUpdate);
    };
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
      {/* Background Blobs */}
      <div className="ambient-blob blob-gold" />
      <div className="ambient-blob blob-blue" />

      <div className="container">
        <motion.div 
          className="dashboard-lux-wrapper"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.15
              }
            }
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
                Track your chamas, manage debt, and watch your portfolio grow with precision.
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
            <div className="user-hero-visual" style={{ position: 'relative', zIndex: 1 }}>
               <Activity size={180} strokeWidth={0.5} style={{ opacity: 0.1, color: 'var(--gold-text)' }} />
            </div>
          </motion.div>

          {error && <div className="alert alert-error">{error}</div>}

          {loading ? (
            <div>
              <div className="stats-row" style={{ marginBottom: "2rem" }}>
                <LoadingSkeleton type="card" count={3} />
              </div>
              <LoadingSkeleton type="card" count={4} />
            </div>
          ) : chamas.length === 0 ? (
            /* ── Empty state ── */
            <div className="card-modern text-center" style={{ padding: "4rem 2rem" }}>
              <div className="empty-state-icon"><Activity size={56} strokeWidth={1} /></div>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Your Financial Journey Starts Here</h2>
              <p className="text-muted" style={{ maxWidth: "500px", margin: "0 auto 2.5rem" }}>
                Join or create a Chama to unlock real-time growth tracking, secure contributions, and group analytics.
              </p>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/chamas/create" className="btn-action-primary" style={{ padding: "0.8rem 1.5rem" }}>
                  <Plus size={18} /> Create Your First Chama
                </Link>
                <Link to="/join-chama" className="btn-action-secondary" style={{ padding: "0.8rem 1.5rem" }}>
                  <Users size={18} /> Join with Code
                </Link>
                <Link to="/browse-chamas" className="btn-action-secondary" style={{ padding: "0.8rem 1.5rem" }}>
                  <Search size={18} /> Browse Groups
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* ── High Priority Alerts ── */}
              {loanSummary.guaranteed.filter(l => l.status === 'DEFAULTED').map(loan => (
                <motion.div 
                  key={`alert-${loan.loan_id}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="alert alert-error" 
                  style={{ 
                    marginBottom: "2rem", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "1rem 1.5rem",
                    borderRadius: "1rem",
                    border: "1px solid #fee2e2",
                    background: "#fef2f2"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ background: "#ef4444", color: "#fff", padding: "0.5rem", borderRadius: "0.5rem" }}>
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 900, color: "#991b1b" }}>
                        Action Required: Guaranteed Loan Default
                      </h4>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "#b91c1c" }}>
                        The loan you guaranteed for <strong>{loan.borrower_name}</strong> in {loan.chama_name} has defaulted. Please settle the liability.
                      </p>
                    </div>
                  </div>
                  <Link to={`/chamas/${loan.chama_id}/loans`} className="btn btn-sm btn-danger">
                    Settle Now
                  </Link>
                </motion.div>
              ))}

              {/* ── Stat Cards ── */}
              <div className="portfolio-grid">
                <StatCard 
                  icon={PieChart} 
                  value={chamas.length} 
                  label="Active Chamas" 
                  image="https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=800" 
                />
                <StatCard 
                  icon={TrendingUp} 
                  value={formatCurrency(chamas.reduce((sum, c) => sum + parseFloat(c.total_interest_earned || 0), 0))} 
                  label="Interest Earned" 
                  image="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&q=80&w=800" 
                />
                <StatCard 
                  icon={DollarSign} 
                  value={formatCurrency(loanSummary.summary.totalBorrowed)} 
                  label="Direct Debt" 
                  image="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800" 
                />
                <StatCard 
                  icon={ShieldCheck} 
                  value={formatCurrency(loanSummary.summary.totalGuaranteed)} 
                  label="Guarantee Risk" 
                  image="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=800" 
                />
              </div>

              {/* ── Loan Commitments ── */}
              <motion.div className="dashboard-section" style={{ marginBottom: "3rem" }} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                <div className="section-header-lux">
                  <span />
                  <h3>Loan Commitments</h3>
                </div>
                {allLoans.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "2rem", opacity: 0.5, border: "2px dashed var(--border)", borderRadius: "var(--radius-lg)" }}>
                    <p style={{ margin: 0, fontWeight: 700, textTransform: "uppercase", fontSize: "0.8rem" }}>No Active Loan Commitments</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                    {allLoans.map((loan) => (
                      <LoanCommitmentCard
                        key={`${loan.user_role}-${loan.loan_id}`}
                        loan={loan}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </motion.div>

              {/* ── Charts ── */}
              {/* ── Cinematic Charts Overhaul ── */}
              <div className="dashboard-grid-wrapper">
                {/* Portfolio Wealth Growth & Distribution */}
                <div className="report-card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-surface-glass)" }}>
                  <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, color: "var(--text-secondary)" }}>
                      <Activity size={16} style={{ color: "var(--gold-soft)" }} /> Portfolio Wealth
                    </h2>
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Contribution Density</div>
                  </div>
                  <div style={{ padding: "1.5rem 1rem 1rem 1rem" }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart 
                        data={chamas.map((c) => ({ 
                          name: c.chama_name?.length > 8 ? c.chama_name.substring(0, 8) + "…" : c.chama_name, 
                          total: parseFloat(['ASCA', 'TABLE_BANKING'].includes(c.chama_type) ? (c.current_fund || 0) : (c.total_contributions || 0)) 
                        })).sort((a,b) => b.total - a.total)}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="wealthGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--gold-soft)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--gold-soft)" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="wealthStroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#D4AF37" />
                            <stop offset="100%" stopColor="#F59E0B" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 10, fontWeight: 700, fill: "var(--text-secondary)" }} 
                          axisLine={false} 
                          tickLine={false} 
                          dy={10}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontWeight: 700, fill: "var(--text-secondary)" }} 
                          tickFormatter={(val) => val >= 1000 ? (val/1000).toFixed(0) + 'K' : val} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="recharts-default-tooltip" style={{ minWidth: "180px" }}>
                                  <p className="recharts-tooltip-label">{label}</p>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Net Stake:</span>
                                    <span style={{ fontWeight: 800, color: "var(--gold-text)" }}>{formatCurrency(payload[0].value)}</span>
                                  </div>
                                  <div style={{ marginTop: "8px", height: "4px", background: "rgba(212,175,55,0.1)", borderRadius: "2px" }}>
                                    <div style={{ width: "100%", height: "100%", background: "var(--gold-gradient)", borderRadius: "2px" }} />
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="total" 
                          stroke="url(#wealthStroke)" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#wealthGradient)" 
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Target Alignment - Premium Bar Design */}
                <div className="report-card" style={{ padding: 0, overflow: "hidden", background: "var(--bg-surface-glass)" }}>
                  <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, color: "var(--text-secondary)" }}>
                      <Target size={16} style={{ color: "#3b82f6" }} /> Annual Targets
                    </h2>
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase" }}>Benchmark vs Actual</div>
                  </div>
                  <div style={{ padding: "1.5rem 1rem 1rem 1rem" }}>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart 
                          data={chamas.slice(0, 6).map((c) => {
                            const contributions = parseFloat(c.total_contributions || 0);
                            const target = parseFloat(c.contribution_amount || 0) * 12;
                            const validTarget = target > 0 ? target : 10000;
                            const pct = Math.min(100, Math.round((contributions / validTarget) * 100));
                            return {
                              name: c.chama_name?.length > 8 ? c.chama_name.substring(0, 8) + "…" : c.chama_name,
                              contributions,
                              target: validTarget,
                              pct
                            };
                          })} 
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          barCategoryGap="20%"
                          barGap={-32} // Overlays bars
                        >
                          <defs>
                            <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" stopOpacity={1}/>
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8}/>
                            </linearGradient>
                            <filter id="glow">
                              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                              <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                              </feMerge>
                            </filter>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 10, fontWeight: 700, fill: "var(--text-secondary)" }} 
                            axisLine={false} 
                            tickLine={false} 
                            dy={10}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fontWeight: 700, fill: "var(--text-secondary)" }} 
                            tickFormatter={(val) => val >= 1000 ? (val/1000).toFixed(0) + 'K' : val}
                            axisLine={false} 
                            tickLine={false} 
                          />
                          <Tooltip 
                            cursor={{ fill: "rgba(59, 130, 246, 0.05)" }} 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0]?.payload;
                                return (
                                  <div className="recharts-default-tooltip" style={{ minWidth: "200px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                      <p className="recharts-tooltip-label" style={{ margin: 0 }}>{label}</p>
                                      <span style={{ fontSize: "0.7rem", fontWeight: 900, color: d?.pct >= 100 ? "#10b981" : "#3b82f6", background: "rgba(0,0,0,0.2)", padding: "2px 8px", borderRadius: "6px" }}>
                                        {d?.pct}%
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                                        <span style={{ color: "var(--text-muted)" }}>Target:</span>
                                        <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{formatCurrency(d?.target)}</span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                                        <span style={{ color: "var(--text-muted)" }}>Actual:</span>
                                        <span style={{ color: "#3b82f6", fontWeight: 800 }}>{formatCurrency(d?.contributions)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="target" 
                            name="Benchmark" 
                            fill="rgba(255, 255, 255, 0.03)" 
                            radius={[8, 8, 0, 0]} 
                            barSize={32}
                          />
                          <Bar 
                            dataKey="contributions" 
                            name="Accumulated" 
                            fill="url(#barBlue)" 
                            radius={[6, 6, 0, 0]} 
                            barSize={18}
                            filter="url(#glow)"
                          />
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── Portfolio Groups ── */}
              <motion.div className="dashboard-section" style={{ marginTop: "3rem" }} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
                  <div className="section-header-lux">
                    <span />
                    <h3>Your Portfolio Groups</h3>
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", background: "rgba(212, 175, 55, 0.1)", color: "var(--gold-text)", padding: "6px 14px", borderRadius: "10px", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
                    {chamas.length} groups active
                  </span>
                </div>
                <div className="rosca-grid">
                  {chamas.map((chama) => (
                    <DashboardChamaCard
                      key={chama.chama_id}
                      chama={chama}
                      getChamaTypeLabel={getChamaTypeLabel}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </div>
              </motion.div>
            </>
          )}

        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
