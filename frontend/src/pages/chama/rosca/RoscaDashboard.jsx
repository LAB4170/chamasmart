import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { roscaAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import {
    Plus, RefreshCw, Calendar, Users, ArrowRight, CircleDot, CheckCircle2,
    Clock, ArrowLeft
} from "lucide-react";
import "./Rosca.css";

const RoscaDashboard = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const [cycles, setCycles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchCycles = async () => {
            try {
                const [cyclesRes, membersRes] = await Promise.all([
                    roscaAPI.getCycles(id),
                    chamaAPI.getMembers(id)
                ]);

                if (isMounted) {
                    setCycles(cyclesRes.data.data || cyclesRes.data);
                    const members = membersRes.data.data || membersRes.data;
                    const currentMember = members.find(m => m.user_id === user.user_id);
                    setUserRole(currentMember?.role || 'MEMBER');
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to fetch merry-go-round cycles");
                    setLoading(false);
                }
            }
        };

        fetchCycles();
        return () => { isMounted = false; };
    }, [id]);

    const handleActivate = async (cycleId) => {
        if (!window.confirm("Are you sure you want to activate this cycle? This will start the contribution rounds.")) return;

        try {
            await roscaAPI.activateCycle(cycleId);
            toast.success("Cycle activated successfully!");
            // Refresh cycles
            const res = await roscaAPI.getCycles(id);
            setCycles(res.data.data || res.data);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to activate cycle");
        }
    };

    if (loading) return (
        <div className="loading-container">
            <div className="spinner-modern"></div>
            <p>Gathering your rounds...</p>
        </div>
    );

    const activeCycles = cycles.filter(c => c.status === 'ACTIVE');
    const pendingCycles = cycles.filter(c => c.status === 'PENDING');
    const completedCycles = cycles.filter(c => c.status === 'COMPLETED');

    const chartData = [
        { name: 'Active', value: activeCycles.length, color: '#10b981' },
        { name: 'Pending', value: pendingCycles.length, color: '#f59e0b' },
        { name: 'Completed', value: completedCycles.length, color: '#6366f1' }
    ];

    const canManage = ['CHAIRPERSON', 'TREASURER', 'SECRETARY'].includes(userRole);

    const renderCycleGrid = (title, items, type) => {
        if (items.length === 0) return null;
        return (
            <div className={`cycle-section ${type}`}>
                <h2 className="section-title">
                    {type === 'active' && <CircleDot size={20} className="text-success" />}
                    {type === 'pending' && <Clock size={20} className="text-warning" />}
                    {type === 'completed' && <CheckCircle2 size={20} className="text-indigo" />}
                    {title}
                </h2>
                <div className="rosca-grid">
                    {items.map(cycle => (
                        <div key={cycle.cycle_id} className="cycle-card-modern">
                            <Link to={`/chamas/${id}/rosca/${cycle.cycle_id}`} className="cycle-card-content">
                                <div className="cycle-card-top">
                                    <span className={`cycle-badge badge-${type}`}>
                                        {type === 'active' ? 'Active' : type === 'pending' ? 'Pending' : 'Completed'}
                                    </span>
                                    <ArrowRight size={16} className="cycle-arrow" />
                                </div>
                                <h3 className="cycle-card-name">{cycle.cycle_name}</h3>
                                <div className="cycle-card-amount">
                                    KES {Number(cycle.contribution_amount)?.toLocaleString()}
                                    <span className="amount-label">/ person</span>
                                </div>
                                <div className="cycle-card-meta">
                                    <span><Calendar size={14} /> {cycle.frequency}</span>
                                    <span><Users size={14} /> {cycle.total_members || 0} Members</span>
                                </div>
                            </Link>
                            {type === 'pending' && canManage && (
                                <div className="cycle-card-actions">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleActivate(cycle.cycle_id);
                                        }}
                                        className="btn-activate-mini"
                                    >
                                        <Plus size={14} /> Activate Now
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="page rosca-dashboard-page">
            <div className="container">
                {/* Page Header */}
                <div className="page-header-modern">
                    <Link to={`/chamas/${id}`} className="back-link-premium">
                        <ArrowLeft size={16} />
                        <span>Chama Dashboard</span>
                    </Link>
                    <div className="header-content">
                        <div className="header-info">
                            <div className="header-icon-wrapper">
                                <RefreshCw size={28} className="rotate-slow" />
                            </div>
                            <div>
                                <h1>Merry-Go-Round</h1>
                                <p>Manage your ROSCA cycles and contributions</p>
                            </div>
                        </div>
                        {canManage && (
                            <Link to={`/chamas/${id}/rosca/create`} className="btn-create-premium">
                                <Plus size={20} />
                                <span>Start New Round</span>
                            </Link>
                        )}
                    </div>
                </div>

                {cycles.length === 0 ? (
                    <div className="empty-state-card-premium">
                        <div className="empty-illustration">
                            <RefreshCw size={64} />
                        </div>
                        <h2>No active rounds yet</h2>
                        <p>Launch your first merry-go-round cycle to start rotating savings today.</p>
                        {canManage && (
                            <Link to={`/chamas/${id}/rosca/create`} className="btn-create-premium large">
                                <Plus size={20} />
                                <span>Initialize First Cycle</span>
                            </Link>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Stats Summary */}
                        <div className="stats-grid-premium">
                            <div className="stat-card-premium active">
                                <div className="stat-icon"><CircleDot size={20} /></div>
                                <div className="stat-data">
                                    <span className="stat-value">{activeCycles.length}</span>
                                    <span className="stat-label">Active Rounds</span>
                                </div>
                            </div>
                            <div className="stat-card-premium pending">
                                <div className="stat-icon"><Clock size={20} /></div>
                                <div className="stat-data">
                                    <span className="stat-value">{pendingCycles.length}</span>
                                    <span className="stat-label">Upcoming</span>
                                </div>
                            </div>
                            <div className="stat-card-premium total">
                                <div className="stat-icon"><Users size={20} /></div>
                                <div className="stat-data">
                                    <span className="stat-value">{cycles.length}</span>
                                    <span className="stat-label">Total Cycles</span>
                                </div>
                            </div>
                        </div>

                        {/* Content Sections */}
                        <div className="dashboard-content-grid">
                            <div className="main-content">
                                {renderCycleGrid("Ongoing Rounds", activeCycles, "active")}
                                {renderCycleGrid("Upcoming / Scheduled", pendingCycles, "pending")}
                                {renderCycleGrid("Past Rounds", completedCycles, "completed")}
                            </div>

                            <div className="side-content">
                                <div className="card-premium chart-card-premium">
                                    <h3 className="card-title-premium">Status Distibution</h3>
                                    <div className="chart-wrapper">
                                        <ResponsiveContainer width="100%" height={240}>
                                            <PieChart>
                                                <Pie
                                                    data={chartData}
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{
                                                        borderRadius: '12px',
                                                        border: 'none',
                                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="chart-legend-premium">
                                            {chartData.map(d => (
                                                <div key={d.name} className="legend-item">
                                                    <span className="dot" style={{ backgroundColor: d.color }}></span>
                                                    <span className="name">{d.name}</span>
                                                    <span className="val">{d.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RoscaDashboard;
