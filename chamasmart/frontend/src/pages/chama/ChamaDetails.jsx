import { useState, useEffect, memo, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, contributionAPI, ascaAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import CreateCycleModal from "../../components/CreateCycleModal";
import SwapRequestModal from "../../components/SwapRequestModal";
import { roscaAPI } from "../../services/api";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FixedSizeList as List } from "react-window";

// --- Memoized Sub-components ---

const ChamaHeader = memo(({ chama, userRole, isROSCA, getChamaTypeLabel, onNavigate, onTabChange, isOfficial }) => (
  <div className="chama-header">
    <div className="header-content">
      <div className="chama-title-section">
        <h1 className="chama-title">{chama.chama_name}</h1>
        <div className="chama-meta">
          <span className="chama-type-badge">
            <span className="badge-icon">
              {isROSCA
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
            <span className={`role-badge role-${userRole.toLowerCase()}`}>
              {userRole}
            </span>
          </div>
        </div>
      </div>
      <div className="header-actions">
        <button className="btn btn-modern btn-reports" onClick={() => onTabChange("reports")}>
          <span className="btn-icon">📊</span> Reports
        </button>
        {isOfficial && (
          <button
            className="btn btn-modern btn-secondary"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/invites`)}
          >
            <span className="btn-icon">📨</span> Invites
          </button>
        )}
        {chama.chama_type === "TABLE_BANKING" && (
          <button
            className="btn btn-modern btn-secondary"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/loans`)}
          >
            <span className="btn-icon">🏦</span> Loans
          </button>
        )}
        {chama.chama_type === "ROSCA" && (
          <button
            className="btn btn-modern btn-secondary"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/payouts`)}
          >
            <span className="btn-icon">💰</span> Payouts
          </button>
        )}
        {isOfficial && (
          <>
            <button
              className="btn btn-modern btn-manage"
              onClick={() => onNavigate(`/chamas/${chama.chama_id}/manage`)}
            >
              <span className="btn-icon">⚙️</span> Manage
            </button>
            <button
              className="btn btn-modern btn-primary"
              onClick={() => onNavigate(`/chamas/${chama.chama_id}/record-contribution`)}
            >
              <span className="btn-icon">💳</span> Record Payment
            </button>
          </>
        )}
      </div>
    </div>
  </div>
));

const StatsSection = memo(({ stats, isROSCA, chama, members, formatCurrency }) => (
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
      <div className="stat-icon">{isROSCA ? "🔄" : "📊"}</div>
      <div>
        <h3>
          {isROSCA
            ? formatCurrency(chama.contribution_amount * members.length)
            : formatCurrency(chama.contribution_amount)}
        </h3>
        <p>{isROSCA ? "Per Payout" : "Per Contribution"}</p>
      </div>
    </div>
  </div>
));


const MembersTab = memo(({ members, isOfficial, isROSCA, roster, getMemberStatus, onNavigate, formatCurrency, formatDate, chamaId, activeUsers = [] }) => {
  const Row = ({ index, style }) => {
    const member = members[index];
    const status = getMemberStatus(member);
    const isOnline = activeUsers.includes(member.user_id.toString()) || activeUsers.includes(member.user_id);

    return (
      <div className="v-tr" style={style}>
        <div className="v-td v-td-lg">
          <strong>{member.first_name} {member.last_name}</strong>
          {isOnline && <span className="online-indicator" title="Online"></span>}
        </div>
        <div className="v-td">
          <span className={`badge badge-${member.role === "CHAIRPERSON" ? "primary" : member.role === "TREASURER" ? "success" : member.role === "SECRETARY" ? "warning" : "secondary"}`}>
            {member.role}
          </span>
        </div>
        {isROSCA && (
          <div className="v-td v-td-sm">{roster.findIndex((r) => r.user_id === member.user_id) + 1}</div>
        )}
        {isROSCA && (
          <div className="v-td">
            <span className={`badge badge-${status === "CURRENT_RECIPIENT" ? "success" : status === "COMPLETED" ? "primary" : "secondary"}`}>
              {status.replace("_", " ")}
            </span>
          </div>
        )}
        <div className="v-td v-td-lg">{member.phone_number}</div>
        <div className="v-td text-success">{formatCurrency(member.total_contributions || 0)}</div>
        <div className="v-td text-muted">{formatDate(member.join_date)}</div>
      </div>
    );
  };

  return (
    <div className="card" style={{ height: "500px", display: "flex", flexDirection: "column" }}>
      <div className="card-header flex-between" style={{ flexShrink: 0 }}>
        <h3>Members ({members.length})</h3>
        {isOfficial && (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onNavigate(`/chamas/${chamaId}/add-member`)}
          >
            + Add Member
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <p className="text-muted text-center" style={{ padding: "2rem" }}>No members yet</p>
      ) : (
        <div className="v-table" style={{ flex: 1, minHeight: 0 }}>
          <div className="v-thead" style={{ flexShrink: 0 }}>
            <div className="v-th v-td-lg">Name</div>
            <div className="v-th">Role</div>
            {isROSCA && <div className="v-th v-td-sm">Pos</div>}
            {isROSCA && <div className="v-th">Status</div>}
            <div className="v-th v-td-lg">Phone</div>
            <div className="v-th">Total</div>
            <div className="v-th">Joined</div>
          </div>
          <div style={{ flex: 1 }}>
            <List
              height={400}
              itemCount={members.length}
              itemSize={60}
              width="100%"
            >
              {Row}
            </List>
          </div>
        </div>
      )}
    </div>
  );
});

// --- Main Component ---

const ChamaDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);

  const [cycles, setCycles] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [roster, setRoster] = useState([]);
  const [currentCyclePosition, setCurrentCyclePosition] = useState(0);
  const [showCreateCycleModal, setShowCreateCycleModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapRequests, setSwapRequests] = useState({ incoming: [], outgoing: [] });
  // Constitution State
  const [constitutionForm, setConstitutionForm] = useState({
    late_payment: { enabled: false, amount: 0, grace_period_days: 1 }
  });
  const [constitutionText, setConstitutionText] = useState("");
  // ASCA equity state
  const [ascaEquity, setAscaEquity] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    userId: ""
  });

  useEffect(() => {
    fetchChamaData();
  }, [id]);

  useEffect(() => {
    // Socket.io real-time updates
    if (socket && id) {
      socket.emit("join_chama", id);

      const handleUpdate = () => {
        console.log("Real-time update received, re-fetching data...");
        fetchChamaData();
      };

      socket.on("contribution_recorded", handleUpdate);
      socket.on("contribution_deleted", handleUpdate);
      socket.on("presence_update", (users) => {
        console.log("Presence update:", users);
        setActiveUsers(users);
      });

      return () => {
        socket.emit("leave_chama", id);
        socket.off("contribution_recorded", handleUpdate);
        socket.off("contribution_deleted", handleUpdate);
        socket.off("presence_update");
      };
    }
  }, [id, socket]);

  const fetchChamaData = async () => {
    try {
      setLoading(true);
      setError("");

      if (!user) {
        navigate("/login");
        return;
      }

      const [chamaRes, membersRes, statsRes] = await Promise.all([
        chamaAPI.getById(id),
        chamaAPI.getMembers(id),
        chamaAPI.getStats(id)
      ]);

      await fetchContributions();

      const chamaData = chamaRes.data.data;
      const membersData = membersRes.data.data;

      setChama(chamaData);
      setMembers(membersData);
      setStats(statsRes.data.data);

      // Load ASCA equity if this is an ASCA chama
      if (chamaData.chama_type === "ASCA") {
        try {
          const equityRes = await ascaAPI.getEquity(id);
          setAscaEquity(equityRes.data.data);
        } catch (equityErr) {
          console.error("Failed to load ASCA equity:", equityErr);
        }
      } else {
        setAscaEquity(null);
      }

      if (chamaData.constitution_config) {
        setConstitutionForm(prev => ({
          ...prev,
          ...chamaData.constitution_config
        }));
      }
      setConstitutionText(chamaData.description || "");

      if (chamaData.chama_type === "ROSCA") {
        try {
          const cyclesRes = await roscaAPI.getCycles(id);
          setCycles(cyclesRes.data.data);

          // Find active or latest cycle
          const active = cyclesRes.data.data.find(c => c.status === 'ACTIVE' || c.status === 'PENDING');
          if (active) {
            setActiveCycle(active);
            const rosterRes = await roscaAPI.getRoster(active.cycle_id);
            setRoster(rosterRes.data.data);

            // Calculate progress
            const paidCount = rosterRes.data.data.filter(r => r.status === 'PAID').length;
            setCurrentCyclePosition(paidCount);

            // Fetch swap requests
            const swapRes = await roscaAPI.getSwapRequests();
            setSwapRequests(swapRes.data.data);
          }
        } catch (cycleErr) {
          console.error("Failed to load cycles:", cycleErr);
        }
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

  const fetchContributions = async (f = filters) => {
    try {
      const response = await contributionAPI.getAll(id, f);
      setContributions(response.data.data);
    } catch (err) {
      console.error("Failed to fetch contributions:", err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    fetchContributions();
  };

  const resetFilters = () => {
    const defaultFilters = { startDate: "", endDate: "", userId: "" };
    setFilters(defaultFilters);
    fetchContributions(defaultFilters);
  };

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  }, []);

  const formatDate = useCallback((dateString) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  const userRole = useMemo(() => {
    const member = members.find((m) => m.user_id === user?.id);
    return member?.role || "MEMBER";
  }, [members, user]);

  const officialStatus = useMemo(() => {
    return ["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(userRole);
  }, [userRole]);

  const isROSCA = useMemo(() => chama?.chama_type === "ROSCA", [chama]);

  const getCurrentRecipient = useCallback(() => {
    if (!isROSCA || !roster.length) return null;
    return roster[currentCyclePosition % roster.length];
  }, [isROSCA, roster, currentCyclePosition]);

  const getCycleProgress = useCallback(() => {
    if (!isROSCA || !activeCycle || !roster.length) return 0;
    const paidCount = roster.filter(r => r.status === 'PAID').length;
    return (paidCount / roster.length) * 100;
  }, [isROSCA, activeCycle, roster]);

  const getMemberStatus = useCallback((member) => {
    if (!isROSCA) return "MEMBER";
    const position = roster.findIndex((r) => r.user_id === member.user_id);
    if (position === -1) return "MEMBER";
    const currentPos = currentCyclePosition % roster.length;
    if (position === currentPos) return "CURRENT_RECIPIENT";
    if (position < currentPos) return "COMPLETED";
    return "WAITING";
  }, [isROSCA, roster, currentCyclePosition]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text(`${chama.chama_name} - Financial Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = contributions.map(c => [
      formatDate(c.contribution_date),
      c.contributor_name,
      formatCurrency(c.amount),
      c.payment_method
    ]);

    doc.autoTable({
      startY: 30,
      head: [['Date', 'Member', 'Amount', 'Method']],
      body: tableData,
    });

    doc.save(`${chama.chama_name}_Report.pdf`);
  };

  const handleUpdateConstitution = async (e) => {
    e.preventDefault();
    try {
      await chamaAPI.update(id, {
        constitution_config: constitutionForm,
        description: constitutionText
      });
      alert("Constitution updated successfully!");
      fetchChamaData();
    } catch (err) {
      console.error(err);
      alert("Failed to update constitution");
    }
  };

  const handleSwapResponse = async (requestId, action) => {
    try {
      await roscaAPI.respondToSwap(requestId, action);
      alert(`Swap request ${action.toLowerCase()}ed`);
      fetchChamaData(); // Refresh to see new order
    } catch (err) {
      console.error(err);
      alert("Failed to process request");
    }
  };

  const handleExportExcel = () => {
    const data = contributions.map(c => ({
      Date: formatDate(c.contribution_date),
      Member: c.contributor_name,
      Amount: c.amount,
      Method: c.payment_method,
      Notes: c.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contributions");
    XLSX.utils.writeFile(wb, `${chama.chama_name}_Report.xlsx`);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <LoadingSkeleton type="detail" />
        </div>
      </div>
    );
  }

  if (error || !chama) {
    return (
      <div className="page">
        <div className="container">
          <div className="alert alert-error">{error || "Chama not found"}</div>
          <button className="btn btn-outline" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page">
        <div className="container">
          <ChamaHeader
            chama={chama}
            userRole={userRole}
            isROSCA={isROSCA}
            getChamaTypeLabel={getChamaTypeLabel}
            onNavigate={navigate}
            onTabChange={setActiveTab}
            isOfficial={officialStatus}
          />

        {stats && (
          <StatsSection
            stats={stats}
            isROSCA={isROSCA}
            chama={chama}
            members={members}
            formatCurrency={formatCurrency}
          />
        )}

        <div className="tabs-modern">
          <button className={`tab-modern ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            <span className="tab-icon">📋</span> Overview
          </button>
          {isROSCA && (
            <button
              className={`tab-modern ${activeTab === "cycle" ? "active" : ""}`}
              onClick={() => setActiveTab("cycle")}
            >
              <span className="tab-icon">🔄</span> Cycle info
            </button>
          )}
          <button className={`tab-modern ${activeTab === "members" ? "active" : ""}`} onClick={() => setActiveTab("members")}>
            <span className="tab-icon">👥</span> Members ({members.length})
          </button>
          <button
            className={`tab-modern ${activeTab === "contributions" ? "active" : ""
              }`}
            onClick={() => setActiveTab("contributions")}
          >
            <span className="tab-icon">💰</span> Contributions
          </button>
          <button
            className={`tab-modern ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <span className="tab-icon">📊</span> Reports
          </button>
        </div>

        <div className="tab-content">
          {activeTab === "overview" && (
            <div className="card">
              <h3>Chama Information</h3>
              <div className="info-grid">
                <div className="info-item"><span className="info-label">Type</span><span className="info-value">{getChamaTypeLabel(chama.chama_type)}</span></div>
                <div className="info-item"><span className="info-label">Contribution</span><span className="info-value">{formatCurrency(chama.contribution_amount)}</span></div>
                <div className="info-item"><span className="info-label">Frequency</span><span className="info-value">{chama.contribution_frequency}</span></div>
                <div className="info-item"><span className="info-label">Created</span><span className="info-value">{formatDate(chama.created_at)}</span></div>
                <div className="info-item">
                  <span className="info-label">Invite Code</span>
                  <span className="info-value">
                    <span className="badge badge-primary" style={{ fontSize: '1rem', letterSpacing: '1px' }}>
                      {chama.invite_code || "N/A"}
                    </span>
                  </span>
                </div>
                <div className="info-item"><span className="info-label">Visibility</span><span className="info-value">{chama.visibility}</span></div>
              </div>
              {chama.description && (
                <div className="mt-3">
                  <h4>Description</h4>
                  <p className="text-muted">{chama.description}</p>
                </div>
              )}

              {isROSCA && (
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

              {chama.chama_type === "ASCA" && ascaEquity && (
                <div className="mt-3">
                  <h4>My Equity in This ASCA</h4>
                  <div className="equity-grid">
                    <div className="equity-card">
                      <div className="equity-label">Total Contributions</div>
                      <div className="equity-value">{formatCurrency(ascaEquity.totalAmount)}</div>
                    </div>
                    <div className="equity-card">
                      <div className="equity-label">Total Shares</div>
                      <div className="equity-value">{ascaEquity.totalShares.toFixed(2)}</div>
                    </div>
                    <div className="equity-card">
                      <div className="equity-label">Current Share Value</div>
                      <div className="equity-value">{formatCurrency(ascaEquity.currentSharePrice || 0)}</div>
                    </div>
                    <div className="equity-card">
                      <div className="equity-label">Estimated Value</div>
                      <div className="equity-value highlight">{formatCurrency(ascaEquity.estimatedValue || 0)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isROSCA && activeTab === "cycle" && (
            <div className="card">
              <div className="card-header flex-between">
                <h3>ROSCA Cycle Progress</h3>
                {officialStatus && !activeCycle && (
                  <div className="cycle-actions">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => setShowCreateCycleModal(true)}
                    >
                      Start New Cycle
                    </button>
                  </div>
                )}
              </div>

              {!activeCycle && (
                <div className="p-4 text-center text-muted">
                  <p>No active cycle running.</p>
                  {officialStatus && <p>Click "Start New Cycle" to begin.</p>}
                </div>
              )}

              {activeCycle && (
                <div className="rosca-cycle">
                  {/* Swap Requests Section */}
                  {(swapRequests.incoming.length > 0 || swapRequests.outgoing.length > 0) && (
                    <div className="swap-requests-section mb-4">
                      {swapRequests.incoming.length > 0 && (
                        <div className="alert alert-info">
                          <h4>🔔 Incoming Swap Requests</h4>
                          {swapRequests.incoming.map(req => (
                            <div key={req.request_id} className="swap-request-card flex-between mt-2 p-2 bg-white rounded">
                              <div>
                                <strong>{req.requester_first_name} {req.requester_last_name}</strong> wants to swap with you.
                                <div className="text-sm text-muted">Reason: "{req.reason}"</div>
                              </div>
                              <div className="flex-gap">
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleSwapResponse(req.request_id, 'APPROVED')}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleSwapResponse(req.request_id, 'REJECTED')}
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {swapRequests.outgoing.map(req => (
                        <div key={req.request_id} className="alert alert-secondary mt-2">
                          ⏳ Pending swap request with <strong>{req.target_first_name} {req.target_last_name}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="cycle-info">
                    <div className="cycle-stat">
                      <span className="stat-label">Cycle Name</span>
                      <span className="stat-value">{activeCycle.cycle_name}</span>
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
                              activeCycle.contribution_amount * members.length
                            )}
                          </p>
                          <span className="badge badge-success">
                            Ready for Payout
                          </span>
                        </div>
                        {officialStatus && (
                          <div className="flex-gap">
                            <button
                              className="btn btn-success"
                              onClick={() => {
                                if (window.confirm(`Confirm payout of ${formatCurrency(activeCycle.contribution_amount * members.length)} to ${getCurrentRecipient().first_name}?`)) {
                                  roscaAPI.processPayout(activeCycle.cycle_id, {
                                    position: roster.find(r => r.user_id === getCurrentRecipient().user_id).position,
                                    payment_proof: "MANUAL_DISBURSEMENT"
                                  }).then(() => {
                                    alert("Payout processed successfully!");
                                    fetchChamaData();
                                  }).catch(err => {
                                    alert(err.response?.data?.message || "Payout failed");
                                  });
                                }
                              }}
                            >
                              Disburse Funds
                            </button>
                            <button
                              className="btn btn-danger btn-outline ml-2"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to delete this cycle? This action cannot be undone and will remove all roster and payment history for this cycle.")) {
                                  roscaAPI.deleteCycle(activeCycle.cycle_id)
                                    .then(() => {
                                      alert("Cycle deleted successfully.");
                                      fetchChamaData();
                                    })
                                    .catch(err => {
                                      console.error(err);
                                      alert(err.response?.data?.message || "Failed to delete cycle");
                                    });
                                }
                              }}
                            >
                              🗑️ Delete Cycle
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="roster-timeline">
                    <h4>Cycle Roster</h4>
                    <div className="timeline">
                      {roster.map((member, index) => {
                        const status = getMemberStatus(member);
                        const isCurrentUser = member.user_id === user?.id;
                        const isFutureSlot = status === "WAITING";

                        // Can only request swap with future slots, and not with self
                        const canRequestSwap = !isCurrentUser && isFutureSlot && roster.find(r => r.user_id === user?.id)?.status === "WAITING";

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
                              <div className="flex-between">
                                <div className="member-name">
                                  {member.first_name} {member.last_name}
                                  {isCurrentUser && <span className="badge badge-sm badge-outline ml-2">You</span>}
                                </div>
                                {canRequestSwap && (
                                  <button
                                    className="btn btn-xs btn-outline"
                                    onClick={() => {
                                      setSwapTarget(member);
                                      setShowSwapModal(true);
                                    }}
                                  >
                                    ⇄ Swap
                                  </button>
                                )}
                              </div>
                              <div className="member-position">
                                Position {index + 1} •{" "}
                                {status.replace("_", " ")}
                              </div>
                              {status === "CURRENT_RECIPIENT" && (
                                <div className="payout-amount">
                                  Receives{" "}
                                  {formatCurrency(
                                    activeCycle.contribution_amount * members.length
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

          {activeTab === "reports" && (
            <div className="card">
              <div className="card-header flex-between">
                <h3>Financial Reports</h3>
                <div className="export-actions">
                  <button className="btn btn-outline btn-sm mr-2" onClick={handleExportPDF}>
                    📄 Export PDF
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={handleExportExcel}>
                    📈 Export Excel
                  </button>
                </div>
              </div>

              <div className="reports-grid mt-4">
                <div className="report-card">
                  <h4>Total Funds</h4>
                  <div className="report-value">{formatCurrency(chama.current_fund)}</div>
                </div>
                <div className="report-card">
                  <h4>Total Contributions</h4>
                  <div className="report-value">{formatCurrency(stats?.totalContributions || 0)}</div>
                </div>
                <div className="report-card">
                  <h4>Active Loans</h4>
                  <div className="report-value">{formatCurrency(stats?.activeLoansBalance || 0)}</div>
                </div>
                <div className="report-card">
                  <h4>Total Members</h4>
                  <div className="report-value">{members.length}</div>
                </div>
              </div>

              <div className="recent-activity-section mt-5">
                <h4>Recent Contribution History</h4>
                <div className="v-table mt-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <div className="v-thead">
                    <div className="v-th">Date</div>
                    <div className="v-th v-td-lg">Member</div>
                    <div className="v-th">Amount</div>
                    <div className="v-th">Method</div>
                  </div>
                  {contributions.slice(0, 5).map(c => (
                    <div key={c.contribution_id} className="v-tr">
                      <div className="v-td">{formatDate(c.contribution_date)}</div>
                      <div className="v-td v-td-lg"><strong>{c.contributor_name}</strong></div>
                      <div className="v-td text-success">{formatCurrency(c.amount)}</div>
                      <div className="v-td"><span className="badge badge-secondary">{c.payment_method}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "members" && (
            <MembersTab
              members={members}
              isOfficial={officialStatus}
              isROSCA={isROSCA}
              roster={roster}
              getMemberStatus={getMemberStatus}
              onNavigate={navigate}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              chamaId={id}
              activeUsers={activeUsers}
            />
          )}

          {activeTab === "contributions" && (
            <div className="card" style={{ height: "600px", display: "flex", flexDirection: "column" }}>
              <div className="card-header flex-between" style={{ flexShrink: 0 }}>
                <h3>Contributions ({contributions.length})</h3>
                <div className="flex-gap">
                  {userRole === "TREASURER" && (
                    <button className="btn btn-sm btn-primary" onClick={() => navigate(`/chamas/${id}/record-contribution`)}>
                      + Record Contribution
                    </button>
                  )}
                </div>
              </div>

              {/* Filtering UI */}
              <div className="filter-bar mb-3" style={{ padding: '1rem', background: 'var(--light-gray)', borderRadius: 'var(--radius)' }}>
                <div className="filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                  <div className="filter-item">
                    <label className="filter-label">From</label>
                    <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="form-input btn-sm" />
                  </div>
                  <div className="filter-item">
                    <label className="filter-label">To</label>
                    <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="form-input btn-sm" />
                  </div>
                  <div className="filter-item">
                    <label className="filter-label">Member</label>
                    <select name="userId" value={filters.userId} onChange={handleFilterChange} className="form-input btn-sm">
                      <option value="">All Members</option>
                      {members.map(m => (
                        <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-secondary" onClick={applyFilters}>Apply</button>
                    <button className="btn btn-sm btn-outline" onClick={resetFilters}>Reset</button>
                  </div>
                </div>
              </div>

              {contributions.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: "2rem" }}>No contributions found matching filters</p>
              ) : (
                <div className="v-table" style={{ flex: 1, minHeight: 0 }}>
                  <div className="v-thead" style={{ flexShrink: 0 }}>
                    <div className="v-th">Date</div>
                    <div className="v-th v-td-lg">Member</div>
                    <div className="v-th">Amount</div>
                    <div className="v-th">Method</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <List
                      height={400}
                      itemCount={contributions.length}
                      itemSize={60}
                      width="100%"
                    >
                      {({ index, style }) => {
                        const c = contributions[index];
                        return (
                          <div className="v-tr" style={style}>
                            <div className="v-td">{formatDate(c.contribution_date)}</div>
                            <div className="v-td v-td-lg"><strong>{c.contributor_name}</strong></div>
                            <div className="v-td text-success">{formatCurrency(c.amount)}</div>
                            <div className="v-td"><span className="badge badge-secondary">{c.payment_method}</span></div>
                          </div>
                        );
                      }}
                    </List>
                  </div>
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
                {isROSCA && (
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
                            {activeCycle?.cycle_number || activeCycle?.cycleNumber || 1}
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


          {activeTab === "constitution" && officialStatus && (
            <div className="card">
              <div className="card-header">
                <h3>Chama Constitution & Rules</h3>
                <p className="text-muted">Define the automated rules and penalties for your group.</p>
              </div>
              <form onSubmit={handleUpdateConstitution} className="p-4">

                <div className="form-group mb-4">
                  <label className="form-label">Full Constitution / Group Description</label>
                  <textarea
                    className="form-input"
                    rows="10"
                    value={constitutionText}
                    onChange={(e) => setConstitutionText(e.target.value)}
                    placeholder="Enter the full text of your constitution, bylaws, and rules here..."
                    style={{ resize: 'vertical', minHeight: '150px' }}
                  ></textarea>
                </div>

                <div className="settings-section mb-4">
                  <h4 className="flex-between">
                    <span>Late Payment Penalties</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={constitutionForm.late_payment?.enabled}
                        onChange={(e) => setConstitutionForm(prev => ({
                          ...prev,
                          late_payment: { ...prev.late_payment, enabled: e.target.checked }
                        }))}
                      />
                      <span className="slider round"></span>
                    </label>
                  </h4>

                  {constitutionForm.late_payment?.enabled && (
                    <div className="grid-2 mt-2">
                      <div className="form-group">
                        <label>Penalty Amount (KES)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={constitutionForm.late_payment.amount}
                          onChange={(e) => setConstitutionForm(prev => ({
                            ...prev,
                            late_payment: { ...prev.late_payment, amount: parseFloat(e.target.value) }
                          }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>Grace Period (Days)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={constitutionForm.late_payment.grace_period_days}
                          onChange={(e) => setConstitutionForm(prev => ({
                            ...prev,
                            late_payment: { ...prev.late_payment, grace_period_days: parseInt(e.target.value) }
                          }))}
                        />
                        <small className="text-muted">Days after deadline before penalty applies.</small>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Save Constitution</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

    {showCreateCycleModal && (
      <CreateCycleModal
          chama={chama}
          onClose={() => setShowCreateCycleModal(false)}
          onSuccess={() => {
            fetchChamaData();
          }}
        />
      )}

    {showSwapModal && swapTarget && (
      <SwapRequestModal
          cycle={activeCycle}
          targetMember={swapTarget}
          onClose={() => {
            setShowSwapModal(false);
            setSwapTarget(null);
          }}
          onSuccess={() => {
            alert("Swap request sent successfully!");
          }}
        />
      )}
    </>
  );
};

export default ChamaDetails;
