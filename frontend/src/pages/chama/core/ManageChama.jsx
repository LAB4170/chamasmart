import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import { toast } from "react-toastify";

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
        paymentMethods: {
            type: "PAYBILL", // Default
            businessNumber: "",
            accountNumber: "",
            tillNumber: "",
            phoneNumber: ""
        }
    });

    useEffect(() => {
        fetchChamaDetails();
    }, [id]);

    const fetchChamaDetails = async () => {
        try {
            const res = await chamaAPI.getById(id);
            const chama = res.data.data;
            setFormData({
                name: chama.chama_name || "",
                description: chama.description || "",
                type: chama.chama_type || "",
                contributionAmount: chama.contribution_amount || "",
                contributionFrequency: chama.contribution_frequency || "MONTHLY",
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
        if (window.confirm("Are you sure you want to delete this Chama? This action cannot be undone.")) {
            try {
                await chamaAPI.delete(id);
                toast.success("Chama deleted successfully");
                navigate("/chamas");
            } catch (err) {
                console.error(err);
                toast.error("Failed to delete chama");
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
                    <button onClick={() => navigate(`/chamas/${id}`)} className="btn btn-outline">
                        Cancel
                    </button>
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

                        <div className="section-divider my-4"></div>
                        <h3>Payment Details</h3>
                        <p className="text-muted mb-4">How members should contribute funds to the group.</p>

                        <div className="form-group mb-4">
                            <label className="form-label">Collection Method</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="pm_type"
                                        value="PAYBILL"
                                        checked={formData.paymentMethods.type === "PAYBILL"}
                                        onChange={handleChange}
                                    />
                                    <span>M-Pesa Paybill</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="pm_type"
                                        value="TILL"
                                        checked={formData.paymentMethods.type === "TILL"}
                                        onChange={handleChange}
                                    />
                                    <span>Buy Goods (Till)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="pm_type"
                                        value="POCHI"
                                        checked={formData.paymentMethods.type === "POCHI"}
                                        onChange={handleChange}
                                    />
                                    <span>Pochi la Biashara</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-row">
                            {formData.paymentMethods.type === "PAYBILL" && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Business Number</label>
                                        <input
                                            type="text"
                                            name="pm_businessNumber"
                                            className="form-input"
                                            placeholder="e.g. 247247"
                                            value={formData.paymentMethods.businessNumber}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Account Number</label>
                                        <input
                                            type="text"
                                            name="pm_accountNumber"
                                            className="form-input"
                                            placeholder="e.g. Account Name"
                                            value={formData.paymentMethods.accountNumber}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </>
                            )}

                            {formData.paymentMethods.type === "TILL" && (
                                <div className="form-group">
                                    <label className="form-label">Till Number</label>
                                    <input
                                        type="text"
                                        name="pm_tillNumber"
                                        className="form-input"
                                        placeholder="e.g. 123456"
                                        value={formData.paymentMethods.tillNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}

                            {formData.paymentMethods.type === "POCHI" && (
                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input
                                        type="text"
                                        name="pm_phoneNumber"
                                        className="form-input"
                                        placeholder="e.g. 0712345678"
                                        value={formData.paymentMethods.phoneNumber}
                                        onChange={handleChange}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="form-actions-modern mt-6">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="btn btn-outline btn-danger"
                            >
                                Delete Chama
                            </button>
                            <button type="submit" className="btn btn-primary">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ManageChama;
