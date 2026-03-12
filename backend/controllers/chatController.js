const pool = require("../config/db");
const logger = require("../utils/logger");
const { getIo } = require("../socket");
const { handleIncomingSupportMessage } = require("../services/aiSupportService");

// Get all channels for a specific chama
const getChannels = async (req, res) => {
  try {
    const { chamaId } = req.params;
    
    // Auto-create a default 'General' group channel if none exists
    const existing = await pool.query(
      "SELECT * FROM chat_channels WHERE chama_id = $1 ORDER BY created_at ASC",
      [chamaId]
    );

    let channels = existing.rows;

    if (channels.length === 0) {
      const newChannel = await pool.query(
        "INSERT INTO chat_channels (chama_id, name, type) VALUES ($1, 'General', 'group') RETURNING *",
        [chamaId]
      );
      channels = [newChannel.rows[0]];
    }

    res.status(200).json({ success: true, data: channels });
  } catch (error) {
    logger.error("Error fetching chat channels", { error: error.message });
    res.status(500).json({ success: false, message: "Error fetching channels", error: error.message });
  }
};

// Get messages for a channel
const getMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const messages = await pool.query(
      `SELECT m.*, u.first_name, u.last_name, u.profile_picture_url 
       FROM chat_messages m 
       LEFT JOIN users u ON m.user_id = u.user_id 
       WHERE m.channel_id = $1 AND m.is_deleted = FALSE 
       ORDER BY m.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [channelId, limit, offset]
    );

    // Return in chronological order for UI
    res.status(200).json({ success: true, data: messages.rows.reverse() });
  } catch (error) {
    logger.error("Error fetching messages", { error: error.message });
    res.status(500).json({ success: false, message: "Error fetching messages", error: error.message });
  }
};

// Send a message via REST
const sendMessage = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { messageType, content, mediaUrl } = req.body;
    const userId = req.user.user_id;

    if (!['text', 'image', 'video', 'system'].includes(messageType)) {
      return res.status(400).json({ success: false, message: "Invalid message type" });
    }

    const newMessage = await pool.query(
      `INSERT INTO chat_messages (channel_id, user_id, message_type, content, media_url) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [channelId, userId, messageType, content, mediaUrl]
    );

    // Fetch user details to broadcast
    const userRes = await pool.query("SELECT first_name, last_name, profile_picture_url FROM users WHERE user_id = $1", [userId]);
    const userData = userRes.rows[0];

    const broadcastData = {
      ...newMessage.rows[0],
      first_name: userData?.first_name,
      last_name: userData?.last_name,
      profile_picture_url: userData?.profile_picture_url
    };

    // Emit to socket room
    getIo().to(`chat_${channelId}`).emit('new_message', broadcastData);

    res.status(201).json({ success: true, data: broadcastData });
  } catch (error) {
    logger.error("Error sending message", { error: error.message });
    res.status(500).json({ success: false, message: "Error sending message", error: error.message });
  }
};

// Dedicated endpoint for the global floating AI Support widget
const aiSupportChat = async (req, res) => {
  try {
    const { message, history } = req.body;
    const userId = req.user.user_id;

    // We don't need a specific Chama context here since it's global,
    // but we can pass the user's name for personalization
    const userRes = await pool.query("SELECT first_name FROM users WHERE user_id = $1", [userId]);
    const userName = userRes.rows[0]?.first_name || 'User';

    // The logic inside handleIncomingSupportMessage sends a socket emit,
    // but for the global widget we just want a standard REST response.
    // So we'll call the groq completion directly or create a helper in aiSupportService.
    const Groq = require("groq-sdk");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // Minimal system prompt for the global widget
    const SYSTEM_PROMPT = `
You are ChamaSmart AI Support — a knowledgeable, friendly 24/7 customer service assistant for the ChamaSmart platform. 
You help users navigate the app, understand features, and troubleshoot problems.
Keep your responses concise, warm, and professional. Use markdown formatting.
    `;

    // Construct message payload
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []),
      { role: "user", content: message }
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.45,
      max_tokens: 400,
    });

    const reply = chatCompletion.choices[0]?.message?.content || "I'm having a moment of difficulty. Please try again shortly!";

    res.status(200).json({ success: true, reply });
  } catch (error) {
    logger.error("Error in AI Support Chat endpoint", { error: error.message });
    res.status(500).json({ success: false, message: "Error communicating with AI support" });
  }
};

module.exports = {
  getChannels,
  getMessages,
  sendMessage,
  aiSupportChat
};
