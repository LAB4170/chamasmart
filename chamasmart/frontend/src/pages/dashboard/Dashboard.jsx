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
          <div className="card text-center">
            <h3>You're not part of any chama yet</h3>
            <p className="text-muted">
              Create your first chama or ask to join an existing one
            </p>
            <Link to="/chamas/create" className="btn btn-primary">
              Create Your First Chama
            </Link>
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

            {/* Contribution Trends Chart */}
            <div className="card">
              <div className="card-header">
                <h2>📈 Contribution Status by Chama</h2>
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
                      backgroundColor: "var(--white)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
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
