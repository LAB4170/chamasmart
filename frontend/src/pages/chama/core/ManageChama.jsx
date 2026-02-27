import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { CreditCard, Store, Smartphone, Check } from "lucide-react";

const ManageChama = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        type: "",
        contributionAmount: "",
        contributionFrequency: "MONTHLY",
        visibility: "PRIVATE",
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
            // Get user info from localStorage
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

            // Find current user's role
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            // Map form data to API expected format (snake_case)
            const updateData = {
                chamaName: formData.name,
                description: formData.description,
                chamaType: formData.type,
                contributionAmount: formData.contributionAmount,
                contributionFrequency: formData.contributionFrequency,
                visibility: formData.visibility,
                paymentMethods: formData.paymentMethods
            };
            await chamaAPI.update(id, updateData);
            toast.success("Chama updated successfully");
            navigate(`/chamas/${id}`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to update chama");
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        const isInitiator = chamaData?.deletion_requested_by === currentUserId;
        const isHandshake = chamaData?.deletion_requested_by && !isInitiator;

        let confirmMsg = "Are you sure you want to initiate a deletion request? Another official will need to confirm this.";
        if (isHandshake) confirmMsg = "You are confirming a deletion request initiated by another official. This will PERMANENTLY deactivate the Chama. Proceed?";

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
                console.error(err);
                toast.error(err.response?.data?.message || "Failed to process deletion");
                setLoading(false);
            }
        }
    };

    const handleCancelDelete = async () => {
        if (window.confirm("Are you sure you want to cancel the pending deletion request?")) {
            try {
                setLoading(true);
                await chamaAPI.cancelDelete(id);
                toast.success("Deletion request cancelled");
                fetchChamaDetails();
            } catch (err) {
                console.error(err);
                toast.error("Failed to cancel deletion request");
                setLoading(false);
            }
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Manage Chama</h1>
                        <p className="subtitle">Update settings for {formData.name}</p>
                    </div>
                </div>

                <div className="card max-w-2xl mx-auto">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Chama Name</label>
                            <input
                                type="text"
                                name="name"
                                className="form-input"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                name="description"
                                className="form-textarea"
                                value={formData.description}
                                onChange={handleChange}
                                rows="3"
                            ></textarea>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select
                                    name="type"
                                    className="form-select"
                                    value={formData.type}
                                    onChange={handleChange}
                                    disabled
                                >
                                    <option value="REGISTERED">Registered Group</option>
                                    <option value="INFORMAL">Informal Group</option>
                                    <option value="MERRY_GO_ROUND">Merry-Go-Round</option>
                                    <option value="TABLE_BANKING">Table Banking</option>
                                </select>
                                <small className="text-muted">Type cannot be changed once created</small>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Contribution Frequency</label>
                                <select
                                    name="contributionFrequency"
                                    className="form-select"
                                    value={formData.contributionFrequency}
                                    onChange={handleChange}
                                >
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="QUARTERLY">Quarterly</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Visibility</label>
                                <select
                                    name="visibility"
                                    className="form-select"
                                    value={formData.visibility}
                                    onChange={handleChange}
                                    disabled={userRole !== 'CHAIRPERSON'}
                                >
                                    <option value="PRIVATE">Private (Invite Only)</option>
                                    <option value="PUBLIC">Public (Visible to All)</option>
                                </select>
                                {userRole !== 'CHAIRPERSON' && (
                                    <small className="text-muted">Only the Chairperson can change visibility</small>
                                )}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Contribution Amount (KES)</label>
                                <input
                                    type="number"
                                    name="contributionAmount"
                                    className="form-input"
                                    value={formData.contributionAmount}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="section-divider my-10 border-t border-gray-100"></div>

                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-lg bg-emerald-100/50 flex items-center justify-center text-emerald-600">
                                    <CreditCard size={18} />
                                </span>
                                Payment Details
                            </h3>
                            <p className="text-gray-500 text-sm ml-10">Configure how members contribute. This info will be visible on their dashboard.</p>
                        </div>

                        <div className="form-group mb-8">
                            <label className="form-label text-gray-700 font-semibold mb-4 block">Collection Method</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Paybill Card */}
                                <div
                                    onClick={() => handleChange({ target: { name: 'pm_type', value: 'PAYBILL' } })}
                                    className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border-2 flex flex-col items-center text-center gap-3 overflow-hidden
                                        ${formData.paymentMethods.type === "PAYBILL"
                                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xl shadow-emerald-200 scale-105 z-10"
                                            : "border-gray-100 bg-white text-gray-500 hover:border-emerald-200 hover:shadow-lg hover:-translate-y-1"
                                        }`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm
                                        ${formData.paymentMethods.type === "PAYBILL"
                                            ? "bg-white text-emerald-600 shadow-inner"
                                            : "bg-gray-50 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"}`}>
                                        <CreditCard size={28} strokeWidth={formData.paymentMethods.type === "PAYBILL" ? 2 : 1.5} />
                                    </div>
                                    <div className="relative z-10">
                                        <h4 className={`font-bold text-lg mb-1 transition-colors ${formData.paymentMethods.type === "PAYBILL" ? "text-white" : "text-gray-700 group-hover:text-gray-900"}`}>
                                            M-Pesa Paybill
                                        </h4>
                                        <p className={`text-xs transition-colors ${formData.paymentMethods.type === "PAYBILL" ? "text-emerald-100" : "text-gray-400"}`}>For Business Numbers</p>
                                    </div>

                                    {/* Selection Ring Indicator */}
                                    {formData.paymentMethods.type === "PAYBILL" && (
                                        <div className="absolute top-3 right-3 text-emerald-600 animate-scaleIn bg-white rounded-full p-1 shadow-md">
                                            <Check size={16} strokeWidth={4} />
                                        </div>
                                    )}
                                </div>

                                {/* Till Number Card */}
                                <div
                                    onClick={() => handleChange({ target: { name: 'pm_type', value: 'TILL' } })}
                                    className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border-2 flex flex-col items-center text-center gap-3 overflow-hidden
                                        ${formData.paymentMethods.type === "TILL"
                                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xl shadow-emerald-200 scale-105 z-10"
                                            : "border-gray-100 bg-white text-gray-500 hover:border-emerald-200 hover:shadow-lg hover:-translate-y-1"
                                        }`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm
                                        ${formData.paymentMethods.type === "TILL"
                                            ? "bg-white text-emerald-600 shadow-inner"
                                            : "bg-gray-50 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"}`}>
                                        <Store size={28} strokeWidth={formData.paymentMethods.type === "TILL" ? 2 : 1.5} />
                                    </div>
                                    <div className="relative z-10">
                                        <h4 className={`font-bold text-lg mb-1 transition-colors ${formData.paymentMethods.type === "TILL" ? "text-white" : "text-gray-700 group-hover:text-gray-900"}`}>
                                            Buy Goods
                                        </h4>
                                        <p className={`text-xs transition-colors ${formData.paymentMethods.type === "TILL" ? "text-emerald-100" : "text-gray-400"}`}>Till Number</p>
                                    </div>

                                    {formData.paymentMethods.type === "TILL" && (
                                        <div className="absolute top-3 right-3 text-emerald-600 animate-scaleIn bg-white rounded-full p-1 shadow-md">
                                            <Check size={16} strokeWidth={4} />
                                        </div>
                                    )}
                                </div>

                                {/* Pochi Card */}
                                <div
                                    onClick={() => handleChange({ target: { name: 'pm_type', value: 'POCHI' } })}
                                    className={`group relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border-2 flex flex-col items-center text-center gap-3 overflow-hidden
                                        ${formData.paymentMethods.type === "POCHI"
                                            ? "border-emerald-600 bg-emerald-600 text-white shadow-xl shadow-emerald-200 scale-105 z-10"
                                            : "border-gray-100 bg-white text-gray-500 hover:border-emerald-200 hover:shadow-lg hover:-translate-y-1"
                                        }`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm
                                        ${formData.paymentMethods.type === "POCHI"
                                            ? "bg-white text-emerald-600 shadow-inner"
                                            : "bg-gray-50 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-500"}`}>
                                        <Smartphone size={28} strokeWidth={formData.paymentMethods.type === "POCHI" ? 2 : 1.5} />
                                    </div>
                                    <div className="relative z-10">
                                        <h4 className={`font-bold text-lg mb-1 transition-colors ${formData.paymentMethods.type === "POCHI" ? "text-white" : "text-gray-700 group-hover:text-gray-900"}`}>
                                            Pochi la Biashara
                                        </h4>
                                        <p className={`text-xs transition-colors ${formData.paymentMethods.type === "POCHI" ? "text-emerald-100" : "text-gray-400"}`}>Phone Number</p>
                                    </div>

                                    {formData.paymentMethods.type === "POCHI" && (
                                        <div className="absolute top-3 right-3 text-emerald-600 animate-scaleIn bg-white rounded-full p-1 shadow-md">
                                            <Check size={16} strokeWidth={4} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Input Fields Section with Animation */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-500">
                            {formData.paymentMethods.type === "PAYBILL" && (
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-slideDown">
                                    <div className="form-group mb-0">
                                        <label className="form-label text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">Business Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-emerald-500 text-gray-400">
                                                <span className="text-lg font-mono font-bold">#</span>
                                            </div>
                                            <input
                                                type="text"
                                                name="pm_businessNumber"
                                                className="form-input pl-10 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-lg font-medium transition-all"
                                                placeholder="e.g. 247247"
                                                value={formData.paymentMethods.businessNumber}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group mb-0">
                                        <label className="form-label text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">Account Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-emerald-500 text-gray-400">
                                                <span className="text-lg font-mono font-bold">A</span>
                                            </div>
                                            <input
                                                type="text"
                                                name="pm_accountNumber"
                                                className="form-input pl-10 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-lg font-medium transition-all"
                                                placeholder="e.g. Chama Name"
                                                value={formData.paymentMethods.accountNumber}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-full mt-2 p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex items-center gap-2">
                                        <i className="fas fa-info-circle"></i>
                                        <span>Members will be prompted to enter <strong>{formData.paymentMethods.businessNumber || "..."}</strong> as the paybill.</span>
                                    </div>
                                </div>
                            )}

                            {formData.paymentMethods.type === "TILL" && (
                                <div className="p-6 max-w-xl animate-slideDown">
                                    <div className="form-group mb-0">
                                        <label className="form-label text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">Till Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-emerald-500 text-gray-400">
                                                <Store size={20} />
                                            </div>
                                            <input
                                                type="text"
                                                name="pm_tillNumber"
                                                className="form-input pl-12 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-lg font-medium transition-all text-lg tracking-wide"
                                                placeholder="e.g. 123456"
                                                value={formData.paymentMethods.tillNumber}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                                            <Check size={12} className="text-emerald-500" />
                                            Buy Goods and Services
                                        </p>
                                    </div>
                                </div>
                            )}

                            {formData.paymentMethods.type === "POCHI" && (
                                <div className="p-6 max-w-xl animate-slideDown">
                                    <div className="form-group mb-0">
                                        <label className="form-label text-gray-700 text-xs font-bold uppercase tracking-wider mb-2">Phone Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-emerald-500 text-gray-400">
                                                <Smartphone size={20} />
                                            </div>
                                            <input
                                                type="text"
                                                name="pm_phoneNumber"
                                                className="form-input pl-12 py-3 bg-gray-50 border-gray-200 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-lg font-medium transition-all text-lg tracking-wide"
                                                placeholder="e.g. 0712345678"
                                                value={formData.paymentMethods.phoneNumber}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="mt-3 p-3 bg-yellow-50 text-yellow-800 text-sm rounded-lg border border-yellow-100 flex items-start gap-2">
                                            <i className="fas fa-lightbulb mt-0.5"></i>
                                            <span>Ensure this number is registered for Pochi la Biashara to receive business payments automatically.</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Save Button lives at the end of the form, ABOVE the danger zone ── */}
                        <div className="form-actions-modern mt-8 pt-6 border-t border-gray-100">
                            <button type="button" onClick={() => navigate(`/chamas/${id}`)} className="btn btn-outline">
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {loading ? "Saving..." : "Save Settings"}
                            </button>
                        </div>

                    </form>
                </div>

                {/* ── Danger Zone: completely outside the <form> to prevent accidental submission ── */}
                <div className="card max-w-2xl mx-auto mt-4 p-6 border-2 border-red-100 bg-red-50/20">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                            <span className="text-lg">⚠</span>
                        </div>
                        <h3 className="text-red-700 font-bold text-lg mb-0">Danger Zone</h3>
                    </div>
                    <p className="text-sm text-gray-500 ml-11 mb-5">
                        These actions are irreversible. A dual-official handshake is required for security.
                    </p>

                    {chamaData?.deletion_requested_by ? (
                        <div className="p-4 bg-white border border-red-200 rounded-xl shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                    <span className="text-xl">🔴</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-red-700 mb-1">Deletion Pending Approval</h4>
                                    <p className="text-sm text-gray-600 mb-4">
                                        {chamaData.deletion_requested_by === currentUserId
                                            ? "You initiated this deletion request. Waiting for another official to confirm."
                                            : "An official has requested to deactivate this Chama. Your confirmation is required."
                                        }
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        {chamaData.deletion_requested_by !== currentUserId && (
                                            <button type="button" onClick={handleDelete} className="btn btn-danger">
                                                Confirm & Deactivate
                                            </button>
                                        )}
                                        <button type="button" onClick={handleCancelDelete} className="btn btn-outline">
                                            Cancel Request
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap justify-between items-center gap-4 p-4 bg-white rounded-xl border border-red-100">
                            <div>
                                <p className="font-semibold text-gray-900">Deactivate Chama</p>
                                <p className="text-xs text-gray-500 mt-0.5">Soft-deletes the group and all active data. Requires another official's approval.</p>
                            </div>
                            <button type="button" onClick={handleDelete} className="btn btn-outline btn-danger shrink-0">
                                Request Deletion
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ManageChama;
