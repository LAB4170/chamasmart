import api from "./axios";

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
  add: (chamaId, memberData) => api.post(`/chamas/${chamaId}/members`, memberData),
  updateRole: (chamaId, userId, roleData) =>
    api.put(`/chamas/${chamaId}/members/${userId}/role`, roleData),
  remove: (chamaId, userId) =>
    api.delete(`/chamas/${chamaId}/members/${userId}`),
  getContributions: (chamaId, userId) =>
    api.get(`/contributions/${chamaId}`, { params: { userId } }),
};

// Invite API calls
export const inviteAPI = {
  generate: (chamaId, inviteData) =>
    api.post(`/chamas/${chamaId}/invites`, inviteData),
  join: (inviteCode) => api.post("/invites/join", { inviteCode }),
  getAll: (chamaId) => api.get(`/chamas/${chamaId}/invites`),
  deactivate: (inviteId) => api.delete(`/invites/${inviteId}`),
  send: (chamaId, email) => api.post(`/chamas/${chamaId}/invites/send`, { email }),
};
