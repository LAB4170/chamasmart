# ChamaSmart - Integrated Chama Management System

A comprehensive web application for managing chama (savings groups) with integrated frontend and backend serving.

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd chamasmart
   ```

2. **Install all dependencies**

   ```bash
   npm run install:all
   ```

3. **Set up the database**

   ```bash
   npm run setup
   ```

4. **Start the integrated server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:5000`

## 📋 Available Scripts

### Root Level Scripts (Recommended)

- `npm start` - Build frontend and start integrated server (production mode)
- `npm run dev` - Start both frontend and backend in development mode (separate servers)
- `npm run build` - Build the frontend for production
- `npm run serve` - Build and serve the integrated application
- `npm run setup` - Initialize the database with tables and sample data
- `npm run install:all` - Install dependencies for both frontend and backend

### Development Mode (Separate Servers)

- `npm run dev:frontend` - Start frontend development server only
- `npm run dev:backend` - Start backend server only

## 🏗️ Architecture

### Integrated Server Setup

When you run `npm start`, the application:

1. Builds the React frontend for production
2. Starts the Express backend server
3. Serves both API endpoints and static frontend files from the same port (5000)

### API Endpoints

- `GET/POST /api/auth/*` - Authentication (login, register)
- `GET/POST /api/chamas/*` - Chama management
- `GET/POST /api/members/*` - Member management
- `GET/POST /api/contributions/*` - Contribution tracking
- `GET/POST /api/meetings/*` - Meeting management

### Client-Side Routing

All non-API routes serve the React application's `index.html`, enabling client-side routing for pages like:

- `/` - Home/Landing page
- `/login` - User login
- `/register` - User registration
- `/dashboard` - User dashboard
- `/chamas/*` - Chama management pages

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=5000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=chamasmart
DB_PASSWORD=your_password
DB_PORT=5432
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
NODE_ENV=development
# Optional: protect /metrics in production with a shared token
# When set (and NODE_ENV=production), requests to /metrics must send:
#   X-Metrics-Token: $METRICS_AUTH_TOKEN
METRICS_AUTH_TOKEN=
```

### Database Schema

The application uses PostgreSQL with the following main tables:

- `users` - User accounts
- `chamas` - Chama groups
- `chama_members` - Membership relationships
- `contributions` - Financial contributions
- `meetings` - Meeting records
- `meeting_attendance` - Attendance tracking
- `loans` - Loan management
- `loan_repayments` - Loan repayment tracking

## 🛠️ Development

### Running focused backend tests

From the project root you can run only the security-related backend tests:

```bash
# Metrics endpoint protection tests
npm test -- backend/tests/metrics.test.js

# Auth error-handling tests (production vs non-production)
npm test -- backend/tests/authErrors.test.js

# Socket.io auth tests (unauthenticated connections are rejected)
npm test -- backend/tests/socketAuth.test.js
```

### Project Structure

```
chamasmart/
├── backend/           # Express.js API server
│   ├── controllers/   # Route handlers
│   ├── routes/        # API route definitions
│   ├── middleware/    # Custom middleware
│   ├── utils/         # Utility functions
│   └── server.js      # Main server file
├── frontend/          # React application
│   ├── src/
│   │   ├── components/# Reusable components
│   │   ├── pages/     # Page components
│   │   ├── context/   # React context providers
│   │   └── services/  # API service functions
│   └── dist/          # Built frontend (auto-generated)
└── package.json       # Root package.json for orchestration
```

### Adding New Features

1. **Backend**: Add routes in `backend/routes/`, controllers in `backend/controllers/`
2. **Frontend**: Add components in `frontend/src/components/`, pages in `frontend/src/pages/`
3. **Database**: Update schema in `backend/database_schema.sql` and run `npm run setup`

## 🚀 Deployment

For production deployment:

1. **Build the application**

   ```bash
   npm run build
   ```

2. **Start the integrated server**
   ```bash
   npm run serve
   ```

The application will serve both the API and the built frontend from a single port, making it easy to deploy to services like Heroku, Railway, or any Node.js hosting platform.

## 📝 Features

- ✅ User authentication and authorization
- ✅ Chama creation and management
- ✅ Member management and role assignment
- ✅ Contribution tracking and recording
- ✅ Meeting scheduling and attendance
- ✅ Financial reporting and analytics
- ✅ Loan management and tracking
- ✅ Responsive web interface
- ✅ Integrated development and production serving

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run dev`
5. Submit a pull request

## 📄 License

ISC License
