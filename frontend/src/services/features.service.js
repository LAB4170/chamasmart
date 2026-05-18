import api from "./axios";

// ROSCA API calls — RoscaController: /rosca/chamas/{id}/cycles
export const roscaAPI = {
    getCycles: (chamaId) => api.get(`/rosca/chamas/${chamaId}/cycles`),
    createCycle: (cycleData) =>
        api.post(`/rosca/chamas/${cycleData.chama_id}/cycles`, cycleData),
    getCycle: (cycleId) => api.get(`/rosca/cycles/${cycleId}`),
    getRoster: (cycleId) => api.get(`/rosca/cycles/${cycleId}/roster`),
    requestSwap: (cycleId, swapData) =>
        api.post(`/rosca/cycles/${cycleId}/swap-request`, swapData),
    getSwapRequests: () => api.get("/rosca/swap-requests"),
    respondToSwap: (requestId, action) =>
        api.put(`/rosca/swap-requests/${requestId}/respond`, { action }),
    processPayout: (cycleId, payoutData) =>
        api.post(`/rosca/cycles/${cycleId}/payout`, payoutData),
    activateCycle: (cycleId) =>
        api.put(`/rosca/cycles/${cycleId}/activate`),
    cancelCycle: (cycleId) =>
        api.put(`/rosca/cycles/${cycleId}/cancel`),
    deleteCycle: (cycleId) => api.delete(`/rosca/cycles/${cycleId}`),
    makeContribution: (chamaId, cycleId, payload) =>
        api.post(`/rosca/chamas/${chamaId}/cycles/${cycleId}/contributions`, payload),
    getContributions: (cycleId) =>
        api.get(`/rosca/cycles/${cycleId}/contributions`),
    getMemberStatement: (cycleId, memberId) =>
        api.get(`/rosca/cycles/${cycleId}/members/${memberId}/statement`),
    getRosterPreview: (chamaId) =>
        api.get(`/rosca/chamas/${chamaId}/roster-preview`),
};

// ASCA API calls — AscaController: /asca/chamas/{id}/cycles
export const ascaAPI = {
    // Matches /asca/chamas/{chamaId}/cycles
    buyShares: (chamaId, payload) =>
        api.post(`/asca/cycles/${payload.cycleId}/shares/purchase`, payload),
    getEquity: (chamaId) => api.get(`/asca/chamas/${chamaId}/cycles`),
    getProposals: (chamaId) => api.get(`/asca/${chamaId}/proposals`),
    createProposal: (chamaId, payload) =>
        api.post(`/asca/${chamaId}/proposals`, payload),
    voteOnProposal: (chamaId, proposalId, choice) =>
        api.post(`/asca/${chamaId}/proposals/${proposalId}/vote`, { choice }),
    getAssets: (chamaId) => api.get(`/asca/${chamaId}/assets`),
    createAsset: (chamaId, payload) =>
        api.post(`/asca/${chamaId}/assets`, payload),
    getReportsSummary: (chamaId, cycleId) =>
        api.get(`/asca/${chamaId}/reports/summary`, { params: { cycleId } }),
    getMemberStatement: (chamaId, cycleId) =>
        api.get(`/asca/${chamaId}/reports/member-statement`, { params: { cycleId } }),
    getMemberStanding: (chamaId) =>
        api.get(`/asca/${chamaId}/reports/standing`),
};

// Welfare API calls — WelfareController: /welfare/chamas/{chamaId}/...
export const welfareAPI = {
    // GET /welfare/chamas/{chamaId}/configs
    getConfig: (chamaId) => api.get(`/welfare/chamas/${chamaId}/configs`),
    updateConfig: (chamaId, config) =>
        api.post(`/welfare/chamas/${chamaId}/configs`, config),
    getFund: (chamaId) => api.get(`/welfare/chamas/${chamaId}/configs`),
    makeContribution: (chamaId, payload) =>
        api.post(`/welfare/chamas/${chamaId}/contributions`, payload),
    // POST /welfare/claims
    submitClaim: (chamaId, claimData) => {
        const formData = new FormData();
        Object.keys(claimData).forEach((key) => {
            if (claimData[key] instanceof Date) {
                formData.append(key, claimData[key].toISOString());
            } else if (claimData[key] !== null && claimData[key] !== undefined) {
                formData.append(key, claimData[key]);
            }
        });
        return api.post(`/welfare/claims`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    // GET /welfare/chamas/{chamaId}/claims
    getChamaClaims: (chamaId) => api.get(`/welfare/chamas/${chamaId}/claims`),
    getMemberClaims: (chamaId, memberId) => {
        return api.get(`/welfare/claims/my`);
    },
    // POST /welfare/claims/{claimId}/approve
    approveClaim: (claimId, decision) =>
        api.post(`/welfare/claims/${claimId}/approve`, decision),
    // Emergency Drives (not yet in Spring Boot — stubs)
    getEmergencyDrives: (chamaId) => api.get(`/welfare/${chamaId}/emergency-drives`),
    createEmergencyDrive: (chamaId, payload) =>
        api.post(`/welfare/${chamaId}/emergency-drives`, payload),
    contributeToEmergencyDrive: (driveId, payload) =>
        api.post(`/welfare/emergency-drives/${driveId}/contribute`, payload),
    // Payout Ledger (stub)
    getPayoutLedger: (chamaId) => api.get(`/welfare/${chamaId}/ledger`),
};
