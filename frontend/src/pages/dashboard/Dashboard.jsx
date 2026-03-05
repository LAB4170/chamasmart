import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { chamaAPI } from "../../services/api";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Plus, Search, TrendingUp, Users, Wallet, ArrowRight,
  PieChart, Activity, DollarSign, Calendar, ShieldCheck, BarChart3
} from "lucide-react";

// Memoized Stat Card component
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
    <div className="flex flex-col">
      <div className="mini-stat-value">{value}</div>
      <div className="mini-stat-label">{label}</div>
    </div>
  </motion.div>
));

// Memoized Chama Card for dashboard list
const DashboardChamaCard = memo(({ chama, getChamaTypeLabel, formatCurrency }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <Link
      to={`/chamas/${chama.chama_id}`}
      className="cycle-card-modern group"
      style={{ textDecoration: 'none' }}
    >
      <div className="cycle-card-top">
        <div className="cycle-card-name group-hover:text-primary transition-colors">{chama.chama_name}</div>
        <span className={`cycle-badge ${chama.chama_type === "ROSCA" ? "badge-completed" : "badge-active"}`}>
          {getChamaTypeLabel(chama.chama_type)}
        </span>
      </div>

      <div className="cycle-card-amount">
        {formatCurrency(chama.total_contributions || 0)}
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
          Total Saved
        </span>
      </div>

      <div className="cycle-card-meta">
        <span title="Your Role">
          <ShieldCheck size={14} className="text-primary" /> {chama.role}
        </span>
        <span title="Members">
          <Users size={14} className="text-secondary" /> {chama.total_members}
        </span>
        <span title="Contribution" style={{ marginLeft: 'auto' }}>
          <Wallet size={14} className="text-indigo-500" /> {formatCurrency(chama.contribution_amount)}
        </span>
      </div>
      
      {/* Visual background element */}
      <div className="absolute -bottom-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Activity size={100} strokeWidth={1} />
      </div>
    </Link>
  </motion.div>
));

const Dashboard = () => {
  const { user } = useAuth();
  const [chamas, setChamas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchMyChamas = async () => {
      try {
        if (isMounted) setLoading(true);
        const response = await chamaAPI.getMyChamas();
        if (isMounted) {
          const chamasData = response.data?.data;
          setChamas(Array.isArray(chamasData) ? chamasData : []);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load your chamas");
          console.error(err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMyChamas();

    return () => {
      isMounted = false;
    };
  }, []);

  const getChamaTypeLabel = (type) => {
    const types = {
      ROSCA: "Merry-Go-Round",
      ASCA: "Investment",
      TABLE_BANKING: "Table Banking",
      WELFARE: "Welfare",
    };
    return types[type] || type;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  return (
    <div className="page">
      <div className="container">
        <div className="dashboard-content-wrapper">
          <div className="page-header-modern" style={{ border: 'none', background: 'transparent', padding: '0 0 2rem 0' }}>
            <div className="page-header-info">
              <div className="page-header-icon blue shadow-lg shadow-blue-500/20">
                <LayoutDashboard size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight">Welcome back, {user?.firstName}!</h1>
                <p className="page-subtitle text-slate-500">
                  Your financial portfolio overview across all groups.
                </p>
              </div>
            </div>
            <Link to="/chamas/create" className="btn-action-primary shadow-xl shadow-emerald-500/20">
              <Plus size={18} />
              <span>Create New Chama</span>
            </Link>
          </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div>
            <div className="stats-row" style={{ marginBottom: '2rem' }}>
              <LoadingSkeleton type="card" count={3} />
            </div>
            <LoadingSkeleton type="card" count={4} />
          </div>
        ) : chamas.length === 0 ? (
          <div className="card-modern text-center" style={{ padding: '4rem 2rem' }}>
            <div className="empty-state-icon">
              <Activity size={56} strokeWidth={1} />
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Your Financial Journey Starts Here
            </h2>
            <p className="text-muted" style={{ maxWidth: '500px', margin: '0 auto 2.5rem', fontSize: '1.05rem' }}>
              Join or create a Chama to unlock real-time growth tracking, secure contributions, and group analytics.
            </p>

            <div className="ghost-analytics-preview" style={{ opacity: 0.4, marginBottom: '3rem', filter: 'grayscale(100%)' }}>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={[
                  { name: 'Jan', value: 100 }, { name: 'Feb', value: 150 },
                  { name: 'Mar', value: 300 }, { name: 'Apr', value: 250 },
                  { name: 'May', value: 500 }
                ]}>
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="var(--primary-light)" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '1rem' }}>Preview: Potential Growth Visualization</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/chamas/create" className="btn-action-primary" style={{ padding: '0.8rem 1.5rem' }}>
                <Plus size={18} /> Create Your First Chama
              </Link>
              <Link to="/join-chama" className="btn-action-secondary" style={{ padding: '0.8rem 1.5rem' }}>
                <Users size={18} /> Join with Code
              </Link>
              <Link to="/browse-chamas" className="btn-action-secondary" style={{ padding: '0.8rem 1.5rem' }}>
                <Search size={18} /> Browse Groups
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="stats-row">
              <StatCard
                icon={PieChart}
                value={Array.isArray(chamas) ? chamas.length : 0}
                label="Active Chamas"
                color="blue"
              />

              <StatCard
                icon={TrendingUp}
                value={formatCurrency(
                  (Array.isArray(chamas) ? chamas : []).reduce(
                    (sum, chama) =>
                      sum + parseFloat(chama.total_contributions || 0),
                    0
                  )
                )}
                label="Total Contributions"
                color="green"
              />

              <StatCard
                icon={Users}
                value={(Array.isArray(chamas) ? chamas : []).reduce(
                  (sum, chama) => sum + parseInt(chama.total_members || 0),
                  0
                )}
                label="Total Network"
                color="purple"
              />
            </div>

            <div className="dashboard-grid-wrapper">
              {/* Growth Trend Chart */}
              <div className="report-card !p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-500" /> Wealth Velocity
                  </h2>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={(Array.isArray(chamas) ? chamas : []).map((c) => ({
                        name: c.chama_name.substring(0, 10),
                        total: parseFloat(c.total_contributions || 0)
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} stroke="var(--gray)" axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="var(--gray)" axisLine={false} tickLine={false} />
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "var(--bg-surface-glass)",
                          backdropFilter: "var(--glass-blur)",
                          borderColor: "var(--glass-border)",
                          borderRadius: "16px",
                          boxShadow: "var(--shadow-xl)",
                          border: "none"
                        }}
                        labelStyle={{ fontWeight: 800, color: "var(--primary)", marginBottom: "4px" }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Contribution Trends Chart */}
              <div className="report-card !p-0 overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <BarChart3 size={16} className="text-primary" /> Target Alignment
                  </h2>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(Array.isArray(chamas) ? chamas : []).slice(0, 6).map((chama) => ({
                        name: chama.chama_name.length > 10
                          ? chama.chama_name.substring(0, 10) + "..."
                          : chama.chama_name,
                        contributions: parseFloat(chama.total_contributions || 0),
                        target: parseFloat(chama.contribution_amount || 0) * 12,
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fontWeight: 700 }}
                        stroke="var(--gray)"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} stroke="var(--gray)" axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                        contentStyle={{
                          backgroundColor: "var(--bg-surface-glass)",
                          backdropFilter: "var(--glass-blur)",
                          borderColor: "var(--glass-border)",
                          borderRadius: "16px",
                          boxShadow: "var(--shadow-xl)",
                          border: "none"
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', tracking: '0.1em' }} />
                      <Bar
                        dataKey="contributions"
                        fill="url(#colorBar)"
                        name="Accumulated"
                        radius={[6, 6, 0, 0]}
                      >
                         <defs>
                          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                      </Bar>
                      <Bar
                        dataKey="target"
                        fill="var(--border)"
                        name="Benchmark"
                        radius={[6, 6, 0, 0]}
                        opacity={0.3}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="dashboard-section" style={{ marginTop: '3rem' }}>
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black tracking-tight flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  Your Portfolio Groups
                </h3>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  {chamas.length} groups active
                </div>
              </div>
              <div className="rosca-grid">
                {(Array.isArray(chamas) ? chamas : []).map((chama) => (
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
