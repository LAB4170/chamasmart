import { useAuth } from "../../../context/AuthContext";
import { chamaAPI, roscaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { ArrowLeft, Users, Calendar, CircleDot, CheckCircle2, History, List, Send, Check, X as XIcon, RefreshCw } from "lucide-react";
import RoscaCycleLedger from "../../../components/rosca/RoscaCycleLedger";
import SwapRequestModal from "../../../components/rosca/SwapRequestModal";
import "./Rosca.css";

const RoscaDetails = () => {
    const { cycleId } = useParams();
    const { user } = useAuth();
    const [cycle, setCycle] = useState(null);
    const [roster, setRoster] = useState([]);
    const [contributions, setContributions] = useState([]);
    const [swapRequests, setSwapRequests] = useState([]);
    const [userRole, setUserRole] = useState('MEMBER');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [viewMode, setViewMode] = useState('TIMELINE'); // 'TIMELINE' or 'LEDGER'

    // Swap Modal State
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [selectedTurn, setSelectedTurn] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [cycleRes, rosterRes, contributionsRes, swapRes] = await Promise.all([
                    roscaAPI.getCycle(cycleId),
                    roscaAPI.getRoster(cycleId),
                    roscaAPI.getContributions(cycleId),
                    roscaAPI.getSwapRequests()
                ]);
                
                if (isMounted) {
                    const cycleData = cycleRes.data.data || cycleRes.data;
                    setCycle(cycleData);
                    setRoster(rosterRes.data.data || rosterRes.data);
                    setContributions(contributionsRes.data.data || contributionsRes.data);
                    
                    // Filter swap requests for this cycle
                    const allSwaps = swapRes.data.data || swapRes.data || [];
                    setSwapRequests(allSwaps.filter(s => s.cycle_id === parseInt(cycleId)));

                    // Fetch user role in this chama
                    if (cycleData?.chama_id) {
                        const membersRes = await chamaAPI.getMembers(cycleData.chama_id);
                        const members = membersRes.data.data || membersRes.data;
                        const currentUser = members.find(m => m.user_id === user.user_id);
                        setUserRole(currentUser?.role || 'MEMBER');
                    }
                    
                    setLoading(false);
                }
            } catch (err) {
                console.error("Data fetching error:", err);
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
    const currentRecipient = roster.find(item => item.status === 'PENDING');
    const completedCount = roster.filter(item => item.status === 'PAID').length;
    const progress = roster.length > 0 ? (completedCount / roster.length) * 100 : 0;

    const handleProcessPayout = async (position) => {
        if (!window.confirm(`Are you sure you want to process the payout for Turn #${position}?`)) return;
        
        setProcessing(true);
        try {
            await roscaAPI.processPayout(cycleId, { position });
            toast.success("Payout processed successfully!");
            // Refresh data
            const [rosterRes, contributionsRes] = await Promise.all([
                roscaAPI.getRoster(cycleId),
                roscaAPI.getContributions(cycleId)
            ]);
            setRoster(rosterRes.data.data || rosterRes.data);
            setContributions(contributionsRes.data.data || contributionsRes.data);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to process payout");
        } finally {
            setProcessing(false);
        }
    };

    const handleSwapSubmit = async (swapData) => {
        try {
            await roscaAPI.requestSwap(cycleId, swapData);
            toast.success("Swap request sent!");
            // Refresh swap requests
            const swapRes = await roscaAPI.getSwapRequests();
            const allSwaps = swapRes.data.data || swapRes.data || [];
            setSwapRequests(allSwaps.filter(s => s.cycle_id === parseInt(cycleId)));
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to send swap request");
            throw err;
        }
    };

    const handleRespondToSwap = async (requestId, action) => {
        const actionText = action === 'APPROVED' ? 'approve' : 'reject';
        if (!window.confirm(`Are you sure you want to ${actionText} this swap request?`)) return;

        setProcessing(true);
        try {
            await roscaAPI.respondToSwap(requestId, action);
            toast.success(`Swap request ${action.toLowerCase()}!`);
            // Refresh all data as roster positions might have changed
            const [rosterRes, swapRes] = await Promise.all([
                roscaAPI.getRoster(cycleId),
                roscaAPI.getSwapRequests()
            ]);
            setRoster(rosterRes.data.data || rosterRes.data);
            const allSwaps = swapRes.data.data || swapRes.data || [];
            setSwapRequests(allSwaps.filter(s => s.cycle_id === parseInt(cycleId)));
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to respond to swap");
        } finally {
            setProcessing(false);
        }
    };

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
                                        const isCompleted = item.status === 'PAID';
                                        const isActive = item.status === 'PENDING' && (index === 0 || roster[index - 1].status === 'PAID');
                                        const isUserTurn = item.user_id === user.user_id;
                                        
                                        // Find pending swap requests involving this position
                                        const incomingSwap = swapRequests.find(s => s.target_position === item.position && s.status === 'PENDING');
                                        const outgoingSwap = swapRequests.find(s => s.requester_id === user.user_id && s.requester_position === item.position && s.status === 'PENDING');

                                        return (
                                            <div key={item.roster_id} className={`timeline-item relative pl-16 mb-8 last:mb-0 ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                                                <div className={`absolute left-4 top-1 w-4 h-4 rounded-full border-2 bg-white z-10 transition-all ${isCompleted ? 'border-emerald-500 bg-emerald-500' : isActive ? 'border-indigo-600 ring-4 ring-indigo-100' : 'border-gray-200'}`}></div>
                                                <div className={`card-premium !p-5 transition-all ${isActive ? 'ring-2 ring-indigo-600 shadow-indigo-100 scale-[1.02]' : 'hover:border-indigo-100'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${isCompleted ? 'bg-emerald-50 text-emerald-600' : isActive ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                                {(item.first_name?.[0] || 'U').toUpperCase()}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-bold ${isActive ? 'text-indigo-600' : 'text-gray-800'}`}>
                                                                        {item.first_name} {item.last_name}
                                                                        {isUserTurn && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase">You</span>}
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                    <Clock size={12} /> {isCompleted ? 'Paid on' : 'Expecting'}: {new Date(item.payout_date || cycle.start_date).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-end gap-2">
                                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'bg-emerald-100 text-emerald-700' : isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                Turn #{item.position}
                                                            </div>

                                                            {/* Swap Request Status */}
                                                            {outgoingSwap && (
                                                                <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
                                                                    <RefreshCw size={10} className="animate-spin" /> Pending Swap
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Actions Row */}
                                                    <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-2">
                                                        {/* Treasurer Payout Action */}
                                                        {isActive && userRole === 'TREASURER' && (
                                                            <button
                                                                onClick={() => handleProcessPayout(item.position)}
                                                                disabled={processing}
                                                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                                            >
                                                                {processing ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                                                Confirm Payout
                                                            </button>
                                                        )}

                                                        {/* Member Swap Action */}
                                                        {!isCompleted && !isActive && !isUserTurn && !outgoingSwap && !incomingSwap && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedTurn(item);
                                                                    setIsSwapModalOpen(true);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all"
                                                            >
                                                                <RefreshCw size={14} /> Request Swap
                                                            </button>
                                                        )}

                                                        {/* Incoming Swap Response */}
                                                        {incomingSwap && (
                                                            <div className="bg-amber-50 p-3 rounded-xl w-full flex flex-col gap-3 border border-amber-100">
                                                                <div className="text-xs text-amber-800">
                                                                    <span className="font-bold">Swap Request:</span> {incomingSwap.requester_first_name} wants to swap with your turn.
                                                                    {incomingSwap.reason && <p className="mt-1 italic opacity-80">"{incomingSwap.reason}"</p>}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleRespondToSwap(incomingSwap.request_id, 'APPROVED')}
                                                                        disabled={processing}
                                                                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                                                                    >
                                                                        <Check size={14} /> Accept
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRespondToSwap(incomingSwap.request_id, 'REJECTED')}
                                                                        disabled={processing}
                                                                        className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1"
                                                                    >
                                                                        <XIcon size={14} /> Reject
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
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

                <SwapRequestModal 
                    isOpen={isSwapModalOpen}
                    onClose={() => setIsSwapModalOpen(false)}
                    onSubmit={handleSwapSubmit}
                    targetPosition={selectedTurn?.position}
                    targetMemberName={selectedTurn ? `${selectedTurn.first_name} ${selectedTurn.last_name}` : ''}
                />
            </div>
        </div>
    );
};

export default RoscaDetails;
