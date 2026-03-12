import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { meetingAPI, memberAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { 
    Save, 
    Send, 
    Users, 
    FileText, 
    ArrowLeft, 
    CheckCircle, 
    Clock, 
    AlertCircle 
} from "lucide-react";
import "./Meetings.css";

const MeetingMinutesHUD = () => {
    const { id: chamaId, meetingId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [meeting, setMeeting] = useState(null);
    const [members, setMembers] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [minutes, setMinutes] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [meetingRes, membersRes] = await Promise.all([
                    meetingAPI.getById(chamaId, meetingId),
                    memberAPI.getAll(chamaId)
                ]);

                const meetingData = meetingRes.data.data.meeting;
                setMeeting(meetingData);
                setMinutes(meetingData.description || "");

                // Map existing attendance
                const existingAttendance = meetingRes.data.data.attendance || [];
                const attendanceMap = {};
                existingAttendance.forEach(att => {
                    attendanceMap[att.user_id] = {
                        attended: att.attended,
                        late: att.late,
                        notes: att.notes || ""
                    };
                });
                
                setAttendance(attendanceMap);
                setMembers(membersRes.data.data);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load meeting data");
                navigate(`/chamas/${chamaId}/meetings`);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [chamaId, meetingId, navigate]);

    const handleToggleAttendance = (userId) => {
        setAttendance(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                attended: !prev[userId]?.attended
            }
        }));
    };

    const handleSaveDraft = async () => {
        try {
            setSaving(true);
            
            // 1. Save Attendance
            const attendanceList = members.map(m => ({
                userId: m.user_id,
                attended: attendance[m.user_id]?.attended || false,
                late: attendance[m.user_id]?.late || false,
                notes: attendance[m.user_id]?.notes || ""
            }));

            await Promise.all([
                meetingAPI.recordAttendance(chamaId, meetingId, { attendance: attendanceList }),
                meetingAPI.update(chamaId, meetingId, { description: minutes })
            ]);

            toast.success("Draft saved successfully");
        } catch (err) {
            console.error(err);
            toast.error("Failed to save draft");
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!window.confirm("Are you sure you want to publish these minutes? This will notify ALL members and finalize the record.")) {
            return;
        }

        try {
            setPublishing(true);
            
            // Save one last time first
            await handleSaveDraft();

            // Publish
            await meetingAPI.publishMinutes(chamaId, meetingId);
            
            toast.success("Minutes published and members notified!");
            navigate(`/chamas/${chamaId}/meetings/${meetingId}`);
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || "Failed to publish minutes");
        } finally {
            setPublishing(false);
        }
    };

    if (loading) return <div className="meetings-loading"><div className="spinner-modern"></div></div>;

    return (
        <div className="page meetings-page">
            <div className="container-fluid secretary-hud-grid">
                {/* Header - Full Width */}
                <div className="hud-header">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="btn-icon-fallback">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="hud-title">Minutes HUD</h1>
                            <p className="hud-subtitle">{meeting?.title} • {new Date(meeting?.scheduled_date).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="hud-actions">
                        <span className="hud-status-badge">
                            {meeting?.status === 'COMPLETED' ? 'PUBLISHED' : 'DRAFTING'}
                        </span>
                        <button 
                            className="btn-hero-secondary btn-sm"
                            onClick={handleSaveDraft}
                            disabled={saving || publishing}
                        >
                            <Save size={16} /> {saving ? "Saving..." : "Save Draft"}
                        </button>
                        <button 
                            className="btn-emerald btn-sm"
                            onClick={handlePublish}
                            disabled={saving || publishing || meeting?.status === 'COMPLETED'}
                        >
                            <Send size={16} /> {publishing ? "Publishing..." : "Finalize & Publish"}
                        </button>
                    </div>
                </div>

                <div className="hud-content">
                    {/* Left Column: Minutes Editor */}
                    <div className="hud-panel minutes-editor-panel">
                        <div className="panel-header">
                            <FileText size={18} className="text-emerald-600" />
                            <h2>Meeting Minutes</h2>
                        </div>
                        <div className="minutes-editor-container">
                            <textarea
                                className="minutes-textarea"
                                placeholder="Start typing meeting minutes, resolutions, and action items here..."
                                value={minutes}
                                onChange={(e) => setMinutes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Right Column: Quick Attendance */}
                    <div className="hud-panel attendance-panel">
                        <div className="panel-header">
                            <Users size={18} className="text-emerald-600" />
                            <h2>Quick Attendance</h2>
                            <span className="count-tag">
                                {Object.values(attendance).filter(a => a.attended).length} / {members.length}
                            </span>
                        </div>
                        <div className="attendance-list-compact">
                            {members.map(member => (
                                <div 
                                    key={member.user_id} 
                                    className={`attendance-item-compact ${attendance[member.user_id]?.attended ? 'is-present' : ''}`}
                                    onClick={() => handleToggleAttendance(member.user_id)}
                                >
                                    <div className="member-avatar-small">
                                        {member.first_name[0]}{member.last_name[0]}
                                    </div>
                                    <div className="member-info-compact">
                                        <span className="member-name">{member.first_name} {member.last_name}</span>
                                        <span className="member-role-v-small">{member.role}</span>
                                    </div>
                                    <div className="attendance-checkbox">
                                        {attendance[member.user_id]?.attended ? (
                                            <CheckCircle size={18} className="text-emerald-500" />
                                        ) : (
                                            <div className="checkbox-empty" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MeetingMinutesHUD;
