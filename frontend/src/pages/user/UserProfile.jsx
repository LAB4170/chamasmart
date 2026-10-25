import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { userAPI, chamaAPI, authAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { getImageUrl } from "../../utils/imageUtils";
import { Button, Skeleton, Dialog } from "../../components/ui";
import { formatDate } from "../../utils/format";
import TwoFactorCard from "../../components/security/TwoFactorCard";

const maskId = (v) => (!v ? "" : v.length <= 7 ? v : `${v.slice(0, 3)}***${v.slice(-2)}`);

export default function UserProfile() {
  const { logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [groups, setGroups] = useState(0);
  const [since, setSince] = useState(null);
  const [profile, setProfile] = useState({ first_name: "", last_name: "", phone_number: "", email: "", national_id: "", profile_picture_url: "" });
  const [editingId, setEditingId] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [p, c] = await Promise.all([userAPI.getProfile(), chamaAPI.getMyChamas()]);
      const d = p.data?.data || p.data;
      setProfile({
        first_name: d.first_name || "",
        last_name: d.last_name || "",
        phone_number: d.phone_number || "",
        email: d.email || "",
        national_id: d.national_id || "",
        profile_picture_url: d.profilePictureUrl || d.profile_picture_url || "",
      });
      setSince(d.created_at || null);
      const list = c.data?.data || c.data || [];
      setGroups(Array.isArray(list) ? list.length : 0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setP = (e) => setProfile((x) => ({ ...x, [e.target.name]: e.target.value }));

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("The image must be 5MB or smaller.");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await userAPI.uploadProfilePicture(form);
      setProfile((x) => ({ ...x, profile_picture_url: data.url }));
      updateUser({ profilePictureUrl: data.url });
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "The upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    const er = {};
    if (!profile.first_name.trim()) er.first_name = "Enter your first name.";
    if (!profile.last_name.trim()) er.last_name = "Enter your last name.";
    if (!/^\+?[0-9 ]{9,15}$/.test(profile.phone_number.trim())) er.phone_number = "Enter a valid phone number.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await userAPI.updateProfile({
        firstName: profile.first_name.trim(),
        lastName: profile.last_name.trim(),
        phoneNumber: profile.phone_number.trim(),
        nationalId: profile.national_id.trim(),
      });
      updateUser({ firstName: profile.first_name.trim(), lastName: profile.last_name.trim() });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const er = {};
    if (!pw.current) er.current = "Enter your current password.";
    if (pw.next.length < 8) er.next = "Use at least 8 characters.";
    if (pw.next !== pw.confirm) er.confirm = "The passwords don't match.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setChanging(true);
    try {
      await userAPI.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      // The server ended every session, including this one, so sign in again with the new password.
      toast.success("Password changed. Please sign in again.");
      setPw({ current: "", next: "", confirm: "" });
      await logout();
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't change your password.");
    } finally {
      setChanging(false);
    }
  };

  const signOutEverywhere = async () => {
    try {
      await authAPI.logoutAll();
      toast.success("Signed out on all devices.");
      await logout();
      navigate("/login");
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't sign you out everywhere. Try again.");
    }
  };

  const downloadData = async () => {
    try {
      const res = await userAPI.exportMyData();
      const blob = new Blob([JSON.stringify(res.data?.data ?? {}, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "chamasmart-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't prepare your data. Try again.");
    }
  };

  const closeAccount = async () => {
    setClosing(true);
    try {
      await userAPI.deleteAccount();
      toast.success("Your account has been closed.");
      logout();
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't close your account.");
      setClosing(false);
    }
  };

  const aria = (n, id) => ({ id, name: n, "aria-invalid": errors[n] ? "true" : undefined, "aria-describedby": errors[n] ? `${id}-err` : undefined });
  const err = (n, id) => errors[n] && <span className="cs-error" id={`${id}-err`} role="alert">{errors[n]}</span>;
  const pic = getImageUrl(profile.profile_picture_url);
  const initials = ((profile.first_name[0] || "") + (profile.last_name[0] || "")).toUpperCase();

  if (loading) return <div className="cs-shell"><main className="cs-page"><div className="cs-card" aria-busy="true" aria-label="Loading profile"><Skeleton height={20} width="40%" /><Skeleton height={80} style={{ marginTop: 12 }} /></div></main></div>;
  if (failed) return (
    <div className="cs-shell"><main className="cs-page">
      <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}><span>We couldn&apos;t load your profile.</span><Button size="sm" onClick={load}>Try again</Button></div>
    </main></div>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <section className="cs-hero cs-hero--profile" aria-label="Your profile">
          {pic ? <img className="cs-profile-pic" src={pic} alt="Your profile" width={88} height={88} /> : <div className="cs-profile-pic" aria-hidden="true">{initials || "?"}</div>}
          <div className="cs-profile-id">
            <h1 className="cs-hub-title" style={{ margin: 0 }}>{`${profile.first_name} ${profile.last_name}`.trim() || "Your profile"}</h1>
            <p className="cs-hero-note" style={{ margin: "4px 0 10px" }}>{profile.email}</p>
            <div className="cs-hub-meta">
              <span className="cs-hero-pill">{groups} {groups === 1 ? "chama" : "chamas"}</span>
              {since && <span className="cs-hero-pill">Member since {formatDate(since)}</span>}
            </div>
          </div>
          <div className="cs-profile-photo-action">
            <Button className="cs-btn--glass" loading={uploading} onClick={() => fileRef.current?.click()}>Change photo</Button>
            <input ref={fileRef} type="file" accept="image/*" onChange={upload} hidden aria-label="Choose a profile photo" />
          </div>
        </section>

        <section className="cs-card" aria-label="Personal details" style={{ marginBottom: 16, maxWidth: 720 }}>
          <form onSubmit={saveProfile} noValidate>
            <div className="cs-form-grid">
              <div className="cs-field"><label className="cs-label" htmlFor="up-first">First name</label><input className="cs-input" autoComplete="given-name" {...aria("first_name", "up-first")} value={profile.first_name} onChange={setP} />{err("first_name", "up-first")}</div>
              <div className="cs-field"><label className="cs-label" htmlFor="up-last">Last name</label><input className="cs-input" autoComplete="family-name" {...aria("last_name", "up-last")} value={profile.last_name} onChange={setP} />{err("last_name", "up-last")}</div>
              <div className="cs-field"><label className="cs-label" htmlFor="up-email">Email</label><input id="up-email" className="cs-input" type="email" value={profile.email} readOnly aria-describedby="up-email-help" /><span className="cs-help" id="up-email-help">Your email is your sign-in and can&apos;t be changed here.</span></div>
              <div className="cs-field"><label className="cs-label" htmlFor="up-phone">Phone number</label><input className="cs-input" type="tel" autoComplete="tel" {...aria("phone_number", "up-phone")} value={profile.phone_number} onChange={setP} />{err("phone_number", "up-phone")}</div>
              <div className="cs-field">
                <label className="cs-label" htmlFor="up-nid">National ID</label>
                <input id="up-nid" name="national_id" className="cs-input" inputMode="numeric" value={editingId ? profile.national_id : maskId(profile.national_id)} onChange={setP} onFocus={() => setEditingId(true)} onBlur={() => setEditingId(false)} />
              </div>
            </div>
            <div className="cs-actions"><Button type="submit" loading={saving}>Save changes</Button></div>
          </form>
        </section>

        <TwoFactorCard />

        <form className="cs-card" onSubmit={changePassword} noValidate aria-label="Change password" style={{ marginBottom: 16, maxWidth: 720 }}>
          <h2 className="cs-card-title">Change password</h2>
          <div className="cs-field"><label className="cs-label" htmlFor="pw-current">Current password</label><input type="password" autoComplete="current-password" className="cs-input" {...aria("current", "pw-current")} value={pw.current} onChange={(e) => setPw((x) => ({ ...x, current: e.target.value }))} />{err("current", "pw-current")}</div>
          <div className="cs-form-grid">
            <div className="cs-field"><label className="cs-label" htmlFor="pw-next">New password</label><input type="password" autoComplete="new-password" className="cs-input" {...aria("next", "pw-next")} value={pw.next} onChange={(e) => setPw((x) => ({ ...x, next: e.target.value }))} />{err("next", "pw-next")}</div>
            <div className="cs-field"><label className="cs-label" htmlFor="pw-confirm">Confirm new password</label><input type="password" autoComplete="new-password" className="cs-input" {...aria("confirm", "pw-confirm")} value={pw.confirm} onChange={(e) => setPw((x) => ({ ...x, confirm: e.target.value }))} />{err("confirm", "pw-confirm")}</div>
          </div>
          <div className="cs-actions"><Button type="submit" loading={changing}>Change password</Button></div>
        </form>

        <section className="cs-card" aria-label="Sessions and data" style={{ marginBottom: 16, maxWidth: 720 }}>
          <h2 className="cs-card-title">Sessions and your data</h2>
          <p>If you used a shared phone or lost a device, sign out everywhere. You can also download a copy of the data we hold about you.</p>
          <div className="cs-actions">
            <Button variant="secondary" onClick={signOutEverywhere}>Sign out on all devices</Button>
            <Button variant="secondary" onClick={downloadData}>Download my data</Button>
          </div>
        </section>

        <section className="cs-card" aria-label="Close account" style={{ maxWidth: 720 }}>
          <h2 className="cs-card-title">Close account</h2>
          <p>This signs you out for good and erases your name, phone, email and ID. It can&apos;t be undone. You can&apos;t close your account while you have an open loan, hold savings in a chama (leave it first to get them refunded), or chair an active chama.</p>
          <Button variant="danger" onClick={() => { setConfirmText(""); setCloseOpen(true); }}>Close my account</Button>
        </section>

        <Dialog
          open={closeOpen}
          onClose={() => setCloseOpen(false)}
          title="Close your account?"
          actions={(<><Button onClick={() => setCloseOpen(false)}>Keep my account</Button><Button variant="danger" loading={closing} disabled={confirmText !== "DELETE"} onClick={closeAccount}>Close account</Button></>)}
        >
          <p>Type <strong>DELETE</strong> to confirm.</p>
          <div className="cs-field"><label className="cs-label" htmlFor="del-confirm">Confirmation</label><input id="del-confirm" className="cs-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></div>
        </Dialog>
      </main>
    </div>
  );
}
