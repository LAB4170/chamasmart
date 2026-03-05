import api from "./axios";

// Contribution API calls
export const contributionAPI = {
    record: (chamaId, contributionData) =>
        api.post(`/contributions/${chamaId}/record`, contributionData),
    bulkRecord: (chamaId, bulkData) =>
        api.post(`/contributions/${chamaId}/bulk-record`, bulkData),
    initiateMpesaPayment: (paymentData) =>
        api.post('/payments/mpesa/stk-push', paymentData),
    delete: (chamaId, id) => api.delete(`/contributions/${chamaId}/${id}`),
    getAll: (chamaId, params) => api.get(`/contributions/${chamaId}`, { params }),
};

// Loan API calls
export const loanAPI = {
    apply: (chamaId, loanData) => api.post(`/loans/${chamaId}/apply`, loanData),
    getUserLoans: () => api.get("/loans/my-loans"),
    getChamaLoans: (chamaId) => api.get(`/loans/${chamaId}`),
    getLoanById: (chamaId, loanId) => api.get(`/loans/${chamaId}/${loanId}`),
    approve: (chamaId, loanId) =>
        api.put(`/loans/${chamaId}/${loanId}/approve`),
    reject: (chamaId, loanId, reason) =>
        api.put(`/loans/${chamaId}/${loanId}/reject`, { reason }),
    repay: (chamaId, loanId, repaymentData) =>
        api.post(`/loans/${chamaId}/${loanId}/repay`, repaymentData),
    getMyGuarantees: (params) => api.get("/loans/my-guarantees", { params }),
    respondGuarantor: (loanId, decision) =>
        api.post(`/loans/${loanId}/guarantee/respond`, { decision }),
    getChamaAnalytics: (chamaId) => 
        api.get(`/loans/${chamaId}/reports/analytics`),
    getAnalytics: (chamaId) => 
        api.get(`/loans/${chamaId}/reports/analytics`),
    getConfig: (chamaId) =>
        api.get(`/loans/${chamaId}/config`),
    updateConfig: (chamaId, config) =>
        api.put(`/loans/${chamaId}/config`, config),
};

// Payout API calls
export const payoutAPI = {
    getEligible: (chamaId) => api.get(`/payouts/${chamaId}/eligible`),
    process: (chamaId, payoutData) =>
        api.post(`/payouts/${chamaId}/process`, payoutData),
    getAll: (chamaId) => api.get(`/payouts/${chamaId}`),
};
