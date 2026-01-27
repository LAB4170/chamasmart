import axios from "axios";

const API_URL = "/api";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only handle 401 Unauthorized errors (not 404, etc.)
    if (error.response?.status === 401) {
      // Only clear and redirect if we're not already on the login/register page
      if (
        window.location.pathname !== "/login" &&
        window.location.pathname !== "/register"
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.replace("/login");
      }
    }
    // For 404 errors, just return the error without redirecting
    return Promise.reject(error);
  },
);

// Auth API calls
export const authAPI = {
  // Start the signup process (step 1)
  register: (userData) =>
    api.post("/auth/register", {
      email: userData.email,
      phoneNumber: userData.phoneNumber,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: userData.password,
    }),

  // Login
  login: (credentials) =>
    api.post("/auth/login", {
      email: credentials.email,
      password: credentials.password,
    }),
};

// Chama API calls
export const chamaAPI = {
  getAll: () => api.get("/chamas"),
  getById: (id) => api.get(`/chamas/${id}`),
  create: (chamaData) => api.post("/chamas", chamaData),
  update: (id, chamaData) => api.put(`/chamas/${id}`, chamaData),
  delete: (id) => api.delete(`/chamas/${id}`),
  getMyChamas: () => api.get("/chamas/user/my-chamas"),
  getMembers: (id) => api.get(`/chamas/${id}/members`),
  getStats: (id) => api.get(`/chamas/${id}/stats`),
  getPublicChamas: (params) => api.get("/chamas/public", { params }),
};

// Member API calls
export const memberAPI = {
  add: (chamaId, memberData) => api.post(`/members/${chamaId}/add`, memberData),
  updateRole: (chamaId, userId, roleData) =>
    api.put(`/members/${chamaId}/role/${userId}`, roleData),
  remove: (chamaId, userId) =>
    api.delete(`/members/${chamaId}/remove/${userId}`),
  getContributions: (chamaId, userId) =>
    api.get(`/members/${chamaId}/contributions/${userId}`),
};

// Contribution API calls
export const contributionAPI = {
  record: (chamaId, contributionData) =>
    api.post(`/contributions/${chamaId}/record`, contributionData),
  delete: (chamaId, id) => api.delete(`/contributions/${chamaId}/${id}`),
};

// Meeting API calls
export const meetingAPI = {
  create: (chamaId, meetingData) =>
    api.post(`/meetings/${chamaId}`, meetingData),
  getAll: (chamaId) => api.get(`/meetings/${chamaId}`),
  getById: (chamaId, id) => api.get(`/meetings/${chamaId}/${id}`),
};

// Invite API calls
export const inviteAPI = {
  generate: (chamaId, inviteData) =>
    api.post(`/invites/${chamaId}/generate`, inviteData),
  join: (inviteCode) => api.post("/invites/join", { inviteCode }),
  getAll: (chamaId) => api.get(`/invites/${chamaId}`),
  deactivate: (inviteId) => api.delete(`/invites/${inviteId}`),
  send: (chamaId, email) => api.post(`/invites/${chamaId}/send`, { email }),
};

// Loan API calls
export const loanAPI = {
  // Only apply endpoint exists in backend
  apply: (chamaId, loanData) => api.post(`/loans/${chamaId}/apply`, loanData),
};

// Payout API calls
export const payoutAPI = {
  getEligible: (chamaId) => api.get(`/payouts/${chamaId}/eligible`),
  process: (chamaId, payoutData) =>
    api.post(`/payouts/${chamaId}/process`, payoutData),
  getAll: (chamaId) => api.get(`/payouts/${chamaId}`),
};

// Join Request API calls
export const joinRequestAPI = {
  request: (chamaId, message) =>
    api.post(`/join-requests/${chamaId}/request`, { message }),
  getAll: (chamaId) => api.get(`/join-requests/${chamaId}`),
  respond: (requestId, status) =>
    api.put(`/join-requests/${requestId}/respond`, { status }),
  getMyRequests: () => api.get("/join-requests/my"),
};

// Notification API calls
export const notificationAPI = {
  getAll: (limit) => api.get("/notifications", { params: { limit } }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put("/notifications/read-all"),
};

// ROSCA API calls
export const roscaAPI = {
  getCycles: (chamaId) => api.get(`/rosca/chama/${chamaId}/cycles`),
  createCycle: (cycleData) =>
    api.post(`/rosca/chama/${cycleData.chama_id}/cycles`, cycleData),
  getRoster: (cycleId) => api.get(`/rosca/cycles/${cycleId}/roster`),
  requestSwap: (cycleId, swapData) =>
    api.post(`/rosca/cycles/${cycleId}/swap-request`, swapData),
  getSwapRequests: () => api.get("/rosca/swap-requests"),
  respondToSwap: (requestId, action) =>
    api.put(`/rosca/swap-requests/${requestId}/respond`, { action }),
  processPayout: (cycleId, payoutData) =>
    api.post(`/rosca/cycles/${cycleId}/payout`, payoutData),
  deleteCycle: (cycleId) => api.delete(`/rosca/cycles/${cycleId}`),
};

// ASCA API calls
export const ascaAPI = {
  buyShares: (chamaId, payload) =>
    api.post(`/asca/${chamaId}/buy-shares`, payload),
  getEquity: (chamaId) => api.get(`/asca/${chamaId}/equity`),
  getProposals: (chamaId) => api.get(`/asca/${chamaId}/proposals`),
  createProposal: (chamaId, payload) =>
    api.post(`/asca/${chamaId}/proposals`, payload),
  voteOnProposal: (proposalId, choice) =>
    api.post(`/asca/proposals/${proposalId}/vote`, { choice }),
  getAssets: (chamaId) => api.get(`/asca/${chamaId}/assets`),
  createAsset: (chamaId, payload) =>
    api.post(`/asca/${chamaId}/assets`, payload),
};

// User API calls
export const userAPI = {
  search: (query) => api.get("/users/search", { params: { query } }),
};

export default api;
