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
        mpesaPaybill: "",
        accountNumber: ""
    });

    useEffect(() => {
        fetchChamaDetails();
    }, [id]);

    const fetchChamaDetails = async () => {
        try {
            const res = await chamaAPI.getById(id);
            const chama = res.data.data;
            setFormData({
                name: chama.name,
                description: chama.description || "",
                type: chama.type,
                contributionAmount: chama.contributionAmount || "",
                contributionFrequency: chama.contributionFrequency || "MONTHLY",
                mpesaPaybill: chama.mpesaPaybill || "",
                accountNumber: chama.accountNumber || ""
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
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await chamaAPI.update(id, formData);
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

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">M-Pesa Paybill</label>
                                <input
                                    type="text"
                                    name="mpesaPaybill"
                                    className="form-input"
                                    value={formData.mpesaPaybill}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Account Number</label>
                                <input
                                    type="text"
                                    name="accountNumber"
                                    className="form-input"
                                    value={formData.accountNumber}
                                    onChange={handleChange}
                                />
                            </div>
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
