import api from "./axios";

export { authAPI } from "./auth.service";
export { chamaAPI, memberAPI, inviteAPI } from "./chama.service";
export { contributionAPI, loanAPI, payoutAPI } from "./finance.service";
export { roscaAPI, ascaAPI, welfareAPI } from "./features.service";
export { userAPI, meetingAPI, auditAPI, notificationAPI, joinRequestAPI, apiKeyAPI } from "./utils.service";

export default api;
