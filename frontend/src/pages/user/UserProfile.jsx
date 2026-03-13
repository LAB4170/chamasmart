import { useState, useEffect, useRef } from "react";
import { userAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import { Camera, Loader2 } from "lucide-react";
import { uploadMediaToFirebase } from "../../services/firebaseStorage";
import { getImageUrl } from "../../utils/imageUtils";
import "./UserProfile.css";

const UserProfile = () => {
    const { logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState({
        first_name: "",
        last_name: "",
        phone_number: "",
        email: "",
        national_id: "",
        profile_picture_url: ""
    });

    // Password change state
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
            const res = await userAPI.getProfile();
            const data = res.data.data || res.data;
            setProfile({
                first_name: data.first_name,
                last_name: data.last_name,
                phone_number: data.phone_number,
                email: data.email,
                national_id: data.national_id || "",
                profile_picture_url: data.profilePictureUrl || data.profile_picture_url || ""
            });
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load profile");
            setLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            return toast.error("Please select an image file");
        }
        if (file.size > 5 * 1024 * 1024) {
            return toast.error("Image must be less than 5MB");
        }

        setUploadingImage(true);
        try {
            const downloadUrl = await uploadMediaToFirebase(file, 'avatars');
            setProfile(prev => ({ ...prev, profile_picture_url: downloadUrl }));
            toast.success("Profile picture uploaded. Click Save to apply.");
        } catch (err) {
            toast.error("Failed to upload image");
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
            console.log("SENDING UPDATE DATA:", updateData);
            await userAPI.updateProfile(updateData);
            toast.success("Profile updated successfully");
        } catch (err) {
            console.error("PROFILE UPDATE FAILED:", err.response?.data || err);
            toast.error(err.response?.data?.message || "Failed to update profile");
        } finally {
            setUpdating(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            return toast.error("New passwords do not match");
        }

        setChangingPassword(true);
        try {
            await userAPI.changePassword({
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            toast.success("Password changed successfully");
            setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to change password");
        } finally {
            setChangingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
            return;
        }

        try {
            await userAPI.deleteAccount();
            toast.success("Account deleted successfully");
            logout();
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete account");
        }
    };

    if (loading) return <div className="loading-spinner">Loading Profile...</div>;

    return (
        <div className="page">
            <div className="container profile-container">
                <div className="profile-header">
                    <h1>My Profile</h1>
                </div>

                <div className="profile-card">
                    <div className="profile-section">
                        <h3>Personal Information</h3>
                        
                        <div className="profile-picture-container">
                            <div className="profile-picture-wrapper" onClick={() => fileInputRef.current?.click()}>
                                {getImageUrl(profile.profile_picture_url) ? (
                                    <img src={getImageUrl(profile.profile_picture_url)} alt="Profile" className="profile-picture" />
                                ) : (
                                    <div className="profile-picture-placeholder">
                                        {(profile.first_name?.[0] || "") + (profile.last_name?.[0] || "") || "?"}
                                    </div>
                                )}
                                <div className="profile-picture-overlay">
                                    {uploadingImage ? <Loader2 className="spinner" size={24} /> : <Camera size={24} />}
                                </div>
                            </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    style={{ display: 'none' }} 
                                    accept="image/png, image/jpeg, image/jpg, image/webp"
                                    onChange={handleImageUpload}
                                />
                            <p className="profile-picture-hint">Click to change profile picture</p>
                        </div>

                        <form onSubmit={handleProfileUpdate} className="profile-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={profile.first_name || ""}
                                        onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={profile.last_name || ""}
                                        onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={profile.email || ""}
                                        disabled
                                        title="Email cannot be changed"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>National ID</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={profile.national_id || ""}
                                        onChange={(e) => setProfile({ ...profile, national_id: e.target.value })}
                                        placeholder="Enter National ID"
                                    />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Phone Number</label>
                                    <input
                                        type="tel"
                                        className="form-input"
                                        value={profile.phone_number || ""}
                                        onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={updating}>
                                {updating ? "Saving..." : "Save Changes"}
                            </button>
                        </form>
                    </div>

                    {/* Security Section */}
                    <div className="profile-section">
                        <h3>Security</h3>
                        <form onSubmit={handlePasswordChange} className="profile-form">
                            <div className="form-group">
                                <label>Current Password</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>New Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-outline" disabled={changingPassword}>
                                {changingPassword ? "Updating Password..." : "Update Password"}
                            </button>
                        </form>
                    </div>

                    {/* Danger Zone */}
                    <div className="danger-zone">
                        <h3>Danger Zone</h3>
                        <p className="text-muted mb-3">
                            Once you delete your account, there is no going back. Please be certain.
                        </p>
                        <button onClick={handleDeleteAccount} className="btn-danger-outline">
                            Delete Account
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
