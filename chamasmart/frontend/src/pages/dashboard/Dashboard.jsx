import { useState, useEffect, memo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { chamaAPI } from "../../services/api";
import LoadingSkeleton from "../../components/LoadingSkeleton";

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
    fetchMyChamas();
  }, []);

  const fetchMyChamas = async () => {
    try {
      setLoading(true);
      const response = await chamaAPI.getMyChamas();
      setChamas(response.data.data);
    } catch (err) {
      setError("Failed to load your chamas");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
