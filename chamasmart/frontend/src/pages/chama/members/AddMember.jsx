import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { memberAPI, inviteAPI } from "../../../services/api";
import { toast } from "react-toastify";

const AddMember = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("INVITE"); // INVITE or MANUAL
    const [loading, setLoading] = useState(false);

    // Invite State
    const [email, setEmail] = useState("");
    const [inviteLink, setInviteLink] = useState("");

    // Manual Add State
    const [manualData, setManualData] = useState({
        email: "",
        phoneNumber: "",
        firstName: "",
        lastName: "",
        role: "MEMBER"
    });

    const handleInvite = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await inviteAPI.generate(id, { email });
            setInviteLink(res.data.data.inviteLink);
            toast.success("Invite link generated!");

            // Auto-send if email provided
            if (email) {
                await inviteAPI.send(id, email);
                toast.success(`Invite sent to ${email}`);
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to generate invite");
        } finally {
            setLoading(false);
        }
    };

    const handleManualAdd = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await memberAPI.add(id, manualData);
            toast.success("Member added successfully!");
            navigate(`/chamas/${id}`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to add member");
        } finally {
            setLoading(false);
        }
    };

    const copyLink = () => {
        navigator.clipboard.writeText(inviteLink);
        toast.info("Link copied to clipboard");
    };

    return (
        <div className="page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Add New Member</h1>
                        <p className="subtitle">Grow your chama by adding new members</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="btn btn-outline">
                        Cancel
                    </button>
                </div>

                <div className="card max-w-2xl mx-auto">
                    <div className="tabs mb-4 border-b">
                        <button
                            className={`tab-btn px-4 py-2 ${activeTab === 'INVITE' ? 'border-b-2 border-primary text-primary font-bold' : 'text-gray-500'}`}
                            onClick={() => setActiveTab('INVITE')}
                        >
                            Send Invite
                        </button>
                        <button
                            className={`tab-btn px-4 py-2 ${activeTab === 'MANUAL' ? 'border-b-2 border-primary text-primary font-bold' : 'text-gray-500'}`}
                            onClick={() => setActiveTab('MANUAL')}
                        >
                            Manually Add
                        </button>
                    </div>

                    {activeTab === 'INVITE' ? (
                        <form onSubmit={handleInvite}>
                            <div className="text-center mb-6">
                                <div className="text-4xl mb-2">✉️</div>
                                <h3>Invite via Email</h3>
                                <p className="text-muted">Enter an email address to send a secure invitation link.</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="friend@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" className="btn btn-primary btn-block mb-4" disabled={loading}>
                                {loading ? "Sending..." : "Send Invitation"}
                            </button>

                            {inviteLink && (
                                <div className="bg-gray-100 p-4 rounded mt-4">
                                    <label className="text-sm font-bold text-gray-700">Share Link Directly</label>
                                    <div className="d-flex mt-2">
                                        <input
                                            readOnly
                                            value={inviteLink}
                                            className="form-input rounded-r-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={copyLink}
                                            className="btn btn-secondary rounded-l-none"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={handleManualAdd}>
                            <div className="alert alert-info mb-4">
                                <small>Use this only if the user is already registered on ChamaSmart. They will be added immediately.</small>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">First Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={manualData.firstName}
                                        onChange={(e) => setManualData({ ...manualData, firstName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Last Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={manualData.lastName}
                                        onChange={(e) => setManualData({ ...manualData, lastName: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input
                                    type="tel"
                                    className="form-input"
                                    placeholder="0712345678"
                                    value={manualData.phoneNumber}
                                    onChange={(e) => setManualData({ ...manualData, phoneNumber: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Email Address (Optional)</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={manualData.email}
                                    onChange={(e) => setManualData({ ...manualData, email: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Role</label>
                                <select
                                    className="form-select"
                                    value={manualData.role}
                                    onChange={(e) => setManualData({ ...manualData, role: e.target.value })}
                                >
                                    <option value="MEMBER">Member</option>
                                    <option value="TREASURER">Treasurer</option>
                                    <option value="SECRETARY">Secretary</option>
                                    <option value="CHAIRPERSON">Chairperson</option>
                                </select>
                            </div>

                            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                {loading ? "Adding..." : "Add Member"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddMember;
