# 🌐 VibeGrid — Social Media Platform

A modern, full-stack social media web application built with **React.js (Vite + JavaScript JSX)**, **Node.js**, **Express.js**, and **PostgreSQL**.

---

## 📂 Project Architecture

```
Social_Media_Project/
├── package.json               # Root scripts to run both client and server
├── .gitignore                 # Excludes node_modules, .env, and uploads/
├── README.md                  # This documentation
│
├── client/                    # ⚛️ React Frontend (Vite + JavaScript JSX)
│   ├── index.html             # HTML5 entry point
│   ├── package.json           # React dependencies
│   ├── vite.config.js         # Vite config with API proxy to port 5000
│   └── src/
│       ├── main.jsx           # React DOM root render
│       ├── App.jsx            # Core app layout & theme switcher
│       ├── api/client.js      # Reusable API fetcher (with HTTP-Only cookies)
│       ├── components/        # UI components (StatusDashboard, etc.)
│       └── styles/index.css   # Modern social-media design tokens & dark mode
│
└── server/                    # 🚀 Node.js + Express REST API Backend
    ├── package.json           # Express dependencies (pg, bcrypt, jwt, multer)
    ├── .env.example           # Configuration template
    ├── .env                   # Local configuration (never committed to Git)
    ├── src/
    │   ├── server.js          # Express app entry, security headers, CORS
    │   ├── config/env.js      # Centralized environment variable validator
    │   ├── config/db.js       # PostgreSQL connection pool & health checker
    │   └── db/schema.sql      # Database tables definition (Users, Posts, Likes, etc.)
    └── uploads/               # Uploaded images (avatars & posts)
```

---

## 🚀 Getting Started (Phase 1 Setup)

### Step 1: Install Dependencies

In your terminal, navigate to the project directory:
```bash
cd "/Users/atulyadav/Learning/Ai-Learning/Social_Media_Project"
```

Install server dependencies:
```bash
cd server && npm install && cd ..
```

Install client dependencies:
```bash
cd client && npm install && cd ..
```

---

### Step 2: Configure Your Database in `server/.env`

Open `server/.env` and configure your PostgreSQL database:

* **Option A: Free Cloud PostgreSQL (Recommended — No local setup needed)**
  1. Create a free PostgreSQL instance at [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com).
  2. Copy your connection URI.
  3. Paste it into `server/.env`:
     ```env
     DATABASE_URL=postgresql://username:password@ep-sample-12345.us-east-2.aws.neon.tech/vibegrid_db?sslmode=require
     ```

* **Option B: Local PostgreSQL (via Homebrew)**
  ```bash
  brew install postgresql@16
  brew services start postgresql@16
  createdb vibegrid_db
  ```
  Then in `server/.env`:
  ```env
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vibegrid_db
  ```

---

### Step 3: Run the Development Servers

Open two terminal windows (or tabs):

**Terminal 1 — Backend Express Server**:
```bash
cd "/Users/atulyadav/Learning/Ai-Learning/Social_Media_Project/server"
npm run dev
```
*Server will start at: `http://localhost:5000`*

**Terminal 2 — Frontend React App**:
```bash
cd "/Users/atulyadav/Learning/Ai-Learning/Social_Media_Project/client"
npm run dev
```
*Client will start at: `http://localhost:5173`*

---

## 🧪 Phase 1 Testing Checklist

Open `http://localhost:5173` in your browser:
- [ ] **Frontend Status**: Displays `● Online` (React 18 + Vite).
- [ ] **Backend Status**: Displays `● Online` with server uptime.
- [ ] **Database Status**: Displays `● Connected` once your PostgreSQL connection string is configured.
- [ ] **Dark / Light Mode**: Click the 🌙 / ☀️ button in the top right corner to verify theme switching.
- [ ] **Direct API Test**: Open `http://localhost:5000/api/health` in your browser to inspect the raw JSON health response.
