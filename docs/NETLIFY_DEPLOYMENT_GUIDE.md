# CirculaSync / EcoTrack 360 — Netlify Deployment Guide

This guide walks you through deploying **CirculaSync** (all 8 role portals, the 5-Minute Demo Studio, and the serverless Express API) to **Netlify** with free HTTPS and global edge CDN.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │             NETLIFY GLOBAL CDN               │
                      └───────┬──────────────────────────────┬───────┘
                              │                              │
            Static Frontend   ▼                              ▼  Dynamic Backend
       ┌──────────────────────────────┐              ┌──────────────────────────────┐
       │   DIST/ (High-Speed Edge)    │              │ NETLIFY SERVERLESS FUNCTIONS │
       ├──────────────────────────────┤              ├──────────────────────────────┤
       │ /            -> Landing      │              │ /api/*                       │
       │ /user        -> Citizen App  │              │   -> netlify/functions/api.js│
       │ /collector   -> Recycler Hub │              │   -> server.js Express app   │
       │ /municipal   -> Municipal SWM│              │   -> Decision Engine         │
       │ /medical     -> Biomedical   │              │   -> Auction / Route Engine  │
       │ /producer    -> Brand EPR    │              └──────────────────────────────┘
       │ /government  -> Command Hub  │
       │ /demo        -> Demo Studio  │
       │ /assets      -> Shared Tokens│
       └──────────────────────────────┘
```

---

## Method 1: Deploy with Netlify Web Dashboard (Recommended / Easiest)

This links your GitHub repository directly to Netlify so every push automatically redeploys.

1. **Commit and Push your changes to GitHub:**
   ```powershell
   git add .
   git commit -m "feat: configure Netlify serverless deployment and 5-min demo studio"
   git push origin main
   ```

2. **Open Netlify:**
   - Go to [**app.netlify.com**](https://app.netlify.com) and log in (or sign up with GitHub).

3. **Import Project:**
   - Click **"Add new site"** $\rightarrow$ **"Import an existing project"**.
   - Select **GitHub** and authorize access.
   - Choose your repository: `shreyansh-Singh11/A-waste-ecosystem` (or your repo name).

4. **Verify Build Settings:**
   Netlify will automatically read [`netlify.toml`](file:///c:/Users/shreyansh/Downloads/sih/netlify.toml). Confirm these settings:
   - **Base directory:** `local host`
   - **Build command:** `npm run build:netlify`
   - **Publish directory:** `local host/dist` (or `dist` if base is set to `local host`)
   - **Functions directory:** `netlify/functions`

5. **(Optional) Environment Variables:**
   - In Netlify under **Site configuration** $\rightarrow$ **Environment variables**, you can optionally add:
     - `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API key for live optical diagnostics. If left blank, the app runs in simulated demo mode automatically.

6. **Click "Deploy Site":**
   - Within 1–2 minutes, Netlify will build the static portals, bundle the serverless functions, and give you a live production URL:
     `https://<your-custom-subdomain>.netlify.app`

---

## Method 2: Deploy from Terminal via Netlify CLI

If you want to deploy directly from your machine without waiting for GitHub:

1. **Log in to Netlify CLI:**
   ```powershell
   netlify login
   ```
   *(This opens a browser tab. Click **Authorize** to connect your account.)*

2. **Build the production distribution:**
   ```powershell
   cd "c:\Users\shreyansh\Downloads\sih\local host"
   npm run build:netlify
   ```

3. **Deploy to Production:**
   ```powershell
   netlify deploy --prod
   ```
   - When asked *"Create & configure a new site"*, choose **Yes**.
   - When asked *"Publish directory"*, press Enter to accept `dist`.
   - Netlify will upload your site and output your live production URL:
     ```
     Website URL:       https://circulasync-sih2026.netlify.app
     Function URL:      https://circulasync-sih2026.netlify.app/.netlify/functions/api
     ```

---

## Verifying the Live Netlify Deployment

Once your site is deployed, verify all endpoints on your live `.netlify.app` domain:

| Surface | Live Route | Expected Result |
| :--- | :--- | :--- |
| **Landing Hub** | `https://<site>.netlify.app/` | Hero page, Swachh 4,200 scorecard, speed-run link |
| **5-Min Demo Studio** | `https://<site>.netlify.app/demo/` | Dual-pane video simulation & teleprompter |
| **Citizen App** | `https://<site>.netlify.app/user` | AI triage, Eco-Card, doorstep pickup |
| **Recycler Hub** | `https://<site>.netlify.app/collector` | Optical scanner & 5-min reverse English auction |
| **Municipal SWM** | `https://<site>.netlify.app/municipal` | Eulerian Chinese Postman routing & weighbridge scale |
| **Healthcare BMW** | `https://<site>.netlify.app/medical` | CPCB 4-color segregation & autoclave certs |
| **Brand EPR Desk** | `https://<site>.netlify.app/producer` | Annual deficit tracker & carbon credit ledger |
| **Apex Command** | `https://<site>.netlify.app/government` | Swachh Survekshan marks & 1-click CPCB Form-4 |
| **Serverless API** | `https://<site>.netlify.app/api/stats` | JSON response from Express serverless function |

---

## Adding the Live Link & Video Link to Your SIH Presentation (PPT)

Now that you have your live Netlify site and recorded pitch video:

1. **Slide 1 (Title / Team Slide):**
   - Add Live Platform Badge:
     ```
     🌐 Live Production Ledger: https://<site>.netlify.app
     ```
2. **Slide 2 (Architecture / Live Demo Slide):**
   - Add Clickable Button / Hyperlink:
     - Text: **`[ 🎬 Watch 5-Minute Unlisted Video Walkthrough ]`**
     - Link: Your unlisted YouTube URL
   - Add Live Interactive Studio Link:
     - Text: **`[ 🚀 Launch Live Interactive Demo Studio ]`**
     - Link: `https://<site>.netlify.app/demo/`
   - Add QR Code: Insert a QR code pointing to your unlisted YouTube video so judges can watch on their phones during the evaluation.
