# ☁️ Cloudflare Pages Deployment Guide — CirculaSync E-Waste Platform

This guide provides end-to-end instructions for deploying the **CirculaSync Circular Economy & E-Waste Management Platform** to **Cloudflare Pages**.

Cloudflare Pages provides:
- **100% Free Hosting** with unlimited bandwidth and 500 builds/month.
- **Global Edge Network** across 300+ cities with sub-50ms latency worldwide.
- **Serverless Edge Functions** running on Cloudflare Workers V8 runtime (`functions/`).
- **Clean URLs** for all 8 dedicated portals (`/user`, `/collector`, `/government`, `/producer`, `/municipal`, `/medical`, `/demo`, `/track/:token`).

---

## 🏗️ 1. Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │    Cloudflare Pages Edge (Global)     │
                      └──────────────────┬───────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │ Static Asset Edge              │ Serverless Edge Functions      │
        ▼                                ▼                                ▼
  ./dist/                          /api/v1/identify-ewaste           /api/[[path]]
  ├── / (Landing Page)             ├── Native Gemini 2.0 Flash       ├── Dynamic Reverse Proxy
  ├── /user (Citizen Portal)       └── Edge Heuristic Fallback       │   to BACKEND_URL
  ├── /collector (Logistics)                                         └── Standalone Demo Fallback
  ├── /government (Regulator)
  ├── /producer (EPR Dashboard)
  ├── /municipal (SWM Portal)
  ├── /medical (BMW Portal)
  ├── /demo (Interactive Studio)
  ├── /track/:token (QR Passport)
  └── /assets/ (Shared CSS/Tokens)
```

---

## ⚡ 2. Deployment Methods

### Option A: Direct CLI Deployment with Wrangler (Fastest — 2 Minutes)

You do not need to link a GitHub repository to deploy. You can upload the build directly from your terminal using Cloudflare's official `wrangler` CLI:

1. **Build the production distribution:**
   ```powershell
   npm run build:cloudflare
   ```
   *(This compiles all 8 portals, CSS tokens, `_redirects`, and `_headers` into `./dist/`)*.

2. **Deploy directly to Cloudflare Pages:**
   ```powershell
   npx wrangler pages deploy dist --project-name=ewaste-platform
   ```
   - If prompted, log into your Cloudflare account in the browser.
   - Wrangler will upload the static assets and edge functions.
   - You will immediately receive a live URL: `https://ewaste-platform.pages.dev`!

---

### Option B: Git-Connected Continuous Deployment (Cloudflare Dashboard)

To automatically deploy whenever you push to GitHub/GitLab:

1. **Push your code to GitHub / GitLab**.
2. **Log into the Cloudflare Dashboard**:
   - Navigate to **Compute (Workers & Pages)** > **Create application** > **Pages** > **Connect to Git**.
3. **Select your repository**:
   - Choose your repo (`shreyansh-Singh11/A-waste-ecosystem`).
4. **Configure Build Settings**:
   | Setting | Value |
   | :--- | :--- |
   | **Framework preset** | `None` |
   | **Build command** | `npm run build:cloudflare` |
   | **Build output directory** | `dist` |
   | **Root directory** | `local host` *(if in subfolder, otherwise `/`)* |
5. **Click "Save and Deploy"**.

---

## 🔑 3. Environment Variables Setup

Configure environment variables in your Cloudflare Pages dashboard under:
**Pages Project** > **Settings** > **Environment variables** (or via `wrangler.toml`):

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | *(Optional)* Google AI Studio API key starting with `AIzaSy...` for live Gemini 2.0 Flash vision. | `AIzaSyD...` |
| `GEMINI_MODEL` | *(Optional)* Target multimodal vision model. | `gemini-2.0-flash` |
| `BACKEND_URL` | *(Optional)* Full URL of your Node.js/Express backend if hosted on Render, Railway, or VPS. | `https://my-backend.onrender.com` |

> [!NOTE]
> If `GEMINI_API_KEY` is omitted or quota is exceeded, the built-in **Cloudflare Edge Vision Engine** automatically provides intelligent heuristic forensic damage inspection and grading with 100% uptime!

---

## 🧪 4. Verifying Your Live Deployment

Once deployed, test the following URLs on your `*.pages.dev` domain:

1. **Landing Portal**: `https://<your-project>.pages.dev/`
2. **Citizen Portal & AI Identification**: `https://<your-project>.pages.dev/user`
   - Upload any photo of a laptop, phone, monitor, or battery.
   - Verify the forensic grading, damage matrix, and circular lifecycle recommendation render instantly.
3. **5-Minute Interactive Demo Studio**: `https://<your-project>.pages.dev/demo`
   - Play the interactive audio pitch with synchronized portal navigation.
4. **Collector Portal**: `https://<your-project>.pages.dev/collector`
5. **Regulator & CPCB Dashboard**: `https://<your-project>.pages.dev/government`
6. **Producer EPR Dashboard**: `https://<your-project>.pages.dev/producer`
7. **Municipal SWM Portal**: `https://<your-project>.pages.dev/municipal`
8. **Bio-Medical Waste Portal**: `https://<your-project>.pages.dev/medical`

---

## 🛠️ 5. Clean URL Routing & Cache Rules

The build process automatically generates two critical Cloudflare Pages configuration files inside `./dist/`:

- **`_redirects`**:
  Maps all clean URLs without `.html` extensions (e.g., `/user` -> `/user/index.html`, `/collector/scan` -> `/collector/scan.html`, `/track/*` -> `/track/track.html`).
- **`_headers`**:
  Configures global security headers (`X-Frame-Options`, `X-Content-Type-Options`), camera/geolocation permissions for QR scanning, and 1-year immutable caching for static design system assets (`/assets/*`).
