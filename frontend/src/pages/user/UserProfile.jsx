import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { userAPI, chamaAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { 
    Camera, Loader2, Shield, User, Lock, Trash2, 
    CheckCircle2, Mail, Phone, CreditCard, Activity,
    Calendar, Trophy, ShieldCheck
} from "lucide-react";
import { uploadMediaToFirebase } from "../../services/firebaseStorage";
import { getImageUrl } from "../../utils/imageUtils";
import { motion, AnimatePresence } from "framer-motion";
import "./UserProfile.css";

const UserProfile = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ groups: 0, since: "..." });
    const [profile, setProfile] = useState({
        first_name: "",
        last_name: "",
        phone_number: "",
        email: "",
        national_id: "",
        profile_picture_url: ""
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
    });

    const [updating, setUpdating] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const [profileRes, chamasRes] = await Promise.all([
                userAPI.getProfile(),
                chamaAPI.getMyChamas()
            ]);
            
            const data = profileRes.data.data || profileRes.data;
            const myChamas = chamasRes.data.data || chamasRes.data || [];
            
            setProfile({
                first_name: data.first_name,
                last_name: data.last_name,
                phone_number: data.phone_number,
                email: data.email,
                national_id: data.national_id || "",
                profile_picture_url: data.profilePictureUrl || data.profile_picture_url || ""
            });

            // Derive some stats
            const joinDate = new Date(data.created_at || Date.now());
            setStats({
                groups: myChamas.length,
                since: joinDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            });

            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load profile details");
            setLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) return toast.error("Invalid image file");
        if (file.size > 5 * 1024 * 1024) return toast.error("Image too large (max 5MB)");

        setUploadingImage(true);
        try {
            const downloadUrl = await uploadMediaToFirebase(file, 'avatars');
            setProfile(prev => ({ ...prev, profile_picture_url: downloadUrl }));
            toast.success("Identity updated! Save changes to apply permanently.");
        } catch (err) {
            toast.error("Cloud sync failed");
            console.error(err);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setUpdating(true);
        try {
            const updateData = {
                firstName: profile.first_name,
                lastName: profile.last_name,
                email: profile.email,
                phoneNumber: profile.phone_number,
                nationalId: profile.national_id,
                profilePictureUrl: profile.profile_picture_url
            };
            await userAPI.updateProfile(updateData);
            toast.success("Profile records secured");
        } catch (err) {
            toast.error(err.response?.data?.message || "Sync failed");
        } finally {
            setUpdating(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return toast.error("Passwords do not match");
        }

        setChangingPassword(true);
        try {
            await userAPI.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            toast.success("Credentials updated successfully");
            setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err) {
            toast.error(err.response?.data?.message || "Credential update failed");
        } finally {
            setChangingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("CRITICAL: Permanent account deletion. Proceed?")) return;
        try {
            await userAPI.deleteAccount();
            toast.success("Account terminated");
            logout();
            navigate("/");
        } catch (err) {
            toast.error("Termination failed");
        }
    };

    if (loading) return (
        <div className="flex-center" style={{ height: '80vh', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="spinner-modern" />
            <p style={{ color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
                Securing Profile Session...
            </p>
        </div>
    );

    return (
        <div className="profile-page-wrapper">
            <div className="page-frame-lux">
                <motion.div 
                    className="profile-container-lux"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                {/* ── Left Sidebar: Identity ── */}
                <aside className="identity-card-lux">
                    <div className="identity-avatar-group">
                        <div className="identity-avatar-ring" />
                        <div className="identity-avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
                            {getImageUrl(profile.profile_picture_url) ? (
                                <img src={getImageUrl(profile.profile_picture_url)} alt="Profile" className="identity-avatar-img" />
                            ) : (
                                <div className="identity-avatar-placeholder">
                                    {(profile.first_name?.[0] || "") + (profile.last_name?.[0] || "")}
                                </div>
                            )}
                            <div className="identity-avatar-overlay">
                                {uploadingImage ? <Loader2 className="animate-spin" /> : <Camera />}
                            </div>
                        </div>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleImageUpload}
                            accept="image/*"
                        />
                    </div>

                    <h2 className="identity-name">{profile.first_name} {profile.last_name}</h2>
                    <p className="identity-email">{profile.email}</p>
                    
                    <div className="identity-badge-lux">
                        <ShieldCheck size={14} />
                        Verified Member
                    </div>

                    <div className="identity-stats-lux">
                        <div className="identity-stat-item">
                            <span className="identity-stat-val">{stats.groups}</span>
                            <span className="identity-stat-label">Groups</span>
                        </div>
                        <div className="identity-stat-item">
                            <span className="identity-stat-val">{stats.since}</span>
                            <span className="identity-stat-label">Joined</span>
                        </div>
                    </div>
                </aside>

                {/* ── Right Content: Configuration ── */}
                <main className="profile-content-lux">
                    
                    {/* Personal Info */}
                    <div className="profile-card-lux">
                        <div className="card-header-lux">
                            <User size={20} className="text-gold" />
                            <h3>Personal Information</h3>
                        </div>
                        <div className="card-body-lux">
                            <form onSubmit={handleProfileUpdate} className="lux-form-grid">
                                <div className="lux-input-group">
                                    <label className="lux-label">First Name</label>
                                    <input 
                                        className="lux-input" 
                                        value={profile.first_name} 
                                        onChange={e => setProfile({...profile, first_name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="lux-input-group">
                                    <label className="lux-label">Last Name</label>
                                    <input 
                                        className="lux-input" 
                                        value={profile.last_name} 
                                        onChange={e => setProfile({...profile, last_name: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="lux-input-group">
                                    <label className="lux-label">Email Address</label>
                                    <input 
                                        className="lux-input" 
                                        type="email"
                                        value={profile.email} 
                                        onChange={e => setProfile({...profile, email: e.target.value})}
                                    />
                                </div>
                                <div className="lux-input-group">
                                    <label className="lux-label">National ID</label>
                                    <input 
                                        className="lux-input" 
                                        value={profile.national_id} 
                                        onChange={e => setProfile({...profile, national_id: e.target.value})}
                                        placeholder="Identification Number"
                                    />
                                </div>
                                <div className="lux-input-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="lux-label">Phone Number</label>
                                    <input 
                                        className="lux-input" 
                                        value={profile.phone_number} 
                                        onChange={e => setProfile({...profile, phone_number: e.target.value})}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn-lux-save" disabled={updating}>
                                    {updating ? "Syncing Records..." : "Save Profile Changes"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="profile-card-lux security-card-lux">
                        <div className="card-header-lux">
                            <Lock size={20} className="text-primary" />
                            <h3>Access Credentials</h3>
                        </div>
                        <div className="card-body-lux">
                            <form onSubmit={handlePasswordChange} className="lux-form-grid">
                                <div className="lux-input-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="lux-label">Current Password</label>
                                    <input 
                                        type="password"
                                        className="lux-input" 
                                        value={passwordData.currentPassword}
                                        onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="lux-input-group">
                                    <label className="lux-label">New Password</label>
                                    <input 
                                        type="password"
                                        className="lux-input" 
                                        value={passwordData.newPassword}
                                        onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                                        required
                                    />
                                </div>
                                <div className="lux-input-group">
                                    <label className="lux-label">Confirm New Password</label>
                                    <input 
                                        type="password"
                                        className="lux-input" 
                                        value={passwordData.confirmPassword}
                                        onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn-lux-secondary" style={{ gridColumn: '1 / -1' }} disabled={changingPassword}>
                                    {changingPassword ? "Updating Access..." : "Update Security Credentials"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="profile-card-lux danger-card-lux">
                        <div className="card-header-lux">
                            <Trash2 size={20} className="text-danger" />
                            <h3>System Override</h3>
                        </div>
                        <div className="card-body-lux">
                            <p className="danger-text-lux">
                                Terminating your account will permanently remove all stake records, history, and access from the ChamaSmart network. This operation is irreversible.
                            </p>
                            <button onClick={handleDeleteAccount} className="btn-lux-danger">
                                Terminate Account Access
                            </button>
                        </div>
                    </div>

                </main>
            </motion.div>
          </div>
        </div>
    );
};

export default UserProfile;
