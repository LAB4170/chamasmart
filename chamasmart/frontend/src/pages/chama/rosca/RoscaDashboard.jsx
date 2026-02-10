import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { roscaAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
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

                    // Get user's role
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

        return () => {
            isMounted = false;
        };
    }, [id]);

    if (loading) return <div className="loading-spinner">Loading cycles...</div>;

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Merry-Go-Round</h1>
                        <p className="subtitle">Rotating Savings & Credit (ROSCA)</p>
                    </div>
                    {['CHAIRPERSON', 'TREASURER', 'SECRETARY'].includes(userRole) && (
                        <Link to={`/chamas/${id}/rosca/create`} className="btn btn-primary">
                            + Start New Cycle
                        </Link>
                    )}
                </div>

                {cycles.length > 0 && (
                    <div className="cycle-analytics" style={{ marginBottom: '2rem', background: 'white', padding: '1.5rem', borderRadius: '8px' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Cycle Status Overview</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Active', value: cycles.filter(c => c.isActive).length, color: '#10b981' },
                                        { name: 'Completed', value: cycles.filter(c => !c.isActive).length, color: '#6366f1' }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {[
                                        { name: 'Active', value: cycles.filter(c => c.isActive).length, color: '#10b981' },
                                        { name: 'Completed', value: cycles.filter(c => !c.isActive).length, color: '#6366f1' }
                                    ].map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {cycles.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎡</div>
                        <h3>No Active Cycles</h3>
                        <p>Start a new merry-go-round cycle to begin rotating savings.</p>
                        {['CHAIRPERSON', 'TREASURER', 'SECRETARY'].includes(userRole) && (
                            <Link to={`/chamas/${id}/rosca/create`} className="btn btn-primary mt-3">
                                Create Cycle
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="rosca-grid">
                        {cycles.map(cycle => (
                            <Link to={`/chamas/${id}/rosca/${cycle._id}`} key={cycle._id} className="cycle-card">
                                <span className={`cycle-status ${cycle.isActive ? 'status-active' : 'status-completed'}`}>
                                    {cycle.isActive ? 'Active' : 'Completed'}
                                </span>
                                <h3>{cycle.name}</h3>
                                <div className="cycle-amount">
                                    KES {cycle.amount?.toLocaleString()}
                                </div>
                                <div className="cycle-meta">
                                    <span>📅 {cycle.frequency}</span>
                                    <span>👥 {cycle.members?.length || 0} Members</span>
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
