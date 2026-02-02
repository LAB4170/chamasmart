import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { roscaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Rosca.css";

const RoscaDetails = () => {
    const { cycleId } = useParams();
    const [roster, setRoster] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRoster();
    }, [cycleId]);

    const fetchRoster = async () => {
        try {
            const res = await roscaAPI.getRoster(cycleId);
            setRoster(res.data.data || res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load roster");
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading roster...</div>;

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <h1>Cycle Roster</h1>
                </div>

                <div className="card">
                    <div className="roster-list">
                        {roster.map((item, index) => (
                            <div key={item._id} className={`roster-item ${item.isCurrent ? 'current' : ''}`}>
                                {item.isCurrent && <div className="current-indicator"></div>}
                                <div className="turn-number">{index + 1}</div>
                                <div className="member-info">
                                    <span className="member-name">{item.user?.firstName} {item.user?.lastName}</span>
                                    <span className="payout-date">Payout: {new Date(item.payoutDate).toLocaleDateString()}</span>
                                </div>
                                <div className="roster-status">
                                    <span className={`payout-status ${item.status === 'PAID' ? 'status-paid' : 'status-pending'}`}>
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoscaDetails;
