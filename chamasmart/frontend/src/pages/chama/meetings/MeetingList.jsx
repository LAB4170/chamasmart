import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { meetingAPI } from "../../../services/api";
import { toast } from "react-toastify";
import "./Meetings.css";

const MeetingList = () => {
    const { id } = useParams();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchMeetings = async () => {
            try {
                const res = await meetingAPI.getAll(id);
                if (isMounted) {
                    setMeetings(res.data.data || res.data);
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

        fetchMeetings();

        return () => {
            isMounted = false;
        };
    }, [id]);

    const getStatusClass = (status) => {
        switch (status.toLowerCase()) {
            case 'completed': return 'status-completed';
            case 'cancelled': return 'status-cancelled';
            default: return 'status-scheduled';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return {
            day: date.getDate(),
            month: date.toLocaleString('default', { month: 'short' }),
            full: date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    };

    if (loading) return <div className="loading-spinner">Loading meetings...</div>;

    return (
        <div className="page meetings-page">
            <div className="container">
                <div className="page-header">
                    <div>
                        <h1>Meetings</h1>
                        <p className="subtitle">Schedule and manage chama meetings</p>
                    </div>
                    <Link to={`/chamas/${id}/meetings/create`} className="btn btn-primary">
                        + Schedule Meeting
                    </Link>
                </div>

                {meetings.length === 0 ? (
                    <div className="empty-state">
                        <p>No meetings scheduled yet.</p>
                    </div>
                ) : (
                    <div className="meeting-list">
                        {meetings.map(meeting => {
                            const date = formatDate(meeting.date);
                            return (
                                <Link to={`/chamas/${id}/meetings/${meeting._id}`} key={meeting._id} className="meeting-card">
                                    <div className="d-flex align-items-center">
                                        <div className="meeting-date">
                                            <span className="day">{date.day}</span>
                                            <span className="month">{date.month}</span>
                                        </div>
                                        <div className="meeting-info">
                                            <h3>{meeting.title || "Chama Meeting"}</h3>
                                            <div className="meeting-meta">
                                                <span>📍 {meeting.location || "Online"}</span>
                                                <span>🕒 {date.full}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`meeting-status ${getStatusClass(meeting.status)}`}>
                                        {meeting.status}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MeetingList;
