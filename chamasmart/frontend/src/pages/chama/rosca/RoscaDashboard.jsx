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

    if (loading) return <div className="loading-spinner">Loading cycles...</div>;

    const activeCycles = cycles.filter(c => c.isActive);
    const completedCycles = cycles.filter(c => !c.isActive);
    const chartData = [
        { name: 'Active', value: activeCycles.length, color: '#22c55e' },
        { name: 'Completed', value: completedCycles.length, color: '#8b5cf6' }
    ];

    const canManage = ['CHAIRPERSON', 'TREASURER', 'SECRETARY'].includes(userRole);

    return (
        <div className="page">
            <div className="container">
                {/* Page Header */}
                <div className="page-header-modern">
                    <Link to={`/chamas/${id}`} className="back-link">
                        <ArrowLeft size={18} />
                        <span>Back to Chama</span>
                    </Link>
                    <div className="page-header-row">
                        <div className="page-header-info">
                            <div className="page-header-icon blue">
                                <RefreshCw size={24} />
                            </div>
                            <div>
                                <h1>Merry-Go-Round</h1>
                                <p className="page-subtitle">Rotating Savings & Credit (ROSCA)</p>
                            </div>
                        </div>
                        {canManage && (
                            <Link to={`/chamas/${id}/rosca/create`} className="btn-action-primary">
                                <Plus size={18} />
                                <span>New Cycle</span>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Stats Row */}
                {cycles.length > 0 && (
                    <div className="stats-row">
                        <div className="mini-stat-card">
                            <div className="mini-stat-icon green">
                                <CircleDot size={20} />
                            </div>
                            <div>
                                <div className="mini-stat-value">{activeCycles.length}</div>
                                <div className="mini-stat-label">Active Cycles</div>
                            </div>
                        </div>
                        <div className="mini-stat-card">
                            <div className="mini-stat-icon purple">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <div className="mini-stat-value">{completedCycles.length}</div>
                                <div className="mini-stat-label">Completed</div>
                            </div>
                        </div>
                        <div className="mini-stat-card">
                            <div className="mini-stat-icon blue">
                                <Users size={20} />
                            </div>
                            <div>
                                <div className="mini-stat-value">{cycles.reduce((sum, c) => sum + (c.members?.length || 0), 0)}</div>
                                <div className="mini-stat-label">Total Participants</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Chart */}
                {cycles.length > 0 && (
                    <div className="card-modern chart-card">
                        <h3 className="card-modern-title">Cycle Status Overview</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Cycles Grid */}
                {cycles.length === 0 ? (
                    <div className="empty-state-modern">
                        <div className="empty-state-icon">
                            <RefreshCw size={48} strokeWidth={1.5} />
                        </div>
                        <h3>No Active Cycles</h3>
                        <p>Start a new merry-go-round cycle to begin rotating savings among members.</p>
                        {canManage && (
                            <Link to={`/chamas/${id}/rosca/create`} className="btn-action-primary">
                                <Plus size={18} />
                                <span>Create First Cycle</span>
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="rosca-grid">
                        {cycles.map(cycle => (
                            <Link to={`/chamas/${id}/rosca/${cycle._id}`} key={cycle._id} className="cycle-card-modern">
                                <div className="cycle-card-top">
                                    <span className={`cycle-badge ${cycle.isActive ? 'badge-active' : 'badge-completed'}`}>
                                        {cycle.isActive ? <><CircleDot size={12} /> Active</> : <><CheckCircle2 size={12} /> Completed</>}
                                    </span>
                                    <ArrowRight size={16} className="cycle-arrow" />
                                </div>
                                <h3 className="cycle-card-name">{cycle.name}</h3>
                                <div className="cycle-card-amount">
                                    KES {cycle.amount?.toLocaleString()}
                                </div>
                                <div className="cycle-card-meta">
                                    <span><Calendar size={14} /> {cycle.frequency}</span>
                                    <span><Users size={14} /> {cycle.members?.length || 0}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoscaDashboard;
