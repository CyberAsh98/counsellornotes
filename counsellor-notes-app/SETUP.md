# CounsellorNotes — Setup Guide

## 1. Supabase

1. Go to https://app.supabase.com → your project (`wpaceehrvopbcqmsncam`)
2. **Authentication → Providers → Email** — enable "Confirm email"
3. **SQL Editor** — run migrations in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls.sql`
4. **Settings → API** — copy your `anon` key and `service_role` key

## 2. Cloudflare

### Pages (frontend)
1. Dashboard → Workers & Pages → Create application → Pages
2. Connect to GitHub → `CyberAsh98/counsellornotes`
3. Framework preset: **Vite**; Build command: `npm run build`; Output: `dist`
4. Add environment variables:
   - `VITE_SUPABASE_URL` = `https://wpaceehrvopbcqmsncam.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (from Supabase anon key)
   - `VITE_API_URL` = `https://counsellor-notes-worker.<your-account>.workers.dev`

### Worker (API proxy)
```bash
cd counsellor-notes-app
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_KEY --config worker/wrangler.toml
# paste the service_role key when prompted
npx wrangler deploy --config worker/wrangler.toml
```

## 3. GitHub Secrets

In `CyberAsh98/counsellornotes` → Settings → Secrets → Actions, add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token (use "Edit Cloudflare Workers" template) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → right sidebar on any page |
| `VITE_SUPABASE_URL` | `https://wpaceehrvopbcqmsncam.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | From Supabase Settings → API |
| `VITE_API_URL` | Your deployed Worker URL |
| `SUPABASE_PROJECT_REF` | `wpaceehrvopbcqmsncam` |
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens → Generate |

## 4. Push to GitHub

```bash
cd "counsellor-notes-app"
git init
git remote add origin https://github.com/CyberAsh98/counsellornotes.git
git add .
git commit -m "Initial commit: full-stack CounsellorNotes app"
git push -u origin main
```

This triggers the CI/CD pipeline: migrations → build → Pages deploy → Worker deploy.

## 5. Local dev

```bash
cp .env.example .env
# Fill in your Supabase URL and anon key in .env

# Terminal 1: start worker
npx wrangler dev --config worker/wrangler.toml

# Terminal 2: start Vite
npm run dev
```

App runs at http://localhost:5173, Worker at http://localhost:8787.
