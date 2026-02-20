import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { roscaAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import {
    Plus, RefreshCw, Calendar, Users, ArrowRight, CircleDot, CheckCircle2,
    Clock, ArrowLeft, CreditCard, Store, Smartphone, Copy, X, Send, Info
} from "lucide-react";
import "./Rosca.css";

const RoscaDashboard = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const [chama, setChama] = useState(null);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedCycle, setSelectedCycle] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchCycles = async () => {
            try {
                const [cyclesRes, membersRes, chamaRes] = await Promise.all([
                    roscaAPI.getCycles(id),
                    chamaAPI.getMembers(id),
                    chamaAPI.getChama(id)
                ]);

                if (isMounted) {
                    setCycles(cyclesRes.data.data || cyclesRes.data);
                    const members = membersRes.data.data || membersRes.data;
                    const currentMember = members.find(m => m.user_id === user.user_id);
                    setUserRole(currentMember?.role || 'MEMBER');
                    setChama(chamaRes.data.data || chamaRes.data);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to fetch dashboard data");
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
            const res = await roscaAPI.getCycles(id);
            setCycles(res.data.data || res.data);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to activate cycle");
        }
    };

    const handlePayClick = (cycle) => {
        setSelectedCycle(cycle);
        setShowPayModal(true);
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

    const PaymentInstructionCard = ({ methods }) => {
        if (!methods || !methods.type) return (
            <div className="card-premium mb-6 bg-gradient-to-br from-gray-50 to-gray-100 border-dashed">
                <div className="p-4 flex flex-col items-center text-center text-gray-500">
                    <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                        <CreditCard size={24} />
                    </div>
                    <h4 className="font-semibold text-gray-700">No Payment Method</h4>
                    <p className="text-sm mt-1">The chairperson hasn't set up payment details yet.</p>
                </div>
            </div>
        );

        const isPaybill = methods.type === 'PAYBILL';
        const isTill = methods.type === 'TILL';

        return (
            <div className="card-premium mb-6 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                <div className="p-5">
                    <h3 className="card-title-premium flex items-center gap-2 mb-4">
                        <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                            <CreditCard size={18} />
                        </div>
                        Payment Details
                    </h3>

                    <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-emerald-600">
                                {isPaybill ? <CreditCard size={20} /> : isTill ? <Store size={20} /> : <Smartphone size={20} />}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800">
                                    {isPaybill ? 'M-Pesa Paybill' : isTill ? 'Buy Goods Till' : 'Pochi la Biashara'}
                                </h4>
                                <p className="text-xs text-emerald-600 font-medium tracking-wide uppercase">Official Channel</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                                    {isPaybill ? 'Business Number' : isTill ? 'Till Number' : 'Phone Number'}
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="text-xl font-mono font-bold text-gray-900 tracking-tight">
                                        {methods.details.businessNumber || methods.details.tillNumber || methods.details.phoneNumber}
                                    </span>
                                    <button
                                        className="text-gray-400 hover:text-emerald-600 transition-colors"
                                        onClick={() => {
                                            navigator.clipboard.writeText(methods.details.businessNumber || methods.details.tillNumber || methods.details.phoneNumber);
                                            toast.success("Copied to clipboard!");
                                        }}
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                            </div>

                            {isPaybill && (
                                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-sm">
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Number</p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-medium text-gray-800">
                                            {methods.details.accountNumber}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex gap-2 text-xs text-gray-500 bg-white/60 p-2 rounded-lg">
                            <div className="min-w-[4px] bg-emerald-400 rounded-full"></div>
                            <p>To pay manually, go to M-Pesa &gt; {isPaybill ? 'Lipa na M-Pesa > Paybill' : isTill ? 'Lipa na M-Pesa > Buy Goods' : 'Pochi la Biashara'} and use details above.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const PaymentModal = () => {
        if (!showPayModal) return null;

        const [amount, setAmount] = useState(selectedCycle?.contribution_amount || '');
        const [phone, setPhone] = useState(user?.phoneNumber || '');
        const [processing, setProcessing] = useState(false);

        const handlePay = async (e) => {
            e.preventDefault();
            setProcessing(true);

            // SIMULATION
            setTimeout(() => {
                setProcessing(false);
                setShowPayModal(false);
                toast.success("Payment request sent to " + phone);
                toast.info("Check your phone to complete the transaction.", { autoClose: 8000 });
            }, 2000);
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slideDown">
                    <div className="bg-emerald-600 p-6 text-white text-center relative">
                        <button
                            onClick={() => setShowPayModal(false)}
                            className="absolute top-4 right-4 text-emerald-100 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-md">
                            <Send size={32} />
                        </div>
                        <h3 className="text-xl font-bold">Send Contribution</h3>
                        <p className="text-emerald-100 text-sm mt-1">{selectedCycle?.cycle_name}</p>
                    </div>

                    <form onSubmit={handlePay} className="p-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">KES</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold text-lg text-gray-800"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">M-Pesa Phone Number</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                        <Smartphone size={18} />
                                    </span>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        placeholder="07..."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg flex gap-3 items-start text-xs text-blue-700">
                                <Info size={16} className="shrink-0 mt-0.5" />
                                <p>You will receive an M-Pesa prompt on your phone. Enter your PIN to complete the transaction.</p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <>
                                        <RefreshCw size={20} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Pay KES {Number(amount).toLocaleString()}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

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

                            {type === 'active' && (
                                <div className="cycle-card-actions mt-3 pt-3 border-t border-gray-100">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handlePayClick(cycle);
                                        }}
                                        className="w-full py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Send size={14} /> Pay Now
                                    </button>
                                </div>
                            )}

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
                <PaymentModal />
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
                                {chama?.payment_methods && (
                                    <PaymentInstructionCard methods={chama.payment_methods} />
                                )}

                                <div className="card-premium chart-card-premium">
                                    <h3 className="card-title-premium">Status Dictionary</h3>
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
