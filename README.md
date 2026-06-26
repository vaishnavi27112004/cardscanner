# 📋 EXPO Lead Capture — Full Stack Setup Guide

A mobile-first PWA for capturing leads at trade shows & EXPO events.  
**Stack:** HTML/JS frontend · Node.js + Express backend · MongoDB database · JWT auth

---

## 📁 File Structure

```
expo-lead-app/
├── public/               ← Static files served by Express
│   ├── index.html        ← Main app (copy here)
│   ├── login.html        ← Login / register page (copy here)
│   └── manifest.json     ← PWA manifest (copy here)
├── server.js             ← Express + MongoDB backend
├── package.json
├── .env.example          ← Copy to .env and fill in values
└── README.md
```

> **Important:** Move `index.html`, `login.html`, and `manifest.json` into a `public/` folder.  
> Express serves everything in `public/` automatically.

---

## 🚀 Option 1 — Deploy to Render.com (FREE, recommended)

### Step 1 — MongoDB Atlas (free cloud database)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → **Try Free**
2. Create a free **M0** cluster (512 MB, plenty for leads)
3. Create a **database user** (username + password — save these)
4. Go to **Network Access** → Add IP `0.0.0.0/0` (allow all, for cloud hosting)
5. Click **Connect** → **Drivers** → copy the connection string:
   ```
   mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/expo_leads?retryWrites=true&w=majority
   ```
   Replace `USERNAME` and `PASSWORD` with your database user credentials.

### Step 2 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/expo-lead-app.git
git push -u origin main
```

### Step 3 — Deploy on Render.com

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add **Environment Variables** (click "Add Environment Variable"):

   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | your Atlas connection string from Step 1 |
   | `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` locally and paste the output |
   | `NODE_ENV` | `production` |
   | `APP_URL` | `https://your-app-name.onrender.com` (you'll know this after first deploy) |
   | `CORS_ORIGIN` | `https://your-app-name.onrender.com` |

5. Click **Deploy** — Render gives you a free `*.onrender.com` URL
6. Your app is live at `https://your-app-name.onrender.com/login.html`

---

## 🏠 Option 2 — Run Locally

### Prerequisites
- Node.js 18+ → [nodejs.org](https://nodejs.org)
- MongoDB Community → [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET

# 3. Create public folder and copy frontend files
mkdir public
cp login.html index.html manifest.json public/

# 4. Start MongoDB (if running locally)
mongod --dbpath /data/db

# 5. Start the server
npm run dev   # uses nodemon for auto-restart
# or
npm start     # production mode
```

App available at: `http://localhost:5000/login.html`

---

## 🔑 API Reference

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Create account → returns `{ token, user }` |
| `POST` | `/api/auth/login` | Login → returns `{ token, user }` |
| `POST` | `/api/auth/forgot-password` | Send reset email |
| `POST` | `/api/auth/reset-password` | Reset with token |
| `GET`  | `/api/auth/me` | Get current user (requires Bearer token) |

### Leads Endpoints (all require `Authorization: Bearer <token>`)

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/leads` | List all leads (supports `?quality=hot&search=text&sort=newest`) |
| `POST`   | `/api/leads` | Create a lead |
| `GET`    | `/api/leads/stats` | Count by quality |
| `GET`    | `/api/leads/:id` | Get single lead |
| `PUT`    | `/api/leads/:id` | Update lead |
| `DELETE` | `/api/leads/:id` | Delete lead |
| `DELETE` | `/api/leads` | Delete ALL leads for user |

---

## 📧 Email Setup (for password reset)

Using Gmail:
1. Enable **2-Factor Authentication** on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate an App Password for "Mail"
4. Add to your `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your.email@gmail.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx
   SMTP_FROM=EXPO Leads <your.email@gmail.com>
   ```

---

## 🔒 Security Notes

- JWT tokens expire after **30 days**
- Passwords are hashed with **bcrypt** (12 rounds)
- Each user can only see **their own leads**
- Reset tokens expire in **1 hour**
- Never commit `.env` to Git — it's in `.gitignore`

---

## 📱 Install as PWA

Once deployed, open the URL on your phone:
- **Android (Chrome):** Menu → "Add to Home Screen"
- **iOS (Safari):** Share → "Add to Home Screen"

The app works **offline** — leads are saved locally first, then synced to MongoDB when online.

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| `MongoDB connection error` | Check `MONGODB_URI` in `.env` and Atlas Network Access whitelist |
| `401 Unauthorised` | Token expired — log out and log back in |
| Login page loops | Clear `localStorage` in browser DevTools → Application → Local Storage |
| Render deploy fails | Check build logs; make sure `public/` folder exists with HTML files |
