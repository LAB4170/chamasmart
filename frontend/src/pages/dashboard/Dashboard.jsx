import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { chamaAPI } from "../../services/api";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import {
  LayoutDashboard, Plus, Search, TrendingUp, Users, Wallet, ArrowRight,
  PieChart, Activity, DollarSign, Calendar, ShieldCheck
} from "lucide-react";

// Memoized Stat Card component
const StatCard = memo(({ icon: Icon, value, label, color }) => (
  <div className="mini-stat-card">
    <div className={`mini-stat-icon ${color}`}>
      <Icon size={24} />
    </div>
    <div>
      <div className="mini-stat-value">{value}</div>
      <div className="mini-stat-label">{label}</div>
    </div>
  </div>
));

// Memoized Chama Card for dashboard list
const DashboardChamaCard = memo(({ chama, getChamaTypeLabel, formatCurrency }) => (
  <Link
    to={`/chamas/${chama.chama_id}`}
    className="cycle-card-modern"
    style={{ textDecoration: 'none' }}
  >
    <div className="cycle-card-top">
      <div className="cycle-card-name">{chama.chama_name}</div>
      <span className={`cycle-badge ${chama.chama_type === "ROSCA" ? "badge-completed" : "badge-active"}`}>
        {getChamaTypeLabel(chama.chama_type)}
      </span>
    </div>

    <div className="cycle-card-amount">
      {formatCurrency(chama.total_contributions || 0)}
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '0.5rem' }}>
        saved
      </span>
    </div>

    <div className="cycle-card-meta">
      <span title="Your Role">
        <ShieldCheck size={14} /> {chama.role}
      </span>
      <span title="Members">
        <Users size={14} /> {chama.total_members}
      </span>
      <span title="Contribution" style={{ marginLeft: 'auto' }}>
        <Wallet size={14} /> {formatCurrency(chama.contribution_amount)}
      </span>
    </div>
  </Link>
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
        <div className="page-header-modern">
          <div className="page-header-info">
            <div className="page-header-icon blue">
              <LayoutDashboard size={28} />
            </div>
            <div>
              <h1>Welcome back, {user?.firstName}!</h1>
              <p className="page-subtitle">
                Overview of your financial growth and groups.
              </p>
            </div>
          </div>
          <Link to="/chamas/create" className="btn-action-primary">
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Growth Trend Chart */}
              <div className="card-modern">
                <div className="card-header" style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={18} className="text-success" /> Wealth Growth
                  </h2>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart
                    data={(Array.isArray(chamas) ? chamas : []).map((c) => ({
                      name: c.chama_name.substring(0, 10),
                      total: parseFloat(c.total_contributions || 0)
                    }))}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                      }}
                      itemStyle={{ color: "var(--text-primary)" }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Contribution Trends Chart */}
              <div className="card-modern">
                <div className="card-header" style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={18} className="text-primary" /> Target vs. Actual
                  </h2>
                </div>
                <ResponsiveContainer width="100%" height={250}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      stroke="var(--text-secondary)"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--text-secondary)" />
                    <Tooltip
                      formatter={(value) => formatCurrency(value)}
                      cursor={{ fill: 'var(--bg-secondary)' }}
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        borderColor: "var(--border)",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar
                      dataKey="contributions"
                      fill="#3b82f6"
                      name="Saved"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="target"
                      fill="#e5e7eb"
                      name="Goal"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: 600 }}>Your Chamas</h3>
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
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
