# ChamaSmart Quick Reference Guide

## 🚀 Quick Start

### Prerequisites

- Node.js v16+
- npm v8+
- PostgreSQL v12+
- (Optional) Docker Desktop

### Installation & Running

```bash
# 1. Clone and setup
cd c:\Users\lewis\Desktop\chamasmart

# 2. Backend setup
cd backend
npm install
npm run dev

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# 4. Access
Frontend: http://localhost:5173
Backend:  http://localhost:5005
```

---

## 🗂️ Project Structure

```
chamasmart/
├── backend/                 # Express API server
│   ├── controllers/         # Business logic (14 modules)
│   ├── routes/              # API endpoints
│   ├── middleware/          # Auth, logging, security
│   ├── config/              # Database, CORS, Redis
│   ├── migrations/          # Database schemas
│   ├── utils/               # Validators, logger
│   ├── scheduler/           # Cron jobs
│   └── server.js            # Entry point
│
├── frontend/                # React + Vite app
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── services/        # API calls
│   │   ├── context/         # State management
│   │   └── App.jsx          # Root component
│   ├── vite.config.js       # Build config
│   └── package.json
│
├── docker-compose.yml       # PostgreSQL + Redis
├── DIAGNOSTIC_REPORT.md     # Full diagnostic analysis
└── .env                     # Environment variables
```

---

## 🔑 Key Endpoints

### Authentication

```
POST   /api/auth/register           # New user signup
POST   /api/auth/login              # User login
GET    /api/auth/me                 # Get current user
POST   /api/auth/verify-email       # Email verification
POST   /api/auth/verify-phone       # Phone verification
```

### Chama Groups

```
GET    /api/chamas                  # List all chamas
POST   /api/chamas                  # Create chama
GET    /api/chamas/:id              # Get chama details
PUT    /api/chamas/:id              # Update chama
GET    /api/chamas/user/my-chamas   # User's chamas
```

### Contributions

```
GET    /api/contributions/:chamaId          # Get contributions
POST   /api/contributions/:chamaId/record   # Record contribution
GET    /api/contributions/:chamaId/:id      # Get contribution details
```

### Loans (Table Banking)

```
GET    /api/loans/:chamaId/config          # Loan settings
PUT    /api/loans/:chamaId/config          # Update settings
POST   /api/loans/:chamaId/apply           # Apply for loan
GET    /api/loans/:chamaId                 # List loans
PUT    /api/loans/:loanId/approve          # Approve/reject loan
POST   /api/loans/:loanId/repay            # Record repayment
```

### ROSCA (Rotating Savings)

```
GET    /api/rosca/chama/:chamaId/cycles    # List cycles
POST   /api/rosca/chama/:chamaId/cycles    # Create cycle
GET    /api/rosca/cycles/:cycleId/roster   # Cycle roster
POST   /api/rosca/cycles/:cycleId/payout   # Process payout
```

### Health & Monitoring

```
GET    /health                      # Health check
GET    /api/ping                    # Ping endpoint
GET    /metrics                     # Prometheus metrics
GET    /readiness                   # Readiness probe
```

---

## 🔐 Authentication

### JWT Token Flow

1. **Register/Login** → Get JWT token
2. **Store** → localStorage as `token`
3. **Attach** → Axios adds `Authorization: Bearer <token>` to all requests
4. **Validate** → Backend validates JWT signature
5. **Access** → Server checks user permissions

### Role-Based Access Control (RBAC)

- `MEMBER` - Regular member
- `CHAIRPERSON` - Group leader
- `SECRETARY` - Records keeper
- `TREASURER` - Financial officer
- `ADMIN` - System administrator

### Protected Routes Example

```javascript
// Protected routes require JWT
app.get("/api/chamas/:id", protect, getChamaById);

// Admin-only routes
app.post("/api/loans/:id/approve", protect, isTreasurer, approveLoan);

// Role-based routes
app.post(
  "/api/rosca/cycles",
  protect,
  authorize("ADMIN", "TREASURER"),
  createCycle
);
```

---

## ⚙️ Environment Variables

### Required (.env)

```env
# Server
NODE_ENV=development
PORT=5005

# JWT
JWT_SECRET=<your-secret-key>
JWT_EXPIRES_IN=90d

# Database
DB_USER=postgres
DB_HOST=localhost
DB_NAME=chamasmart
DB_PASSWORD=password
DB_PORT=5432

# Redis (optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Frontend
FRONTEND_URL=http://localhost:3000

# SMTP (for email)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_password
```

---

## 📊 Database Schemas

### Core Tables

- **users** - User accounts
- **chamas** - Chama groups
- **chama_members** - Group membership
- **contributions** - Member contributions
- **loans** - Loan applications
- **loan_guarantors** - Loan guarantees
- **meetings** - Group meetings
- **notifications** - User notifications
- **rosca_cycles** - ROSCA rotation cycles
- **asca_shares** - ASCA share holdings
- **welfare_claims** - Welfare benefit claims

### Sample Query

```sql
-- Get all members of a chama with their contributions
SELECT
    u.user_id,
    u.email,
    cm.role,
    SUM(c.amount) as total_contributions
FROM users u
JOIN chama_members cm ON u.user_id = cm.user_id
LEFT JOIN contributions c ON u.user_id = c.user_id
WHERE cm.chama_id = $1 AND cm.is_active = true
GROUP BY u.user_id, cm.role;
```

---

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:watch        # Watch mode
jest --coverage           # Coverage report

# Frontend lint
cd frontend
npm run lint
```

### Test Example

```bash
# Test registration
cd backend
node scripts/test_register.js
```

---

## 🐳 Docker Setup

### Using Docker Compose

```bash
# Start all services (PostgreSQL + Redis)
docker-compose up

# Or start just database
docker-compose up postgres

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Reset database
docker-compose down -v  # Remove volumes
docker-compose up       # Fresh start
```

---

## 🚨 Common Issues & Solutions

### Redis Not Connecting

```
⚠️ Redis connection failed multiple times
```

**Solution:** This is non-critical. Either:

1. Start Redis: `docker-compose up redis`
2. Ignore for development (uses in-memory rate limiting)

### Database Connection Error

```
error: password authentication failed
```

**Solution:** Check `.env`:

```env
DB_USER=postgres          # Must exist
DB_PASSWORD=password      # Must match DB
DB_HOST=localhost         # Or 127.0.0.1
DB_PORT=5432
```

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use
```

**Solution:** Kill process or use different port:

```bash
# Find process using port 5005
netstat -ano | findstr :5005

# Kill process
taskkill /PID <PID> /F

# Or change port
set PORT=5006
npm run dev
```

### Module Not Found

```
Error: Cannot find module './utils/logger'
```

**Solution:** Install dependencies:

```bash
npm install
```

---

## 📈 Performance Tips

### Backend Optimization

1. Enable Redis for distributed caching
2. Add database indexes (already included in migrations)
3. Use connection pooling (configured: max 20)
4. Monitor slow queries (logged automatically)

### Frontend Optimization

1. Use React DevTools Profiler
2. Check bundle size: `npm run build`
3. Enable PWA offline caching
4. Use React.memo for heavy components
5. Implement code splitting with React.lazy

---

## 🔗 API Examples

### Create a Chama Group

```bash
curl -X POST http://localhost:5005/api/chamas \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Silicon Valley Savers",
    "description": "Tech community savings group",
    "targetAmount": 500000,
    "currency": "KES"
  }'
```

### Record a Contribution

```bash
curl -X POST http://localhost:5005/api/contributions/123/record \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 456,
    "amount": 5000,
    "date": "2026-01-16"
  }'
```

### Apply for a Loan

```bash
curl -X POST http://localhost:5005/api/loans/123/apply \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "duration": 12,
    "purpose": "Business equipment"
  }'
```

---

## 📚 Documentation Files

- `DIAGNOSTIC_REPORT.md` - Full system analysis
- `DOCKER_GUIDE.md` - Docker deployment guide
- `MIGRATION_INSTRUCTIONS.md` - Database migration help
- `SIMPLE_MIGRATION_STEPS.md` - Quick migration guide

---

## 🎯 Development Workflow

### Make Changes

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make code changes
# Backend changes hot-reload with nodemon
# Frontend hot-reloads with Vite

# 3. Run tests
npm test

# 4. Commit changes
git add .
git commit -m "feat: add new feature"

# 5. Push and create PR
git push origin feature/new-feature
```

---

## 🆘 Support Resources

### Useful Commands

```bash
# View backend logs
npm run dev              # See console output

# View frontend errors
npm run dev              # Check browser console

# Database shell
psql -U postgres -d chamasmart -h localhost

# Redis CLI
redis-cli               # If Redis running

# Health check
curl http://localhost:5005/health

# API documentation (if available)
# Add Swagger UI: npm install swagger-ui-express
```

### Error Logs Location

- Backend: `backend/logs/` (daily rotation)
- Frontend: Browser DevTools Console
- Database: PostgreSQL logs

---

**Last Updated:** 2026-01-16 | **Version:** 1.0 | **Status:** ✅ Active
