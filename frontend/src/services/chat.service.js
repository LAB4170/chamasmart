import api from "./axios";

export const chatAPI = {
  getChannels: (chamaId) => api.get(`/chat/chamas/${chamaId}/channels`),
  getMessages: (channelId, page = 1, limit = 50) => 
    api.get(`/chat/channels/${channelId}/messages?page=${page}&limit=${limit}`),
  sendMessage: (channelId, data) => 
    api.post(`/chat/channels/${channelId}/messages`, data)
};
