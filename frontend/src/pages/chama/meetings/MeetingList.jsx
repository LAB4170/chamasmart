import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { meetingAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-toastify";
import { Calendar, MapPin, Clock, Video, Users, PlusCircle, ArrowLeft, Play } from "lucide-react";
import "./Meetings.css";

const MeetingList = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState("MEMBER");

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [meetingsRes, membersRes] = await Promise.all([
                    meetingAPI.getAll(id),
                    chamaAPI.getMembers(id),
                ]);

                if (isMounted) {
                    setMeetings(meetingsRes.data.data || meetingsRes.data);

                    // Determine user's role in THIS chama
                    const members = membersRes.data.data || membersRes.data;
                    const me = members.find(m => m.user_id === user?.id || m.user_id === user?.user_id);
                    setUserRole(me?.role || "MEMBER");
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    toast.error("Failed to fetch meetings");
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [id]);

    const isOfficial = ["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(userRole);

    const getStatusStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'completed': return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Completed' };
            case 'cancelled': return { bg: 'bg-red-50', text: 'text-red-600', label: 'Cancelled' };
            default: return { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Scheduled' };
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'VIRTUAL': return <Video size={14} />;
            case 'HYBRID': return <Users size={14} />;
            default: return <MapPin size={14} />;
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return { day: '??', month: '???', year: '????', time: '--:--', full: 'Date not set' };
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return { day: '??', month: '???', year: '????', time: '--:--', full: 'Invalid Date' };
        
        return {
            day: date.getDate(),
            month: date.toLocaleString('default', { month: 'short' }),
            year: date.getFullYear(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            full: date.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        };
    };

    const upcomingMeetings = meetings.filter(m => m.status?.toLowerCase() === 'scheduled');
    const pastMeetings = meetings.filter(m => m.status?.toLowerCase() !== 'scheduled');

    if (loading) return (
        <div className="meetings-loading">
            <div className="spinner-modern"></div>
            <p>Loading meetings...</p>
        </div>
    );

    return (
        <div className="page meetings-page">
            <div className="container">

                {/* Page Header */}
                <div className="meetings-header">
                    <div>
                        <button onClick={() => navigate(`/chamas/${id}`)} className="back-link-premium">
                            <ArrowLeft size={16} /> Back to Chama
                        </button>
                        <h1 className="meetings-title">
                            <Calendar size={28} />
                            Meetings
                        </h1>
                        <p className="meetings-subtitle">
                            {isOfficial
                                ? "Schedule and manage chama meetings"
                                : "View upcoming and past chama meetings"
                            }
                        </p>
                    </div>

                    {/* ✅ SENIOR DEV NOTE: Only officials can schedule meetings */}
                    {isOfficial && (
                        <Link to={`/chamas/${id}/meetings/create`} className="btn-schedule">
                            <PlusCircle size={18} />
                            Schedule Meeting
                        </Link>
                    )}
                </div>

                {/* Role Info Banner for Members */}
                {!isOfficial && (
                    <div className="member-info-banner">
                        <Calendar size={16} />
                        <span>You're viewing as a <strong>{userRole}</strong>. Only officials can schedule meetings.</span>
                    </div>
                )}

                {meetings.length === 0 ? (
                    <div className="meetings-empty">
                        <div className="empty-icon">📅</div>
                        <h3>No Meetings Yet</h3>
                        <p>
                            {isOfficial
                                ? "Schedule your chama's first meeting to get started."
                                : "No meetings have been scheduled yet. Check back later."}
                        </p>
                        {isOfficial && (
                            <Link to={`/chamas/${id}/meetings/create`} className="btn btn-primary mt-3">
                                Schedule First Meeting
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="meetings-content">

                        {/* Upcoming Meetings */}
                        {upcomingMeetings.length > 0 && (
                            <div className="meetings-section">
                                <h2 className="section-heading">
                                    <span className="section-dot upcoming"></span>
                                    Upcoming ({upcomingMeetings.length})
                                </h2>
                                <div className="meeting-cards">
                                    {upcomingMeetings.map(meeting => {
                                        const date = formatDate(meeting.scheduled_date || meeting.scheduledAt || meeting.date);
                                        const status = getStatusStyle(meeting.status);
                                        return (
                                            <div key={meeting.meeting_id || meeting._id} className="meeting-card-modern upcoming-card">
                                                <div className="meeting-date-block">
                                                    <span className="meeting-day">{date.day}</span>
                                                    <span className="meeting-month">{date.month}</span>
                                                    <span className="meeting-year">{date.year}</span>
                                                </div>
                                                <div className="meeting-body">
                                                    <div className="meeting-card-top">
                                                        <h3 className="meeting-name">{meeting.title || "Chama Meeting"}</h3>
                                                        <span className={`meeting-badge ${status.bg} ${status.text}`}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div className="meeting-meta-row">
                                                        <span className="meta-item">
                                                            <Clock size={13} /> {date.time}
                                                        </span>
                                                        <span className="meta-item">
                                                            {getTypeIcon(meeting.type)}
                                                            {meeting.location || "Online"}
                                                        </span>
                                                    </div>
                                                    {meeting.description && (
                                                        <p className="meeting-agenda">{meeting.description}</p>
                                                    )}
                                                    <div className="meeting-actions">
                                                        {(meeting.type === 'VIRTUAL' || meeting.type === 'HYBRID') && meeting.meetingLink && (
                                                            <a
                                                                href={meeting.meetingLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="btn-join"
                                                            >
                                                                <Video size={14} /> Join Meeting
                                                            </a>
                                                        )}
                                                        {/* Only officials see the manage link */}
                                                        {isOfficial && (
                                                            <div className="flex gap-2">
                                                                <Link
                                                                    to={`/chamas/${id}/meetings/${meeting.meeting_id || meeting._id}`}
                                                                    className="btn-manage"
                                                                >
                                                                    Manage
                                                                </Link>
                                                                <Link
                                                                    to={`/chamas/${id}/meetings/${meeting.meeting_id || meeting._id}/session`}
                                                                    className="btn-session-link"
                                                                >
                                                                    <Play size={12} /> Live Session
                                                                </Link>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Past Meetings */}
                        {pastMeetings.length > 0 && (
                            <div className="meetings-section">
                                <h2 className="section-heading">
                                    <span className="section-dot past"></span>
                                    Past Meetings ({pastMeetings.length})
                                </h2>
                                <div className="meeting-cards">
                                    {pastMeetings.map(meeting => {
                                        const date = formatDate(meeting.scheduled_date || meeting.scheduledAt || meeting.date);
                                        const status = getStatusStyle(meeting.status);
                                        return (
                                            <div key={meeting.meeting_id || meeting._id} className="meeting-card-modern past-card">
                                                <div className="meeting-date-block past">
                                                    <span className="meeting-day">{date.day}</span>
                                                    <span className="meeting-month">{date.month}</span>
                                                    <span className="meeting-year">{date.year}</span>
                                                </div>
                                                <div className="meeting-body">
                                                    <div className="meeting-card-top">
                                                        <h3 className="meeting-name past">{meeting.title || "Chama Meeting"}</h3>
                                                        <span className={`meeting-badge ${status.bg} ${status.text}`}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div className="meeting-meta-row">
                                                        <span className="meta-item">
                                                            <Clock size={13} /> {date.time}
                                                        </span>
                                                        <span className="meta-item">
                                                            {getTypeIcon(meeting.type)}
                                                            {meeting.location || "Online"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>
                )}

            </div>
        </div>
    );
};

export default MeetingList;
