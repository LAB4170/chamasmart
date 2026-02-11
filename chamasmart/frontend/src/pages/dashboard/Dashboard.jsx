import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { chamaAPI } from "../../services/api";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";

// Memoized Stat Card component
const StatCard = memo(({ icon, value, label }) => (
  <div className="stat-card">
    <div className="stat-icon">{icon}</div>
    <div>
      <h3>{value}</h3>
      <p>{label}</p>
    </div>
  </div>
));

// Memoized Chama Card for dashboard list
const DashboardChamaCard = memo(({ chama, getChamaTypeLabel, formatCurrency }) => (
  <Link
    to={`/chamas/${chama.chama_id}`}
    className="chama-card"
  >
    <div className="chama-card-header">
      <h3>{chama.chama_name}</h3>
      <span
        className={`badge badge-${chama.chama_type === "ROSCA" ? "primary" : "success"
          }`}
      >
        {getChamaTypeLabel(chama.chama_type)}
      </span>
    </div>

    <div className="chama-card-body">
      <div className="chama-info">
        <span className="info-label">Your Role:</span>
        <span className="info-value badge badge-warning">
          {chama.role}
        </span>
      </div>

      <div className="chama-info">
        <span className="info-label">Members:</span>
        <span className="info-value">
          {chama.total_members}
        </span>
      </div>

      <div className="chama-info">
        <span className="info-label">Contribution:</span>
        <span className="info-value">
          {formatCurrency(chama.contribution_amount)}
        </span>
      </div>

      <div className="chama-info">
        <span className="info-label">Your Total:</span>
        <span className="info-value text-success">
          {formatCurrency(chama.total_contributions || 0)}
        </span>
      </div>

      <div className="chama-info">
        <span className="info-label">Frequency:</span>
        <span className="info-value">
          {chama.contribution_frequency}
        </span>
      </div>
    </div>

    <div className="chama-card-footer">
      <span className="text-muted">View Details →</span>
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
        if (isMounted) {
          setLoading(true);
        }
        const response = await chamaAPI.getMyChamas();
        if (isMounted) {
          setChamas(response.data.data);
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load your chamas");
          console.error(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
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
        <div className="dashboard-header">
          <div>
            <h1>Welcome back, {user?.firstName}!</h1>
            <p className="text-muted">
              Manage your chama groups and contributions
            </p>
          </div>
          <Link to="/chamas/create" className="btn btn-primary">
            + Create New Chama
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div>
            <div className="stats-grid" style={{ marginBottom: '2rem' }}>
              <LoadingSkeleton type="card" count={3} />
            </div>
            <LoadingSkeleton type="card" count={4} />
          </div>
        ) : chamas.length === 0 ? (
          <div className="card text-center" style={{ padding: '3rem 2rem' }}>
            <div className="mb-4" style={{ fontSize: '4rem', opacity: 0.5 }}>📊</div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>Your Financial Journey Starts Here</h2>
            <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto 2rem', fontSize: '1.1rem' }}>
              Once you join a Chama, this dashboard will come alive with real-time growth trends, contribution tracking, and group analytics.
            </p>

            <div className="ghost-analytics-preview" style={{ opacity: 0.3, marginBottom: '3rem' }}>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={[
                  { name: 'Jan', value: 100 }, { name: 'Feb', value: 150 },
                  { name: 'Mar', value: 300 }, { name: 'Apr', value: 250 },
                  { name: 'May', value: 500 }
                ]}>
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="var(--primary-light)" />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>Example: Potential Growth over 6 months</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/chamas/create" className="btn btn-primary btn-lg">
                + Create Your Chama
              </Link>
              <Link to="/browse-chamas" className="btn btn-outline btn-lg">
                Browse Groups
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <StatCard
                icon="📊"
                value={chamas.length}
                label="Active Chamas"
              />

              <StatCard
                icon="💰"
                value={formatCurrency(
                  chamas.reduce(
                    (sum, chama) =>
                      sum + parseFloat(chama.total_contributions || 0),
                    0
                  )
                )}
                label="Total Contributions"
              />

              <StatCard
                icon="👥"
                value={chamas.reduce(
                  (sum, chama) => sum + parseInt(chama.total_members || 0),
                  0
                )}
                label="Total Members"
              />
            </div>

            {/* Growth Trend Chart (New Area Chart) */}
            <div className="card">
              <div className="card-header">
                <h2>🌊 Personal Wealth Growth</h2>
                <p className="text-muted">Cumulative savings across all chamas</p>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart
                  data={chamas.map((c, i) => ({
                    name: c.chama_name.substring(0, 10),
                    total: parseFloat(c.total_contributions || 0)
                  }))}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <CartesianGrid strokeDasharray="3 3" />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="total" stroke="var(--primary)" fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Contribution Trends Chart */}
            <div className="card">
              <div className="card-header">
                <h2>📊 Contribution Status by Chama</h2>
                <p className="text-muted">Your total contributions vs annual target</p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chamas.slice(0, 6).map((chama, index) => ({
                    name: chama.chama_name.length > 15
                      ? chama.chama_name.substring(0, 15) + "..."
                      : chama.chama_name,
                    contributions: parseFloat(chama.total_contributions || 0),
                    target: parseFloat(chama.contribution_amount || 0) * 12,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "var(--surface-1)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      color: "var(--text-primary)"
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="contributions"
                    fill="var(--primary)"
                    name="Your Contributions"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar
                    dataKey="target"
                    fill="var(--secondary)"
                    name="Annual Target"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Your Chamas</h2>
              </div>

              <div className="chamas-grid">
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
  );
};

export default Dashboard;
