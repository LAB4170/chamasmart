# ChamaSmart

## Overview
ChamaSmart is a modern web platform that enables the creation and management of rotating‑savings groups ("chamas") and associated financial activities. It provides a full‑stack solution with a **React/Vite** frontend deployed on Netlify and a **Spring Boot** backend running on Render. The application includes user authentication via Firebase, role‑based access control, real‑time chat, loan and contribution management, and comprehensive REST APIs.

---

## Table of Contents
1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Setup & Development](#setup--development)
5. [Running Locally](#running-locally)
6. [Deployment](#deployment)
7. [API Documentation](#api-documentation)
8. [Environment Variables](#environment-variables)
9. [Testing](#testing)
10. [Contributing](#contributing)
11. [License](#license)

---

## Features
- **User Management** – Register, login (email/password and Google OAuth) using Firebase Authentication.
- **Chama Management** – Create, join, and administer chamas with configurable contribution cycles.
- **Financial Transactions** – Record contributions, loans, payouts, and generate statements.
- **Real‑time Chat** – Socket‑IO based chat for members within a chama.
- **Notification System** – Push notifications for events such as loan approvals, reminders, and announcements.
- **Role‑Based Access Control** – Secure endpoints with JWT authentication and Spring Security.
- **Responsive UI** – Mobile‑first design with a fixed navigation bar that adapts to different screen sizes.
- **CI/CD** – Automatic builds on Netlify (frontend) and Render (backend) with environment‑variable handling.

---

## Technology Stack
| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript (optional), Tailwind‑CSS (custom CSS), Framer Motion, React Router, Axios |
| Backend | Java 17, Spring Boot 3, Spring Security, JWT, Spring Data JPA, PostgreSQL, Lombok |
| Authentication | Firebase Authentication (client‑side) |
| Real‑time | Socket.IO (Spring Boot) |
| Database | PostgreSQL (Render) |
| Deployment | Netlify (frontend), Render (backend) |
| CI | GitHub Actions (optional) |

---

## Architecture Overview
- **Frontend** – A single‑page application built with Vite. It consumes the backend REST API (`/api/v1/**`) and communicates with Firebase for authentication. All configuration values are injected at build time via environment variables prefixed with `VITE_`.
- **Backend** – A Spring Boot application exposing versioned REST endpoints under `/api/v1`. Security is enforced by a JWT filter (`JwtAuthenticationFilter`). CORS is configured to allow requests from the Netlify domain and development hosts.
- **Database** – PostgreSQL stores users, chamas, contributions, loans, and chat messages. Entity relationships are defined using JPA.
- **Realtime** – Socket.IO server runs inside the Spring Boot app; the frontend connects via the `socket.io-client` library for live chat.
- **Authentication Flow** –
  1. The frontend authenticates with Firebase and obtains an ID token.
  2. The token is sent to `/auth/firebase-sync` which validates it, creates/updates the backend user record, and returns a JWT for subsequent API calls.
  3. All protected endpoints require the JWT in the `Authorization: Bearer <token>` header.

---

## Setup & Development
### Prerequisites
- **Node.js** (v20+) and **npm**
- **Java JDK** (17) and **Maven**
- **Docker** (optional, for local PostgreSQL)
- **Firebase project** (for authentication) – obtain API key, auth domain, project id, etc.

### Clone the Repository
```bash
git clone https://github.com/LAB4170/chamasmart.git
cd chamasmart
```

### Backend Setup
1. Create a PostgreSQL database (locally or on Render). Update `src/main/resources/application.yml` with the connection URL, username, and password.
2. Set the following environment variables (or add to a `.env` file for local runs):
   - `SPRING_DATASOURCE_URL`
   - `SPRING_DATASOURCE_USERNAME`
   - `SPRING_DATASOURCE_PASSWORD`
   - `JWT_SECRET` – a random secret used to sign JWTs.
3. Build and run:
```bash
./mvnw clean install
./mvnw spring-boot:run
```
   The API will be available at `http://localhost:8080/api/v1`.

### Frontend Setup
1. Navigate to the `frontend` folder:
```bash
cd frontend
```
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file at the project root (or configure Netlify UI). Example keys (values omitted):
```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_URL=https://chamasmart-khrb.onrender.com/api/v1
```
4. Run the development server:
```bash
npm run dev
```
   Open `http://localhost:5173` in a browser.

---

## Running Locally
- **Backend** – Ensure the PostgreSQL container is running (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=chamasmart postgres`). Then start the Spring Boot app as described above.
- **Frontend** – Use the `.env` file to point `VITE_API_URL` to the local backend (`http://localhost:8080/api/v1`).
- **CORS** – The development configuration already allows `http://localhost:*`. No additional changes are needed.

---

## Deployment
### Frontend (Netlify)
1. Connect the GitHub repository to Netlify.
2. In **Site Settings → Build & Deploy → Environment**, add the same `VITE_` variables used locally (the values are public, so they can be stored here).
3. Set the build command to `npm run build` and the publish directory to `dist`.
4. Netlify will automatically build and deploy on each push.

### Backend (Render)
1. Create a new Web Service on Render linking the same repository.
2. Set the start command to `./mvnw spring-boot:run`.
3. Add the required environment variables (`SPRING_DATASOURCE_*`, `JWT_SECRET`).
4. Render will provision a PostgreSQL instance (or you can attach an external database) and expose the service at a URL like `https://chamasmart-khrb.onrender.com`.
5. Ensure the domain `https://chamasmart.netlify.app` is whitelisted in the CORS configuration (already done).

---

## API Documentation
The backend provides Swagger UI at `/swagger-ui/index.html` when the application is running. Key endpoint groups include:
- **Auth** – `/auth/register`, `/auth/login`, `/auth/firebase-sync`, `/auth/logout`
- **User** – `/users/**`
- **Chama** – CRUD operations for chamas, member management, contribution cycles
- **Finance** – `/contributions/**`, `/loans/**`, `/payouts/**`
- **Chat** – Socket.IO endpoint `/socket.io/` for real‑time messaging
- **Notifications** – `/notifications/**`
- **Admin** – `/audit/**`, `/actuator/**` (health checks)

All protected routes require a valid JWT in the `Authorization` header.

---

## Environment Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase public API key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain | `chamasmart-1c600.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | `chamasmart-1c600` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | `chamasmart-1c600.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID | `475835064239` |
| `VITE_FIREBASE_APP_ID` | Firebase app identifier | `1:475835064239:web:...` |
| `VITE_API_URL` | Base URL for backend API | `https://chamasmart-khrb.onrender.com/api/v1` |
| `SPRING_DATASOURCE_URL` | JDBC URL for PostgreSQL | `jdbc:postgresql://<host>:5432/chamasmart` |
| `SPRING_DATASOURCE_USERNAME` | Database username |
| `SPRING_DATASOURCE_PASSWORD` | Database password |
| `JWT_SECRET` | Secret used to sign JWT tokens (keep confidential) |
| `GROQ_API_KEY` | Optional AI service key (if used) |

> **Note:** Do not commit actual secret values to the repository.

---

## Testing
- **Backend** – Run unit and integration tests with `./mvnw test`. The project includes tests for service layers and controller endpoints.
- **Frontend** – Use `npm run test` (Jest + React Testing Library) to execute component tests.
- **API Contract** – Swagger UI can be used to manually verify request/response payloads.

---

## Contributing
1. Fork the repository and create a feature branch.
2. Follow the coding standards used in the existing codebase (Java Lombok for backend, functional React components for frontend).
3. Write tests for any new functionality.
4. Ensure the application builds and all tests pass.
5. Submit a pull request with a clear description of the changes.

All contributions must respect the licensing terms and should not introduce hard‑coded secrets.

---

## License
This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---

## Contact
For questions or support, please open an issue on the GitHub repository.
