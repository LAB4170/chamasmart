import api from "./axios";

export const trustScoreAPI = {
    getMemberScore: (memberId) => api.get(`/trust/member/${memberId}`).then(res => res.data),
};
