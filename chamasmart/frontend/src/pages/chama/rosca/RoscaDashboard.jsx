import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { roscaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Rosca.css";

const RoscaDashboard = () => {
    const { id } = useParams();
    const [cycles, setCycles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchCycles = async () => {
            try {
                const res = await roscaAPI.getCycles(id);
                if (isMounted) {
                    setCycles(res.data.data || res.data);
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
                    <Link to={`/chamas/${id}/rosca/create`} className="btn btn-primary">
                        + Start New Cycle
                    </Link>
                </div>

                {cycles.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎡</div>
                        <h3>No Active Cycles</h3>
                        <p>Start a new merry-go-round cycle to begin rotating savings.</p>
                        <Link to={`/chamas/${id}/rosca/create`} className="btn btn-primary mt-3">
                            Create Cycle
                        </Link>
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
