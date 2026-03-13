import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { notificationAPI } from "../services/api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";

const NotificationBell = () => {
    const { isAuthenticated, user } = useAuth();
    const { socket } = useSocket();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user) {
            fetchUnreadCount();
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        // Listen for real-time notifications
        if (socket) {
            socket.on("new_notification", (notification) => {
                console.log("New notification received:", notification);
                setUnreadCount((prev) => prev + 1);

                // Add to list if it's already been fetched
                setNotifications((prev) => [notification, ...prev]);
            });

            return () => {
                socket.off("new_notification");
            };
        }
    }, [socket]);

    const fetchUnreadCount = async () => {
        try {
            const response = await notificationAPI.getUnreadCount();
            setUnreadCount(response.data.count);
        } catch (err) {
            // Silently fail - notifications are optional, axios interceptor handles 401s
        }
    };

    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const response = await notificationAPI.getAll(10);
            setNotifications(response.data.data);
        } catch (err) {
            // Silently fail - notifications are optional
        } finally {
            setLoading(false);
        }
    };

    const handleBellClick = () => {
        if (!showDropdown) {
            fetchNotifications();
        }
        setShowDropdown(!showDropdown);
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.is_read) {
            try {
                await notificationAPI.markAsRead(notification.notification_id);
                setUnreadCount((prev) => Math.max(0, prev - 1));
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.notification_id === notification.notification_id
                            ? { ...n, is_read: true }
                            : n
                    )
                );
            } catch (err) {
                console.error("Failed to mark as read:", err);
            }
        }
        setShowDropdown(false);
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationAPI.markAllAsRead();
            setUnreadCount(0);
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch (err) {
            console.error("Failed to mark all as read:", err);
        }
    };

    const formatTimeAgo = (dateString) => {
        const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
        if (seconds < 60) return "just now";
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const getNotificationIcon = (type) => {
        const icons = {
            JOIN_REQUEST: "👋",
            JOIN_APPROVED: "✅",
            JOIN_REJECTED: "❌",
            LOAN_GUARANTEE_REQUEST: "🛡️",
            LOAN_GUARANTEE_REJECTED: "🚫",
        };
        return icons[type] || "🔔";
    };

    return (
        <div style={{ position: "relative" }}>
        <button
            onClick={handleBellClick}
            aria-label="Notifications"
            style={{
                position: "relative",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.5rem",
                color: unreadCount > 0 ? "var(--primary, #4f46e5)" : "var(--text-secondary, #6b7280)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.2s",
            }}
        >
            <Bell
                size={22}
                style={{
                    animation: unreadCount > 0 ? "bell-ring 0.5s ease-in-out" : "none",
                }}
            />
            {unreadCount > 0 && (
                <span
                    style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        backgroundColor: "#ef4444",
                        color: "white",
                        borderRadius: "50%",
                        minWidth: "18px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        padding: "0 3px",
                        boxShadow: "0 0 0 2px var(--card-bg, white)",
                    }}
                >
                    {unreadCount > 9 ? "9+" : unreadCount}
                </span>
            )}
        </button>

            {showDropdown && (
                <>
                    <div
                        style={{
                            position: "fixed",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 999,
                        }}
                        onClick={() => setShowDropdown(false)}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: "100%",
                            right: 0,
                            marginTop: "0.5rem",
                            backgroundColor: "var(--card-bg, white)",
                            border: "1px solid var(--border, #e5e7eb)",
                            borderRadius: "0.75rem",
                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                            width: "370px",
                            maxHeight: "520px",
                            overflowY: "auto",
                            zIndex: 1000,
                        }}
                    >
                        <div
                            style={{
                                padding: "1rem",
                                borderBottom: "1px solid #e5e7eb",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <h3 style={{ margin: 0, fontSize: "1rem" }}>Notifications</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "#3b82f6",
                                        cursor: "pointer",
                                        fontSize: "0.875rem",
                                    }}
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div style={{ padding: "2rem", textAlign: "center" }}>
                                <div className="spinner" style={{ margin: "0 auto" }}></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>
                                No notifications
                            </div>
                        ) : (
                            <div>
                                {notifications.map((notification) => (
                                    <Link
                                        key={notification.notification_id}
                                        to={notification.link || "#"}
                                        onClick={() => handleNotificationClick(notification)}
                                        style={{
                                            display: "block",
                                            padding: "1rem",
                                            borderBottom: "1px solid #e5e7eb",
                                            textDecoration: "none",
                                            color: "inherit",
                                            backgroundColor: notification.is_read ? "white" : "#eff6ff",
                                        }}
                                    >
                                        <div style={{ display: "flex", gap: "0.75rem" }}>
                                            <div style={{ fontSize: "1.5rem" }}>
                                                {getNotificationIcon(notification.type)}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div
                                                    style={{
                                                        fontWeight: notification.is_read ? "normal" : "bold",
                                                        marginBottom: "0.25rem",
                                                    }}
                                                >
                                                    {notification.title}
                                                </div>
                                                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                                                    {notification.message}
                                                </div>
                                                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                                                    {formatTimeAgo(notification.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;
