import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, contributionAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./Chama.css";

const ChamaDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchChamaData();
  }, [id]);

  const fetchChamaData = async () => {
    try {
      setLoading(true);
      setError("");

      // Check if user is authenticated
      if (!user) {
        setError("Please log in to view chama details");
        navigate("/login");
        return;
      }

      // Fetch chama details
      const chamaRes = await chamaAPI.getById(id);
      setChama(chamaRes.data.data);

      // Fetch members
      const membersRes = await chamaAPI.getMembers(id);
      setMembers(membersRes.data.data);

      // Fetch stats
      const statsRes = await chamaAPI.getStats(id);
      setStats(statsRes.data.data);

      // Fetch recent contributions
      const contribRes = await contributionAPI.getAll(id);
      setContributions(contribRes.data.data);
    } catch (err) {
      console.error("ChamaDetails error:", err);

      if (err.response?.status === 401) {
        setError("Please log in to view this chama");
        navigate("/login");
      } else if (err.response?.status === 403) {
        setError("You don't have permission to view this chama");
      } else if (err.response?.status === 404) {
        setError("Chama not found");
      } else {
        setError(err.response?.data?.message || "Failed to load chama details");
      }
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  const getUserRole = () => {
    const member = members.find((m) => m.user_id === user?.id);
    return member?.role || "MEMBER";
  };

  const isOfficial = () => {
    const role = getUserRole();
    return ["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(role);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading chama details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !chama) {
    return (
      <div className="page">
        <div className="container">
          <div className="alert alert-error">{error || "Chama not found"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div className="chama-header">
          <div>
            <h1>{chama.chama_name}</h1>
            <div className="chama-meta">
              <span className="badge badge-primary">
                {getChamaTypeLabel(chama.chama_type)}
              </span>
              <span className="text-muted">Your Role: {getUserRole()}</span>
            </div>
          </div>
          {isOfficial() && (
            <div className="header-actions">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate(`/chamas/${id}/manage`)}
              >
                Manage Chama
              </button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div>
                <h3>{stats.total_members || 0}</h3>
                <p>Members</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div>
                <h3>{formatCurrency(stats.total_contributions || 0)}</h3>
                <p>Total Collected</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏦</div>
              <div>
                <h3>{formatCurrency(stats.current_fund || 0)}</h3>
                <p>Current Fund</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div>
                <h3>{formatCurrency(chama.contribution_amount)}</h3>
                <p>Per Contribution</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`tab ${activeTab === "members" ? "active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            Members ({members.length})
          </button>
          <button
            className={`tab ${activeTab === "contributions" ? "active" : ""}`}
            onClick={() => setActiveTab("contributions")}
          >
            Contributions ({contributions.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "overview" && (
            <div className="card">
              <h3>Chama Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Type</span>
                  <span className="info-value">
                    {getChamaTypeLabel(chama.chama_type)}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Contribution Amount</span>
                  <span className="info-value">
                    {formatCurrency(chama.contribution_amount)}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Frequency</span>
                  <span className="info-value">
                    {chama.contribution_frequency}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Meeting Day</span>
                  <span className="info-value">
                    {chama.meeting_day || "Not set"}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Meeting Time</span>
                  <span className="info-value">
                    {chama.meeting_time || "Not set"}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Created</span>
                  <span className="info-value">
                    {formatDate(chama.created_at)}
                  </span>
                </div>
              </div>
              {chama.description && (
                <div className="mt-3">
                  <h4>Description</h4>
                  <p className="text-muted">{chama.description}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "members" && (
            <div className="card">
              <div className="card-header flex-between">
                <h3>Members</h3>
                {isOfficial() && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate(`/chamas/${id}/add-member`)}
                  >
                    + Add Member
                  </button>
                )}
              </div>

              {members.length === 0 ? (
                <p className="text-muted text-center">No members yet</p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Total Contributions</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.user_id}>
                          <td>
                            <strong>
                              {member.first_name} {member.last_name}
                            </strong>
                          </td>
                          <td>
                            <span
                              className={`badge badge-${
                                member.role === "CHAIRPERSON"
                                  ? "primary"
                                  : member.role === "TREASURER"
                                  ? "success"
                                  : member.role === "SECRETARY"
                                  ? "warning"
                                  : "secondary"
                              }`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td>{member.phone_number}</td>
                          <td className="text-success">
                            {formatCurrency(member.total_contributions || 0)}
                          </td>
                          <td className="text-muted">
                            {formatDate(member.join_date)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === "contributions" && (
            <div className="card">
              <div className="card-header flex-between">
                <h3>Recent Contributions</h3>
                {getUserRole() === "TREASURER" && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() =>
                      navigate(`/chamas/${id}/record-contribution`)
                    }
                  >
                    + Record Contribution
                  </button>
                )}
              </div>

              {contributions.length === 0 ? (
                <p className="text-muted text-center">
                  No contributions recorded yet
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Member</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contributions.slice(0, 10).map((contrib) => (
                        <tr key={contrib.contribution_id}>
                          <td>{formatDate(contrib.contribution_date)}</td>
                          <td>
                            <strong>{contrib.contributor_name}</strong>
                          </td>
                          <td className="text-success">
                            {formatCurrency(contrib.amount)}
                          </td>
                          <td>
                            <span className="badge badge-secondary">
                              {contrib.payment_method}
                            </span>
                          </td>
                          <td className="text-muted">
                            {contrib.recorded_by_name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChamaDetails;
