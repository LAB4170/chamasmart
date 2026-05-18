import api from "./axios";

// Chama API calls
export const chamaAPI = {
  getAll: () => api.get("/chamas"),
  getById: (id) => api.get(`/chamas/${id}`),
  create: (chamaData) => api.post("/chamas", chamaData),
  update: (id, chamaData) => api.put(`/chamas/${id}`, chamaData),
  delete: (id) => api.delete(`/chamas/${id}`),
  // Matches @GetMapping({"/my", "/user/my-chamas"}) in ChamaController
  getMyChamas: () => api.get("/chamas/user/my-chamas"),
  // Meetings are under GovernanceController -> /governance/chamas/{id}/meetings
  getMembers: (id) => api.get(`/chamas/${id}/members`),
  getStats: (id) => api.get(`/chamas/${id}/stats`),
  getPublicChamas: (params) => api.get("/chamas/public", { params }),
  cancelDelete: (id) => api.post(`/chamas/${id}/cancel-delete`),
  analyzeReliability: (id) => api.post(`/chamas/${id}/analyze-reliability`),
};

// Member API calls — managed via ChamaController or GovernanceController
export const memberAPI = {
  add: (chamaId, memberData) => api.post(`/chamas/${chamaId}/members/add`, memberData),
  updateRole: (chamaId, userId, roleData) =>
    api.put(`/chamas/${chamaId}/members/${userId}/role`, roleData),
  remove: (chamaId, userId) =>
    api.delete(`/chamas/${chamaId}/members/${userId}`),
  getContributions: (chamaId, userId) =>
    api.get(`/contributions/${chamaId}`, { params: { userId } }),
};

// Invite API calls — GovernanceController: /governance/chamas/{id}/invites
export const inviteAPI = {
  generate: (chamaId, inviteData) =>
    api.post(`/governance/chamas/${chamaId}/invites`, inviteData),
  // Accept invite by code: /governance/invites/{code}/accept
  join: (inviteCode) => api.post(`/governance/invites/${inviteCode}/accept`),
  getAll: (chamaId) => api.get(`/governance/chamas/${chamaId}/invites`),
  deactivate: (inviteId) => api.delete(`/governance/invites/${inviteId}`),
  send: (chamaId, email, role = "MEMBER") =>
    api.post(`/governance/chamas/${chamaId}/invites`, { email, role }),
};
