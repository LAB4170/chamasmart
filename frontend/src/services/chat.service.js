import api from "./axios";

export const chatAPI = {
  getChannels: (chamaId) => api.get(`/api/chat/chamas/${chamaId}/channels`),
  getMessages: (channelId, page = 1, limit = 50) => 
    api.get(`/api/chat/channels/${channelId}/messages?page=${page}&limit=${limit}`),
  sendMessage: (channelId, data) => 
    api.post(`/api/chat/channels/${channelId}/messages`, data)
};
