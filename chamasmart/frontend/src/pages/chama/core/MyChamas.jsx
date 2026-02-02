import { useState, useEffect, memo, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import LoadingSkeleton from "../../../components/LoadingSkeleton";

const MyChamaCard = memo(({ chama, getChamaTypeLabel, formatCurrency }) => (
  <Link
    to={`/chamas/${chama.chama_id}`}
    className="chama-card"
  >
    <div className="chama-card-header">
      <div className="chama-type-badge">
        {getChamaTypeLabel(chama.chama_type)}
      </div>
      <h3>{chama.chama_name}</h3>
    </div>

    <div className="chama-card-body">
      {chama.description && (
        <p className="chama-description text-muted">
          {chama.description}
        </p>
      )}

      <div className="chama-info">
        <span className="info-label">Your Role</span>
        <span
          className={`badge badge-${chama.role === "CHAIRPERSON"
            ? "primary"
            : chama.role === "TREASURER"
              ? "success"
              : "secondary"
            }`}
        >
          {chama.role}
        </span>
      </div>

      <div className="chama-info">
        <span className="info-label">Members</span>
        <span className="info-value">{chama.total_members}</span>
      </div>

      <div className="chama-info">
        <span className="info-label">Contribution</span>
        <span className="info-value">
          {formatCurrency(chama.contribution_amount)}
        </span>
      </div>

      <div className="chama-info">
        <span className="info-label">Total Saved</span>
        <span className="info-value text-success" style={{ fontWeight: '700' }}>
          {formatCurrency(chama.total_contributions || 0)}
        </span>
      </div>
    </div>

    <div className="chama-card-footer">
      Go to Group →
    </div>
  </Link>
));

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
      setChamas(response.data.data);
    } catch (err) {
      setError("Failed to load your chamas");
      console.error(err);
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
    { id: "ALL", label: "All", icon: "🏢" },
    { id: "ROSCA", label: "Merry-Go-Round", icon: "🔄" },
    { id: "ASCA", label: "Investment", icon: "📈" },
    { id: "TABLE_BANKING", label: "Table Banking", icon: "🏦" },
    { id: "WELFARE", label: "Welfare", icon: "🤝" },
  ];

  return (
    <div className="page">
      <div className="container">
        <div className="page-header" style={{ marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Chamas</h1>
            <p className="text-muted" style={{ fontSize: '1.1rem' }}>Manage your memberships and track your growth.</p>
          </div>
          <Link to="/chamas/create" className="btn btn-primary btn-lg">
            ✨ Create New Chama
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Filter Bar */}
        <div className="filter-bar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`filter-btn ${filter === cat.id ? "active" : ""}`}
              onClick={() => setFilter(cat.id)}
            >
              <span>{cat.icon}</span>
              {cat.label} ({cat.id === "ALL" ? chamas.length : chamas.filter((c) => c.chama_type === cat.id).length})
            </button>
          ))}
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="chamas-grid">
            <LoadingSkeleton type="card" count={3} />
          </div>
        ) : filteredChamas.length === 0 ? (
          <div className="card text-center" style={{ padding: '4rem 2rem' }}>
            <div className="mb-4" style={{ fontSize: '4rem' }}>🏜️</div>
            <h2>No chamas found</h2>
            <p className="text-muted" style={{ fontSize: '1.1rem', maxWidth: '500px', margin: '1rem auto' }}>
              {filter === "ALL"
                ? "You haven't joined any groups yet. Start your financial journey today!"
                : `You don't have any ${getChamaTypeLabel(filter)} chamas yet.`}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
              <Link to="/chamas/create" className="btn btn-primary">
                Start a Chama
              </Link>
              <Link to="/browse-chamas" className="btn btn-outline">
                Browse Groups
              </Link>
            </div>
          </div>
        ) : (
          <div className="chamas-grid">
            {filteredChamas.map((chama) => (
              <MyChamaCard
                key={chama.chama_id}
                chama={chama}
                getChamaTypeLabel={getChamaTypeLabel}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyChamas;
