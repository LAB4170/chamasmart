import api from "./axios";

// ROSCA API calls
export const roscaAPI = {
    getCycles: (chamaId) => api.get(`/rosca/chama/${chamaId}/cycles`),
    createCycle: (cycleData) =>
        api.post(`/rosca/chama/${cycleData.chama_id}/cycles`, cycleData),
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
        api.post(`/rosca/chama/${chamaId}/cycles/${cycleId}/contributions`, payload),
    getContributions: (cycleId) =>
        api.get(`/rosca/cycles/${cycleId}/contributions`),
    getMemberStatement: (cycleId, memberId) =>
        api.get(`/rosca/cycles/${cycleId}/members/${memberId}/statement`),
    getRosterPreview: (chamaId) =>
        api.get(`/rosca/chama/${chamaId}/roster-preview`),
};

// ASCA API calls
export const ascaAPI = {
    buyShares: (chamaId, payload) =>
        api.post(`/asca/${chamaId}/buy-shares`, payload),
    getEquity: (chamaId) => api.get(`/asca/${chamaId}/equity`),
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

// Welfare API calls
export const welfareAPI = {
    getConfig: (chamaId) => api.get(`/welfare/${chamaId}/config`),
    updateConfig: (chamaId, config) =>
        api.put(`/welfare/${chamaId}/config`, config),
    getFund: (chamaId) => api.get(`/welfare/${chamaId}/fund`),
    makeContribution: (chamaId, payload) =>
        api.post(`/welfare/${chamaId}/contributions`, payload),
    submitClaim: (chamaId, claimData) => {
        const formData = new FormData();
        Object.keys(claimData).forEach((key) => {
            if (claimData[key] instanceof Date) {
                formData.append(key, claimData[key].toISOString());
            } else if (claimData[key] !== null && claimData[key] !== undefined) {
                formData.append(key, claimData[key]);
            }
        });
        return api.post(`/welfare/${chamaId}/claims`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
    getChamaClaims: (chamaId) => api.get(`/welfare/${chamaId}/claims`),
    getMemberClaims: (chamaId, memberId) => {
        const id = memberId || JSON.parse(localStorage.getItem('user'))?.user_id;
        return api.get(`/welfare/${chamaId}/members/${id}/claims`);
    },
    approveClaim: (claimId, decision) =>
        api.post(`/welfare/claims/${claimId}/approve`, decision),
    // Emergency Drives
    getEmergencyDrives: (chamaId) => api.get(`/welfare/${chamaId}/emergency-drives`),
    createEmergencyDrive: (chamaId, payload) =>
        api.post(`/welfare/${chamaId}/emergency-drives`, payload),
    contributeToEmergencyDrive: (driveId, payload) =>
        api.post(`/welfare/emergency-drives/${driveId}/contribute`, payload),
        
    // Payout Ledger (Phase 23 Transparency)
    getPayoutLedger: (chamaId) => api.get(`/welfare/${chamaId}/ledger`),
};

