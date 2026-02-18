import { useState, useEffect, memo, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { chamaAPI, contributionAPI, ascaAPI, memberAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { useSocket } from "../../../context/SocketContext";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import CreateCycleModal from "../../../components/CreateCycleModal";
import SwapRequestModal from "../../../components/SwapRequestModal";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { roscaAPI } from "../../../services/api";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FixedSizeList as List } from "react-window";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  BarChart3, Calendar, Mail, Building2, Heart, RefreshCw, TrendingUp,
  Settings, CreditCard, Users, DollarSign, Handshake, FileText, Download,
  Target, Bell, Trash2, Filter, RotateCcw
} from 'lucide-react';

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
                ? <RefreshCw size={16} />
                : chama.chama_type === "TABLE_BANKING"
                  ? <DollarSign size={16} />
                  : chama.chama_type === "ASCA"
                    ? <TrendingUp size={16} />
                    : <Handshake size={16} />}
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
        <button className="btn btn-modern btn-reports" onClick={() => onTabChange("reports")} aria-label="View reports">
          <BarChart3 size={18} className="btn-icon" aria-hidden="true" /> Reports
        </button>
        <button className="btn btn-modern btn-secondary" onClick={() => onNavigate(`/chamas/${chama.chama_id}/meetings`)} aria-label="View meetings">
          <Calendar size={18} className="btn-icon" aria-hidden="true" /> Meetings
        </button>
        {isOfficial && (
          <button
            className="btn btn-modern btn-secondary"
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/invites`)}
            aria-label="Manage invites"
          >
            <Mail size={18} className="btn-icon" aria-hidden="true" /> Invites
          </button>
        )}
        {chama.chama_type === "TABLE_BANKING" && (
          <button
            className="btn btn-modern btn-secondary"
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/loans`)}
            aria-label="View loans"
          >
            <Building2 size={18} className="btn-icon" aria-hidden="true" /> Loans
          </button>
        )}
        {chama.chama_type === "WELFARE" && (
          <button
            className="btn btn-modern btn-secondary"
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/welfare`)}
            aria-label="View welfare"
          >
            <Heart size={18} className="btn-icon" aria-hidden="true" /> Welfare
          </button>
        )}
        {chama.chama_type === "ROSCA" && (
          <button
            className="btn btn-modern btn-secondary"
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/rosca`)}
            aria-label="View merry-go-round"
          >
            <RefreshCw size={18} className="btn-icon" aria-hidden="true" /> Merry-Go-Round
          </button>
        )}
        {chama.chama_type === "ASCA" && (
          <button
            className="btn btn-modern btn-secondary"
            onClick={() => onNavigate(`/chamas/${chama.chama_id}/asca`)}
            aria-label="View investments"
          >
            <TrendingUp size={18} className="btn-icon" aria-hidden="true" /> Investments
          </button>
        )}
        {isOfficial && (
          <>
            <button
              className="btn btn-modern btn-manage"
              onClick={() => onNavigate(`/chamas/${chama.chama_id}/manage`)}
              aria-label="Manage chama settings"
            >
              <Settings size={18} className="btn-icon" aria-hidden="true" /> Manage
            </button>
            <button
              className="btn btn-modern btn-primary"
              onClick={() => onNavigate(`/chamas/${chama.chama_id}/record-contribution`)}
              aria-label="Record payment for member"
            >
              <CreditCard size={18} className="btn-icon" aria-hidden="true" /> Record Payment
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
      <div className="stat-icon"><Users size={24} /></div>
      <div>
        <h3>{stats.total_members || 0}</h3>
        <p>Members</p>
      </div>
    </div>
    <div className="stat-card">
      <div className="stat-icon"><DollarSign size={24} /></div>
      <div>
        <h3>{formatCurrency(stats.total_contributions || 0)}</h3>
        <p>Total Collected</p>
      </div>
    </div>
    <div className="stat-card">
      <div className="stat-icon"><Building2 size={24} /></div>
      <div>
        <h3>{formatCurrency(stats.current_fund || 0)}</h3>
        <p>Current Fund</p>
      </div>
    </div>
    <div className="stat-card">
      <div className="stat-icon">{isROSCA ? <RefreshCw size={24} /> : <BarChart3 size={24} />}</div>
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


const MembersTab = memo(({ members, isOfficial, isROSCA, roster, getMemberStatus, onNavigate, formatCurrency, formatDate, chamaId, userRole, onUpdateRole, activeUsers = [] }) => {
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
          {isOfficial && userRole === "CHAIRPERSON" ? (
            <select
              value={member.role}
              onChange={(e) => onUpdateRole(member.user_id, e.target.value)}
              className={`role-select badge badge-${member.role === "CHAIRPERSON" ? "primary" : member.role === "TREASURER" ? "success" : member.role === "SECRETARY" ? "warning" : "secondary"}`}
              style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <option value="CHAIRPERSON">CHAIRPERSON</option>
              <option value="TREASURER">TREASURER</option>
              <option value="SECRETARY">SECRETARY</option>
              <option value="MEMBER">MEMBER</option>
            </select>
          ) : (
            <span className={`badge badge-${member.role === "CHAIRPERSON" ? "primary" : member.role === "TREASURER" ? "success" : member.role === "SECRETARY" ? "warning" : "secondary"}`}>
              {member.role}
            </span>
          )}
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

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "info",
    onConfirm: () => { },
  });

  const confirmAction = (options) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title || "Confirm Action",
      message: options.message || "Are you sure?",
      confirmText: options.confirmLabel || "Confirm",
      cancelText: options.cancelLabel || "Cancel",
      variant: options.variant || "info",
      onConfirm: async () => {
        if (options.onConfirm) await options.onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

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
    // Socket.io real-time  useEffect(() => {
    if (socket && id) {
      socket.emit("join_chama", id);

      const handleUpdate = () => {
        fetchChamaData();
      };

      socket.on("contribution_recorded", handleUpdate);
      socket.on("contribution_deleted", handleUpdate);
      socket.on("presence_update", (users) => {
        setActiveUsers(Array.isArray(users) ? users : []);
      });

      return () => {
        socket.emit("leave_chama", id);
        socket.off("contribution_recorded", handleUpdate);
        socket.off("contribution_deleted", handleUpdate);
        socket.off("presence_update");
      };
    }
  }, [id, socket]);

  // Check for refresh signal from navigation
  useEffect(() => {
    if (location.state?.refresh) {
      fetchChamaData();

      // If specific tab requested, switch to it
      if (location.state?.tab) {
        setActiveTab(location.state.tab);
      }

      // Clear state to prevent loop
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
      // Filter out empty values to prevent 500 errors
      const cleanFilters = Object.fromEntries(
        Object.entries(f).filter(([_, v]) => v != null && v !== "")
      );

      const response = await contributionAPI.getAll(id, cleanFilters);
      setContributions(response.data.data);
    } catch (err) {
      console.error("Failed to fetch contributions:", err);
      toast.error("Failed to load contribution history");
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleQuickFilter = (type) => {
    const now = new Date();
    let start = "", end = "";

    if (type === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (type === 'lastMonth') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    } else if (type === 'ytd') {
      start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    } else if (type === 'all') {
      start = "";
      end = "";
    }

    setFilters(prev => ({ ...prev, startDate: start, endDate: end }));
  };

  const applyFilters = () => {
    if (filters.startDate && filters.endDate && new Date(filters.startDate) > new Date(filters.endDate)) {
      toast.error("Start date cannot be after End date");
      return;
    }
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

  const handleUpdateRole = (userId, newRole) => {
    confirmAction({
      title: "Confirm Role Change",
      message: `Are you sure you want to change this member's role to ${newRole}? This may grant them additional access to sensitive chama data.`,
      confirmLabel: "Change Role",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        try {
          await memberAPI.updateRole(id, userId, { role: newRole });
          toast.success("Member role updated successfully");
          fetchChamaData();
        } catch (err) {
          console.error("Failed to update member role:", err);
          toast.error(err.response?.data?.message || "Failed to update member role");
        }
      }
    });
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
    <div className="chama-details-root">
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
              <FileText size={18} className="tab-icon" aria-hidden="true" /> Overview
            </button>
            {isROSCA && (
              <button
                className={`tab-modern ${activeTab === "cycle" ? "active" : ""}`}
                onClick={() => setActiveTab("cycle")}
              >
                <RefreshCw size={18} className="tab-icon" aria-hidden="true" /> Cycle info
              </button>
            )}
            <button className={`tab-modern ${activeTab === "members" ? "active" : ""}`} onClick={() => setActiveTab("members")}>
              <Users size={18} className="tab-icon" aria-hidden="true" /> Members ({members.length})
            </button>
            <button
              className={`tab-modern ${activeTab === "contributions" ? "active" : ""
                }`}
              onClick={() => setActiveTab("contributions")}
            >
              <DollarSign size={18} className="tab-icon" aria-hidden="true" /> Contributions
            </button>
            <button
              className={`tab-modern ${activeTab === "reports" ? "active" : ""}`}
              onClick={() => setActiveTab("reports")}
              aria-label="View reports tab"
            >
              <BarChart3 size={18} className="tab-icon" aria-hidden="true" /> Reports
            </button>
            {officialStatus && (
              <button
                className={`tab-modern ${activeTab === "constitution" ? "active" : ""}`}
                onClick={() => setActiveTab("constitution")}
              >
                <span className="tab-icon">📜</span> Constitution
              </button>
            )}
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
                        <div className="explanation-icon"><RefreshCw size={24} /></div>
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
                        <div className="explanation-icon"><Target size={24} /></div>
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
                            <h4><Bell size={18} /> Incoming Swap Requests</h4>
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
                                      toast.success("Payout processed successfully!");
                                      fetchChamaData();
                                    }).catch(err => {
                                      toast.error(err.response?.data?.message || "Payout failed");
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
                                        toast.success("Cycle deleted successfully.");
                                        fetchChamaData();
                                      })
                                      .catch(err => {
                                        console.error(err);
                                        toast.error(err.response?.data?.message || "Failed to delete cycle");
                                      });
                                  }
                                }}
                              >
                                <Trash2 size={16} /> Delete Cycle
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
                                  <Target size={16} />
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
                userRole={userRole}
                onUpdateRole={handleUpdateRole}
                activeUsers={activeUsers}
              />
            )}

            {activeTab === "contributions" && (
              <div className="card" style={{ height: "auto", minHeight: "600px", display: "flex", flexDirection: "column" }}>
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

                {/* Contribution Summary Stats */}
                <div className="stats-grid mb-4">
                  <div className="stat-card">
                    <div className="stat-icon bg-primary-light text-primary">
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <div className="stat-label">Total Collected</div>
                      <div className="stat-value text-lg">
                        {formatCurrency(contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0))}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon bg-success-light text-success">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="stat-label">This Month</div>
                      <div className="stat-value text-lg">
                        {formatCurrency(
                          contributions
                            .filter(c => new Date(c.contribution_date).getMonth() === new Date().getMonth())
                            .reduce((sum, c) => sum + parseFloat(c.amount), 0)
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon bg-warning-light text-warning">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="stat-label">Members Contributed</div>
                      <div className="stat-value text-lg">
                        {new Set(contributions.map(c => c.user_id)).size} / {members.length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Progress */}
                {!isROSCA && (
                  <div className="progress-section mb-4 p-3 bg-light rounded">
                    <div className="flex-between mb-2">
                      <span className="text-sm font-medium">Monthly Target Progress</span>
                      <span className="text-sm text-muted">
                        {Math.round((contributions.filter(c => new Date(c.contribution_date).getMonth() === new Date().getMonth()).length / Math.max(members.length, 1)) * 100)}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill bg-success"
                        style={{
                          width: `${Math.min((contributions.filter(c => new Date(c.contribution_date).getMonth() === new Date().getMonth()).length / Math.max(members.length, 1)) * 100, 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Filtering UI */}
                {/* Filtering UI */}
                {/* Filtering UI - Premium Redesign */}
                <div style={{
                  background: 'var(--card-bg)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)'
                }}>
                  {/* Header & Quick Select Row */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    paddingBottom: '1rem',
                    borderBottom: '1px solid var(--light-gray)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      <Filter size={18} className="text-primary" />
                      <span>Filter Contributions</span>
                    </div>

                    {/* Segmented Control */}
                    <div style={{
                      display: 'inline-flex',
                      background: 'var(--bg-secondary)',
                      padding: '4px',
                      borderRadius: '8px',
                      gap: '4px'
                    }}>
                      {['thisMonth', 'lastMonth', 'ytd', 'all'].map((type) => {
                        const isActive = (type === 'thisMonth' && new Date(filters.startDate).getMonth() === new Date().getMonth() && !filters.endDate.includes(new Date().getFullYear() + 1)) ||
                          (type === 'all' && !filters.startDate) ||
                          (type === 'lastMonth' && new Date(filters.startDate).getMonth() === new Date().getMonth() - 1);

                        return (
                          <button
                            key={type}
                            onClick={() => handleQuickFilter(type)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              fontWeight: isActive ? 600 : 500,
                              border: 'none',
                              cursor: 'pointer',
                              background: isActive ? 'var(--card-bg)' : 'transparent',
                              color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                              boxShadow: isActive ? 'var(--shadow)' : 'none',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {type === 'thisMonth' ? 'This Month' :
                              type === 'lastMonth' ? 'Last Month' :
                                type === 'ytd' ? 'Year to Date' : 'All Time'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inputs Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'end'
                  }}>
                    {/* From Date */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        From Date
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--gray-light)' }}>
                          <Calendar size={16} />
                        </div>
                        <input
                          type="date"
                          name="startDate"
                          value={filters.startDate}
                          onChange={handleFilterChange}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                            border: '1px solid var(--input-border)',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--input-text)',
                            outline: 'none',
                            background: 'var(--input-bg)',
                            transition: 'border-color 0.2s'
                          }}
                        />
                      </div>
                    </div>

                    {/* To Date */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        To Date
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--gray-light)' }}>
                          <Calendar size={16} />
                        </div>
                        <input
                          type="date"
                          name="endDate"
                          value={filters.endDate}
                          onChange={handleFilterChange}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                            border: '1px solid var(--input-border)',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--input-text)',
                            outline: 'none',
                            background: 'var(--input-bg)',
                            transition: 'border-color 0.2s'
                          }}
                        />
                      </div>
                    </div>

                    {/* Member Select */}
                    <div style={{ flexGrow: 1.5 }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Member
                      </label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--gray-light)' }}>
                          <Users size={16} />
                        </div>
                        <select
                          name="userId"
                          value={filters.userId}
                          onChange={handleFilterChange}
                          style={{
                            width: '100%',
                            padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                            border: '1px solid var(--input-border)',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            color: 'var(--input-text)',
                            outline: 'none',
                            background: 'var(--input-bg)',
                            appearance: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="">All Members</option>
                          {members.map(m => (
                            <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>
                          ))}
                        </select>
                        <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--gray)' }}></div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={applyFilters}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          background: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.625rem 1.25rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                        }}
                      >
                        <RefreshCw size={16} /> Apply
                      </button>
                      <button
                        onClick={resetFilters}
                        title="Reset Filters"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '0.625rem',
                          color: 'var(--gray)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <RotateCcw size={18} />
                      </button>
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
                      <div className="v-th">Status</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <List
                        height={400}
                        itemCount={contributions.length}
                        itemSize={70}
                        width="100%"
                      >
                        {({ index, style }) => {
                          const c = contributions[index];
                          const member = members.find(m => m.user_id === c.user_id);
                          const initials = c.contributor_name ? c.contributor_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';

                          return (
                            <div className="v-tr" style={style}>
                              <div className="v-td">
                                <div className="font-medium">{formatDate(c.contribution_date)}</div>
                                <div className="text-xs text-muted">{new Date(c.contribution_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </div>
                              <div className="v-td v-td-lg">
                                <div className="flex items-center gap-2">
                                  <div className="avatar-placeholder bg-primary-light text-primary text-xs rounded-full w-8 h-8 flex items-center justify-center font-bold">
                                    {initials}
                                  </div>
                                  <div>
                                    <strong>{c.contributor_name}</strong>
                                    {member?.role && <div className="text-xs text-muted">{member.role}</div>}
                                  </div>
                                </div>
                              </div>
                              <div className="v-td text-success font-bold">{formatCurrency(c.amount)}</div>
                              <div className="v-td">
                                <span className={`badge badge-${c.payment_method === 'MPESA' ? 'success' : 'secondary'}`}>
                                  {c.payment_method}
                                </span>
                              </div>
                              <div className="v-td">
                                <span className="badge badge-success flex items-center gap-1">
                                  <CheckCircle size={10} /> Verified
                                </span>
                              </div>
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
                    <button className="btn btn-sm btn-outline" onClick={handleExportPDF} aria-label="Export PDF report">
                      <FileText size={16} /> Export PDF
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={handleExportExcel} aria-label="Export Excel report">
                      <Download size={16} /> Export Excel
                    </button>
                  </div>
                </div>

                {/* Contribution Trends Chart */}
                <div className="report-card" style={{ gridColumn: '1 / -1' }}>
                  <div className="report-header">
                    <div className="report-icon"><TrendingUp size={20} /></div>
                    <h4>Contribution Trends</h4>
                  </div>
                  <div className="report-content">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={(() => {
                          // Aggregate contributions by month
                          const monthlyData = {};
                          contributions.forEach(c => {
                            const date = new Date(c.contribution_date);
                            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                            const monthLabel = date.toLocaleDateString('en', { month: 'short', year: 'numeric' });

                            if (!monthlyData[monthKey]) {
                              monthlyData[monthKey] = { month: monthLabel, amount: 0, count: 0 };
                            }
                            monthlyData[monthKey].amount += parseFloat(c.amount);
                            monthlyData[monthKey].count += 1;
                          });

                          return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
                        })()}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === 'amount') return [formatCurrency(value), 'Total Amount'];
                            return [value, 'Transactions'];
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="var(--primary, #4f46e5)"
                          strokeWidth={2}
                          name="Total Amount"
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="var(--secondary, #10b981)"
                          strokeWidth={2}
                          name="Transactions"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="reports-grid">
                  {/* Financial Summary */}
                  <div className="report-card">
                    <div className="report-header">
                      <div className="report-icon"><DollarSign size={20} /></div>
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
                      <div className="report-icon"><TrendingUp size={20} /></div>
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
                      <div className="report-icon"><BarChart3 size={20} /></div>
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
                        <div className="report-icon"><RefreshCw size={20} /></div>
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
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
};

export default ChamaDetails;
