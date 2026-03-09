import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { roscaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { ArrowLeft, Users, Calendar, CircleDot, CheckCircle2, History, List } from "lucide-react";
import RoscaCycleLedger from "../../../components/rosca/RoscaCycleLedger";
import "./Rosca.css";

const RoscaDetails = () => {
    const { cycleId } = useParams();
    const [cycle, setCycle] = useState(null);
    const [roster, setRoster] = useState([]);
    const [contributions, setContributions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('TIMELINE'); // 'TIMELINE' or 'LEDGER'

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [cycleRes, rosterRes, contributionsRes] = await Promise.all([
                    roscaAPI.getCycle(cycleId),
                    roscaAPI.getRoster(cycleId),
                    roscaAPI.getContributions(cycleId)
                ]);
                
                if (isMounted) {
                    setCycle(cycleRes.data.data || cycleRes.data);
                    setRoster(rosterRes.data.data || rosterRes.data);
                    setContributions(contributionsRes.data.data || contributionsRes.data);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to load cycle details");
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [cycleId]);

    if (loading) return (
        <div className="loading-container">
            <div className="spinner-modern"></div>
            <p>Fetching the payout path...</p>
        </div>
    );

    // Find current recipient (first one where is_paid is false)
    const currentRecipient = roster.find(item => !item.is_paid);
    const completedCount = roster.filter(item => item.is_paid).length;
    const progress = roster.length > 0 ? (completedCount / roster.length) * 100 : 0;

    return (
        <div className="page rosca-details-page">
            <div className="container">
                <div className="page-header-modern items-center flex justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => window.history.back()} className="back-link-premium">
                            <ArrowLeft size={16} />
                            <span>Dashboard</span>
                        </button>
                        <div className="header-info">
                            <div className="header-icon-wrapper">
                                <Users size={28} />
                            </div>
                            <div>
                                <h1>{cycle?.cycle_name || 'Cycle Timeline'}</h1>
                                <p>Track the rotation path and fund status</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
                        <button 
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'TIMELINE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setViewMode('TIMELINE')}
                        >
                            <History size={16} />
                            <span>Timeline</span>
                        </button>
                        <button 
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'LEDGER' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setViewMode('LEDGER')}
                        >
                            <List size={16} />
                            <span>Ledger</span>
                        </button>
                    </div>
                </div>

                {/* Progress Overview Card */}
                <div className="card-premium mb-6">
                    <div className="flex justify-between items-end mb-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Cycle Progress</h3>
                            <p className="text-xs text-gray-500">Based on payouts distributed</p>
                        </div>
                        <span className="text-2xl font-black text-indigo-600">{Math.round(progress)}%</span>
                    </div>
                    <div className="progress-bar-container h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="progress-bar-fill h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex justify-between mt-3 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <span>{completedCount} Distributed</span>
                        <span>{roster.length - completedCount} In Progress</span>
                    </div>
                </div>

                <div className="dashboard-content-grid">
                    <div className="main-content">
                        {viewMode === 'TIMELINE' ? (
                            <>
                                <h2 className="section-title flex items-center gap-2 text-xl font-bold mb-4">
                                    <Calendar size={20} className="text-indigo-600" />
                                    Distribution Sequence
                                </h2>

                                <div className="timeline-container relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-indigo-50">
                                    {roster.map((item, index) => {
                                        const isActive = !item.is_paid && (index === 0 || roster[index-1].is_paid);
                                        const isCompleted = item.is_paid;

                                        return (
                                            <div key={item.roster_id} className={`timeline-item relative pl-16 mb-8 last:mb-0 ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                                                <div className={`absolute left-4 top-1 w-4 h-4 rounded-full border-2 bg-white z-10 transition-all ${isCompleted ? 'border-emerald-500 bg-emerald-500' : isActive ? 'border-indigo-600 ring-4 ring-indigo-100' : 'border-gray-200'}`}></div>
                                                <div className={`card-premium !p-5 transition-all ${isActive ? 'ring-2 ring-indigo-600 shadow-indigo-100 scale-[1.02]' : 'hover:border-indigo-100'}`}>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${isCompleted ? 'bg-emerald-50 text-emerald-600' : isActive ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                                {(item.first_name?.[0] || 'U').toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`font-bold ${isActive ? 'text-indigo-600' : 'text-gray-800'}`}>{item.first_name} {item.last_name}</span>
                                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                    <Clock size={12} /> {isCompleted ? 'Paid on' : 'Expecting'}: {new Date(item.payout_date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                                            Turn #{item.position}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <RoscaCycleLedger 
                                contributions={contributions} 
                                roster={roster} 
                                contributionAmount={cycle?.contribution_amount || 0} 
                            />
                        )}
                    </div>

                    <div className="side-content space-y-6">
                        {currentRecipient && (
                            <div className="card-premium overflow-hidden border-indigo-100 bg-gradient-to-br from-white to-indigo-50/30">
                                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-4">Active Round Recipient</h3>
                                <div className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-indigo-50">
                                    <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-indigo-200">
                                        {(currentRecipient.first_name?.[0] || 'U').toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800 leading-tight">{currentRecipient.first_name} {currentRecipient.last_name}</h4>
                                        <p className="text-xs text-indigo-600 font-medium">Round {currentRecipient.position} In Progress</p>
                                    </div>
                                </div>
                                <div className="mt-6 p-4 bg-indigo-600 rounded-2xl text-white">
                                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Target Payout</div>
                                    <div className="text-2xl font-black">KES {(cycle?.contribution_amount * (roster.length - 1)).toLocaleString()}</div>
                                    <div className="mt-3 pt-3 border-t border-white/20 flex justify-between items-center text-[10px] font-bold">
                                        <span>STATUS</span>
                                        <span className="px-2 py-0.5 bg-white/20 rounded-full">COLLECTING...</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="card-premium">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-800 mb-4">Cycle Rules</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                                        <CheckCircle2 size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800">Verified Payouts</span>
                                        <span className="text-[10px] text-gray-400">All disbursements are recorded on the blockchain ledger.</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
                                        <CircleDot size={16} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-800">Fixed Contributions</span>
                                        <span className="text-[10px] text-gray-400">Every member drops KES {cycle?.contribution_amount.toLocaleString()} per round.</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoscaDetails;
