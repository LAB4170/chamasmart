import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Minimize2, Maximize2, Bot } from "lucide-react";
import chatbotIcon from "../../assets/images/chatbot-icon.png";
import api from "../../services/axios";
import "./AIBotWidget.css";

const CHAMASMART_CONTEXT = `
You are ChamaSmart AI Support — a knowledgeable, friendly 24/7 customer service assistant for the ChamaSmart platform. You help users navigate the app, understand features, and troubleshoot problems.

PLATFORM OVERVIEW:
ChamaSmart manages 4 types of Kenyan savings groups (Chamas):
• ROSCA – Rotating pot; members take turns receiving the full contribution pool
• ASCA – Share-based investment pool with internal lending and interest share-out
• Table Banking – Bring money to meetings, lend immediately, collect interest
• Welfare – Emergency fund; members claim for medical, bereavement, accidents

KEY FEATURES & NAVIGATION:
Dashboard: Overview of all your Chamas and activity
Chama Details has these tabs:
  - Overview: Stats, fund balance, member count
  - Members: View/update member roles (Chairperson, Treasurer, Secretary, Member)
  - Payments: Full contribution history. "Record" adds single payment; "Bulk Record" for many members
  - Chat: WhatsApp-style group messaging with your Chama members. Send text, images, videos
  - Meetings: Schedule meetings, add agendas, write minutes
  - Loans (ASCA/Table Banking only): Apply, approve, track repayments, view guarantor requests
  - Welfare (Welfare type): Submit emergency claims, run drives
  - Cycle (ROSCA only): Manage rotation roster, swap slot requests
  - Reports: Financial charts, contribution trends, loan analytics

M-PESA PAYMENTS:
1. Go to Payments tab → click Pay/Record Contribution
2. Enter phone number (format: 07XXXXXXXX)
3. Click Send STK Push → you get a PIN prompt on your phone
4. Enter M-Pesa PIN to complete

ROLES: Chairperson (full admin), Treasurer (payments), Secretary (meetings), Member (basic)

LOAN PROCESS: Apply → select guarantors → guarantors accept notification → officials approve → funds via M-Pesa

TROUBLESHOOTING:
- STK Push not received: Check phone number format, ensure M-Pesa is active
- Can't see Chama: Ask Chairperson for invite link
- Feature locked: You may need a higher role — ask Chairperson
- Chat not loading: Refresh the page

FORMATTING: Use bold for feature names, numbered lists for steps. Keep replies under 200 words unless showing steps. Be warm and encouraging.
`;

export default function AIBotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 Hello! I'm **ChamaSmart AI**, your 24/7 support assistant.\n\nI can help you:\n• Navigate any feature\n• Understand how Chamas work\n• Troubleshoot issues\n• Guide you step by step\n\nWhat can I help you with today?",
      id: Date.now(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Show notification pulse after 5s if user hasn't opened
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) setHasUnread(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = { role: "user", content: inputValue.trim(), id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await api.post("/chat/ai-support", {
        message: userMsg.content,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content }))
      });

      const data = response.data;
      const botMsg = {
        role: "assistant",
        content: data.reply || "I'm sorry, I had trouble processing that. Please try again.",
        id: Date.now() + 1
      };
      setMessages(prev => [...prev, botMsg]);
      if (!isOpen) setHasUnread(true);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having a brief connectivity issue. Please try again in a moment.",
        id: Date.now() + 1
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Parse simple markdown for bold
  const renderContent = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        className={`ai-bot-trigger ${hasUnread && !isOpen ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        title="ChamaSmart AI Support"
        aria-label="Open AI Support Chat"
      >
        {isOpen ? (
          <X size={24} />
        ) : (
          <img src={chatbotIcon} alt="AI Support" className="ai-bot-trigger-img" />
        )}
        {hasUnread && !isOpen && <span className="ai-bot-badge">1</span>}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className={`ai-bot-window ${isMinimized ? 'minimized' : ''}`}>
          {/* Header */}
          <div className="ai-bot-header">
            <div className="ai-bot-header-info">
              <div className="ai-bot-avatar">
                <img src={chatbotIcon} alt="Bot" />
                <span className="ai-bot-online-dot" />
              </div>
              <div>
                <div className="ai-bot-name">ChamaSmart AI</div>
                <div className="ai-bot-status">Always online · Instant replies</div>
              </div>
            </div>
            <div className="ai-bot-header-actions">
              <button
                className="ai-bot-action-btn"
                onClick={() => setIsMinimized(prev => !prev)}
                title={isMinimized ? "Expand" : "Minimize"}
              >
                {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
              </button>
              <button
                className="ai-bot-action-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="ai-bot-messages">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`ai-bot-message ${msg.role === 'user' ? 'user-msg' : 'bot-msg'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="ai-bot-msg-avatar">
                        <img src={chatbotIcon} alt="Bot" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                      </div>
                    )}
                    <div className={`ai-bot-bubble ${msg.role === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                      {msg.content.split('\n').map((line, i) => (
                        <p key={i} style={{ margin: 0, lineHeight: 1.5 }}>
                          {renderContent(line)}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="ai-bot-message bot-msg">
                    <div className="ai-bot-msg-avatar">
                      <img src={chatbotIcon} alt="Bot" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    </div>
                    <div className="ai-bot-bubble bot-bubble ai-bot-typing">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions */}
              {messages.length === 1 && (
                <div className="ai-bot-suggestions">
                  {["How do I make a payment?", "How does ROSCA work?", "I can't see my Chama"].map((s) => (
                    <button
                      key={s}
                      className="ai-bot-suggestion-chip"
                      onClick={() => { setInputValue(s); inputRef.current?.focus(); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="ai-bot-input-area">
                <textarea
                  ref={inputRef}
                  className="ai-bot-input"
                  placeholder="Ask anything about ChamaSmart..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  className="ai-bot-send-btn"
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  title="Send message"
                >
                  {isLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
