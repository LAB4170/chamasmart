import api from "./axios";

// User API calls — Spring Boot needs a UserController; these are stubs that won't 403
export const userAPI = {
    getProfile: () => api.get("/users/profile"),
    updateProfile: (userData) => api.put("/users/profile", userData),
    changePassword: (passwordData) => api.post("/users/change-password", passwordData),
    exportMyData: () => api.get("/users/me/export"),
    deleteAccount: () => api.delete("/users/account"),
    search: (query) => api.get("/users/search", { params: { query } }),
    uploadProfilePicture: (formData) => api.post("/users/profile-picture", formData, { headers: { "Content-Type": "multipart/form-data" } })
};

// Meeting API calls — GovernanceController: /governance/chamas/{chamaId}/meetings
export const meetingAPI = {
    create: (chamaId, meetingData) =>
        api.post(`/governance/chamas/${chamaId}/meetings`, meetingData),
    getAll: (chamaId) => api.get(`/governance/chamas/${chamaId}/meetings`),
    getById: (chamaId, id) => api.get(`/governance/chamas/${chamaId}/meetings/${id}`),
    update: (chamaId, id, meetingData) =>
        api.put(`/governance/chamas/${chamaId}/meetings/${id}`, meetingData),
    recordAttendance: (chamaId, id, attendanceData) =>
        api.post(`/governance/chamas/${chamaId}/meetings/${id}/attendance`, attendanceData),
    publishMinutes: (chamaId, id) =>
        api.post(`/governance/chamas/${chamaId}/meetings/${id}/publish`),
    delete: (chamaId, id) =>
        api.delete(`/governance/chamas/${chamaId}/meetings/${id}`),
};

// Audit API calls (not yet in Spring Boot — return silently)
export const auditAPI = {
    getUserLogs: (userId, params) =>
        api.get(`/audit/users/${userId}`, { params }),
    getChamaLogs: (chamaId, params) =>
        api.get(`/audit/chamas/${chamaId}`, { params }),
    getSecurityLogs: (params) => api.get("/audit/security", { params }),
    getChamaSummary: (chamaId) => api.get(`/audit/chamas/${chamaId}/summary`),
    exportChamaLogs: (chamaId, format = "csv", extra = {}) =>
        api.get(`/audit/chamas/${chamaId}/export`, {
            params: { ...extra, format },
            responseType: "blob",
        }),
};

// Notification API calls — NotificationController: /notifications
export const notificationAPI = {
    getAll: (limit) => api.get("/notifications", { params: { limit } }),
    getUnreadCount: () => api.get("/notifications/unread-count"),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put("/notifications/read-all"),
};

// Join Request API calls — GovernanceController: /governance/chamas/{id}/join-requests
export const joinRequestAPI = {
    request: (chamaId, message) =>
        api.post(`/governance/chamas/${chamaId}/join-requests`, { message }),
    getAll: (chamaId) => api.get(`/governance/chamas/${chamaId}/join-requests`),
    respond: (requestId, status, comments = "") =>
        api.post(`/governance/join-requests/${requestId}/review`, { decision: status, comments }),
    getMyRequests: () => api.get("/governance/join-requests/my"),
};

// API Key Management calls (not in Spring Boot yet — stubs)
export const apiKeyAPI = {
    create: (keyData) => api.post("/api-keys", keyData),
    list: () => api.get("/api-keys"),
    revoke: (keyId) => api.post(`/api-keys/${keyId}/revoke`),
    delete: (keyId) => api.delete(`/api-keys/${keyId}`),
    rotate: (keyId) => api.post(`/api-keys/${keyId}/rotate`),
};

// Session Management calls (not in Spring Boot yet — stubs)
export const sessionAPI = {
    open: (chamaId, meetingId, openingCash) =>
        api.post(`/sessions/${chamaId}/${meetingId}/open`, { openingCash }),
    getData: (chamaId, meetingId) =>
        api.get(`/sessions/${chamaId}/${meetingId}/data`),
    close: (chamaId, meetingId, physical_cash_count, discrepancy_note) =>
        api.post(`/sessions/${chamaId}/${meetingId}/close`, { physical_cash_count, discrepancy_note }),
    addLivePenalty: (chamaId, meetingId, penaltyData) =>
        api.post(`/sessions/${chamaId}/${meetingId}/penalties`, penaltyData),
    getPenalties: (chamaId, meetingId) =>
        api.get(`/sessions/${chamaId}/${meetingId}/penalties`),
};

// Score / Credit Bureau API calls (stubs)
export const scoreAPI = {
    getScore: (chamaId) => api.get(`/chamas/${chamaId}/score`),
    getHistory: (chamaId) => api.get(`/chamas/${chamaId}/score/history`),
    getAlerts: (chamaId) => api.get(`/chamas/${chamaId}/health-alerts`),
};

// Every chama the signed-in person runs, together: PortfolioController /portfolio
export const portfolioAPI = {
  page: (params) => api.get("/portfolio", { params }),
  exportCsv: () => api.get("/portfolio/export.csv", { responseType: "blob" }),
};

// Platform operator console: AdminController /admin (administrators with two-factor sign-in only)
export const adminAPI = {
  overview: () => api.get("/admin/overview"),
  queue: (status) => api.get("/admin/verifications", { params: { status } }),
  detail: (chamaId) => api.get(`/admin/verifications/${chamaId}`),
  setCheck: (chamaId, item, passed, note) => api.post(`/admin/verifications/${chamaId}/checks`, { item, passed, note }),
  requestChanges: (chamaId, note) => api.post(`/admin/verifications/${chamaId}/request-changes`, { note }),
  reject: (chamaId, note) => api.post(`/admin/verifications/${chamaId}/reject`, { note }),
  approve: (chamaId, note) => api.post(`/admin/verifications/${chamaId}/approve`, { note }),
  delist: (chamaId, note) => api.post(`/admin/verifications/${chamaId}/delist`, { note }),
  cases: () => api.get("/admin/cases"),
  openCase: (chamaId, level, reason, urgent) => api.post(`/admin/chamas/${chamaId}/cases`, { level, reason, urgent }),
  resolveCase: (caseId, note) => api.post(`/admin/cases/${caseId}/resolve`, { note }),
  agreements: () => api.get("/admin/agreements"),
  agreement: (id) => api.get(`/admin/agreements/${id}`),
  publishAgreement: (id, counsel) => api.post(`/admin/agreements/${id}/publish`, { counsel }),
  audit: (limit = 100) => api.get("/admin/audit", { params: { limit } }),
  unrouted: () => api.get("/admin/payments/held"),
};

// A chama's side of the public-listing review: ListingController
export const listingAPI = {
  agreements: () => api.get("/agreements/current"),
  accept: (chamaId, agreementId) => api.post(`/chamas/${chamaId}/agreements/${agreementId}/accept`),
  status: (chamaId) => api.get(`/chamas/${chamaId}/listing`),
  apply: (chamaId, body) => api.post(`/chamas/${chamaId}/listing/apply`, body),
  notices: (chamaId) => api.get(`/chamas/${chamaId}/notices`),
  respond: (chamaId, caseId, text) => api.post(`/chamas/${chamaId}/notices/${caseId}/respond`, { text }),
};
