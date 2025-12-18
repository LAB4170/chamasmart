import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { chamaAPI } from "../../services/api";
import "./Chama.css";

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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
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

  const filteredChamas =
    filter === "ALL" ? chamas : chamas.filter((c) => c.chama_type === filter);

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading your chamas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>My Chamas</h1>
            <p className="text-muted">All your chama memberships</p>
          </div>
          <Link to="/chamas/create" className="btn btn-primary">
            + Create New Chama
          </Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Filter */}
        <div className="filter-bar">
          <button
            className={`filter-btn ${filter === "ALL" ? "active" : ""}`}
            onClick={() => setFilter("ALL")}
          >
            All ({chamas.length})
          </button>
          <button
            className={`filter-btn ${filter === "ROSCA" ? "active" : ""}`}
            onClick={() => setFilter("ROSCA")}
          >
            Merry-Go-Round (
            {chamas.filter((c) => c.chama_type === "ROSCA").length})
          </button>
          <button
            className={`filter-btn ${filter === "ASCA" ? "active" : ""}`}
            onClick={() => setFilter("ASCA")}
          >
            Investment ({chamas.filter((c) => c.chama_type === "ASCA").length})
          </button>
          <button
            className={`filter-btn ${
              filter === "TABLE_BANKING" ? "active" : ""
            }`}
            onClick={() => setFilter("TABLE_BANKING")}
          >
            Table Banking (
            {chamas.filter((c) => c.chama_type === "TABLE_BANKING").length})
          </button>
          <button
            className={`filter-btn ${filter === "WELFARE" ? "active" : ""}`}
            onClick={() => setFilter("WELFARE")}
          >
            Welfare ({chamas.filter((c) => c.chama_type === "WELFARE").length})
          </button>
        </div>

        {/* Chamas Grid */}
        {filteredChamas.length === 0 ? (
          <div className="card text-center">
            <h3>No chamas found</h3>
            <p className="text-muted">
              {filter === "ALL"
                ? "You are not part of any chama yet"
                : `You don't have any ${getChamaTypeLabel(filter)} chamas`}
            </p>
            <Link to="/chamas/create" className="btn btn-primary">
              Create Your First Chama
            </Link>
          </div>
        ) : (
          <div className="chamas-grid">
            {filteredChamas.map((chama) => (
              <Link
                key={chama.chama_id}
                to={`/chamas/${chama.chama_id}`}
                className="chama-card"
              >
                <div className="chama-card-header">
                  <h3>{chama.chama_name}</h3>
                  <span
                    className={`badge badge-${
                      chama.chama_type === "ROSCA"
                        ? "primary"
                        : chama.chama_type === "ASCA"
                        ? "success"
                        : chama.chama_type === "TABLE_BANKING"
                        ? "warning"
                        : "secondary"
                    }`}
                  >
                    {getChamaTypeLabel(chama.chama_type)}
                  </span>
                </div>

                <div className="chama-card-body">
                  {chama.description && (
                    <p className="chama-description text-muted">
                      {chama.description.length > 100
                        ? chama.description.substring(0, 100) + "..."
                        : chama.description}
                    </p>
                  )}

                  <div className="chama-info">
                    <span className="info-label">Your Role:</span>
                    <span
                      className={`badge badge-${
                        chama.role === "CHAIRPERSON"
                          ? "primary"
                          : chama.role === "TREASURER"
                          ? "success"
                          : chama.role === "SECRETARY"
                          ? "warning"
                          : "secondary"
                      }`}
                    >
                      {chama.role}
                    </span>
                  </div>

                  <div className="chama-info">
                    <span className="info-label">Members:</span>
                    <span className="info-value">{chama.total_members}</span>
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

                  {chama.meeting_day && (
                    <div className="chama-info">
                      <span className="info-label">Meetings:</span>
                      <span className="info-value">{chama.meeting_day}</span>
                    </div>
                  )}
                </div>

                <div className="chama-card-footer">
                  <span className="text-muted">View Details →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyChamas;
