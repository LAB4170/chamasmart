import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { 
    CreditCard, Store, Smartphone, Check, Settings, 
    Shield, ArrowLeft, RefreshCw, BarChart3, AlertCircle,
    Info, Trash2, ShieldAlert
} from "lucide-react";

const ManageChama = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        contributionAmount: "",
        contributionFrequency: "MONTHLY",
        visibility: "PRIVATE",
        acceptsManualPayment: false,
        paymentMethods: {
            type: "PAYBILL",
            businessNumber: "",
            accountNumber: "",
            tillNumber: "",
            phoneNumber: ""
        }
    });

    const [chamaData, setChamaData] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        fetchChamaDetails();
    }, [id]);

    const fetchChamaDetails = async () => {
        try {
            const userStr = localStorage.getItem("user");
            if (userStr) {
                const user = JSON.parse(userStr);
                setCurrentUserId(user.user_id);
            }

            const [chamaRes, membersRes] = await Promise.all([
                chamaAPI.getById(id),
                chamaAPI.getMembers(id)
            ]);

            const chama = chamaRes.data.data;
            setChamaData(chama);

            if (userStr) {
                const user = JSON.parse(userStr);
                const currentUserId = user.user_id || user.id;
                const member = membersRes.data.data.find(m => m.user_id === currentUserId);
                if (member) setUserRole(member.role);
            }

            setFormData({
                name: chama.chama_name || "",
                description: chama.description || "",
                type: chama.chama_type || "",
                contributionAmount: chama.contribution_amount || "",
                contributionFrequency: chama.contribution_frequency || "MONTHLY",
                visibility: chama.visibility || "PRIVATE",
                acceptsManualPayment: !!chama.accepts_manual_payment,
                paymentMethods: {
                    type: chama.payment_methods?.type || "PAYBILL",
                    businessNumber: chama.payment_methods?.businessNumber || "",
                    accountNumber: chama.payment_methods?.accountNumber || "",
                    tillNumber: chama.payment_methods?.tillNumber || "",
                    phoneNumber: chama.payment_methods?.phoneNumber || ""
                }
            });
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to fetch chama details");
            navigate(`/chamas/${id}`);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith("pm_")) {
            const field = name.replace("pm_", "");
            setFormData(prev => ({
                ...prev,
                paymentMethods: {
                    ...prev.paymentMethods,
                    [field]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handlePaymentTypeChange = (type) => {
        setFormData(prev => ({
            ...prev,
            paymentMethods: {
                ...prev.paymentMethods,
                type
            }
        }));
    };

    const handleAnalyzeReliability = async () => {
        try {
            setAnalyzing(true);
            const res = await chamaAPI.analyzeReliability(id);
            toast.success(res.data.message || "Reliability tokens recalculated across the group.");
            fetchChamaDetails(); // Refresh to see any score updates in potential future visuals
        } catch (err) {
            toast.error(err.response?.data?.message || "Analysis failed");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.visibility !== chamaData?.visibility && userRole !== 'CHAIRPERSON') {
            toast.error('Only the Chairperson can change Chama visibility.');
            return;
        }

        try {
            setLoading(true);
            const updateData = {};

            if (formData.name) updateData.chamaName = formData.name;
            if (formData.description !== undefined) updateData.description = formData.description;
            if (formData.contributionAmount) updateData.contributionAmount = Number(formData.contributionAmount);
            if (formData.contributionFrequency) updateData.contributionFrequency = formData.contributionFrequency;
            if (formData.visibility) updateData.visibility = formData.visibility;
            
            updateData.acceptsManualPayment = formData.acceptsManualPayment;

            const pm = formData.paymentMethods;
            updateData.paymentMethods = {
                type: pm.type,
                ...(pm.businessNumber && { businessNumber: pm.businessNumber }),
                ...(pm.accountNumber && { accountNumber: pm.accountNumber }),
                ...(pm.tillNumber && { tillNumber: pm.tillNumber }),
                ...(pm.phoneNumber && { phoneNumber: pm.phoneNumber }),
            };

            await chamaAPI.update(id, updateData);
            toast.success('Chama configurations updated');
            navigate(`/chamas/${id}`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Update failed');
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        const isInitiator = chamaData?.deletion_requested_by === currentUserId;
        const isHandshake = chamaData?.deletion_requested_by && !isInitiator;

        let confirmMsg = "Initiate deactivation request? Another official must confirm.";
        if (isHandshake) confirmMsg = "Confirming deactivation will PERMANENTLY retire this group. Proceed?";

        if (window.confirm(confirmMsg)) {
            try {
                setLoading(true);
                const res = await chamaAPI.delete(id);
                if (res.data.pending) {
                    toast.info(res.data.message);
                    fetchChamaDetails();
                } else {
                    toast.success(res.data.message);
                    navigate("/chamas");
                }
            } catch (err) {
                toast.error(err.response?.data?.message || "Handshake failed");
                setLoading(false);
            }
        }
    };

    const handleCancelDelete = async () => {
        if (window.confirm("Cancel pending deactivation request?")) {
            try {
                setLoading(true);
                await chamaAPI.cancelDelete(id);
                toast.success("Deactivation cancelled");
                fetchChamaDetails();
            } catch (err) {
                toast.error("Failed to cancel deactivation");
                setLoading(false);
            }
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <RefreshCw className="animate-spin text-primary" size={40} />
        </div>
    );

    return (
        <div className="page" style={{ background: 'var(--surface-3)', minHeight: '100vh' }}>
            <div className="container" style={{ maxWidth: '900px' }}>
                
                {/* --- HEADER --- */}
                <div className="flex flex-between align-center mb-8">
                    <button 
                        onClick={() => navigate(`/chamas/${id}`)}
                        className="btn btn-outline btn-sm gap-2"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                    >
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={handleAnalyzeReliability}
                            disabled={analyzing}
                            className="btn btn-secondary btn-sm gap-2"
                            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
                        >
                            {analyzing ? <RefreshCw className="animate-spin" size={16} /> : <BarChart3 size={16} />}
                            {analyzing ? "Analyzing..." : "Analyze Reliability"}
                        </button>
                    </div>
                </div>

                <div className="page-header" style={{ marginBottom: '2rem' }}>
                    <div className="flex align-center gap-4">
                        <div className="p-4 rounded-2xl bg-white shadow-sm border border-gray-100">
                            <Settings className="text-primary" size={32} />
                        </div>
                        <div>
                            <h1 style={{ marginBottom: '0.25rem', fontSize: '1.8rem' }}>Group Strategy & Settings</h1>
                            <p className="subtitle">Configure operations and logistics for <strong>{formData.name}</strong></p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    
                    {/* --- CORE SETTINGS CARD --- */}
                    <div className="card" style={{ borderRadius: '24px', padding: '2rem', border: 'none', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}>
                        <h3 className="flex align-center gap-2 mb-6" style={{ fontSize: '1.2rem' }}>
                            <Shield className="text-primary" size={20} /> General Configuration
                        </h3>
                        
                        <div className="form-group">
                            <label className="form-label">Official Chama Name</label>
                            <input
                                type="text"
                                name="name"
                                className="form-input"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                style={{ background: 'var(--white)', borderRadius: '12px', border: '1.5px solid var(--border)' }}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Objective & Description</label>
                            <textarea
                                name="description"
                                className="form-textarea"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                                style={{ background: 'var(--white)', borderRadius: '12px', border: '1.5px solid var(--border)' }}
                            ></textarea>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Group Type</label>
                                <select
                                    name="type"
                                    className="form-select"
                                    value={formData.type}
                                    onChange={handleChange}
                                    disabled
                                    style={{ background: 'var(--surface-3)', borderRadius: '12px' }}
                                >
                                    <option value="REGISTERED">Registered Group</option>
                                    <option value="INFORMAL">Informal Group</option>
                                    <option value="MERRY_GO_ROUND">Merry-Go-Round</option>
                                    <option value="TABLE_BANKING">Table Banking</option>
                                    <option value="ASCA">ASCA (Accumulating Savings)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Contribution Frequency</label>
                                <select
                                    name="contributionFrequency"
                                    className="form-select"
                                    value={formData.contributionFrequency}
                                    onChange={handleChange}
                                    style={{ background: 'var(--white)', borderRadius: '12px' }}
                                >
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="BIWEEKLY">Bi-Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="QUARTERLY">Quarterly</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Contribution Amount (KES)</label>
                                <div className="input-with-icon">
                                    <span className="input-prefix" style={{ background: 'var(--surface-3)', borderRight: '1px solid var(--border)' }}>KES</span>
                                    <input
                                        type="number"
                                        name="contributionAmount"
                                        className="form-input"
                                        style={{ paddingLeft: '4.5rem', borderRadius: '12px' }}
                                        value={formData.contributionAmount}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Visibility</label>
                                <select
                                    name="visibility"
                                    className="form-select"
                                    value={formData.visibility}
                                    onChange={handleChange}
                                    disabled={userRole !== 'CHAIRPERSON'}
                                    style={{ background: userRole === 'CHAIRPERSON' ? 'var(--white)' : 'var(--surface-3)', borderRadius: '12px' }}
                                >
                                    <option value="PRIVATE">Private (Invite Only)</option>
                                    <option value="PUBLIC">Public (Visible to All)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* --- PAYMENT LOGISTICS --- */}
                    <div className="card mt-6" style={{ borderRadius: '24px', padding: '2rem', border: 'none', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 40px rgba(0,0,0,0.04)' }}>
                        <div className="flex flex-between align-center mb-6">
                            <h3 className="flex align-center gap-2 m-0" style={{ fontSize: '1.2rem' }}>
                                <CreditCard className="text-primary" size={20} /> Contribution Logistics
                            </h3>
                            <div className="p-1 px-3 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100 flex items-center gap-1">
                                <Smartphone size={12} /> Mobile Money Ready
                            </div>
                        </div>

                        <div className="form-group mb-8 p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex align-center justify-between">
                            <div>
                                <label className="form-label mb-1 block" style={{ fontSize: '1rem', color: '#1e3a8a' }}>Allow Manual M-Pesa Payments</label>
                                <p className="text-xs text-blue-600/80 m-0">If enabled, members can pay manually and submit their M-Pesa receipt for verification. If disabled, only automatic STK Push is allowed.</p>
                            </div>
                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                                <input 
                                    type="checkbox" 
                                    name="acceptsManualPayment"
                                    checked={formData.acceptsManualPayment}
                                    onChange={(e) => setFormData(prev => ({ ...prev, acceptsManualPayment: e.target.checked }))}
                                    style={{ opacity: 0, width: 0, height: 0 }} 
                                />
                                <span className="slider round" style={{ 
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                    backgroundColor: formData.acceptsManualPayment ? '#2563eb' : '#cbd5e1', 
                                    transition: '.4s', borderRadius: '34px' 
                                }}>
                                    <span style={{
                                        position: 'absolute', height: '18px', width: '18px', left: formData.acceptsManualPayment ? '28px' : '4px', top: '4px',
                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                    }}></span>
                                </span>
                            </label>
                        </div>

                        <div className="grid grid-3 gap-4 mb-8">
                            {[
                                { id: 'PAYBILL', label: 'Paybill', icon: <CreditCard size={24} />, desc: 'Business Number' },
                                { id: 'TILL', label: 'Buy Goods', icon: <Store size={24} />, desc: 'Till Number' },
                                { id: 'POCHI', label: 'Pochi', icon: <Smartphone size={24} />, desc: 'Social Payments' }
                            ].map(opt => (
                                <div 
                                    key={opt.id}
                                    onClick={() => handlePaymentTypeChange(opt.id)}
                                    style={{
                                        position: 'relative',
                                        padding: '1.25rem',
                                        borderRadius: '16px',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        border: '2px solid',
                                        borderColor: formData.paymentMethods.type === opt.id ? 'var(--primary)' : 'var(--border)',
                                        background: formData.paymentMethods.type === opt.id ? 'rgba(37, 99, 235, 0.05)' : 'var(--white)',
                                        transform: formData.paymentMethods.type === opt.id ? 'translateY(-4px)' : 'none',
                                        boxShadow: formData.paymentMethods.type === opt.id ? '0 8px 20px rgba(37, 99, 235, 0.1)' : 'none'
                                    }}
                                >
                                    <div style={{ color: formData.paymentMethods.type === opt.id ? 'var(--primary)' : 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                        {opt.icon}
                                    </div>
                                    <div className="font-bold text-sm">{opt.label}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{opt.desc}</div>
                                    
                                    {formData.paymentMethods.type === opt.id && (
                                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                                            <Check className="text-primary" size={16} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="p-6 rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50">
                            {formData.paymentMethods.type === "PAYBILL" && (
                                <div className="grid grid-2 gap-4">
                                    <div className="form-group m-0">
                                        <label className="form-label text-xs uppercase text-gray-400">Paybill Number</label>
                                        <input
                                            type="text"
                                            name="pm_businessNumber"
                                            className="form-input"
                                            placeholder="e.g. 247247"
                                            value={formData.paymentMethods.businessNumber}
                                            onChange={handleChange}
                                            style={{ borderRadius: '12px' }}
                                        />
                                    </div>
                                    <div className="form-group m-0">
                                        <label className="form-label text-xs uppercase text-gray-400">Account Note/ID</label>
                                        <input
                                            type="text"
                                            name="pm_accountNumber"
                                            className="form-input"
                                            placeholder="e.g. Chama ID"
                                            value={formData.paymentMethods.accountNumber}
                                            onChange={handleChange}
                                            style={{ borderRadius: '12px' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {formData.paymentMethods.type === "TILL" && (
                                <div className="form-group m-0">
                                    <label className="form-label text-xs uppercase text-gray-400">Till Number</label>
                                    <input
                                        type="text"
                                        name="pm_tillNumber"
                                        className="form-input"
                                        placeholder="e.g. 123456"
                                        value={formData.paymentMethods.tillNumber}
                                        onChange={handleChange}
                                        style={{ borderRadius: '12px', fontSize: '1.2rem', fontWeight: 600 }}
                                    />
                                </div>
                            )}

                            {formData.paymentMethods.type === "POCHI" && (
                                <div className="form-group m-0">
                                    <label className="form-label text-xs uppercase text-gray-400">Registered Phone Number</label>
                                    <input
                                        type="text"
                                        name="pm_phoneNumber"
                                        className="form-input"
                                        placeholder="e.g. 0712 XXX XXX"
                                        value={formData.paymentMethods.phoneNumber}
                                        onChange={handleChange}
                                        style={{ borderRadius: '12px', fontSize: '1.2rem', fontWeight: 600 }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- ACTIONS --- */}
                    <div className="flex flex-between align-center mt-10 p-6 rounded-3xl" style={{ background: 'var(--white)', border: '1px solid var(--border)' }}>
                        <div>
                             <p className="text-sm m-0 flex align-center gap-2 text-gray-500">
                                <Info size={16} /> All changes are logged for auditing purposes.
                             </p>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => navigate(`/chamas/${id}`)} className="btn btn-outline" style={{ border: 'none' }}>
                                Discard
                            </button>
                            <button type="submit" disabled={loading} className="btn btn-primary" style={{ minWidth: '160px', borderRadius: '14px', boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)' }}>
                                {loading ? "Updating..." : "Publish Changes"}
                            </button>
                        </div>
                    </div>

                </form>

                {/* --- DANGER ZONE --- */}
                <div className="mt-12 p-8 rounded-[32px] border-2 border-red-100 bg-red-50/10 relative overflow-hidden">
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}>
                        <ShieldAlert size={120} />
                    </div>
                    
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 rounded-2xl bg-red-100 text-red-600">
                            <Trash2 size={24} />
                        </div>
                        <div>
                            <h3 className="text-red-700 m-0">Security Termination Zone</h3>
                            <p className="text-red-600/60 text-sm">Critical actions require a dual-official consensus (handshake).</p>
                        </div>
                    </div>

                    {chamaData?.deletion_requested_by ? (
                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-red-200">
                            <div className="flex gap-4">
                                <AlertCircle className="text-red-500" size={32} />
                                <div className="flex-1">
                                    <h4 className="font-extrabold text-red-700 mb-1">Retirement Pending Confirmation</h4>
                                    <p className="text-gray-600 mb-6">
                                        {chamaData.deletion_requested_by === currentUserId
                                            ? "Request sent. Waiting for another official to authorize retirement."
                                            : "Critical: An authorized official has requested to retire this group. Your consent is required."
                                        }
                                    </p>
                                    <div className="flex gap-3">
                                        {chamaData.deletion_requested_by !== currentUserId && (
                                            <button onClick={handleDelete} className="btn btn-danger gap-2">
                                                <Check size={18} /> Confirm Retirement
                                            </button>
                                        )}
                                        <button onClick={handleCancelDelete} className="btn btn-outline">
                                            Revoke Request
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-between align-center p-6 bg-white rounded-2xl border border-red-100 shadow-sm">
                            <div>
                                <p className="font-bold text-gray-800 m-0">Soft-Retire Group</p>
                                <p className="text-xs text-gray-500">Archives all records and stops contributions. Requires handshake.</p>
                            </div>
                            <button onClick={handleDelete} className="btn btn-outline btn-danger py-2 rounded-xl text-xs font-bold uppercase tracking-wider">
                                Initiate Retirement
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ManageChama;
