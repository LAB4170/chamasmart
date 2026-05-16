import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { 
    CreditCard, Store, Smartphone, Check, Settings, Building2,
    Shield, ArrowLeft, RefreshCw, BarChart3, AlertCircle, Phone,
    Info, Trash2, ShieldAlert, Eye, EyeOff, Landmark
} from "lucide-react";
import "./ChamaDetailsLux.css";

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
        mobileNumber: "",
        paymentMethods: {
            type: "PAYBILL",
            businessNumber: "",
            accountNumber: "",
            tillNumber: "",
            phoneNumber: "",
            bankName: "",
            bankAccountNumber: "",
            bankAccountName: ""
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
                mobileNumber: chama.mobile_number || "",
                paymentMethods: {
                    type: chama.payment_methods?.type || "PAYBILL",
                    businessNumber: chama.payment_methods?.businessNumber || "",
                    accountNumber: chama.payment_methods?.accountNumber || "",
                    tillNumber: chama.payment_methods?.tillNumber || "",
                    phoneNumber: chama.payment_methods?.phoneNumber || "",
                    bankName: chama.payment_methods?.bankName || "",
                    bankAccountNumber: chama.payment_methods?.bankAccountNumber || "",
                    bankAccountName: chama.payment_methods?.bankAccountName || ""
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
            if (formData.mobileNumber) updateData.mobileNumber = formData.mobileNumber;
            
            updateData.acceptsManualPayment = formData.acceptsManualPayment;

            const pm = formData.paymentMethods;
            updateData.paymentMethods = {
                type: pm.type,
                ...(pm.businessNumber && { businessNumber: pm.businessNumber }),
                ...(pm.accountNumber && { accountNumber: pm.accountNumber }),
                ...(pm.tillNumber && { tillNumber: pm.tillNumber }),
                ...(pm.phoneNumber && { phoneNumber: pm.phoneNumber }),
                ...(pm.bankName && { bankName: pm.bankName }),
                ...(pm.bankAccountNumber && { bankAccountNumber: pm.bankAccountNumber }),
                ...(pm.bankAccountName && { bankAccountName: pm.bankAccountName }),
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
        <div className="page manage-page-root">
            <div className="container">
                <div className="manage-shell">
                    {/* ── HERO BAND ── */}
                    <div className="manage-hero-band">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1 }}>
                            <div className="manage-hero-icon">
                                <Settings size={28} />
                            </div>
                            <div>
                                <h1>Group Strategy &amp; Settings</h1>
                                <p>Configure operations and payment logistics for <strong style={{ color: 'var(--lux-text-primary)' }}>{formData.name}</strong></p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => navigate(`/chamas/${id}`, { state: { tab: 'management' } })}
                                className="btn-lux btn-lux-outline flex items-center gap-2"
                                style={{ fontSize: '0.85rem' }}
                            >
                                <ArrowLeft size={15} /> Back
                            </button>
                            <button
                                onClick={handleAnalyzeReliability}
                                disabled={analyzing}
                                className="btn-lux btn-lux-primary flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', fontSize: '0.85rem' }}
                            >
                                {analyzing ? <RefreshCw className="animate-spin" size={15} /> : <BarChart3 size={15} />}
                                {analyzing ? 'Analyzing...' : 'Analyze Reliability'}
                            </button>
                        </div>
                    </div>

                    <form id="manage-chama-form" onSubmit={handleSubmit}>
                    <div className="manage-form-body">

                        {/* ── GENERAL CONFIGURATION ── */}
                        <div className="msec">
                            <div className="msec-header">
                                <div className="msec-icon msec-icon-indigo"><Shield size={20} /></div>
                                <div>
                                    <p className="msec-title">General Configuration</p>
                                    <p className="msec-sub">Identity, description, and operational schedule</p>
                                </div>
                            </div>
                            <div className="msec-body">
                                <div className="mfield-group">
                                    <div>
                                        <label className="mlabel">Official Chama Name</label>
                                        <input type="text" name="name" className="minput" value={formData.name} onChange={handleChange} required placeholder="e.g. Nguzo Savings Group" />
                                    </div>
                                    <div>
                                        <label className="mlabel">Objective &amp; Description</label>
                                        <textarea name="description" className="minput" value={formData.description} onChange={handleChange} rows="3" style={{ resize: 'vertical', lineHeight: 1.6 }} placeholder="Describe your group's goals..."></textarea>
                                    </div>
                                </div>

                                <div className="mfield-group">
                                    <div className="mfield-row">
                                        <div>
                                            <label className="mlabel">Group Type</label>
                                            <select name="type" className="minput" value={formData.type} onChange={handleChange} disabled>
                                                <option value="REGISTERED">Registered Group</option>
                                                <option value="INFORMAL">Informal Group</option>
                                                <option value="MERRY_GO_ROUND">Merry-Go-Round</option>
                                                <option value="TABLE_BANKING">Table Banking</option>
                                                <option value="ASCA">ASCA (Accumulating Savings)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mlabel">Contribution Frequency</label>
                                            <select name="contributionFrequency" className="minput" value={formData.contributionFrequency} onChange={handleChange}>
                                                <option value="WEEKLY">Weekly</option>
                                                <option value="BIWEEKLY">Bi-Weekly</option>
                                                <option value="MONTHLY">Monthly</option>
                                                <option value="QUARTERLY">Quarterly</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mfield-row">
                                        <div>
                                            <label className="mlabel">Contribution Amount</label>
                                            <div className="minput-prefix-wrap">
                                                <span className="minput-prefix">KES</span>
                                                <input type="number" name="contributionAmount" className="minput" value={formData.contributionAmount} onChange={handleChange} placeholder="0" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mlabel">Visibility {userRole !== 'CHAIRPERSON' && <span style={{ color: '#ef4444', fontSize: '0.6rem' }}>— Chairperson only</span>}</label>
                                            <select name="visibility" className="minput" value={formData.visibility} onChange={handleChange} disabled={userRole !== 'CHAIRPERSON'} style={{ opacity: userRole === 'CHAIRPERSON' ? 1 : 0.55 }}>
                                                <option value="PRIVATE">Private (Invite Only)</option>
                                                <option value="PUBLIC">Public (Visible to All)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── PAYMENT LOGISTICS ── */}
                        <div className="msec">
                            <div className="msec-header">
                                <div className="msec-icon msec-icon-blue"><CreditCard size={20} /></div>
                                <div style={{ flex: 1 }}>
                                    <p className="msec-title">Contribution Logistics</p>
                                    <p className="msec-sub">Configure how members send payments to this group</p>
                                </div>
                                <div style={{ padding: '0.3rem 0.9rem', borderRadius: '99px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                                    <Smartphone size={12} /> Mobile Ready
                                </div>
                            </div>
                            <div className="msec-body">
                                <div className="mfield-group">
                                    <label className="mlabel"><Phone size={12} style={{display:'inline',verticalAlign:'middle',marginRight:4}}/> Contact Mobile Number</label>
                                    <div className="minput-prefix-wrap">
                                        <span className="minput-prefix" style={{color:'#10b981'}}><Phone size={13}/> +254</span>
                                        <input type="tel" name="mobileNumber" className="minput" placeholder="712 000 000" value={formData.mobileNumber} onChange={handleChange} />
                                    </div>
                                </div>
                            {/* Manual M-Pesa Toggle — Premium Design */}
                            <div
                                onClick={() => setFormData(prev => ({ ...prev, acceptsManualPayment: !prev.acceptsManualPayment }))}
                                style={{
                                    marginBottom: '2rem', padding: '1.5rem', borderRadius: '16px',
                                    border: `2px solid ${formData.acceptsManualPayment ? 'rgba(16, 185, 129, 0.4)' : 'var(--lux-border)'}`,
                                    background: formData.acceptsManualPayment ? 'rgba(16, 185, 129, 0.05)' : 'var(--lux-bg-soft)',
                                    cursor: 'pointer', transition: 'all 0.3s ease',
                                    display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap'
                                }}
                            >
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <div style={{ padding: '0.5rem', borderRadius: '10px', background: formData.acceptsManualPayment ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.1)', color: formData.acceptsManualPayment ? '#10b981' : 'var(--lux-text-secondary)' }}>
                                            <Smartphone size={18} />
                                        </div>
                                        <span style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--lux-text-primary)' }}>Allow Manual M-Pesa Payments</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--lux-text-secondary)', lineHeight: 1.5 }}>
                                        Members can submit their M-Pesa receipt screenshot for admin verification. Disable to require automatic STK Push only.
                                    </p>
                                </div>
                                {/* Custom Toggle */}
                                <div style={{
                                    width: '56px', height: '30px', borderRadius: '99px', flexShrink: 0,
                                    background: formData.acceptsManualPayment ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--lux-border)',
                                    position: 'relative', transition: 'all 0.3s ease',
                                    boxShadow: formData.acceptsManualPayment ? '0 0 12px rgba(16,185,129,0.4)' : 'none'
                                }}>
                                    <div style={{
                                        position: 'absolute', top: '4px',
                                        left: formData.acceptsManualPayment ? '30px' : '4px',
                                        width: '22px', height: '22px', borderRadius: '50%',
                                        background: '#fff', transition: 'left 0.3s ease',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                                <input type="checkbox" name="acceptsManualPayment" checked={formData.acceptsManualPayment}
                                    onChange={() => {}} style={{ display: 'none' }} />
                            </div>

                            {/* Payment Method Selector */}
                            <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '1rem' }}>
                                Select Payment Channel
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                {[
                                    { id: 'PAYBILL', label: 'Paybill', icon: <CreditCard size={22} />, desc: 'Business No.' },
                                    { id: 'TILL', label: 'Buy Goods', icon: <Store size={22} />, desc: 'Till Number' },
                                    { id: 'POCHI', label: 'Pochi / Mpesa', icon: <Smartphone size={22} />, desc: 'Phone No.' },
                                    { id: 'BANK', label: 'Bank Transfer', icon: <Landmark size={22} />, desc: 'Account No.' }
                                ].map(opt => {
                                    const isActive = formData.paymentMethods.type === opt.id;
                                    return (
                                        <div
                                            key={opt.id}
                                            onClick={() => handlePaymentTypeChange(opt.id)}
                                            style={{
                                                position: 'relative', padding: '1rem', borderRadius: '14px',
                                                cursor: 'pointer', transition: 'all 0.3s ease',
                                                border: `2px solid ${isActive ? 'var(--lux-gold)' : 'var(--lux-border)'}`,
                                                background: isActive ? 'rgba(212, 175, 55, 0.06)' : 'var(--lux-card-bg)',
                                                transform: isActive ? 'translateY(-3px)' : 'none',
                                                boxShadow: isActive ? '0 8px 20px rgba(212,175,55,0.15)' : 'none',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {isActive && (
                                                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                                                    <Check style={{ color: 'var(--lux-gold)' }} size={14} strokeWidth={3} />
                                                </div>
                                            )}
                                            <div style={{ color: isActive ? 'var(--lux-gold)' : 'var(--lux-text-secondary)', marginBottom: '0.5rem' }}>{opt.icon}</div>
                                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--lux-text-primary)' }}>{opt.label}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--lux-text-secondary)', marginTop: '2px' }}>{opt.desc}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Dynamic Fields */}
                            <div style={{ padding: '1.5rem', borderRadius: '16px', border: '1.5px dashed var(--lux-border)', background: 'var(--lux-bg-soft)' }}>
                                <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '1rem' }}>
                                    Payment Details — Visible to All Members
                                </p>

                                {formData.paymentMethods.type === "PAYBILL" && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '6px' }}>Paybill Number</label>
                                            <input type="text" name="pm_businessNumber" className="form-input" placeholder="e.g. 247247"
                                                value={formData.paymentMethods.businessNumber} onChange={handleChange}
                                                style={{ borderRadius: '10px', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)', fontWeight: 700, fontSize: '1rem' }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '6px' }}>Account Reference</label>
                                            <input type="text" name="pm_accountNumber" className="form-input" placeholder="e.g. Chama Name or ID"
                                                value={formData.paymentMethods.accountNumber} onChange={handleChange}
                                                style={{ borderRadius: '10px', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)', fontWeight: 700, fontSize: '1rem' }} />
                                        </div>
                                    </div>
                                )}

                                {formData.paymentMethods.type === "TILL" && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '6px' }}>Till Number</label>
                                        <input type="text" name="pm_tillNumber" className="form-input" placeholder="e.g. 123456"
                                            value={formData.paymentMethods.tillNumber} onChange={handleChange}
                                            style={{ borderRadius: '10px', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)', fontWeight: 800, fontSize: '1.1rem' }} />
                                    </div>
                                )}

                                {formData.paymentMethods.type === "POCHI" && (
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '6px' }}>Registered Phone Number</label>
                                        <input type="tel" name="pm_phoneNumber" className="form-input" placeholder="e.g. 0712 000 000"
                                            value={formData.paymentMethods.phoneNumber} onChange={handleChange}
                                            style={{ borderRadius: '10px', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)', fontWeight: 800, fontSize: '1.1rem' }} />
                                    </div>
                                )}

                                {formData.paymentMethods.type === "BANK" && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '6px' }}>Bank Name</label>
                                            <input type="text" name="pm_bankName" className="form-input" placeholder="e.g. Equity Bank"
                                                value={formData.paymentMethods.bankName} onChange={handleChange}
                                                style={{ borderRadius: '10px', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)', fontWeight: 700 }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '6px' }}>Account Number</label>
                                            <input type="text" name="pm_bankAccountNumber" className="form-input" placeholder="e.g. 0010123456789"
                                                value={formData.paymentMethods.bankAccountNumber} onChange={handleChange}
                                                style={{ borderRadius: '10px', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)', fontWeight: 700 }} />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--lux-text-secondary)', marginBottom: '6px' }}>Account Name</label>
                                            <input type="text" name="pm_bankAccountName" className="form-input" placeholder="e.g. Nguzo Chama"
                                                value={formData.paymentMethods.bankAccountName} onChange={handleChange}
                                                style={{ borderRadius: '10px', background: 'var(--lux-card-bg)', border: '1px solid var(--lux-border)', color: 'var(--lux-text-primary)', fontWeight: 700 }} />
                                        </div>
                                    </div>
                                )}
                            </div>{/* Dynamic Fields end */}
                            </div>{/* msec-body end */}
                        </div>{/* msec end */}

                    </div>{/* manage-form-body */}
                    </form>

                    {/* ACTIONS BAR */}
                    <div className="manage-actions-bar">
                        <p style={{ margin:0, fontSize:'0.82rem', display:'flex', alignItems:'center', gap:'0.5rem', color:'var(--lux-text-secondary)' }}>
                            <Info size={15}/> All changes are logged for compliance &amp; auditing.
                        </p>
                        <div style={{ display:'flex', gap:'0.75rem' }}>
                            <button type="button" onClick={() => navigate(`/chamas/${id}`, { state:{ tab:'management' } })} className="btn-lux btn-lux-outline">Discard</button>
                            <button type="submit" form="manage-chama-form" disabled={loading} className="btn-lux btn-lux-primary" style={{ minWidth:'160px' }}>
                                {loading ? 'Updating...' : 'Publish Changes'}
                            </button>
                        </div>
                    </div>

                    {/* DANGER ZONE */}
                    <div className="msec" style={{ margin:'0 2.5rem 2rem', border:'1.5px solid rgba(239,68,68,0.25)', background:'rgba(239,68,68,0.02)' }}>
                        <div className="msec-header">
                            <div className="msec-icon msec-icon-red"><ShieldAlert size={20}/></div>
                            <div>
                                <p className="msec-title" style={{color:'#ef4444'}}>Security Termination Zone</p>
                                <p className="msec-sub">Critical actions require dual-official consensus.</p>
                            </div>
                        </div>
                        <div className="msec-body">

                        {chamaData?.deletion_requested_by ? (
                            <div className="p-6 rounded-2xl border" style={{ background: 'var(--lux-card-bg)', borderColor: 'rgba(239, 68, 68, 0.2)', boxShadow: 'var(--lux-shadow)' }}>
                                <div className="flex gap-4">
                                    <AlertCircle className="text-red-500" size={32} />
                                    <div className="flex-1">
                                        <h4 className="font-extrabold mb-1" style={{ color: '#ef4444' }}>Retirement Pending Confirmation</h4>
                                        <p className="mb-6" style={{ color: 'var(--lux-text-secondary)' }}>
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
                            <div className="flex flex-between align-center p-6 bg-lux-card rounded-2xl border border-red-500/20 shadow-sm" style={{ background: 'var(--lux-bg-soft)' }}>
                                <div>
                                    <p className="font-bold m-0" style={{ color: 'var(--lux-text-primary)' }}>Soft-Retire Group</p>
                                    <p className="text-xs m-0" style={{ color: 'var(--lux-text-secondary)' }}>Archives all records and stops contributions. Requires handshake.</p>
                                </div>
                                <button onClick={handleDelete} className="btn-lux btn-lux-outline border-red-500 text-red-500 hover:bg-red-500/10">
                                    Initiate Retirement
                                </button>
                            </div>
                        )}
                        </div>{/* msec-body */}
                    </div>{/* Danger Zone msec */}
                </div>{/* manage-shell */}
            </div>{/* container */}
        </div>
    );
};

export default ManageChama;
