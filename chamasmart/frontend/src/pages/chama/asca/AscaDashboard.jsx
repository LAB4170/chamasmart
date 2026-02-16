import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ascaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import {
    TrendingUp, Coins, PieChart as PieChartIcon, Percent,
    ShoppingCart, Vote, ArrowLeft, ArrowRight, Wallet
} from "lucide-react";
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
        return () => { isMounted = false; };
    }, [id]);

    if (loading) return <div className="loading-spinner">Loading equity...</div>;

    const ownershipNum = equity?.percentage || 0;

    return (
        <div className="page asca-dashboard">
            <div className="container">
                {/* Page Header */}
                <div className="page-header-modern">
                    <Link to={`/chamas/${id}`} className="back-link">
                        <ArrowLeft size={18} />
                        <span>Back to Chama</span>
                    </Link>
                    <div className="page-header-row">
                        <div className="page-header-info">
                            <div className="page-header-icon green">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h1>Investment & Lending</h1>
                                <p className="page-subtitle">Accumulating Savings & Credit (ASCA)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Equity Stats */}
                <div className="stats-row">
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon blue">
                            <Coins size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{equity?.shares || 0}</div>
                            <div className="mini-stat-label">Shares Owned</div>
                        </div>
                    </div>
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon green">
                            <Wallet size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">KES {equity?.value?.toLocaleString() || 0}</div>
                            <div className="mini-stat-label">Total Value</div>
                        </div>
                    </div>
                    <div className="mini-stat-card">
                        <div className="mini-stat-icon purple">
                            <Percent size={20} />
                        </div>
                        <div>
                            <div className="mini-stat-value">{ownershipNum}%</div>
                            <div className="mini-stat-label">Ownership</div>
                        </div>
                    </div>
                </div>

                {/* Ownership Progress */}
                <div className="card-modern">
                    <h3 className="card-modern-title">Your Ownership Share</h3>
                    <div className="ownership-bar-container">
                        <div className="ownership-bar">
                            <div
                                className="ownership-bar-fill"
                                style={{ width: `${Math.min(ownershipNum, 100)}%` }}
                            />
                        </div>
                        <div className="ownership-bar-labels">
                            <span>0%</span>
                            <span className="ownership-current">{ownershipNum}%</span>
                            <span>100%</span>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="action-cards-grid">
                    <Link to={`/chamas/${id}/asca/buy`} className="action-card green">
                        <div className="action-card-icon">
                            <ShoppingCart size={24} />
                        </div>
                        <div className="action-card-content">
                            <h3>Buy Shares</h3>
                            <p>Increase your equity by purchasing additional shares in the pool.</p>
                        </div>
                        <ArrowRight size={18} className="action-card-arrow" />
                    </Link>
                    <Link to={`/chamas/${id}/asca/proposals`} className="action-card purple">
                        <div className="action-card-icon">
                            <Vote size={24} />
                        </div>
                        <div className="action-card-content">
                            <h3>Investment Proposals</h3>
                            <p>View, vote on, and propose new investment opportunities for the group.</p>
                        </div>
                        <ArrowRight size={18} className="action-card-arrow" />
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AscaDashboard;
