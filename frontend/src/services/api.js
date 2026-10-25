import api from "./axios";

export { authAPI } from "./auth.service";
export { chamaAPI, memberAPI, inviteAPI, exitAPI, fineAPI, coverAPI, paymentAPI, subscriptionAPI, spendAPI } from "./chama.service";
export { contributionAPI, loanAPI, payoutAPI } from "./finance.service";
export { roscaAPI, ascaAPI, welfareAPI } from "./features.service";
export { userAPI, meetingAPI, sessionAPI, auditAPI, notificationAPI, joinRequestAPI, apiKeyAPI, portfolioAPI } from "./utils.service";
export { chatAPI } from "./chat.service";

export default api;
