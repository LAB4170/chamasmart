# ChamaSmart - Quick Start Guide

## ✅ Prerequisites
- **Node.js** installed
- **PostgreSQL** running on port 5432 (for manual setup)
- **Docker Desktop** (optional, for Docker setup)

---

## 🚀 Choose Your Setup Method

### 🐳 **Option 1: Docker (Easiest - Everything in One Command)**

Perfect for: First-time setup, team collaboration, production deployment

```bash
# Make sure Docker Desktop is running, then:
docker-compose up --build
```

**That's it!** Everything starts automatically:
- ✅ PostgreSQL database (port 5433)
- ✅ Redis cache (port 6379)
- ✅ Backend API (port 5000)
- ✅ Frontend UI (port 5173)

**Open:** `http://localhost:5173/`

**To stop:** Press `Ctrl+C` or run `docker-compose down`

📖 **[Full Docker Guide →](file:///c:/Users/lewis/Desktop/chamasmart/DOCKER_GUIDE.md)**

---

### 💻 **Option 2: Manual (Current Setup - More Control)**

Perfect for: Active development, debugging, faster restarts

Open **TWO** separate PowerShell terminals:

#### Terminal 1 - Backend
```powershell
cd c:\Users\lewis\Desktop\chamasmart\backend
node server.js
```

You should see:
```
STABILIZED: Server running on port 5005
```

#### Terminal 2 - Frontend
```powershell
cd c:\Users\lewis\Desktop\chamasmart\frontend
npm run dev
```

You should see:
```
VITE v7.3.0  ready in 15079 ms
➜  Local:   http://localhost:5173/
```

**Open:** `http://localhost:5173/`

---

## 🔍 Verify Everything is Working

### Check Backend Health
```powershell
# Manual setup (port 5005)
Invoke-RestMethod -Uri http://localhost:5005/health

# Docker setup (port 5000)
Invoke-RestMethod -Uri http://localhost:5000/health
```

Expected response:
```json
{
  "uptime": 7.54,
  "message": "OK",
  "timestamp": 1736369806906,
  "port": 5005
}
```

### Check Backend API
```powershell
# Manual setup
Invoke-RestMethod -Uri http://localhost:5005/api/ping

# Docker setup
Invoke-RestMethod -Uri http://localhost:5000/api/ping
```

Should return: `{"success": true, "message": "pong"}`

---

## 📝 Important Port Differences

| Component | Manual Setup | Docker Setup |
|-----------|--------------|--------------|
| Backend | Port **5005** | Port **5000** |
| Frontend | Port **5173** | Port **5173** |
| PostgreSQL | Port **5432** | Port **5433** |
| Redis | Port **6379** | Port **6379** |

---

## ❌ Troubleshooting

### Manual Setup Issues

**Port already in use:**
```powershell
# Kill all node processes
taskkill /F /IM node.exe /T

# Then restart backend and frontend
```

**Backend crashes on startup:**
```powershell
# Check PostgreSQL is running
psql -U postgres -d chamasmart
```

**Frontend can't connect to backend:**
```powershell
# Verify backend is running
Invoke-RestMethod -Uri http://localhost:5005/api/ping
```

### Docker Setup Issues

**Port conflicts:**
```bash
# Stop all containers
docker-compose down

# Kill manual processes
taskkill /F /IM node.exe /T

# Start Docker again
docker-compose up
```

**Docker daemon not running:**
- Make sure Docker Desktop is running
- Check system tray for Docker icon

**Database connection failed:**
```bash
# Check container health
docker-compose ps

# View logs
docker-compose logs postgres
```

---

## 🎯 Quick Commands Reference

### Manual Setup
| Action | Command |
|--------|---------|
| Start Backend | `cd backend; node server.js` |
| Start Frontend | `cd frontend; npm run dev` |
| Kill All Servers | `taskkill /F /IM node.exe /T` |
| Check Health | `Invoke-RestMethod -Uri http://localhost:5005/health` |
| Check API | `Invoke-RestMethod -Uri http://localhost:5005/api/ping` |

### Docker Setup
| Action | Command |
|--------|---------|
| Start All | `docker-compose up` |
| Start in Background | `docker-compose up -d` |
| Stop All | `docker-compose down` |
| View Logs | `docker-compose logs -f` |
| Rebuild | `docker-compose up --build` |
| Clean Everything | `docker-compose down -v` |

---

## 🌟 Which Setup Should I Use?

### Use **Manual Setup** if:
- ✅ You're actively developing and need fast restarts
- ✅ You want more control over each component
- ✅ You're debugging specific issues
- ✅ You already have PostgreSQL/Redis installed

### Use **Docker Setup** if:
- ✅ First time setting up the project
- ✅ Working with a team (ensures identical environments)
- ✅ Don't want to install PostgreSQL/Redis locally
- ✅ Preparing for production deployment
- ✅ Want everything to "just work" with one command

**Both setups work perfectly!** Choose what fits your workflow. 🚀

---

## ✨ You're Ready!

**Manual Setup:**
- ✅ Backend API: `http://localhost:5005`
- ✅ Frontend UI: `http://localhost:5173`

**Docker Setup:**
- ✅ Backend API: `http://localhost:5000`
- ✅ Frontend UI: `http://localhost:5173`

Happy coding! 🎉

---

## 📚 Additional Resources

- **[Docker Guide](file:///c:/Users/lewis/Desktop/chamasmart/DOCKER_GUIDE.md)** - Complete Docker documentation
- **[Walkthrough](file:///C:/Users/lewis/.gemini/antigravity/brain/d49b34a4-57f8-40b7-92ad-761df31c5b56/walkthrough.md)** - Backend stabilization details
