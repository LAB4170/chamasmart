# 🐳 Docker Guide for ChamaSmart

## What is Docker and Why Use It?

Docker helps you run your entire ChamaSmart application (frontend, backend, database, Redis) in **isolated containers** that work the same way on any computer. Think of it as packaging your entire app with all its dependencies into portable boxes.

### 🎯 Benefits of Using Docker

| Benefit | Description |
|---------|-------------|
| **One Command Setup** | Start everything with `docker-compose up` - no manual setup needed |
| **Consistent Environment** | Works the same on Windows, Mac, Linux - no "works on my machine" issues |
| **Isolated Services** | Each service runs in its own container - no port conflicts or dependency issues |
| **Easy Database** | PostgreSQL and Redis automatically configured and ready to use |
| **Team Collaboration** | Everyone on your team gets the exact same setup |
| **Production-Ready** | Same containers can be deployed to production servers |

---

## 🔄 Docker vs Manual Setup

### Manual Setup (What you're doing now):
```powershell
# Terminal 1 - Start PostgreSQL manually
# Terminal 2 - Start Redis manually  
# Terminal 3 - Backend
cd backend
node server.js

# Terminal 4 - Frontend
cd frontend
npm run dev
```
**Requires:** 4 terminals, manual database setup, port management

### Docker Setup:
```bash
docker-compose up
```
**Requires:** 1 command, everything auto-configured ✨

---

## 📋 Your Current Docker Configuration

Your project has a complete Docker setup with 4 services:

### 1. **PostgreSQL Database** (`postgres`)
- Automatically creates the `chamasmart` database
- Runs database schema on first startup
- Data persists in Docker volumes
- Port: 5433 (mapped from container's 5432)

### 2. **Backend API** (`backend`)
- Node.js server running on port 5000
- Auto-connects to PostgreSQL and Redis
- Hot-reload enabled for development
- Health checks ensure it's running properly

### 3. **Frontend** (`frontend`)
- Vite dev server on port 5173
- Auto-connects to backend API
- Hot-reload for instant updates
- Waits for backend to be healthy before starting

### 4. **Redis Cache** (`redis`)
- In-memory caching for better performance
- Port: 6379
- Data persists in Docker volumes

---

## 🚀 How to Use Docker

### Prerequisites
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Make sure Docker Desktop is running (check system tray)

### Option 1: Start Everything (Recommended)

```bash
# From project root directory
docker-compose up --build
```

This will:
- Build all containers
- Start PostgreSQL, Redis, Backend, Frontend
- Run database migrations
- Make the app available at `http://localhost:5173`

**To stop:** Press `Ctrl+C` or run `docker-compose down`

### Option 2: Run in Background

```bash
# Start all services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Option 3: Start Only Database & Redis

If you want to develop locally but use Docker for database:

```bash
# Start only infrastructure
docker-compose up -d postgres redis

# Then run backend and frontend manually
cd backend
node server.js

# In another terminal
cd frontend
npm run dev
```

---

## 🛠️ Useful Docker Commands

### View Running Containers
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart a Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Rebuild After Code Changes
```bash
docker-compose up --build
```

### Clean Everything (Fresh Start)
```bash
# Stop and remove containers, networks
docker-compose down

# Also remove volumes (deletes database data!)
docker-compose down -v
```

### Access Database
```bash
# Connect to PostgreSQL inside Docker
docker exec -it chamasmart_db psql -U postgres -d chamasmart
```

---

## ⚠️ Important Notes

### Port Differences
When using Docker, the backend runs on **port 5000** (not 5005):
- **Manual setup:** Backend on 5005, Frontend on 5173
- **Docker setup:** Backend on 5000, Frontend on 5173

### Database Connection
- **Manual:** `localhost:5432`
- **Docker:** `postgres:5432` (inside containers) or `localhost:5433` (from host)

### File Changes
- Code changes are automatically detected (hot-reload works)
- If you change `package.json`, rebuild: `docker-compose up --build`

---

## 🎯 When to Use Docker vs Manual

### Use Docker When:
✅ Setting up the project for the first time  
✅ Working with a team (ensures everyone has same setup)  
✅ Deploying to production  
✅ You don't want to install PostgreSQL/Redis locally  
✅ Testing the full integrated system  

### Use Manual Setup When:
✅ Actively developing and need faster restarts  
✅ Debugging specific backend/frontend issues  
✅ You already have PostgreSQL/Redis installed  
✅ Working on a single component  

---

## 🔧 Troubleshooting Docker

### "Port already in use"
```bash
# Stop all containers
docker-compose down

# Kill any manual processes
taskkill /F /IM node.exe /T

# Start Docker again
docker-compose up
```

### "Cannot connect to Docker daemon"
- Make sure Docker Desktop is running
- Check system tray for Docker icon

### "Database connection failed"
```bash
# Check if PostgreSQL container is healthy
docker-compose ps

# View database logs
docker-compose logs postgres
```

### Containers won't start
```bash
# Clean everything and start fresh
docker-compose down -v
docker-compose up --build
```

---

## 📊 Quick Comparison

| Feature | Manual Setup | Docker Setup |
|---------|-------------|--------------|
| Setup Time | 15-30 min | 5 min |
| Commands to Start | 4 terminals | 1 command |
| Database Setup | Manual | Automatic |
| Team Consistency | Variable | Identical |
| Port Management | Manual | Automatic |
| Production Similarity | Different | Same |

---

## ✨ Recommendation

**For Development:** Use the manual setup you have now (it's already working!)  
**For Team Collaboration:** Use Docker to ensure everyone has the same environment  
**For Production:** Definitely use Docker for deployment

Your current manual setup is **perfectly fine** for development. Docker is there when you need it for:
- Onboarding new team members quickly
- Deploying to staging/production
- Testing the full integrated system

Both approaches work - choose what fits your workflow! 🚀
