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
  add: (chamaId, memberData) => api.post(`/members/${chamaId}/add`, memberData),
  updateRole: (chamaId, userId, roleData) =>
    api.put(`/members/${chamaId}/role/${userId}`, roleData),
  remove: (chamaId, userId) =>
    api.delete(`/members/${chamaId}/remove/${userId}`),
  getContributions: (chamaId, userId) =>
    api.get(`/members/${chamaId}/contributions/${userId}`),
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
