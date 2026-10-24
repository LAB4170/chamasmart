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

// Leaving a chama with a refund: ExitController /chamas/{id}/exits
export const exitAPI = {
  list: (chamaId) => api.get(`/chamas/${chamaId}/exits`),
  preview: (chamaId) => api.get(`/chamas/${chamaId}/exits/preview`),
  leave: (chamaId) => api.post(`/chamas/${chamaId}/exits`),
  decide: (chamaId, exitId, decision, note) => api.post(`/chamas/${chamaId}/exits/${exitId}/decision`, { decision, note }),
  pay: (chamaId, exitId, reference) => api.post(`/chamas/${chamaId}/exits/${exitId}/pay`, { reference }),
  cancel: (chamaId, exitId) => api.post(`/chamas/${chamaId}/exits/${exitId}/cancel`),
  statement: (chamaId, exitId) => api.get(`/chamas/${chamaId}/exits/${exitId}/statement`),
};

// Fines: FineController /chamas/{id}/fines
export const fineAPI = {
  list: (chamaId) => api.get(`/chamas/${chamaId}/fines`),
  issue: (chamaId, body) => api.post(`/chamas/${chamaId}/fines`, body),
  waive: (chamaId, fineId, note) => api.post(`/chamas/${chamaId}/fines/${fineId}/waive`, { note }),
};

// Loan cover reserve: LoanCoverController /loans/{id}/cover
export const coverAPI = {
  overview: (chamaId) => api.get(`/loans/${chamaId}/cover`),
  setPercent: (chamaId, coverPercent) => api.put(`/loans/${chamaId}/cover/percent`, { cover_percent: coverPercent }),
  request: (chamaId, body) => api.post(`/loans/${chamaId}/cover/claims`, body),
  decide: (chamaId, claimId, decision, note) => api.post(`/loans/${chamaId}/cover/claims/${claimId}/decision`, { decision, note }),
};

// Payment workflow: PaymentIntentController /chamas/{id}/payments (manual provider only for now)
export const paymentAPI = {
  providers: (chamaId) => api.get(`/chamas/${chamaId}/payments/providers`),
  list: (chamaId) => api.get(`/chamas/${chamaId}/payments`),
  create: (chamaId, body, key) => api.post(`/chamas/${chamaId}/payments`, body, { headers: { "Idempotency-Key": key } }),
  submit: (chamaId, intentId, body) => api.post(`/chamas/${chamaId}/payments/${intentId}/submit`, body),
  cancel: (chamaId, intentId) => api.post(`/chamas/${chamaId}/payments/${intentId}/cancel`),
};
