import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { chamaAPI, loanAPI } from "../../services/api";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Plus, Search, TrendingUp, Users, Wallet, ArrowRight,
  PieChart, Activity, DollarSign, ShieldCheck, BarChart3
} from "lucide-react";

// ─── StatCard ───────────────────────────────────────────────────────────────
const StatCard = memo(({ icon: Icon, value, label, color }) => (
  <motion.div
    className="mini-stat-card group"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
  >
    <div className={`mini-stat-icon ${color} group-hover:scale-110 transition-transform`}>
      <Icon size={24} />
    </div>
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="mini-stat-value">{value}</div>
      <div className="mini-stat-label">{label}</div>
    </div>
  </motion.div>
));

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

// ─── DashboardChamaCard ───────────────────────────────────────────────────────
const DashboardChamaCard = memo(({ chama, getChamaTypeLabel, formatCurrency }) => (
  <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
    <Link to={`/chamas/${chama.chama_id}`} className="cycle-card-modern group" style={{ textDecoration: "none" }}>
      <div className="cycle-card-top">
        <div className="cycle-card-name">{chama.chama_name}</div>
        <span className={`cycle-badge ${chama.chama_type === "ROSCA" ? "badge-completed" : "badge-active"}`}>
          {getChamaTypeLabel(chama.chama_type)}
        </span>
      </div>
      <div className="cycle-card-amount" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div>
          {formatCurrency(
            ['ASCA', 'TABLE_BANKING'].includes(chama.chama_type) 
              ? chama.current_fund || 0 
              : chama.total_contributions || 0
          )}
          <span style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", color: "#94a3b8", marginLeft: "0.5rem" }}>
            {['ASCA', 'TABLE_BANKING'].includes(chama.chama_type) ? "Net Worth" : "Total Saved"}
          </span>
        </div>
        
        {['ASCA', 'TABLE_BANKING'].includes(chama.chama_type) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.5rem', background: 'var(--surface)', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 800 }}>Base Savings</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(chama.total_contributions || 0)}</span>
            </div>
            <div style={{ width: '1px', background: 'var(--border)' }}></div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 800 }}>Interest Earned</span>
              <span style={{ fontWeight: 800, color: '#10b981' }}>+{formatCurrency(chama.total_interest_earned || 0)}</span>
            </div>
          </div>
        )}
      </div>
      <div className="cycle-card-meta" style={{ marginTop: ['ASCA', 'TABLE_BANKING'].includes(chama.chama_type) ? '0.5rem' : 'auto' }}>
        <span title="Your Role"><ShieldCheck size={14} /> {chama.role}</span>
        <span title="Members"><Users size={14} /> {chama.total_members}</span>
        <span title="Contribution" style={{ marginLeft: "auto" }}>
          <Wallet size={14} /> {formatCurrency(chama.contribution_amount)}
        </span>
      </div>
    </Link>
  </motion.div>
));

// ─── Dashboard ────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { user } = useAuth();
  const [chamas, setChamas] = useState([]);
  const [loanSummary, setLoanSummary] = useState({
    borrowed: [], guaranteed: [], summary: { totalBorrowed: 0, totalGuaranteed: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchDashboardData = async () => {
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
    fetchDashboardData();
    return () => { isMounted = false; };
  }, []);

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
      <div className="container">
        <div className="dashboard-content-wrapper">

          {/* Header */}
          <div className="page-header-modern" style={{ border: "none", background: "transparent", padding: "0 0 2rem 0" }}>
            <div className="page-header-info">
              <div className="page-header-icon blue">
                <LayoutDashboard size={28} />
              </div>
              <div>
                <h1>Welcome back, {user?.firstName || user?.first_name}!</h1>
                <p className="page-subtitle">Your financial portfolio overview across all groups.</p>
              </div>
            </div>
            <Link to="/chamas/create" className="btn-action-primary">
              <Plus size={18} /><span>Create New Chama</span>
            </Link>
          </div>

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
              <div className="stats-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <StatCard icon={PieChart} value={chamas.length} label="Active Chamas" color="blue" />
                <StatCard 
                  icon={TrendingUp} 
                  value={formatCurrency(chamas.reduce((sum, c) => sum + parseFloat(c.total_interest_earned || 0), 0))} 
                  label="Total Interest Earned" 
                  color="green" 
                />
                <StatCard icon={DollarSign} value={formatCurrency(loanSummary.summary.totalBorrowed)} label="Direct Debt" color="amber" />
                <StatCard icon={ShieldCheck} value={formatCurrency(loanSummary.summary.totalGuaranteed)} label="Guarantee Risk" color="purple" />
              </div>

              {/* ── Loan Commitments ── */}
              <div className="dashboard-section" style={{ marginBottom: "2rem" }}>
                <h3 style={{ fontWeight: 900, fontSize: "1.1rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ width: "6px", height: "24px", background: "#f59e0b", borderRadius: "3px", display: "inline-block" }} />
                  Loan Commitments
                </h3>
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
              </div>

              {/* ── Charts ── */}
              <div className="dashboard-grid-wrapper">
                {/* Portfolio Distribution */}
                <div className="report-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                    <h2 style={{ fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, color: "var(--text-secondary)" }}>
                      <PieChart size={16} style={{ color: "#10b981" }} /> Portfolio Distribution
                    </h2>
                  </div>
                  <div style={{ padding: "1rem" }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart 
                        data={chamas.map((c) => ({ 
                          name: c.chama_name?.length > 10 ? c.chama_name.substring(0, 10) + "…" : c.chama_name, 
                          total: parseFloat(['ASCA', 'TABLE_BANKING'].includes(c.chama_type) ? (c.current_fund || 0) : (c.total_contributions || 0)) 
                        })).sort((a,b) => b.total - a.total)}
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} opacity={0.5} />
                        <XAxis type="number" tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(val) => {
                          if(val >= 1000000) return (val/1000000).toFixed(1) + 'M';
                          if(val >= 1000) return (val/1000).toFixed(0) + 'K';
                          return val;
                        }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} width={80}/>
                        <Tooltip 
                          formatter={(v) => formatCurrency(v)} 
                          cursor={{ fill: "var(--surface)", opacity: 0.5 }} 
                          contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-surface-glass)", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }} 
                        />
                        <Bar dataKey="total" name="Net Worth / Saved" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Target Alignment */}
                <div className="report-card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
                    <h2 style={{ fontSize: "0.75rem", fontWeight: 900, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, color: "var(--text-secondary)" }}>
                      <BarChart3 size={16} style={{ color: "var(--primary)" }} /> Target Alignment
                    </h2>
                  </div>
                  <div style={{ padding: "1rem" }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart 
                        data={chamas.slice(0, 6).map((c) => {
                          const contributions = parseFloat(c.total_contributions || 0);
                          const target = parseFloat(c.contribution_amount || 0) * 12; // Annualized baseline target
                          const validTarget = target > 0 ? target : 10000; // prevent zero division
                          const pct = Math.min(100, Math.round((contributions / validTarget) * 100));
                          return {
                            name: c.chama_name?.length > 10 ? c.chama_name.substring(0, 10) + "…" : c.chama_name,
                            contributions,
                            target: validTarget,
                            pct
                          };
                        })} 
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(val) => {
                          if(val >= 1000000) return (val/1000000).toFixed(1) + 'M';
                          if(val >= 1000) return (val/1000).toFixed(0) + 'K';
                          return val;
                        }} axisLine={false} tickLine={false} />
                        
                        {/* Custom Tooltip for Percentage Insight */}
                        <Tooltip 
                          cursor={{ fill: "rgba(59,130,246,0.05)" }} 
                          contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-surface-glass)", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }} 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                                  <p style={{ margin: "0 0 8px 0", fontWeight: 'bold' }}>{label}</p>
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Annual Target: <strong style={{color: 'var(--text-primary)'}}>{formatCurrency(data.target)}</strong></div>
                                  <div style={{ color: '#3b82f6', fontSize: '0.85rem' }}>Accumulated: <strong>{formatCurrency(data.contributions)}</strong></div>
                                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontWeight: 'bold', color: data.pct >= 100 ? '#10b981' : 'inherit' }}>
                                    {data.pct}% Achieved
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase" }} />
                        
                        {/* Overlapping Bars: Background first (Target), Foreground second (Contributions) */}
                        <Bar dataKey="target" name="Annual Benchmark" fill="#dbeafe" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="contributions" name="Accumulated" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} style={{ transform: 'translateX(-50%)', transformOrigin: 'bottom' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* ── Portfolio Groups ── */}
              <div className="dashboard-section" style={{ marginTop: "2rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                  <h3 style={{ fontWeight: 900, fontSize: "1.1rem", margin: 0, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ width: "6px", height: "24px", background: "var(--primary)", borderRadius: "3px", display: "inline-block" }} />
                    Your Portfolio Groups
                  </h3>
                  <span style={{ fontSize: "0.65rem", fontWeight: 900, textTransform: "uppercase", background: "var(--surface-3)", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "999px" }}>
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
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
