import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ascaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Asca.css";

const AscaDashboard = () => {
    const { id } = useParams();
    const [equity, setEquity] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchEquity = async () => {
            try {
                const res = await ascaAPI.getEquity(id);
                if (isMounted) {
                    setEquity(res.data.data || res.data);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to fetch equity data");
                    setLoading(false);
                }
            }
        };

        fetchEquity();

        return () => {
            isMounted = false;
        };
    }, [id]);

    if (loading) return <div className="loading-spinner">Loading equity...</div>;

    return (
        <div className="page asca-dashboard">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Table Banking (ASCA)</h1>
                        <p className="subtitle">Accumulating Savings & Credit Association</p>
                    </div>
                </div>

                {/* Equity Summary Card */}
                <div className="equity-card">
                    <h2>My Equity</h2>
                    <div className="equity-stats">
                        <div className="stat-block">
                            <h3>{equity?.shares || 0}</h3>
                            <p>Shares Owned</p>
                        </div>
                        <div className="stat-block">
                            <h3>KES {equity?.value?.toLocaleString() || 0}</h3>
                            <p>Total Value</p>
                        </div>
                        <div className="stat-block">
                            <h3>{equity?.percentage || 0}%</h3>
                            <p>Ownership</p>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="actions-row">
                    <Link to={`/chamas/${id}/asca/buy`} className="btn btn-primary flex-1">
                        💰 Buy Shares
                    </Link>
                    <Link to={`/chamas/${id}/asca/proposals`} className="btn btn-outline flex-1">
                        🗳️ Investments
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AscaDashboard;
