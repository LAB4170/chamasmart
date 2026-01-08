# How to Run ChamaSmart

This guide details how to set up and run the ChamaSmart application (Backend + Frontend).

## Prerequisites
1.  **Node.js** (v18+ recommended)
2.  **PostgreSQL** (Active and running on default port 5432)
3.  **Redis** (Optional but recommended for optimal rate limiting)

## 1. Installation

If this is your first time running the project, install dependencies for both the backend and frontend:

```bash
# From the root "chamasmart" directory:
npm run install:all
```

## 2. Database Setup

Ensure your PostgreSQL service is running and you have created the `chamasmart` database. Then run the migrations to create the required tables and indexes:

```bash
cd backend
npm run migrate
cd ..
```

*Note: The migration command automatically runs the public schema, table-banking, performance, and welfare module migrations in sequence.*

## 3. Running the Application

### Option A: Run Everything (Recommended)
You can run both the backend API and the frontend concurrently with a single command from the root directory:

```bash
# From the root "chamasmart" directory:
npm run dev
```

-   **Backend** will start on: `http://localhost:5000`
-   **Frontend** will start on: `http://localhost:5173` (or the next available port)

### Option B: Run Separately
If you prefer to run them in separate terminals:

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## 4. Environment Variables
Ensure your `.env` file in the `backend` directory is configured correctly (database credentials, JWT secrets, etc.).

## 5. Troubleshooting
-   **Port Conflicts**: If port 5000 is in use, kill the process or change the port in `.env`.
-   **Database Errors**: Ensure PostgreSQL is running and credentials in `.env` match your local setup.
-   **Migration Errors**: If migrations fail, try resetting the database (caution: data loss) with `npm run db:reset` in the backend folder, providing you have that script set up, or manually drop tables.

Enjoy using ChamaSmart!
