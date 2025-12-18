import axios from "axios";

const API_URL = "";

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
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: (userData) => api.post("/auth/register", userData),
  login: (credentials) => api.post("/auth/login", credentials),
  getMe: () => api.get("/auth/me"),
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
  getAll: (chamaId, params) => api.get(`/contributions/${chamaId}`, { params }),
  getById: (chamaId, id) => api.get(`/contributions/${chamaId}/${id}`),
  delete: (chamaId, id) => api.delete(`/contributions/${chamaId}/${id}`),
};

// Meeting API calls
export const meetingAPI = {
  create: (chamaId, meetingData) =>
    api.post(`/meetings/${chamaId}/create`, meetingData),
  getAll: (chamaId) => api.get(`/meetings/${chamaId}`),
  getById: (chamaId, id) => api.get(`/meetings/${chamaId}/${id}`),
  update: (chamaId, id, meetingData) =>
    api.put(`/meetings/${chamaId}/${id}`, meetingData),
  recordAttendance: (chamaId, id, attendanceData) =>
    api.post(`/meetings/${chamaId}/${id}/attendance`, attendanceData),
};

export default api;
