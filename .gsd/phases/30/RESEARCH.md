# Phase 30 Research: Real-Time Communication & AI Architecture

## 1. The Challenge
The user requested a WhatsApp-clone inside ChamaSmart for every specific Chama, allowing members to chat in real time, send photos, and send videos. Following this, a 24/7 AI customer service chatbot needs to be implemented.

## 2. Component Analysis: Real-Time Messaging

### Option A: Firebase Realtime Database / Firestore
- **Pros**: Instant frontend integration, handles offline persistence beautifully, zero backend WebSocket management required.
- **Cons**: Can become expensive at scale. Disconnected from our core PostgreSQL database (requires heavy syncing logic). 
- **Verdict**: Since ChamaSmart already relies heavily on a structured Node/PostgreSQL backend and has an existing `Socket.io` implementation (used for live M-Pesa tracking and Meeting Minutes), keeping chat in `Socket.io` is more cohesive.

### Option B: Node.js + Socket.io + PostgreSQL (Chosen Route)
- **Pros**: We already have `Socket.io` running on port 5005. Messages can be persisted instantly to our relational PostgreSQL DB, keeping data unified.
- **Cons**: Media requires offloading. Video files cannot be sent over base64 WebSockets efficiently.

## 3. Component Analysis: Media Storage (Photos & Videos)

Since we are doing a WhatsApp clone, media handling is critical. We cannot store videos in PostgreSQL.

### Option A: AWS S3 / Cloudflare R2
- **Pros**: Industry standard, cheap storage.
- **Cons**: High setup friction, requires AWS SDK, IAM roles, and bucket policies.

### Option B: Firebase Cloud Storage (Chosen Route)
- **Pros**: We **already** have the exact Firebase environment (`chamasmart-1c600.appspot.com` bucket) configured in out `.env` and `firebaseAdmin.js`. 
- **Execution**: The frontend will directly upload media to Firebase Storage to spare the Node backend from heavy bandwidth. Firebase will return a secure download URL. The frontend will then send that URL via `Socket.io` as a chat message.

## 4. Component Analysis: 24/7 AI Customer Service Bot

### Option A: Dialogflow
- **Pros**: Built for intent matching.
- **Cons**: Rigid, feels like an "old" chatbot tree.

### Option B: Groq API / Google Gemini SDK (Chosen Route)
- **Pros**: We already installed and configured `@google/genai` and `groq-sdk` in Phase 28.
- **Execution**: Create a dedicated bot user in the system (`bot@chamasmart.com`). The bot will listen to a generic "Platform Support" chat channel via the backend. When a user sends a message there, the Node server pulls the message, queries the LLM with system instructions ("You are ChamaSmart Support..."), and emits the AI's response via Socket.io.

## 5. Architectural Decisions
1. **DB Schema**: New tables -> `chat_channels` (Groups/Private/Support), `chat_messages` (contains `message_type`: text/image/video, and `content`).
2. **WebSockets**: Utilize 'Room' features in Socket.io. When a user enters a Chama, they join `room_chama_X`. 
3. **Media Pipeline**: Frontend uploads to Firebase -> gets URL -> emits `{ type: 'image', url: '...' }` via Socket -> Backend saves URL to PostgreSQL DB -> broadcasts to room.

## 6. Execution Waves
- **Wave 1**: Database schema scaling and Backend REST/Socket endpoints.
- **Wave 2**: Frontend UI implementation matching modern messaging apps (bubbles, media previews).
- **Wave 3**: AI Customer Support Agent integration.
