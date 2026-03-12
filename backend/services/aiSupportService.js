const Groq = require("groq-sdk");
const logger = require("../utils/logger");
const pool = require("../config/db");
const { getIo } = require("../socket");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const AI_BOT_EMAIL = 'bot@chamasmart.com';

const generateSupportResponse = async (userMessage, userName, chamaName) => {
  try {
    const prompt = `
      You are 'ChamaSmart AI Support', an expert, friendly 24/7 assistant strictly for the ChamaSmart platform.
      You are currently chatting with ${userName} from the Chama group "${chamaName}".
      Keep your responses concise, professional, and directly related to Chama/Savings group management or app navigation.
      Do not hallucinate features.
      
      User message: "${userMessage}"
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "system", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 250,
    });

    return chatCompletion.choices[0]?.message?.content || "I'm sorry, I'm having trouble processing that request right now.";
  } catch (error) {
    logger.error("Groq AI Error in Chat Support", { error: error.message });
    return "I'm currently experiencing technical difficulties connecting to my AI core. Please try again later.";
  }
};

const handleIncomingSupportMessage = async (channelId, userMessage, userName, chamaName) => {
  try {
    // Note: We don't await this immediately to prevent blocking the initial user's REST response
    
    // 1. Get bot ID
    const botRes = await pool.query("SELECT user_id, first_name, last_name, profile_picture_url FROM users WHERE email = $1", [AI_BOT_EMAIL]);
    if (botRes.rows.length === 0) {
      logger.error("AI Bot User missing from database. Cannot reply.");
      return;
    }
    const botUser = botRes.rows[0];

    // 2. Generate AI Reply
    const aiText = await generateSupportResponse(userMessage, userName, chamaName);

    // 3. Save AI message to DB
    const insertRes = await pool.query(
      `INSERT INTO chat_messages (channel_id, user_id, message_type, content) 
       VALUES ($1, $2, 'text', $3) RETURNING *`,
      [channelId, botUser.user_id, aiText]
    );

    // 4. Construct broadcast payload
    const broadcastData = {
      ...insertRes.rows[0],
      first_name: botUser.first_name,
      last_name: botUser.last_name,
      profile_picture_url: botUser.profile_picture_url
    };

    // 5. Emit back to the room
    getIo().to(`chat_${channelId}`).emit('new_message', broadcastData);

  } catch (error) {
    logger.error("Error handling AI Support message pipeline", { error: error.message });
  }
};

module.exports = {
  handleIncomingSupportMessage
};
