import api from "./axios";

// User API calls
export const userAPI = {
    getProfile: () => api.get("/users/profile"),
    updateProfile: (userData) => api.put("/users/profile", userData),
    changePassword: (passwordData) => api.put("/users/change-password", passwordData),
    deleteAccount: () => api.delete("/users/account"),
    search: (query) => api.get("/users/search", { params: { query } }),
};

// Meeting API calls
export const meetingAPI = {
    create: (chamaId, meetingData) => api.post(`/meetings/${chamaId}`, meetingData),
    getAll: (chamaId) => api.get(`/meetings/${chamaId}`),
    getById: (chamaId, id) => api.get(`/meetings/${chamaId}/${id}`),
    update: (chamaId, id, meetingData) => api.put(`/meetings/${chamaId}/${id}`, meetingData),
    recordAttendance: (chamaId, id, attendanceData) => api.post(`/meetings/${chamaId}/${id}/attendance`, attendanceData),
};

// Audit API calls
export const auditAPI = {
    getUserLogs: (userId, params) =>
        api.get(`/audit/users/${userId}`, { params }),
    getChamaLogs: (chamaId, params) =>
        api.get(`/audit/chamas/${chamaId}`, { params }),
    getSecurityLogs: (params) => api.get("/audit/security", { params }),
    getChamaSummary: (chamaId) => api.get(`/audit/chamas/${chamaId}/summary`),
    exportChamaLogs: (chamaId, format = "csv") =>
        api.get(`/audit/chamas/${chamaId}/export`, {
            params: { format },
            responseType: "blob",
        }),
};

// Notification API calls
export const notificationAPI = {
    getAll: (limit) => api.get("/notifications", { params: { limit } }),
    getUnreadCount: () => api.get("/notifications/unread-count"),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put("/notifications/read-all"),
};

// Join Request API calls
export const joinRequestAPI = {
    request: (chamaId, message) =>
        api.post(`/chamas/${chamaId}/join-requests`, { message }),
    getAll: (chamaId) => api.get(`/chamas/${chamaId}/join-requests`),
    respond: (requestId, status) =>
        api.put(`/join-requests/${requestId}`, { status }),
    getMyRequests: () => api.get("/join-requests/my"),
};

// API Key Management calls
export const apiKeyAPI = {
    create: (keyData) => api.post("/api-keys", keyData),
    list: () => api.get("/api-keys"),
    revoke: (keyId) => api.post(`/api-keys/${keyId}/revoke`),
    delete: (keyId) => api.delete(`/api-keys/${keyId}`),
    rotate: (keyId) => api.post(`/api-keys/${keyId}/rotate`),
};
