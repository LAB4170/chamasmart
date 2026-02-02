import api from "./axios";

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

// Welfare API calls
export const welfareAPI = {
    getConfig: (chamaId) => api.get(`/welfare/${chamaId}/config`),
    updateConfig: (chamaId, config) =>
        api.put(`/welfare/${chamaId}/config`, config),
    getFund: (chamaId) => api.get(`/welfare/${chamaId}/fund`),
    submitClaim: (chamaId, claimData) => {
        const formData = new FormData();
        Object.keys(claimData).forEach((key) => {
            formData.append(key, claimData[key]);
        });
        return api.post(`/welfare/${chamaId}/claims`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    getChamaClaims: (chamaId) => api.get(`/welfare/${chamaId}/claims`),
    getMemberClaims: (chamaId, memberId) =>
        api.get(`/welfare/${chamaId}/members/${memberId}/claims`),
    approveClaim: (claimId, decision) =>
        api.post(`/welfare/claims/${claimId}/approve`, decision),
};
