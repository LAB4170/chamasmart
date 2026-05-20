import { useState, useEffect, memo, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { 
  chamaAPI, contributionAPI, ascaAPI, memberAPI, 
  roscaAPI, welfareAPI, 
  meetingAPI, loanAPI, chatAPI 
} from "../../../services/api";


import { useAuth } from "../../../context/AuthContext";
import { useSocket } from "../../../context/SocketContext";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import CreateCycleModal from "../../../components/CreateCycleModal";
import SwapRequestModal from "../../../components/SwapRequestModal";
import PayoutConfirmationModal from "../../../components/PayoutConfirmationModal";
import ConfirmDialog from "../../../components/ConfirmDialog";
import LoanConfigCard from "../../../components/LoanConfigCard";
import ManualPaymentModal from "../../../components/payments/ManualPaymentModal";
import PendingContributions from "../../../components/payments/PendingContributions";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { FixedSizeList as List } from "react-window";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  BarChart3, Calendar, Mail, Building2, Heart, RefreshCw, TrendingUp,
  Settings, CreditCard, Users, User, DollarSign, Handshake, FileText, Download,
  Target, Bell, Trash2, Filter, RotateCcw, CheckCircle2, Clock, MapPin,
  Shield, Landmark, ArrowRight, TrendingDown, Wallet, Smartphone, AlertTriangle,
  MessageCircle, ArrowRightLeft, Sparkles
} from 'lucide-react';
import ContributionMatrix from "../../../components/rosca/ContributionMatrix";
import ChamaCreditScore from "./ChamaCreditScore";
import HealthAlerts from "./HealthAlerts";
import ChamaChat from "../../../components/chat/ChamaChat";
import InvestmentProposals from "../asca/InvestmentProposals";
import "./ChamaDetailsLux.css";

// --- Memoized Sub-components ---

const ChamaHeader = memo(({ chama, userRole, isROSCA, getChamaTypeLabel, onNavigate, isOfficial }) => (
  <div className="chama-header-lux">
    <div className="chama-title-area">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button
          onClick={() => onNavigate('/dashboard')}
          aria-label="Back to Dashboard"
          className="tab-btn-lux"
          style={{ padding: '0.6rem', background: 'var(--lux-bg-soft)', border: '1px solid var(--lux-border)' }}
        >
          <ArrowRight size={20} style={{ transform: 'rotate(180deg)', color: 'var(--lux-text-primary)' }} />
        </button>
        <div>
          <h1>{chama.chama_name}</h1>
          <div className="chama-badges">
            <span className="badge-lux badge-gold">
              {isROSCA ? <RefreshCw size={13} /> : <DollarSign size={13} />}
              {getChamaTypeLabel(chama.chama_type)}
            </span>
            <span className="badge-lux" style={{ background: 'var(--lux-bg-soft)', color: 'var(--lux-text-secondary)', border: '1px solid var(--lux-border)' }}>
              <Shield size={11} /> {userRole}
            </span>
          </div>
        </div>
      </div>
    </div>

    {isOfficial && (
      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={() => onNavigate(`/chamas/${chama.chama_id}/manage`)}
          className="tab-btn-lux"
        >
          <Settings size={16} /> Manage
        </button>
        <button
          onClick={() => onNavigate(`/chamas/${chama.chama_id}/record-contribution`)}
          className="tab-btn-lux active"
        >
          <CreditCard size={16} /> Record
        </button>
      </div>
    )}
  </div>
));

const StatsSection = memo(({ stats, isROSCA, chama, members, formatCurrency }) => (
  <div className="hero-stats-lux">
    <div className="stat-card-lux">
      <div className="flex items-center gap-2 mb-1">
        <Users size={14} className="text-blue-400" />
        <span className="stat-label-lux">Directors</span>
      </div>
      <div className="stat-value-lux">{stats.total_members || 0}</div>
      <div className="stat-trend-lux stat-trend-up">
        <TrendingUp size={12} /> {members.length} Active
      </div>
    </div>
    <div className="stat-card-lux">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign size={14} className="text-emerald-400" />
        <span className="stat-label-lux">Revenue</span>
      </div>
      <div className="stat-value-lux">{formatCurrency(stats.total_contributions || 0)}</div>
      <div className="stat-trend-lux stat-trend-up">
        <TrendingUp size={12} /> Lifetime
      </div>
    </div>
    <div className="stat-card-lux">
      <div className="flex items-center gap-2 mb-1">
        <Wallet size={14} className="text-amber-400" />
        <span className="stat-label-lux">Treasury</span>
      </div>
      <div className="stat-value-lux">{formatCurrency(stats.total_fund || 0)}</div>
      <div className="stat-trend-lux" style={{ color: 'var(--text-secondary)' }}>
        <Shield size={12} /> Verified
      </div>
    </div>
    <div className="stat-card-lux">
      <div className="flex items-center gap-2 mb-1">
        <Target size={14} className="text-purple-400" />
        <span className="stat-label-lux">{isROSCA ? 'Next Payout' : 'Loan Volume'}</span>
      </div>
      <div className="stat-value-lux">
        {isROSCA 
          ? formatCurrency(chama.contribution_amount * members.length)
          : formatCurrency(stats.total_loans_disbursed || 0)
        }
      </div>
      <div className="stat-trend-lux" style={{ color: 'var(--text-secondary)' }}>
        <Clock size={12} /> Upcoming
      </div>
    </div>
  </div>
));


const MembersTab = memo(({ members, isOfficial, isROSCA, roster, getMemberStatus, onNavigate, formatCurrency, formatDate, chamaId, userRole, onUpdateRole, activeUsers = [] }) => {
  return (
    <div className="dashboard-card-lux" style={{ minHeight: '600px' }}>
      <div className="card-header pb-4 mb-8 border-b flex justify-between items-center" style={{ borderColor: 'var(--lux-border)' }}>
        <h3 className="card-title-lux m-0 flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--lux-gold)', border: '1px solid var(--lux-border)' }}>
            <Users size={20} />
          </div>
          Group Directors ({members.length})
        </h3>
        {isOfficial && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn-lux btn-lux-outline"
              onClick={() => onNavigate(`/chamas/${chamaId}/bulk-record`)}
            >
              Bulk Record
            </button>
            <button
              className="btn-lux btn-lux-primary"
              onClick={() => onNavigate(`/chamas/${chamaId}/add-member`)}
            >
              <Users size={16} /> Add Member
            </button>
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <div className="text-center py-20 opacity-50">
          <Users size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
          <p>No members have been added to this chama yet.</p>
        </div>
      ) : (
        <div className="member-grid-lux">
          {members.map((member) => {
            const status = getMemberStatus(member);
            const isOnline = activeUsers.includes(member.user_id.toString()) || activeUsers.includes(member.user_id);
            const initials = `${member.first_name?.[0] || ''}${member.last_name?.[0] || ''}`;
            const trustColor = member.trust_score >= 70 ? '#10b981' : member.trust_score >= 40 ? '#f59e0b' : '#ef4444';

            return (
              <div key={member.user_id} className="member-card-lux">
                <div 
                  className="member-avatar-lux" 
                  style={{ 
                    background: 'rgba(212, 175, 55, 0.05)', 
                    color: 'var(--gold-text)',
                    position: 'relative'
                  }}
                >
                  {initials}
                  {isOnline && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '2px', 
                      right: '2px', 
                      width: '12px', 
                      height: '12px', 
                      background: '#10b981', 
                      borderRadius: '50%', 
                      border: '2px solid rgba(0,0,0,0.5)',
                      boxShadow: '0 0 10px #10b981'
                    }} />
                  )}
                </div>

                <div className="member-role-lux">{member.role}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--lux-text-primary)', marginBottom: '0.25rem' }}>
                  {member.first_name} {member.last_name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--lux-text-secondary)', marginBottom: '1rem' }}>
                  {member.phone_number}
                </div>

                <div style={{ width: '100%', padding: '1rem', background: 'var(--lux-bg-soft)', border: '1px solid var(--lux-border)', borderRadius: '16px', marginBottom: '1.25rem' }}>
                  <div className="flex-between mb-2">
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--lux-text-secondary)', letterSpacing: '0.05em' }}>PERFORMANCE INDEX</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 900, color: trustColor }}>{member.trust_score || 0}%</span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'var(--lux-card-bg)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--lux-border)' }}>
                    <div style={{ height: '100%', width: `${member.trust_score || 0}%`, background: trustColor, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: `0 0 10px ${trustColor}40` }} />
                  </div>
                </div>

                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--lux-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Equity</div>
                    <div style={{ fontSize: '1rem', fontWeight: 900, color: '#10b981' }}>{formatCurrency(member.total_contributions || 0)}</div>
                  </div>
                  {isOfficial && userRole === "CHAIRPERSON" && (
                    <button 
                      className="btn-lux btn-lux-outline" 
                      style={{ padding: '0.5rem', borderRadius: '10px' }}
                      onClick={() => onUpdateRole(member.user_id, member.role === 'MEMBER' ? 'TREASURER' : 'MEMBER')}
                      title="Governance Control"
                    >
                      <Shield size={16} />
                    </button>
                  )}
                </div>

                {isROSCA && (
                  <div style={{ 
                    marginTop: '1rem', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid rgba(255,255,255,0.05)', 
                    width: '100%',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}>
                    <Target size={12} /> Cycle Position: {roster.findIndex((r) => r.user_id === member.user_id) + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

const DeadlineAlerts = memo(({ repayments, formatDate, formatCurrency, isOfficial }) => {
  if (!repayments || repayments.length === 0) return null;

  const urgent = repayments.filter(r => {
    const due = new Date(r.next_repayment_date);
    const now = new Date();
    const diff = (due - now) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  if (urgent.length === 0) return null;

  return (
    <div className="dashboard-card-lux" style={{ borderLeft: '5px solid #f59e0b', background: 'rgba(245, 158, 11, 0.02)', marginBottom: '1.5rem' }}>
      <h4 className="card-title-lux" style={{ color: '#f59e0b' }}>
        <Bell size={18} className="animate-bounce" /> Attention: Critical Deadlines
      </h4>
      <div className="grid grid-2 gap-4">
        {urgent.map((r, idx) => (
          <div key={idx} className="member-card-lux" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase' }}>Repayment Due</div>
              <div style={{ fontWeight: 800, color: '#fff' }}>{isOfficial ? r.borrower_name : 'Your Loan Facility'}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(r.next_repayment_date)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff' }}>{formatCurrency(r.amount_due)}</div>
              <button className="btn-lux btn-lux-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem', marginTop: '0.5rem' }}>Execute</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// --- Main Component ---

const ChamaDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [generalChannelId, setGeneralChannelId] = useState(null);

  const [cycles, setCycles] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [roster, setRoster] = useState([]);
  const [currentCyclePosition, setCurrentCyclePosition] = useState(0);
  const [showCreateCycleModal, setShowCreateCycleModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);
  const [swapRequests, setSwapRequests] = useState({ incoming: [], outgoing: [] });
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutRecipient, setPayoutRecipient] = useState(null);
  const [showManualPaymentModal, setShowManualPaymentModal] = useState(false);
  const [showPendingContributionsModal, setShowPendingContributionsModal] = useState(false);
  // Constitution State
  const [constitutionForm, setConstitutionForm] = useState({
    late_payment: { enabled: false, amount: 0, grace_period_days: 1 }
  });
  const [constitutionText, setConstitutionText] = useState("");
  // ASCA equity state
  const [ascaEquity, setAscaEquity] = useState(null);

  // Confirmation Dialog State
  const [meetings, setMeetings] = useState([]);
  const [loans, setLoans] = useState([]);
  const [welfareFund, setWelfareFund] = useState(null);
  const [welfareClaims, setWelfareClaims] = useState([]);
  const [ascaReports, setAscaReports] = useState(null);
  const [ascaStatement, setAscaStatement] = useState([]);
  const [memberStanding, setMemberStanding] = useState(null);
  const [loanAnalytics, setLoanAnalytics] = useState(null);

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
    if (user) {
      fetchChamaData();
    }
  }, [id, user]);

  useEffect(() => {
    // Socket.io real-time  useEffect(() => {
    if (socket && id) {
      socket.emit("join_chama", id);

      // Fetch and join the general chat channel for unread notifications
      chatAPI.getChannels(id).then(res => {
        if (res.data?.data?.length > 0) {
          const channelId = res.data.data[0].channel_id;
          setGeneralChannelId(channelId);
          socket.emit("join_chat_channel", channelId);
        }
      }).catch(err => console.error("Error joining chat channel for notifications:", err));

      const handleUpdate = () => {
        fetchChamaData();
      };

      const handleNewChatMessage = (msg) => {
        // Increment unread count if we are NOT on the chat tab and it's not our own message
        const currentUserId = user?.user_id || user?.id;
        if (activeTab !== "chat" && msg.user_id !== currentUserId) {
          setUnreadChatCount(prev => prev + 1);
        }
      };

      socket.on("contribution_recorded", handleUpdate);
      socket.on("contribution_deleted", handleUpdate);
      socket.on("member_added", handleUpdate);
      socket.on("member_removed", handleUpdate);
      socket.on("new_message", handleNewChatMessage);
      socket.on("presence_update", (users) => {
        setActiveUsers(Array.isArray(users) ? users : []);
      });

      return () => {
        socket.emit("leave_chama", id);
        if (generalChannelId) {
          socket.emit("leave_chat_channel", generalChannelId);
        }
        socket.off("contribution_recorded", handleUpdate);
        socket.off("contribution_deleted", handleUpdate);
        socket.off("member_added", handleUpdate);
        socket.off("member_removed", handleUpdate);
        socket.off("new_message", handleNewChatMessage);
        socket.off("presence_update");
      };
    }
  }, [id, socket, activeTab, generalChannelId, user]);

  // Fetch meetings, loans, or welfare when tab changes
  useEffect(() => {
    if (activeTab === "meetings") {
      fetchMeetings();
    } else if (activeTab === "loans" && chama?.chama_type === "TABLE_BANKING") {
      fetchLoans();
    } else if (activeTab === "welfare" && chama?.chama_type === "WELFARE") {
      fetchWelfare();
    } else if (activeTab === "reports" && (chama?.chama_type === "ASCA" || chama?.chama_type === "TABLE_BANKING")) {
      fetchAscaReports();
    }
  }, [activeTab, id, chama?.chama_type]);

  const fetchMeetings = async () => {
    try {
      const res = await meetingAPI.getAll(id);
      setMeetings(res.data.data || res.data || []);
    } catch (err) {
      console.error("Failed to fetch meetings:", err);
    }
  };

  const fetchLoans = async () => {
    try {
      const res = await loanAPI.getChamaLoans(id);
      // Backend returns { loans: [], pagination: {} } inside data
      const loanData = res.data.data?.loans || res.data?.loans || res.data.data || res.data || [];
      setLoans(Array.isArray(loanData) ? loanData : []);
    } catch (err) {
      console.error("Failed to fetch loans:", err);
    }
  };

  const fetchWelfare = async () => {
    try {
      const [fundRes, claimsRes] = await Promise.all([
        welfareAPI.getFund(id),
        welfareAPI.getChamaClaims(id)
      ]);
      setWelfareFund(fundRes.data.data);
      setWelfareClaims(claimsRes.data.data || []);
    } catch (err) {
      console.error("Failed to fetch welfare:", err);
    }
  };

  const fetchAscaReports = async () => {
    try {
      const [summaryRes, statementRes, standingRes] = await Promise.all([
        ascaAPI.getReportsSummary(id),
        ascaAPI.getMemberStatement(id),
        ascaAPI.getMemberStanding(id).catch(() => ({ data: { data: null } }))
      ]);
      setAscaReports(summaryRes.data.data);
      setAscaStatement(statementRes.data.data);
      setMemberStanding(standingRes.data.data);

      if (officialStatus) {
        const analyticsRes = await loanAPI.getChamaAnalytics(id).catch(() => ({ data: { data: null } }));
        setLoanAnalytics(analyticsRes.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch ASCA reports:", err);
    }
  };

  useEffect(() => {
    if (location.state?.refresh) {
      fetchChamaData();
    }
    // Restore tab from navigation state (e.g., back from management sub-sections)
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
      // Clear state to prevent loop
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchChamaData = async () => {
    try {
      setLoading(true);
      setError("");

      if (!user) {
        return;
      }

      const [chamaRes, membersRes, statsRes] = await Promise.all([
        chamaAPI.getById(id).catch(err => { throw err; }), // Main chama data is required
        chamaAPI.getMembers(id).catch(err => {
          console.warn("Members fetch restricted:", err.response?.status);
          return { data: { data: [] } };
        }),
        chamaAPI.getStats(id).catch(err => {
          console.warn("Stats fetch restricted:", err.response?.status);
          return { data: { data: null } };
        })
      ]);

      const chamaData = chamaRes.data.data;
      const membersData = membersRes.data.data;
      
      const membersArray = Array.isArray(membersData) ? membersData : (membersData?.data || []);
      setMembers(membersArray);
      setChama(Array.isArray(chamaData) ? chamaData[0] : chamaData);
      
      // Basic stats if detailed stats are restricted
      if (statsRes.data.data) {
        setStats(statsRes.data.data);
      } else {
        const fullChama = Array.isArray(chamaData) ? chamaData[0] : chamaData;
        setStats({
          total_members: fullChama.total_members || membersArray.length,
          total_contributions: 0,
          current_fund: fullChama.current_fund || 0,
          contribution_amount: fullChama.contribution_amount,
          chama_type: fullChama.chama_type
        });
      }

      // Check membership
      const currentUserId = user?.user_id || user?.id;
      const isMember = membersArray.some(m => m.user_id === currentUserId);

      if (isMember) {
        await fetchContributions();
      } else {
        setContributions([]);
      }

      // Load ASCA equity if this is an ASCA chama
      if (chamaData.chama_type === "ASCA" || chamaData.chama_type === "TABLE_BANKING") {
        try {
          // Table banking might fail the ASCA equity check currently, but we attempt it to load standing
          const equityRes = await ascaAPI.getEquity(id).catch(() => ({ data: { data: null } }));
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
          const cyclesData = cyclesRes.data.data;
          setCycles(Array.isArray(cyclesData) ? cyclesData : (cyclesData?.data || []));

          // Find active or latest cycle
          const active = (Array.isArray(cyclesData) ? cyclesData : (cyclesData?.data || [])).find(c => c.status === 'ACTIVE' || c.status === 'PENDING');
          if (active) {
            setActiveCycle(active);
            const rosterRes = await roscaAPI.getRoster(active.cycle_id);
            const rosterData = rosterRes.data.data;
            setRoster(Array.isArray(rosterData) ? rosterData : (rosterData?.data || []));

            // Calculate progress
            const rosterArray = Array.isArray(rosterData) ? rosterData : (rosterData?.data || []);
            const paidCount = rosterArray.filter(r => r.status === 'PAID').length;
            setCurrentCyclePosition(paidCount);

            // Fetch swap requests
            const swapRes = await roscaAPI.getSwapRequests();
            const swapData = swapRes.data.data;
            setSwapRequests(Array.isArray(swapData) ? { incoming: swapData, outgoing: [] } : (swapData || { incoming: [], outgoing: [] }));
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

  const handleUpdateConstitution = async (e) => {
    if (e) e.preventDefault();
    try {
      setLoading(true);
      const response = await chamaAPI.update(id, {
        description: constitutionText,
        constitution_config: constitutionForm
      });
      if (response.data.success) {
        toast.success("Constitution updated successfully!");
        setChama(response.data.data);
      }
    } catch (err) {
      console.error("Update constitution error:", err);
      toast.error(err.response?.data?.message || "Failed to update constitution");
    } finally {
      setLoading(false);
    }
  };

  const fetchContributions = async (f = filters) => {
    try {
      // Filter out empty values to prevent 500 errors
      const cleanFilters = Object.fromEntries(
        Object.entries(f).filter(([key, v]) => v != null && v !== "")
      );

      const response = await contributionAPI.getAll(id, cleanFilters);
      const contribData = response.data.data;
      setContributions(Array.isArray(contribData) ? contribData : (contribData?.data || []));
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
    if (!dateString) return "-";
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
    // Backend now returns the role directly on the chama object
    if (chama?.role) return chama.role.toUpperCase();
    
    // Fallback just in case
    if (!Array.isArray(members)) return "MEMBER";
    const currentUserId = user?.user_id || user?.id;
    const member = members.find((m) => m.user_id === currentUserId);
    return member?.role ? member.role.toUpperCase() : "MEMBER";
  }, [chama, members, user]);

  const officialStatus = useMemo(() => {
    return ["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(userRole);
  }, [userRole]);

  const isROSCA = useMemo(() => chama?.chama_type === "ROSCA", [chama]);

  // Return the current unpaid member in the roster (first ACTIVE or PENDING member by position)
  const getCurrentRecipient = useCallback(() => {
    if (!isROSCA || !Array.isArray(roster) || roster.length === 0) return null;
    // Find the first roster entry that hasn't been paid yet
    const sortedRoster = [...roster].sort((a, b) => a.position - b.position);
    const current = sortedRoster.find(r => r.status === 'ACTIVE' || r.status === 'PENDING');
    if (!current) return null;
    // Try to enrich with member name data from members list if roster entry lacks it
    if (!current.first_name) {
      const member = members.find(m => m.user_id === current.user_id);
      return member ? { ...current, ...member } : current;
    }
    return current;
  }, [isROSCA, roster, members]);

  const getCycleProgress = useCallback(() => {
    if (!isROSCA || !activeCycle || !Array.isArray(roster) || roster.length === 0) return 0;
    const paidCount = roster.filter(r => r.status === 'PAID').length;
    return (paidCount / roster.length) * 100;
  }, [isROSCA, activeCycle, roster]);

  const getMemberStatus = useCallback((member) => {
    if (!isROSCA || !Array.isArray(roster)) return "MEMBER";
    const entry = roster.find((r) => r.user_id === member.user_id);
    if (!entry) return "MEMBER";
    // Use the actual status from the DB roster entry
    if (entry.status === 'PAID') return "COMPLETED";
    // The current recipient is the first ACTIVE/PENDING entry by position
    const sortedRoster = [...roster].sort((a, b) => a.position - b.position);
    const currentEntry = sortedRoster.find(r => r.status === 'ACTIVE' || r.status === 'PENDING');
    if (currentEntry && entry.user_id === currentEntry.user_id) return "CURRENT_RECIPIENT";
    return "WAITING";
  }, [isROSCA, roster]);

  const handleExportPDF = async () => {
    try {
      // 1. Show processing toast
      const toastId = toast.loading("Generating professional PDF report...");
      
      const doc = new jsPDF();
      
      // 2. Header Styling
      doc.setFillColor(79, 70, 229); // Primary Indigo
      doc.rect(0, 0, 210, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(`${chama.chama_name} - Financial Report`, 14, 16);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
      
      let currentY = 35;
      doc.setTextColor(0, 0, 0);

      // 3. Chama Details
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Group Information", 14, currentY);
      currentY += 8;
      
      const infoData = [
        ["Type:", getChamaTypeLabel(chama.chama_type), "Total Members:", members?.length?.toString() || "0"],
        ["Contribution:", formatCurrency(chama.contribution_amount), "Frequency:", chama.contribution_frequency],
        ["Total Collected:", formatCurrency(stats?.total_contributions || 0), "Current Fund:", formatCurrency(stats?.current_fund || 0)]
      ];
      
      autoTable(doc, {
        startY: currentY,
        body: infoData,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2, font: "helvetica" },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [100, 100, 100] },
          2: { fontStyle: 'bold', textColor: [100, 100, 100] }
        }
      });
      currentY = doc.lastAutoTable.finalY + 15;

      // 4. ASCA/Table Banking Financial Summary
      if ((chama.chama_type === "ASCA" || chama.chama_type === "TABLE_BANKING") && ascaReports) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Financial Summary", 14, currentY);
        
        const summaryData = [
          ["Total Savings", formatCurrency(ascaReports.stats?.totalSavings || 0)],
          ["Interest Collected", formatCurrency(ascaReports.stats?.interestCollected || 0)],
          ["Dividends Distributed", formatCurrency(ascaReports.stats?.totalDividends || 0)],
          ["Outstanding Loans", formatCurrency(ascaReports.stats?.outstandingBalance || 0)],
          ["Liquid Cash", formatCurrency(ascaReports.readiness?.liquidCash || 0)]
        ];
        
        autoTable(doc, {
          startY: currentY + 5,
          body: summaryData,
          theme: 'grid',
          headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0] },
          styles: { font: 'helvetica' }
        });
        currentY = doc.lastAutoTable.finalY + 15;
      }

      // 5. Incorporate Charts (Snapshot)
      const chartsDiv = document.getElementById('finance-reports-charts');
      if (chartsDiv) {
        try {
          // Temporarily hide actions for the screenshot
          const actions = chartsDiv.querySelector('.report-actions');
          if (actions) actions.style.display = 'none';

          const canvas = await html2canvas(chartsDiv, { 
            scale: 1.5, 
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff'
          });

          if (actions) actions.style.display = 'flex';
          
          const imgData = canvas.toDataURL('image/png');
          
          if (currentY > 160) {
             doc.addPage();
             currentY = 20;
          }
          
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("Analytics & Trends Dashboard", 14, currentY);
          
          const imgWidth = 180;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          doc.addImage(imgData, 'PNG', 15, currentY + 5, imgWidth, imgHeight);
          currentY += imgHeight + 20;
          
        } catch(htmlErr) {
          console.error("Chart capture failed", htmlErr);
        }
      }

      // 6. Member Balances
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Member Balances", 14, currentY);
      
      const memberData = members.map(m => [
        `${m.first_name} ${m.last_name}`,
        m.role || 'MEMBER',
        formatCurrency(m.total_contributions || 0)
      ]);
      
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Member Name', 'Role', 'Total Contributed']],
        body: memberData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });
      currentY = doc.lastAutoTable.finalY + 15;

      // 7. Active Loans (if applicable)
      if (["ASCA", "TABLE_BANKING"].includes(chama.chama_type)) {
        let loansToExport = loans;
        if (loansToExport.length === 0 && !loading) {
          try {
             const res = await loanAPI.getChamaLoans(id);
             loansToExport = res.data?.data?.loans || res.data?.loans || res.data?.data || res.data || [];
          } catch(e) {
             console.error("Failed fetching loans for export", e);
          }
        }
        
        if (loansToExport.length > 0) {
          if (currentY > 250) { doc.addPage(); currentY = 20; }
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("Loan Portfolio", 14, currentY);
          
          const loanData = loansToExport.map(l => [
            l.borrower_name,
            formatCurrency(l.loan_amount),
            formatCurrency(l.balance || 0),
            l.status,
            formatDate(l.created_at)
          ]);
          
          autoTable(doc, {
            startY: currentY + 5,
            head: [['Borrower', 'Principal', 'Balance', 'Status', 'Date']],
            body: loanData,
            theme: 'striped',
            headStyles: { fillColor: [16, 185, 129] } // Emerald
          });
          currentY = doc.lastAutoTable.finalY + 15;
        }
      }

      // 8. Recent Contributions
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      const contribTableData = contributions.slice(0, 50).map(c => [
        formatDate(c.contribution_date),
        c.contributor_name,
        formatCurrency(c.amount),
        c.payment_method || 'MANUAL'
      ]);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Contributions History (Last 50 transactions)", 14, currentY);
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Date', 'Member', 'Amount', 'Method']],
        body: contribTableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });

      // 9. Add Footer with page numbers
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`ChamaSmart Financial Report - Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
      }

      doc.save(`${chama.chama_name.replace(/\s+/g, '_')}_Financial_Report.pdf`);
      toast.update(toastId, { render: "PDF Report generated successfully", type: "success", isLoading: false, autoClose: 3000 });
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to generate PDF. Please try again.");
    }
  };

  const handleExportExcel = async () => {
    try {
      const toastId = toast.loading("Generating comprehensive Excel workbook...");
      const wb = XLSX.utils.book_new();
      
      // 1. Dashboard / Summary Sheet
      const summarySheetData = [
        ["Chama Name", chama.chama_name],
        ["Type", getChamaTypeLabel(chama.chama_type)],
        ["Date Generated", new Date().toLocaleString()],
        [""],
        ["--- FUND SUMMARY ---", ""],
        ["Total Members", members?.length || 0],
        ["Total Collected", stats?.total_contributions || 0],
        ["Current Fund", stats?.current_fund || 0]
      ];
      
      if ((chama.chama_type === "ASCA" || chama.chama_type === "TABLE_BANKING") && ascaReports) {
        summarySheetData.push([""]);
        summarySheetData.push(["--- FINANCIAL METRICS ---", ""]);
        summarySheetData.push(["Total Savings", ascaReports.stats?.totalSavings || 0]);
        summarySheetData.push(["Interest Collected", ascaReports.stats?.interestCollected || 0]);
        summarySheetData.push(["Dividends Distributed", ascaReports.stats?.totalDividends || 0]);
        summarySheetData.push(["Outstanding Loans", ascaReports.stats?.outstandingBalance || 0]);
        summarySheetData.push(["Liquid Cash", ascaReports.readiness?.liquidCash || 0]);
      }
      
      const wsSummary = XLSX.utils.aoa_to_sheet(summarySheetData);
      wsSummary['!cols'] = [{ wch: 25 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Overview Summary");

      // 2. Member Balances
      const memberSheetData = members.map(m => ({
        "Member Name": `${m.first_name} ${m.last_name}`,
        "Role": m.role || 'MEMBER',
        "Phone": m.phone_number || '',
        "Status": m.is_active ? 'Active' : 'Inactive',
        "Total Contributed": m.total_contributions || 0
      }));
      const wsMembers = XLSX.utils.json_to_sheet(memberSheetData);
      wsMembers['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsMembers, "Member Balances");

      // 3. Loans (if applicable)
      if (["ASCA", "TABLE_BANKING"].includes(chama.chama_type)) {
        let loansToExport = loans;
        if (loansToExport.length === 0 && !loading) {
           try {
             const res = await loanAPI.getChamaLoans(id);
             loansToExport = res.data?.data?.loans || res.data?.loans || res.data?.data || res.data || [];
           } catch(e) {}
        }
        
        if (loansToExport.length > 0) {
          const loanSheetData = loansToExport.map(l => ({
            "Borrower": l.borrower_name,
            "Principal Amount": l.loan_amount,
            "Total Repayable": l.total_repayable || 0,
            "Balance": l.balance || 0,
            "Status": l.status,
            "Date Applied": formatDate(l.created_at)
          }));
          const wsLoans = XLSX.utils.json_to_sheet(loanSheetData);
          wsLoans['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
          XLSX.utils.book_append_sheet(wb, wsLoans, "Loan Portfolio");
        }
      }

      // 4. Contributions History
      const contribSheetData = contributions.map(c => ({
        "Date": formatDate(c.contribution_date),
        "Member Name": c.contributor_name,
        "Amount": c.amount,
        "Method": c.payment_method || 'MANUAL',
        "Transaction Ref": c.transaction_reference || '',
        "Notes": c.notes || ''
      }));
      const wsContrib = XLSX.utils.json_to_sheet(contribSheetData);
      wsContrib['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, wsContrib, "Contributions Ledger");

      XLSX.writeFile(wb, `${chama.chama_name.replace(/\s+/g, '_')}_Financial_Report.xlsx`);
      toast.update(toastId, { render: "Excel Report generated successfully", type: "success", isLoading: false, autoClose: 3000 });
    } catch(err) {
      console.error(err);
      toast.dismiss();
      toast.error("Failed to generate Excel report");
    }
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

  const handleActivateCycle = async (cycleId) => {
    try {
      setLoading(true);
      await roscaAPI.activateCycle(cycleId);
      toast.success("Cycle activated successfully!");
      fetchChamaData();
    } catch (err) {
      console.error("Failed to activate cycle:", err);
      toast.error(err.response?.data?.message || "Failed to activate cycle");
    } finally {
      setLoading(false);
    }
  };

  const handleSwapResponse = async (requestId, action) => {
    try {
      setLoading(true);
      await roscaAPI.respondToSwap(requestId, action);
      toast.success(`Swap request ${action === 'ACCEPT' ? 'accepted' : 'rejected'}`);
      fetchChamaData();
    } catch (err) {
      console.error("Failed to respond to swap request:", err);
      toast.error(err.response?.data?.message || "Failed to respond to swap request");
    } finally {
      setLoading(false);
    }
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
    <div className="chama-details-root chama-details-lux-root">
      <div className="page">
        <div className="container">
          <div className="page-frame-lux">
            <ChamaHeader
        chama={chama}
        userRole={userRole}
        isROSCA={isROSCA}
        getChamaTypeLabel={getChamaTypeLabel}
        onNavigate={navigate}
        onTabChange={setActiveTab}
        isOfficial={officialStatus}
      />

      <div className="chama-container">
        <StatsSection
          stats={stats}
          isROSCA={isROSCA}
          chama={chama}
          members={members}
          formatCurrency={formatCurrency}
        />

        <div className="tabs-nav-lux">
          <button
            className={`tab-btn-lux ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <BarChart3 size={18} /> Overview
          </button>
          <button
            className={`tab-btn-lux ${activeTab === "members" ? "active" : ""}`}
            onClick={() => setActiveTab("members")}
          >
            <Users size={18} /> Members
          </button>
          <button
            className={`tab-btn-lux ${activeTab === "contributions" ? "active" : ""}`}
            onClick={() => setActiveTab("contributions")}
          >
            <DollarSign size={18} /> Payments
          </button>
          <button
            className={`tab-btn-lux ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("chat");
              setUnreadChatCount(0);
            }}
          >
            <MessageCircle size={18} /> Chat
            {unreadChatCount > 0 && <span className="unread-dot">{unreadChatCount}</span>}
          </button>
          <button
            className={`tab-btn-lux ${activeTab === "meetings" ? "active" : ""}`}
            onClick={() => setActiveTab("meetings")}
          >
            <Calendar size={18} /> Meetings
          </button>
          {officialStatus && (
            <button
              className={`tab-btn-lux ${activeTab === "management" ? "active" : ""}`}
              onClick={() => setActiveTab("management")}
            >
              <Shield size={18} /> Management
            </button>
          )}
        </div>

          <div className="tab-content-area">
            {activeTab === "overview" && (
              <div className="overview-dashboard">
                {/* Main Content Column */}
                <div className="dashboard-main">
                  {officialStatus && (() => {
                    return null;
                  })()}

                    <DeadlineAlerts
                      repayments={loanAnalytics?.upcomingRepayments || []}
                      formatDate={formatDate}
                      formatCurrency={formatCurrency}
                      isOfficial={officialStatus}
                    />

                  <div className="dashboard-card-lux mb-8">
                    <div className="health-hub-lux">
                      <ChamaCreditScore chamaId={id} />
                      <HealthAlerts chamaId={id} />
                    </div>
                  </div>

                  {(ascaEquity || memberStanding) && (
                    <div className="grid grid-2 mb-6">
                      {ascaEquity && (
                        <div className="dashboard-card-lux">
                          <h4 className="card-title-lux" style={{ fontSize: '0.8rem' }}>
                            <DollarSign size={16} /> My Equity
                          </h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatCurrency(ascaEquity.value || 0)}</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.1)', color: 'var(--secondary)', borderRadius: '6px' }}>
                              {ascaEquity.percentage?.toFixed(1)}% Share
                            </span>
                          </div>
                        </div>
                      )}
                      {memberStanding && (
                        <div className="dashboard-card-lux">
                          <h4 className="card-title-lux" style={{ fontSize: '0.8rem' }}>
                            <Shield size={16} /> Credit Limit
                          </h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatCurrency(memberStanding.loanLimit)}</span>
                            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'rgba(212,175,55,0.1)', color: 'var(--gold-text)', borderRadius: '6px' }}>
                              {formatCurrency(memberStanding.availableCredit)} Avail.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                  {chama.accepts_manual_payment && chama.payment_methods && (
                    <div className="dashboard-card-lux">
                      <h3 className="card-title-lux"><Smartphone size={18} /> Payment Information</h3>
                      <div className="info-list-lux" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                        {chama.payment_methods.type === 'PAYBILL' && (
                          <>
                            <div className="info-item-lux">
                              <div style={{ color: 'var(--lux-text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800 }}>Paybill Number</div>
                              <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--lux-text-primary)', fontFamily: 'monospace' }}>{chama.payment_methods.businessNumber}</div>
                            </div>
                            <div className="info-item-lux">
                              <div style={{ color: 'var(--lux-text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800 }}>Account Reference</div>
                              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--lux-text-primary)' }}>{chama.payment_methods.accountPrefix || ''}XXXX</div>
                            </div>
                          </>
                        )}
                        {chama.payment_methods.type === 'BUY_GOODS' && (
                          <div className="info-item-lux">
                            <div style={{ color: 'var(--lux-text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800 }}>Till Number</div>
                            <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--lux-text-primary)', fontFamily: 'monospace' }}>{chama.payment_methods.tillNumber}</div>
                          </div>
                        )}
                        {chama.payment_methods.type === 'POCHI' && (
                          <div className="info-item-lux">
                            <div style={{ color: 'var(--lux-text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800 }}>Pochi Number</div>
                            <div style={{ fontWeight: 900, fontSize: '1.25rem', color: 'var(--lux-text-primary)', fontFamily: 'monospace' }}>{chama.payment_methods.phoneNumber}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isROSCA && activeTab === "cycle" && (
              <div className="card">
                <div className="card-header flex-between">
                  <h3>ROSCA Cycle Progress</h3>
                  {officialStatus && (
                    <div className="cycle-actions flex gap-2">
                      {activeCycle?.status === 'PENDING' && (
                        <button
                          className="btn btn-sm btn-success flex items-center gap-1"
                          onClick={() => {
                            confirmAction({
                              title: "Activate Cycle",
                              message: "Are you sure you want to start this cycle? This will lock the roster and allow members to start contributing and receiving payouts.",
                              confirmLabel: "Activate Now",
                              onConfirm: () => handleActivateCycle(activeCycle.cycle_id)
                            });
                          }}
                        >
                          <CheckCircle2 size={16} /> Activate Cycle
                        </button>
                      )}
                      {!activeCycle && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setShowCreateCycleModal(true)}
                        >
                          Start New Cycle
                        </button>
                      )}
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
                    {/* Swap Requests & Marketplace Section */}
                    {(swapRequests.incoming.length > 0 || swapRequests.outgoing.length > 0 || activeCycle.autopilot_enabled) && (
                      <div className="swap-requests-section mb-6">
                        {/* Autopilot Status Indicator */}
                        {activeCycle.autopilot_enabled && (
                          <div className="alert alert-success mb-4 flex items-center justify-between border-success/30 bg-success/5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success animate-pulse">
                                <Smartphone size={20} />
                              </div>
                              <div>
                                <h4 className="m-0 text-success font-bold text-sm">M-Pesa Autopilot Active</h4>
                                <p className="text-xs text-success/70 m-0">Payouts will trigger automatically via M-Pesa once collective funds are secured.</p>
                              </div>
                            </div>
                            <span className="badge badge-success px-2 py-1 text-[10px]">VERIFIED 10/10</span>
                          </div>
                        )}

                        {swapRequests.incoming.length > 0 && (
                          <div className="alert alert-info shadow-sm">
                            <h4 className="flex items-center gap-2 mb-3 text-blue-700"><Bell size={18} /> Incoming Swap Requests</h4>
                            <div className="grid gap-3">
                              {swapRequests.incoming.map(req => (
                                <div key={req.request_id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-xl border border-blue-100 dark:border-blue-900 gap-4 shadow-sm">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <strong className="text-gray-900 dark:text-gray-100">{req.requester_first_name} {req.requester_last_name}</strong>
                                      <span className="text-gray-500 font-normal">wants to swap slots</span>
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                      Reason: <span className="italic">"{req.reason}"</span>
                                    </div>
                                    {req.swap_fee > 0 && (
                                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-md text-xs font-bold border border-amber-200 dark:border-amber-800">
                                        <DollarSign size={12} /> Incentive Offered: {formatCurrency(req.swap_fee)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      className="btn btn-sm btn-success px-4"
                                      onClick={() => handleSwapResponse(req.request_id, 'APPROVED')}
                                    >
                                      Accept Swap
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline px-4"
                                      onClick={() => handleSwapResponse(req.request_id, 'REJECTED')}
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {swapRequests.outgoing.map(req => (
                          <div key={req.request_id} className="alert alert-secondary mt-2 flex items-center justify-between border-slate-200">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-slate-400" />
                              <span>Pending swap request with <strong>{req.target_first_name} {req.target_last_name}</strong></span>
                            </div>
                            {req.swap_fee > 0 && <span className="text-xs font-bold text-slate-500">Fee: {formatCurrency(req.swap_fee)}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="card-premium">
                        <span className="text-secondary text-xs uppercase font-bold tracking-wider block mb-2">Cycle Name</span>
                        <span className="card-value-premium text-lg font-bold">{activeCycle.cycle_name}</span>
                      </div>
                      <div className="card-premium">
                        <span className="text-secondary text-xs uppercase font-bold tracking-wider block mb-2">Progress</span>
                        <span className="card-value-premium text-lg font-bold text-primary">
                          {Math.round(getCycleProgress())}%
                        </span>
                      </div>
                      <div className="card-premium">
                        <span className="text-secondary text-xs uppercase font-bold tracking-wider block mb-2">Next Payout</span>
                        <span className="card-value-premium text-lg font-bold text-success">
                          {formatCurrency(
                            activeCycle.contribution_amount * members.length
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600 mb-8">
                      <div
                        className="h-full bg-primary transition-all duration-1000"
                        style={{ width: `${getCycleProgress()}%` }}
                      ></div>
                    </div>

                    <div className="dashboard-card-lux mb-8 border border-success/30 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-success"></div>
                      
                      <div className="card-header pb-4 mb-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <h4 className="flex items-center gap-2 m-0 text-gray-800 dark:text-gray-100 font-bold">
                          <User size={18} className="text-success" />
                          Current Recipient
                        </h4>
                        <span className="status-pill-lux status-verified px-3 py-1">Ready for Payout</span>
                      </div>

                      {getCurrentRecipient() && (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center text-success font-bold text-xl shrink-0 border border-success/20">
                              {getCurrentRecipient().first_name[0]}
                              {getCurrentRecipient().last_name[0]}
                            </div>
                            <div>
                              <h5 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">
                                {getCurrentRecipient().first_name} {getCurrentRecipient().last_name}
                              </h5>
                              <p className="text-sm text-gray-500 dark:text-gray-400 m-0 flex items-center gap-2">
                                Expected Payout:
                                <span className="font-bold text-lg text-gray-900 dark:text-gray-100 tracking-tight">
                                  {formatCurrency(activeCycle.contribution_amount * members.length)}
                                </span>
                              </p>
                            </div>
                          </div>

                          {['TREASURER', 'CHAIRPERSON'].includes(userRole) && (
                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
                              <button
                                className="btn-lux btn-lux-primary flex-1 md:flex-none shadow-sm h-10 px-5 font-bold"
                                onClick={() => {
                                  setPayoutRecipient({
                                    ...getCurrentRecipient(),
                                    position: roster.find(r => r.user_id === getCurrentRecipient().user_id).position
                                  });
                                  setShowPayoutModal(true);
                                }}
                              >
                                Disburse Funds
                              </button>

                              <button
                                className="btn-lux btn-lux-outline flex-1 md:flex-none h-10 px-4 flex justify-center items-center gap-2 transition-colors cursor-pointer"
                                onClick={() => {
                                  confirmAction({
                                    title: "Cancel ROSCA Cycle",
                                    message: "Are you sure you want to cancel this cycle? This will stop future payouts but keep existing history.",
                                    variant: "warning",
                                    confirmLabel: "Yes, Cancel Cycle",
                                    onConfirm: async () => {
                                      try {
                                        await roscaAPI.cancelCycle(activeCycle.cycle_id);
                                        toast.success("Cycle cancelled successfully");
                                        fetchChamaData();
                                      } catch (err) {
                                        toast.error(err.response?.data?.message || "Failed to cancel cycle");
                                      }
                                    }
                                  });
                                }}
                              >
                                <RefreshCw size={14} /> Cancel
                              </button>

                              <button
                                className="btn-lux btn-lux-outline flex-1 md:flex-none h-10 px-4 flex justify-center items-center gap-2 cursor-pointer border-danger"
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
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="dashboard-card-lux mb-8">
                      <div className="card-header pb-4 mb-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                        <h4 className="flex items-center gap-2 m-0 text-gray-800 dark:text-gray-100">
                          <Users size={18} className="text-primary" /> Cycle Roster
                        </h4>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="table-lux w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/50">
                              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 w-16 text-center">Pos</th>
                              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">Member</th>
                              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">Payout Status</th>
                              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-right">Expected Payout</th>
                              <th className="p-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {roster.map((member, index) => {
                              const status = getMemberStatus(member);
                              const isCurrentUser = member.user_id === user?.id;
                              const isFutureSlot = status === "WAITING";
                              const canRequestSwap = !isCurrentUser && isFutureSlot && roster.find(r => r.user_id === user?.id)?.status === "WAITING";
                              
                              const payoutAmount = activeCycle.contribution_amount * members.length;

                              return (
                                <tr 
                                  key={member.user_id} 
                                  className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors ${status === 'CURRENT_RECIPIENT' ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                >
                                  <td className="p-3 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-700 text-xs font-bold text-gray-700 dark:text-gray-300">
                                      {index + 1}
                                    </span>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                                          status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' :
                                          status === 'CURRENT_RECIPIENT' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                                          'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                                        }`}
                                      >
                                        {status === "COMPLETED" && <CheckCircle2 size={14} />}
                                        {status === "CURRENT_RECIPIENT" && <Target size={14} />}
                                        {status === "WAITING" && <Clock size={14} />}
                                      </div>
                                      <div>
                                        <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                          {member.first_name} {member.last_name}
                                          {isCurrentUser && <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">You</span>}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                                      status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' :
                                      status === 'CURRENT_RECIPIENT' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800' :
                                      'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
                                    }`}>
                                      {status.replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className={`text-sm font-semibold ${status === 'COMPLETED' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                                      {formatCurrency(payoutAmount)}
                                    </div>
                                  </td>
                                  <td className="p-3 text-right">
                                    {canRequestSwap ? (
                                      <button
                                        className="btn btn-xs btn-outline hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                        onClick={() => {
                                          setSwapTarget(member);
                                          setShowSwapModal(true);
                                        }}
                                      >
                                        <ArrowRightLeft size={14} className="mr-1" /> Swap
                                      </button>
                                    ) : (
                                      <span className="text-gray-300 dark:text-gray-600">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <ContributionMatrix
                      roster={roster}
                      members={members}
                      contributions={contributions}
                      formatCurrency={formatCurrency}
                      activeCycle={activeCycle}
                    />
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
              <div className="dashboard-card-lux" style={{ minHeight: '700px' }}>
                <div className="card-header pb-4 mb-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="card-title-lux m-0">
                    <CreditCard size={20} /> Financial Ledger ({contributions.length})
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {officialStatus && (
                      <button 
                        className="btn-lux btn-lux-outline"
                        onClick={() => setShowPendingContributionsModal(true)}
                      >
                        <Shield size={16} /> Verify Payments
                      </button>
                    )}
                    <button 
                      className="btn-lux btn-lux-primary" 
                      onClick={() => navigate(`/chamas/${id}/submit-contribution`)}
                    >
                      <Smartphone size={16} /> Pay M-Pesa
                    </button>
                    {chama.accepts_manual_payment && (
                      <button 
                        className="btn-lux btn-lux-outline"
                        onClick={() => setShowManualPaymentModal(true)}
                      >
                        <FileText size={16} /> Receipt
                      </button>
                    )}
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="stats-grid-lux" style={{ marginBottom: '2rem' }}>
                  <div className="stat-card-lux">
                    <span className="stat-label-lux">Total Collections</span>
                    <div className="stat-value-lux" style={{ color: '#10b981' }}>
                      {formatCurrency(contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0))}
                    </div>
                  </div>
                  <div className="stat-card-lux">
                    <span className="stat-label-lux">Current Month</span>
                    <div className="stat-value-lux">
                      {formatCurrency(
                        contributions
                          .filter(c => new Date(c.contribution_date).getMonth() === new Date().getMonth())
                          .reduce((sum, c) => sum + parseFloat(c.amount), 0)
                      )}
                    </div>
                  </div>
                  <div className="stat-card-lux">
                    <span className="stat-label-lux">Member Participation</span>
                    <div className="stat-value-lux">
                      {new Set(contributions.map(c => c.user_id)).size} <small style={{ fontSize: '0.6em', opacity: 0.5 }}>/ {members.length}</small>
                    </div>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="filter-bar-lux">
                  <div className="filter-group-lux">
                    <span className="filter-label-lux">Search Member</span>
                    <select
                      name="userId"
                      value={filters.userId}
                      onChange={handleFilterChange}
                      className="filter-input-lux"
                    >
                      <option value="">All Members</option>
                      {members.map(m => (
                        <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-group-lux">
                    <span className="filter-label-lux">Start Date</span>
                    <input
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      className="filter-input-lux"
                    />
                  </div>
                  <div className="filter-group-lux">
                    <span className="filter-label-lux">End Date</span>
                    <input
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      className="filter-input-lux"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-lux btn-lux-primary" onClick={applyFilters}>
                      <Filter size={16} /> Filter
                    </button>
                    <button className="btn-lux btn-lux-outline" onClick={resetFilters}>
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </div>

                {contributions.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <CreditCard size={48} style={{ marginBottom: '1rem' }} />
                    <p>No transaction history found.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-lux">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Contributor</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Status</th>
                          <th>Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contributions.slice(0, 100).map((c) => {
                          const verStatus = c.verification_status || c.status || 'PENDING';
                          const isVerified = verStatus === 'VERIFIED' || verStatus === 'COMPLETED';
                          const isRejected = verStatus === 'REJECTED';
                          
                          return (
                            <tr key={c.id || c.contribution_id || Math.random()}>
                              <td style={{ whiteSpace: 'nowrap' }}>
                                <div style={{ fontWeight: 700 }}>{formatDate(c.contribution_date)}</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{new Date(c.contribution_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: '#fff' }}>{c.contributor_name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gold-text)', opacity: 0.8 }}>Member</div>
                              </td>
                              <td style={{ fontWeight: 900, color: '#10b981' }}>{formatCurrency(c.amount)}</td>
                              <td>
                                <span className="status-pill-lux" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                  {c.payment_method === 'MPESA' ? <Smartphone size={10} /> : <CreditCard size={10} />}
                                  {c.payment_method}
                                </span>
                              </td>
                              <td>
                                <span className={`status-pill-lux ${isVerified ? 'status-verified' : isRejected ? 'status-danger' : 'status-pending'}`}>
                                  {isVerified ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                  {isVerified ? 'Verified' : verStatus}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
                                {c.transaction_reference || 'MANUAL-REF'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {contributions.length > 100 && (
                      <div className="text-center py-4 opacity-50 text-xs italic">
                        Showing last 100 transactions. Export for full history.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "chat" && (
              <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
                <ChamaChat chamaId={chama.chama_id} />
              </div>
            )}

            {activeTab === "reports" && (
              <div className="dashboard-card-lux" id="finance-reports-charts">
                <div className="card-header pb-4 mb-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="card-title-lux m-0">
                    <BarChart3 size={20} /> Analytics & Intelligence
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn-lux btn-lux-outline" onClick={handleExportPDF}>
                      <FileText size={16} /> PDF
                    </button>
                    <button className="btn-lux btn-lux-outline" onClick={handleExportExcel}>
                      <Download size={16} /> Excel
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
                      <AreaChart
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
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                        <XAxis 
                          dataKey="month" 
                          tick={{fontSize: 11, fontWeight: 700}} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <YAxis 
                          tick={{fontSize: 11, fontWeight: 700}} 
                          axisLine={false} 
                          tickLine={false} 
                          tickFormatter={(val) => val >= 1000 ? (val/1000).toFixed(0) + 'K' : val}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="recharts-default-tooltip" style={{ minWidth: "200px" }}>
                                  <p className="recharts-tooltip-label">{label}</p>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
                                        Revenue:
                                      </span>
                                      <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{formatCurrency(payload[0].value)}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                                        Activity:
                                      </span>
                                      <span style={{ fontWeight: 800, color: "var(--text-primary)" }}>{payload[1].value} tx</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke="#6366f1"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorAmount)"
                          name="Total Amount"
                          animationDuration={1500}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorCount)"
                          name="Transactions"
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="reports-grid">
                  {/* Phase 13 Premium Reports */}
                  {["ASCA", "TABLE_BANKING"].includes(chama.chama_type) && ascaReports && (
                    <>
                      <div className="report-card" style={{ gridColumn: '1 / -1' }}>
                        <div className="report-header">
                          <div className="report-icon"><Target size={20} className="text-primary" /></div>
                          <h4>Share-Out Readiness</h4>
                        </div>
                        <div className="report-content">
                          <div className="readiness-gauge mt-2">
                            <div style={{ width: '100%', height: '12px', background: 'var(--surface-3)', borderRadius: '6px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  width: `${Math.min(100, (ascaReports.readiness.liquidCash / Math.max(1, ascaReports.readiness.totalEquity)) * 100)}%`, 
                                  height: '100%', 
                                  background: 'linear-gradient(90deg, #4f46e5, #10b981)',
                                  transition: 'width 1s ease-in-out'
                                }}
                              ></div>
                            </div>
                            <div className="flex-between mt-2" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Liquid Cash: <span style={{ color: 'var(--primary)' }}>{formatCurrency(ascaReports.readiness.liquidCash)}</span></span>
                              <span style={{ color: 'var(--text-secondary)' }}>Total Equity: <span style={{ color: 'var(--secondary)' }}>{formatCurrency(ascaReports.readiness.totalEquity)}</span></span>
                            </div>
                            <div style={{ padding: '0.75rem', background: 'rgba(79, 70, 229, 0.05)', borderRadius: '0.5rem', marginTop: '1rem', border: '1px dashed rgba(79, 70, 229, 0.2)' }}>
                              <p className="text-xs text-muted leading-tight">
                                {ascaReports.readiness.liquidCash >= ascaReports.readiness.totalEquity 
                                  ? "ðŸŸ¢ Funds are ready for share-out payout. Liquid cash covers 100% of member equity." 
                                  : `ðŸŸ¡ Additional ${formatCurrency(ascaReports.readiness.totalEquity - ascaReports.readiness.liquidCash)} must be recovered from outstanding loans before a full share-out payout can be processed.`}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="report-card">
                        <div className="report-header">
                          <div className="report-icon"><Landmark size={20} className="text-indigo-500" /></div>
                          <h4>ASCA Financial Summary</h4>
                        </div>
                        <div className="report-content">
                          <div className="report-stat">
                            <span className="stat-label">Total investment</span>
                            <span className="stat-value text-indigo-600">{formatCurrency(ascaReports.stats.totalSavings)}</span>
                          </div>
                          <div className="report-stat">
                            <span className="stat-label">Interest Earned</span>
                            <span className="stat-value text-success">{formatCurrency(ascaReports.stats.interestCollected)}</span>
                          </div>
                          <div className="report-stat">
                            <span className="stat-label">Outstanding Debt</span>
                            <span className="stat-value text-orange-500">{formatCurrency(ascaReports.stats.outstandingBalance)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="report-card">
                        <div className="report-header">
                          <div className="report-icon"><TrendingUp size={20} className="text-emerald-500" /></div>
                          <h4>Cycle Growth</h4>
                        </div>
                        <div className="report-content">
                          <div className="h-[150px] w-full mt-2">
                            <ResponsiveContainer width="100%" height={150}>
                              <AreaChart data={ascaReports.trends}>
                                <defs>
                                  <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                  </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorGrowth)" strokeWidth={3} />
                                <XAxis dataKey="month" hide />
                                <YAxis hide />
                                <Tooltip formatter={(val) => formatCurrency(val)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-center text-[10px] uppercase font-black tracking-widest text-slate-400 mt-4">Cumulative fund growth this cycle</p>
                        </div>
                      </div>


                      <div className="dashboard-card-lux" style={{ gridColumn: '1 / -1' }}>
                        <div className="card-header pb-4 mb-4 border-b border-white/5 flex justify-between items-center">
                          <h4 className="card-title-lux m-0 flex items-center gap-2">
                            <FileText size={20} /> Personal Equity Statement
                          </h4>
                          <span className="status-pill-lux status-verified">Live Audit</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="table-lux">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Action</th>
                                <th>Detail</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ascaStatement.length === 0 ? (
                                <tr><td colSpan="4" className="text-center py-8 opacity-30">No equity transactions found.</td></tr>
                              ) : (
                                ascaStatement.map((s, idx) => (
                                  <tr key={idx}>
                                    <td style={{ fontWeight: 700 }}>{formatDate(s.date)}</td>
                                    <td>
                                      <span className={`status-pill-lux ${s.type === 'SHARE_PURCHASE' ? 'status-pending' : 'status-verified'}`}>
                                        {s.type.replace('_', ' ')}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                                      {s.type === 'SHARE_PURCHASE' ? `${s.detail} Shares` : 'Dividend Credit'}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 900, color: s.amount >= 0 ? '#10b981' : '#ef4444' }}>
                                      {formatCurrency(s.amount)}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {/* New Loan Performance Section for Officials (Rendered across modules) */}
                  {officialStatus && loanAnalytics && (
                    <div className="report-card" style={{ gridColumn: '1 / -1' }}>
                      <div className="report-header">
                        <div className="report-icon"><Building2 size={20} className="text-amber-500" /></div>
                        <h4>Loan Performance Dashboard (Official View)</h4>
                      </div>
                      <div className="report-content">
                        <div className="grid grid-1 md:grid-3 gap-6 mb-8">
                          <div className="p-6 bg-surface rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-emerald-500/10 rounded-lg"><TrendingUp size={18} className="text-emerald-500" /></div>
                              <div className="text-xs text-slate-400 uppercase font-black tracking-wider">Interest Revenue</div>
                            </div>
                            <div className="text-3xl font-black text-success tracking-tight">{formatCurrency(loanAnalytics.totalInterestEarned)}</div>
                            <div className="text-xs text-slate-500 mt-2 font-medium">Total realized profit</div>
                          </div>
                          <div className="p-6 bg-surface rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle size={18} className="text-red-500" /></div>
                              <div className="text-xs text-slate-400 uppercase font-black tracking-wider">Default Risk</div>
                            </div>
                            <div className="text-3xl font-black text-orange-500 tracking-tight">{loanAnalytics.defaultRate}%</div>
                            <div className="text-xs text-slate-500 mt-2 font-medium">Portfolio at risk (PAR)</div>
                          </div>
                          <div className="p-6 bg-surface rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-blue-500/10 rounded-lg"><Shield size={18} className="text-blue-500" /></div>
                              <div className="text-xs text-slate-400 uppercase font-black tracking-wider">Portfolio Balance</div>
                            </div>
                            <div className="text-3xl font-black text-blue-500 tracking-tight">{formatCurrency(loanAnalytics.totalOutstanding)}</div>
                            <div className="text-xs text-slate-500 mt-2 font-medium">Active capital in circulation</div>
                          </div>
                        </div>

                        <div className="grid grid-1 lg:grid-2 gap-8 items-start">
                          <div className="p-6 bg-surface/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                            <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-5 flex items-center gap-3">
                              <Clock size={16} className="text-primary" /> Upcoming Repayments
                            </h5>
                            <div className="space-y-3">
                              {loanAnalytics.upcomingRepayments.slice(0, 4).map((r, idx) => (
                                <div key={idx} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm hover:border-primary transition-colors">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-primary">
                                      {r.borrower_name?.charAt(0)}
                                    </div>
                                    <div>
                                      <div className="font-bold text-sm text-slate-700 dark:text-slate-200">{r.borrower_name}</div>
                                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Next: {formatDate(r.next_repayment_date)}</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-black text-slate-800 dark:text-white">{formatCurrency(r.amount_due)}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">Amount Due</div>
                                  </div>
                                </div>
                              ))}
                              {loanAnalytics.upcomingRepayments.length === 0 && (
                                <div className="text-center text-xs text-slate-400 p-8 italic bg-slate-50/50 rounded-2xl">No repayments due in next 30 days.</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="p-6">
                            <h5 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-5">Lending Velocity</h5>
                            <div className="h-[180px] w-full">
                              <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={loanAnalytics.disbursementTrends}>
                                  <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                    </linearGradient>
                                  </defs>
                                  <Area type="monotone" dataKey="total" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} />
                                  <XAxis dataKey="month" hide />
                                  <YAxis hide />
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                                    formatter={(val) => formatCurrency(val)} 
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="flex justify-between items-center mt-4 px-2">
                               <div className="text-xs font-bold text-slate-400 uppercase">Capital Inflow vs Lending</div>
                               <div className="text-xs font-bold text-success flex items-center gap-1">
                                 <TrendingUp size={12} /> Positive
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Financial Summary */}
                  <div className="report-card">
                    <div className="report-header">
                      <div className="report-icon"><DollarSign size={20} className="text-emerald-500" /></div>
                      <h4>Core Fund Analytics</h4>
                    </div>
                    <div className="report-content">
                      <div className="report-stat">
                        <span className="stat-label">Total inflow</span>
                        <span className="stat-value text-emerald-600">
                          {formatCurrency(stats?.total_contributions || 0)}
                        </span>
                      </div>
                      <div className="report-stat">
                        <span className="stat-label">Liquid Balance</span>
                        <span className="stat-value text-blue-600">
                          {formatCurrency(stats?.current_fund || 0)}
                        </span>
                      </div>
                      <div className="report-stat">
                        <span className="stat-label">Equity Density</span>
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
                      <div className="report-icon"><TrendingUp size={20} className="text-primary" /></div>
                      <h4>Elite Performers</h4>
                    </div>
                    <div className="report-content">
                      <div className="performance-list">
                        {members.slice(0, 5).map((member, index) => (
                          <div key={member.user_id} className="performance-item hover:border-primary transition-all">
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
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mt-6">Top 5 by All-Time Contributions</p>
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

            {activeTab === "meetings" && (
              <div className="dashboard-card-lux">
                <div className="card-header pb-4 mb-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="card-title-lux m-0">
                    <Calendar size={20} /> Group Assemblies
                  </h3>
                  {officialStatus && (
                    <button
                      className="btn-lux btn-lux-primary"
                      onClick={() => navigate(`/chamas/${id}/meetings/create`)}
                    >
                      Schedule
                    </button>
                  )}
                </div>
                {meetings.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <Calendar size={48} style={{ marginBottom: '1rem' }} />
                    <p>No upcoming assemblies scheduled.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meetings.map(m => (
                      <div key={m.meeting_id} className="member-card-lux" style={{ alignItems: 'flex-start', textAlign: 'left', padding: '1.25rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--lux-text-primary)' }}>{m.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--lux-text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Clock size={12} /> {new Date(m.scheduled_at || m.date).toLocaleDateString()} at {new Date(m.scheduled_at || m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {m.location && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--lux-gold)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                            <MapPin size={10} /> {m.location}
                          </div>
                        )}
                        <button
                          className="btn-lux btn-lux-outline w-full mt-5"
                          style={{ justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}
                          onClick={() => navigate(`/chamas/${id}/meetings`)}
                        >
                          Access Assembly Agenda
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "loans" && (
              <div className="dashboard-card-lux">
                <div className="card-header pb-4 mb-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="card-title-lux m-0">
                    <Building2 size={20} /> Credit & Lending
                  </h3>
                  <button
                    className="btn-lux btn-lux-primary"
                    onClick={() => navigate(`/chamas/${id}/loans/apply`)}
                  >
                    Apply for Loan
                  </button>
                </div>
                {loans.length === 0 ? (
                  <div className="text-center py-20 opacity-30">
                    <Building2 size={48} style={{ marginBottom: '1rem' }} />
                    <p>No active credit facilities found.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-lux">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Principal</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Disbursement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loans.map(l => (
                          <tr key={l.loan_id}>
                            <td style={{ fontWeight: 800, color: 'var(--lux-text-primary)' }}>{l.borrower_name}</td>
                            <td style={{ fontWeight: 900, color: '#10b981', fontSize: '1rem' }}>{formatCurrency(l.loan_amount)}</td>
                            <td>
                              <span className={`status-pill-lux ${l.status === 'APPROVED' ? 'status-verified' : l.status === 'PENDING' ? 'status-pending' : 'status-danger'}`}>
                                {l.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: 'var(--lux-text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>{formatDate(l.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "investments" && chama.chama_type === "ASCA" && (
              <InvestmentProposals />
            )}

            {activeTab === "welfare" && (
              <div className="dashboard-card-lux">
                <div className="card-header pb-4 mb-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="card-title-lux m-0">
                    <Heart size={20} /> Benevolence & Welfare
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {officialStatus && (
                      <button className="btn-lux btn-lux-outline" onClick={() => navigate(`/chamas/${id}/welfare/admin`)}>
                        Manage Claims
                      </button>
                    )}
                    <button className="btn-lux btn-lux-primary" onClick={() => navigate(`/chamas/${id}/welfare/submit-claim`)}>
                      New Claim
                    </button>
                  </div>
                </div>
                {welfareFund && (
                  <div className="stats-grid-lux mb-8">
                    <div className="stat-card-lux">
                      <span className="stat-label-lux">Fund Balance</span>
                      <div className="stat-value-lux">{formatCurrency(welfareFund.balance)}</div>
                    </div>
                    <div className="stat-card-lux">
                      <span className="stat-label-lux">Active Claims</span>
                      <div className="stat-value-lux" style={{ color: 'var(--gold-text)' }}>
                        {welfareClaims.filter(c => c.status === 'PENDING').length}
                      </div>
                    </div>
                  </div>
                )}
                
                <h4 style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.15em', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Recent Disbursements
                </h4>

                {welfareClaims.length === 0 ? (
                  <div className="text-center py-10 opacity-30">
                    <p>No historical claims found.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {welfareClaims.slice(0, 5).map(c => (
                      <div key={c.claim_id} className="member-card-lux" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div className="member-avatar-lux" style={{ width: '44px', height: '44px', margin: 0, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: 'none' }}>
                            <Heart size={20} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, color: 'var(--lux-text-primary)', fontSize: '1rem' }}>{c.claim_type || c.event_type || 'Custom Claim'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--lux-text-secondary)', fontWeight: 600 }}>{formatDate(c.created_at)}</div>
                          </div>
                        </div>
                        <span className={`status-pill-lux ${c.status === 'APPROVED' ? 'status-verified' : 'status-pending'}`} style={{ height: 'fit-content' }}>
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}


            {activeTab === "management" && officialStatus && (
              <div className="management-tab-lux">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="dashboard-card-lux hover-scale cursor-pointer" onClick={() => navigate(`/chamas/${id}/manage`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                        <Settings size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lux-primary m-0" style={{ color: 'var(--lux-text-primary)' }}>General Settings</h4>
                        <p className="text-xs text-lux-secondary m-0" style={{ color: 'var(--lux-text-secondary)' }}>Update chama name, visibility, and payments</p>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card-lux hover-scale cursor-pointer" onClick={() => navigate(`/chamas/${id}/invites`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                        <Mail size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lux-primary m-0" style={{ color: 'var(--lux-text-primary)' }}>Member Invites</h4>
                        <p className="text-xs text-lux-secondary m-0" style={{ color: 'var(--lux-text-secondary)' }}>Generate codes and send email invitations</p>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card-lux hover-scale cursor-pointer" onClick={() => navigate(`/chamas/${id}/add-member`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                        <Users size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lux-primary m-0" style={{ color: 'var(--lux-text-primary)' }}>Add Member Direct</h4>
                        <p className="text-xs text-lux-secondary m-0" style={{ color: 'var(--lux-text-secondary)' }}>Add a known user directly to the chama</p>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card-lux hover-scale cursor-pointer" onClick={() => navigate(`/chamas/${id}/join-requests`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                        <Bell size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lux-primary m-0" style={{ color: 'var(--lux-text-primary)' }}>Join Requests</h4>
                        <p className="text-xs text-lux-secondary m-0" style={{ color: 'var(--lux-text-secondary)' }}>Approve or reject pending member requests</p>
                      </div>
                    </div>
                  </div>

                  <div className="dashboard-card-lux hover-scale cursor-pointer" onClick={() => navigate(`/chamas/${id}/audit-logs`)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-500/10 text-slate-500 flex items-center justify-center border border-slate-500/20">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-lux-primary m-0" style={{ color: 'var(--lux-text-primary)' }}>Audit Logs</h4>
                        <p className="text-xs text-lux-secondary m-0" style={{ color: 'var(--lux-text-secondary)' }}>View history of all actions in the chama</p>
                      </div>
                    </div>
                  </div>
                </div>
                 {/* Loan Configuration Panel — TABLE_BANKING and ASCA only */}
                 {['TABLE_BANKING', 'ASCA'].includes(chama?.chama_type) && (
                   <div className="mt-6">
                     <LoanConfigCard chamaId={id} />
                   </div>
                 )}
              </div>
            )}

            {activeTab === "constitution" && officialStatus && (
              <div className="dashboard-card-lux" style={{ padding: '40px' }}>
                <form
                  onSubmit={handleUpdateConstitution}
                  className="space-y-6"
                >
                  <div className="section-header mb-8" style={{ borderBottom: '1px solid var(--lux-border)', paddingBottom: '24px' }}>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-2xl font-bold m-0" style={{ color: 'var(--lux-text-primary)' }}>Chama Constitution</h3>
                    </div>
                    <p style={{ color: 'var(--lux-text-secondary)', margin: 0 }}>Define your group's rules, bylaws, and penalties.</p>
                  </div>

                  <div className="form-group mb-6">
                    <label className="block mb-2" style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)' }}>Rules & Bylaws</label>
                    <textarea
                      className="form-textarea"
                      style={{
                          width: '100%',
                          background: 'var(--lux-bg-soft)',
                          border: '1px solid var(--lux-border)',
                          color: 'var(--lux-text-primary)',
                          padding: '20px',
                          borderRadius: '16px',
                          fontSize: '1rem',
                          lineHeight: '1.6'
                      }}
                      rows="10"
                      value={constitutionText}
                      onChange={(e) => setConstitutionText(e.target.value)}
                      placeholder="Enter the full text of your constitution, bylaws, and rules here..."
                      style={{ resize: 'vertical', minHeight: '150px' }}
                    ></textarea>
                  </div>

                  <div className="dashboard-card-lux" style={{ background: 'var(--lux-bg-soft)', padding: '24px', marginBottom: '24px' }}>
                    <h4 className="flex flex-between align-center m-0 mb-4">
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--lux-text-primary)' }}>Late Payment Penalties</span>
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
                      <div className="grid grid-cols-2 gap-6 mt-4">
                        <div className="form-group">
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', display: 'block', marginBottom: '8px' }}>Penalty Amount (KES)</label>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '100%', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                            value={constitutionForm.late_payment.amount}
                            onChange={(e) => setConstitutionForm(prev => ({
                              ...prev,
                              late_payment: { ...prev.late_payment, amount: parseFloat(e.target.value) }
                            }))}
                          />
                        </div>
                        <div className="form-group">
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', display: 'block', marginBottom: '8px' }}>Grace Period (Days)</label>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '100%', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)' }}
                            value={constitutionForm.late_payment.grace_period_days}
                            onChange={(e) => setConstitutionForm(prev => ({
                              ...prev,
                              late_payment: { ...prev.late_payment, grace_period_days: parseInt(e.target.value) }
                            }))}
                          />
                          <small style={{ color: 'var(--lux-text-secondary)', opacity: 0.7, marginTop: '4px', display: 'block' }}>Days after deadline before penalty applies.</small>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end mt-8">
                    <button type="submit" className="btn-lux" style={{ minWidth: '220px' }}>Commit Governance Protocols</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
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

      {showManualPaymentModal && (
        <ManualPaymentModal
          chamaId={chama.chama_id}
          userId={user?.user_id || user?.id}
          expectedAmount={chama.contribution_amount}
          onClose={() => setShowManualPaymentModal(false)}
          onSuccess={() => {
            setShowManualPaymentModal(false);
            fetchContributions();
          }}
        />
      )}

      {showPendingContributionsModal && (
        <PendingContributions
          chamaId={chama.chama_id}
          onClose={() => setShowPendingContributionsModal(false)}
          onVerifySuccess={() => {
             // We can refresh the contributions list after verifying
             fetchContributions();
             if (stats) fetchChamaData();
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
      {showPayoutModal && payoutRecipient && (
        <PayoutConfirmationModal
          cycle={activeCycle}
          recipient={payoutRecipient}
          onClose={() => {
            setShowPayoutModal(false);
            setPayoutRecipient(null);
          }}
          onSuccess={fetchChamaData}
          formatCurrency={formatCurrency}
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

