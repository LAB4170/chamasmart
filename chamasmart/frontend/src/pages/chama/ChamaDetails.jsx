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

  // ROSCA-specific state
  const [cycle, setCycle] = useState(null);
  const [roster, setRoster] = useState([]);
  const [currentCyclePosition, setCurrentCyclePosition] = useState(0);

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

      // ROSCA-specific data
      if (chamaRes.data.data.chama_type === "ROSCA") {
        await fetchROSCAData(id);
      }
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

  const fetchROSCAData = async (chamaId) => {
    try {
      // Initialize ROSCA cycle data
      const cycleData = {
        cycleNumber: 1,
        totalCycles: members.length,
        currentPosition: 0,
        status: "ACTIVE",
      };
      setCycle(cycleData);

      // Create roster based on join date (earliest first)
      const sortedMembers = [...members].sort(
        (a, b) => new Date(a.join_date) - new Date(b.join_date)
      );
      setRoster(sortedMembers);
    } catch (error) {
      console.error("Error fetching ROSCA data:", error);
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

  const isROSCA = () => {
    return chama?.chama_type === "ROSCA";
  };

  const getCurrentRecipient = () => {
    if (!isROSCA() || !roster.length) return null;
    return roster[currentCyclePosition % roster.length];
  };

  const getCycleProgress = () => {
    if (!isROSCA() || !cycle) return 0;
    return ((currentCyclePosition % roster.length) / roster.length) * 100;
  };

  const getMemberStatus = (member) => {
    if (!isROSCA()) return "MEMBER";

    const position = roster.findIndex((r) => r.user_id === member.user_id);
    if (position === -1) return "MEMBER";

    const currentPos = currentCyclePosition % roster.length;
    if (position === currentPos) return "CURRENT_RECIPIENT";
    if (position < currentPos) return "COMPLETED";
    return "WAITING";
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
          <div className="header-content">
            <div className="chama-title-section">
              <h1 className="chama-title">{chama.chama_name}</h1>
              <div className="chama-meta">
                <span className="chama-type-badge">
                  <span className="badge-icon">
                    {isROSCA()
                      ? "🔄"
                      : chama.chama_type === "TABLE_BANKING"
                      ? "💰"
                      : chama.chama_type === "ASCA"
                      ? "📈"
                      : "🤝"}
                  </span>
                  {getChamaTypeLabel(chama.chama_type)}
                </span>
                <div className="user-role-display">
                  <span className="role-label">Your Role:</span>
                  <span
                    className={`role-badge role-${getUserRole().toLowerCase()}`}
                  >
                    {getUserRole()}
                  </span>
                </div>
              </div>
            </div>
            <div className="header-actions">
              <button
                className="btn btn-modern btn-reports"
                onClick={() => setActiveTab("reports")}
              >
                <span className="btn-icon">📊</span>
                Reports
              </button>
              {isOfficial() && (
                <>
                  <button
                    className="btn btn-modern btn-manage"
                    onClick={() => navigate(`/chamas/${id}/manage`)}
                  >
                    <span className="btn-icon">⚙️</span>
                    Manage Chama
                  </button>
                  <button
                    className="btn btn-modern btn-primary"
                    onClick={() =>
                      navigate(`/chamas/${id}/record-contribution`)
                    }
                  >
                    <span className="btn-icon">💳</span>
                    Record Payment
                  </button>
                </>
              )}
            </div>
          </div>
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

            {isROSCA() ? (
              <div className="stat-card">
                <div className="stat-icon">🔄</div>
                <div>
                  <h3>
                    {formatCurrency(chama.contribution_amount * members.length)}
                  </h3>
                  <p>Per Payout</p>
                </div>
              </div>
            ) : (
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div>
                  <h3>{formatCurrency(chama.contribution_amount)}</h3>
                  <p>Per Contribution</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="tabs-modern">
          <button
            className={`tab-modern ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <span className="tab-icon">📋</span>
            Overview
          </button>
          {isROSCA() && (
            <button
              className={`tab-modern ${activeTab === "cycle" ? "active" : ""}`}
              onClick={() => setActiveTab("cycle")}
            >
              <span className="tab-icon">🔄</span>
              Cycle Progress
            </button>
          )}
          <button
            className={`tab-modern ${activeTab === "members" ? "active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            <span className="tab-icon">👥</span>
            Members ({members.length})
          </button>
          <button
            className={`tab-modern ${
              activeTab === "contributions" ? "active" : ""
            }`}
            onClick={() => setActiveTab("contributions")}
          >
            <span className="tab-icon">💰</span>
            Contributions ({contributions.length})
          </button>
          <button
            className={`tab-modern ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <span className="tab-icon">📊</span>
            Reports
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
                {isROSCA() && (
                  <div className="info-item">
                    <span className="info-label">Payout Amount</span>
                    <span className="info-value">
                      {formatCurrency(
                        chama.contribution_amount * members.length
                      )}
                    </span>
                  </div>
                )}
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

              {isROSCA() && (
                <div className="mt-3">
                  <h4>How ROSCA Works</h4>
                  <div className="rosca-explanation">
                    <div className="explanation-item">
                      <div className="explanation-icon">🔄</div>
                      <div>
                        <h5>Cycle Rotation</h5>
                        <p>
                          Each member takes turns receiving the full pot amount
                          while others contribute.
                        </p>
                      </div>
                    </div>
                    <div className="explanation-item">
                      <div className="explanation-icon">⏰</div>
                      <div>
                        <h5>Regular Contributions</h5>
                        <p>
                          Members contribute{" "}
                          {formatCurrency(chama.contribution_amount)}{" "}
                          {chama.contribution_frequency?.toLowerCase()}.
                        </p>
                      </div>
                    </div>
                    <div className="explanation-item">
                      <div className="explanation-icon">🎯</div>
                      <div>
                        <h5>Guaranteed Returns</h5>
                        <p>
                          Each member receives{" "}
                          {formatCurrency(
                            chama.contribution_amount * members.length
                          )}{" "}
                          when their turn comes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isROSCA() && activeTab === "cycle" && (
            <div className="card">
              <div className="card-header flex-between">
                <h3>ROSCA Cycle Progress</h3>
                {isOfficial() && (
                  <div className="cycle-actions">
                    <button className="btn btn-sm btn-success">
                      Start Next Cycle
                    </button>
                  </div>
                )}
              </div>

              {cycle && (
                <div className="rosca-cycle">
                  <div className="cycle-info">
                    <div className="cycle-stat">
                      <span className="stat-label">Current Cycle</span>
                      <span className="stat-value">{cycle.cycleNumber}</span>
                    </div>
                    <div className="cycle-stat">
                      <span className="stat-label">Progress</span>
                      <span className="stat-value">
                        {Math.round(getCycleProgress())}%
                      </span>
                    </div>
                    <div className="cycle-stat">
                      <span className="stat-label">Next Payout</span>
                      <span className="stat-value">
                        {formatCurrency(
                          chama.contribution_amount * members.length
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${getCycleProgress()}%` }}
                    ></div>
                  </div>

                  <div className="current-recipient">
                    <h4>Current Recipient</h4>
                    {getCurrentRecipient() && (
                      <div className="recipient-card">
                        <div className="recipient-avatar">
                          {getCurrentRecipient().first_name[0]}
                          {getCurrentRecipient().last_name[0]}
                        </div>
                        <div className="recipient-info">
                          <h5>
                            {getCurrentRecipient().first_name}{" "}
                            {getCurrentRecipient().last_name}
                          </h5>
                          <p>
                            Receives{" "}
                            {formatCurrency(
                              chama.contribution_amount * members.length
                            )}
                          </p>
                          <span className="badge badge-success">
                            Ready for Payout
                          </span>
                        </div>
                        {isOfficial() && (
                          <button className="btn btn-success">
                            Disburse Funds
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="roster-timeline">
                    <h4>Cycle Roster</h4>
                    <div className="timeline">
                      {roster.map((member, index) => {
                        const status = getMemberStatus(member);
                        return (
                          <div
                            key={member.user_id}
                            className={`timeline-item ${status.toLowerCase()}`}
                          >
                            <div className="timeline-marker">
                              {status === "COMPLETED" && <span>✓</span>}
                              {status === "CURRENT_RECIPIENT" && (
                                <span>🎯</span>
                              )}
                              {status === "WAITING" && <span>⏳</span>}
                            </div>
                            <div className="timeline-content">
                              <div className="member-name">
                                {member.first_name} {member.last_name}
                              </div>
                              <div className="member-position">
                                Position {index + 1} •{" "}
                                {status.replace("_", " ")}
                              </div>
                              {status === "CURRENT_RECIPIENT" && (
                                <div className="payout-amount">
                                  Receives{" "}
                                  {formatCurrency(
                                    chama.contribution_amount * members.length
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
                        {isROSCA() && <th>Roster Position</th>}
                        {isROSCA() && <th>Cycle Status</th>}
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
                          {isROSCA() && (
                            <td>
                              {roster.findIndex(
                                (r) => r.user_id === member.user_id
                              ) + 1}
                            </td>
                          )}
                          {isROSCA() && (
                            <td>
                              <span
                                className={`badge badge-${
                                  getMemberStatus(member) ===
                                  "CURRENT_RECIPIENT"
                                    ? "success"
                                    : getMemberStatus(member) === "COMPLETED"
                                    ? "primary"
                                    : "secondary"
                                }`}
                              >
                                {getMemberStatus(member).replace("_", " ")}
                              </span>
                            </td>
                          )}
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

          {activeTab === "reports" && (
            <div className="card">
              <div className="card-header flex-between">
                <h3>Chama Reports & Analytics</h3>
                <div className="report-actions">
                  <button className="btn btn-sm btn-outline">
                    📥 Export PDF
                  </button>
                  <button className="btn btn-sm btn-outline">
                    📊 Export Excel
                  </button>
                </div>
              </div>

              <div className="reports-grid">
                {/* Financial Summary */}
                <div className="report-card">
                  <div className="report-header">
                    <div className="report-icon">💰</div>
                    <h4>Financial Summary</h4>
                  </div>
                  <div className="report-content">
                    <div className="report-stat">
                      <span className="stat-label">Total Collected</span>
                      <span className="stat-value">
                        {formatCurrency(stats?.total_contributions || 0)}
                      </span>
                    </div>
                    <div className="report-stat">
                      <span className="stat-label">Current Balance</span>
                      <span className="stat-value">
                        {formatCurrency(stats?.current_fund || 0)}
                      </span>
                    </div>
                    <div className="report-stat">
                      <span className="stat-label">Average per Member</span>
                      <span className="stat-value">
                        {formatCurrency(
                          (stats?.total_contributions || 0) /
                            Math.max(members.length, 1)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Member Performance */}
                <div className="report-card">
                  <div className="report-header">
                    <div className="report-icon">📈</div>
                    <h4>Member Performance</h4>
                  </div>
                  <div className="report-content">
                    <div className="performance-list">
                      {members.slice(0, 5).map((member, index) => (
                        <div key={member.user_id} className="performance-item">
                          <div className="member-info">
                            <span className="member-rank">#{index + 1}</span>
                            <span className="member-name">
                              {member.first_name} {member.last_name}
                            </span>
                          </div>
                          <div className="member-contribution">
                            {formatCurrency(member.total_contributions || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contribution Trends */}
                <div className="report-card">
                  <div className="report-header">
                    <div className="report-icon">📊</div>
                    <h4>Contribution Trends</h4>
                  </div>
                  <div className="report-content">
                    <div className="trend-stats">
                      <div className="trend-stat">
                        <span className="trend-label">This Month</span>
                        <span className="trend-value">
                          {formatCurrency(
                            contributions
                              .filter(
                                (c) =>
                                  new Date(c.contribution_date).getMonth() ===
                                  new Date().getMonth()
                              )
                              .reduce((sum, c) => sum + parseFloat(c.amount), 0)
                          )}
                        </span>
                      </div>
                      <div className="trend-stat">
                        <span className="trend-label">Last Month</span>
                        <span className="trend-value">
                          {formatCurrency(
                            contributions
                              .filter((c) => {
                                const contribDate = new Date(
                                  c.contribution_date
                                );
                                const lastMonth = new Date();
                                lastMonth.setMonth(lastMonth.getMonth() - 1);
                                return (
                                  contribDate.getMonth() ===
                                    lastMonth.getMonth() &&
                                  contribDate.getFullYear() ===
                                    lastMonth.getFullYear()
                                );
                              })
                              .reduce((sum, c) => sum + parseFloat(c.amount), 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROSCA Specific Reports */}
                {isROSCA() && (
                  <div className="report-card">
                    <div className="report-header">
                      <div className="report-icon">🔄</div>
                      <h4>ROSCA Cycle Report</h4>
                    </div>
                    <div className="report-content">
                      <div className="cycle-report">
                        <div className="cycle-stat">
                          <span className="stat-label">Current Cycle</span>
                          <span className="stat-value">
                            {cycle?.cycleNumber || 1}
                          </span>
                        </div>
                        <div className="cycle-stat">
                          <span className="stat-label">
                            Completed Recipients
                          </span>
                          <span className="stat-value">
                            {
                              roster.filter(
                                (_, index) =>
                                  index < currentCyclePosition % roster.length
                              ).length
                            }
                          </span>
                        </div>
                        <div className="cycle-stat">
                          <span className="stat-label">Total Payouts</span>
                          <span className="stat-value">
                            {formatCurrency(
                              (currentCyclePosition % roster.length) *
                                chama.contribution_amount *
                                members.length
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChamaDetails;
