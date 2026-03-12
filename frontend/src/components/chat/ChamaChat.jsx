import { useState, useEffect, useRef } from "react";
import { Send, Image as ImageIcon, Video, Paperclip, Loader2 } from "lucide-react";
import { chatAPI } from "../../services/api";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import { uploadMediaToFirebase } from "../../services/firebaseStorage";
import { getImageUrl } from "../../utils/imageUtils";
import "./ChamaChat.css";

export default function ChamaChat({ chamaId }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [channelId, setChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadChannelAndMessages = async () => {
      try {
        const chanRes = await chatAPI.getChannels(chamaId);
        if (chanRes.data?.data?.length > 0) {
          const defaultChannel = chanRes.data.data[0].channel_id;
          if (!mounted) return;
          setChannelId(defaultChannel);

          const msgRes = await chatAPI.getMessages(defaultChannel);
          setMessages(msgRes.data?.data || []);

          if (socket) {
            socket.emit("join_chat_channel", defaultChannel);
          }
        }
      } catch (err) {
        console.error("Chat initialization error:", err);
      }
    };
    loadChannelAndMessages();

    return () => {
      mounted = false;
      if (socket && channelId) {
        socket.emit("leave_chat_channel", channelId);
      }
    };
  }, [chamaId, socket]);

  useEffect(() => {
    if (!socket || !channelId) return;

    const handleNewMessage = (msg) => {
      // Ensure we don't duplicate
      setMessages((prev) => {
        if (prev.find((m) => m.message_id === msg.message_id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 100);
    };

    socket.on("new_message", handleNewMessage);
    return () => socket.off("new_message", handleNewMessage);
  }, [socket, channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e, mediaOptions = null) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !mediaOptions) return;

    try {
      const payload = mediaOptions || {
        messageType: 'text',
        content: inputText.trim(),
        mediaUrl: null
      };

      await chatAPI.sendMessage(channelId, payload);
      
      if (!mediaOptions) {
        setInputText("");
      }
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reject files over 20MB directly
    if (file.size > 20 * 1024 * 1024) {
      alert("File too large. Maximum size is 20MB.");
      return;
    }

    setIsUploading(true);
    try {
      const isVideo = file.type.startsWith("video/");
      const type = isVideo ? 'video' : 'image';
      
      const downloadUrl = await uploadMediaToFirebase(file);
      await handleSendMessage(null, {
        messageType: type,
        content: null,
        mediaUrl: downloadUrl
      });
    } catch (err) {
      alert("Media upload failed.");
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Helper date formatter
  const formatTime = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!channelId) {
    return <div className="chat-loading"><Loader2 className="spinner" /> Loading group chat...</div>;
  }

  return (
    <div className="chama-chat-container">
      <div className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p>Ready to start the conversation! Say hello.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.user_id === user?.user_id;
            const isSystem = msg.user_id === null || msg.message_type === "system";

            if (isSystem) {
              return (
                <div key={msg.message_id || index} className="chat-system-message">
                  {msg.content}
                </div>
              );
            }

            return (
              <div key={msg.message_id || index} className={`chat-bubble-wrapper ${isMe ? 'message-mine' : 'message-theirs'}`}>
                {!isMe && (
                  <div className="chat-avatar">
                   {getImageUrl(msg.profile_picture_url) ? (
                      <img src={getImageUrl(msg.profile_picture_url)} alt={`${msg.first_name}`} />
                   ) : (
                      <div className="chat-avatar-placeholder" title={`${msg.first_name || ''} ${msg.last_name || ''}`}>
                        {((msg.first_name?.[0] || '') + (msg.last_name?.[0] || '')).toUpperCase() || '?'}
                      </div>
                   )}
                  </div>
                )}
                <div className={`chat-bubble ${isMe ? 'bubble-mine' : 'bubble-theirs'}`}>
                  {!isMe && <div className="chat-sender-name">{msg.first_name} {msg.last_name}</div>}
                  
                  {msg.message_type === 'image' && msg.media_url && (
                    <img src={getImageUrl(msg.media_url)} alt="Shared image" className="chat-media-image" />
                  )}
                  {msg.message_type === 'video' && msg.media_url && (
                    <video src={msg.media_url} controls className="chat-media-video" />
                  )}
                  {msg.content && <div className="chat-text">{msg.content}</div>}
                  
                  <div className="chat-timestamp">{formatTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={handleSendMessage}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,video/*"
          onChange={handleFileUpload}
        />
        <button 
          type="button" 
          className="chat-attach-btn" 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Attach Image/Video"
        >
          {isUploading ? <Loader2 size={20} className="spinner" /> : <Paperclip size={20} />}
        </button>

        <input
          type="text"
          className="chat-text-input"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isUploading}
        />

        <button 
          type="submit" 
          className="chat-send-btn" 
          disabled={!inputText.trim() || isUploading}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
