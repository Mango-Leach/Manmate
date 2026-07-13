# Deploying StressReliefChat to a VPS (mannmate.com)

End-to-end guide to run the app on your own VPS (Ubuntu 22.04/24.04) behind
Nginx + HTTPS, managed by PM2.

> **Shared VPS:** another project already runs on this server (Nginx on 80/443,
> apps on 3000/3001/5000/8000/8001, plus local MongoDB on 27017 and Redis on
> 6379). So this app runs on **non-conflicting internal ports 3100 (frontend)
> and 5100 (backend)**, and we **add a server block to the existing Nginx**
> rather than installing our own. We do not touch the other project.

## Architecture

mannmate.com is served by the **existing** Nginx (shared with the other site,
routed by domain name); only Nginx is exposed to the internet:

```
                          ┌───────────────────────────────┐
  Internet ──HTTPS:443──► │            Nginx              │
                          │  mannmate.com  /  www.        │
                          └───────────────┬───────────────┘
              /                           │  /api/  /health  /socket.io/
              ▼                           ▼
   ┌─────────────────────┐     ┌─────────────────────────────┐
   │ Next.js frontend    │     │ Express + Socket.IO backend │
   │ 127.0.0.1:3100 (PM2)│     │ 127.0.0.1:5100 (PM2)        │
   └─────────────────────┘     └──────────────┬──────────────┘
                                              │
                                       MongoDB Atlas (cloud)
```

- **Reverse proxy / SSL:** existing Nginx + Let's Encrypt (Certbot)
- **Process manager:** PM2 (auto-restart + start-on-boot)
- **Database:** MongoDB Atlas (existing `MONGODB_URI`)
- **Ports 3100 / 5100 are internal only** (bound for localhost via Nginx) — not opened in the firewall.

Files added for this deployment:
- `ecosystem.config.js` — PM2 process definitions
- `deploy/nginx/mannmate.com.conf` — Nginx site config
- `deploy/deploy.sh` — one-command redeploy script
- `backend/.env.production.example`, `frontend/.env.production.example` — env templates

---

## 0. DNS (do this first — propagation takes time)

At your domain registrar, create A records pointing to your VPS public IP:

| Type | Host | Value            |
|------|------|------------------|
| A    | `@`  | `YOUR_VPS_IP`    |
| A    | `www`| `YOUR_VPS_IP`    |

Verify before continuing: `dig +short mannmate.com` should return your VPS IP.

---

## 1. Prepare the server

SSH in as a sudo user. Nginx is already installed on this VPS, so most of this
is just ensuring what's missing. Each command is safe to re-run if already present.

```bash
# git (Nginx is already installed — do NOT reinstall/restart it blindly)
sudo apt update
sudo apt install -y git

# Node.js 18 LTS (backend requires >=18). Skip if `node -v` already prints >=18.
node -v 2>/dev/null || { curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs; }

# PM2 — install only if missing (the other project may already use it)
command -v pm2 >/dev/null || sudo npm install -g pm2

# Certbot — likely already present since 443 is already serving HTTPS
command -v certbot >/dev/null || sudo apt install -y certbot python3-certbot-nginx

# Firewall: only needed if ufw is active. These rules are idempotent.
sudo ufw status | grep -q "Status: active" && { sudo ufw allow OpenSSH; sudo ufw allow 'Nginx Full'; }
```

> Do not run `sudo ufw enable` if it isn't already active — on a remote box that
> can lock you out if the SSH rule isn't applied first. The other project's
> firewall setup is presumably already in place; leave it as-is.

---

## 2. Get the code

```bash
sudo mkdir -p /var/www && sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone <YOUR_REPO_URL> mannmate
cd mannmate
```

> If your repo is private, set up a deploy key or use a token-based HTTPS clone.

---

## 3. Configure environment variables

```bash
cp backend/.env.production.example backend/.env
cp frontend/.env.production.example frontend/.env.production
nano backend/.env            # fill in real values (see below)
nano frontend/.env.production
```

**Backend (`backend/.env`) — the must-set values:**
- `JWT_SECRET` — **required.** Generate one: `openssl rand -base64 48`
  (without it, auth uses an insecure hardcoded fallback).
- `MONGODB_URI` — your Atlas connection string. *(Optional: this VPS already runs
  a local MongoDB on `27017`. If the other project doesn't conflict on db name,
  you could instead use `mongodb://127.0.0.1:27017/stressrelief` — free and faster,
  but then you own backups. Atlas is the safer default.)*
- `FRONTEND_URL=https://mannmate.com,https://www.mannmate.com`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, SMTP, Razorpay, WhatsApp, Fast2SMS as used.

**Frontend (`frontend/.env.production`):**
- `NEXT_PUBLIC_API_URL=https://mannmate.com` and `NEXT_PUBLIC_SITE_URL=https://mannmate.com`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `SARVAM_API_KEY`, etc.

> Remember: `NEXT_PUBLIC_*` vars are baked in at build time — changing them
> later means rebuilding the frontend.

---

## 4. Install dependencies & build

```bash
cd backend  && npm ci --omit=dev && cd ..
cd frontend && npm ci && npm run build && cd ..
```

---

## 5. Start with PM2 (shared with the other project)

The other project already runs under PM2, so our apps just join the **same**
PM2 list. Two rules to avoid disturbing it:

1. **Run as the same user** that owns the existing PM2 (the other app runs as
   `root` from `/root/apps`, so deploy this as `root` too). PM2 lists are
   per-user — a different user gets a separate daemon and its own startup hook.
2. **`pm2 startup` is already configured** for the existing project — do **not**
   re-run it. Just `pm2 save` after adding ours, which re-snapshots *all* PM2
   apps (both projects) so they all come back on reboot. That's intended.

```bash
pm2 list                       # confirm names don't collide (ours: mannmate-*)
pm2 start ecosystem.config.js  # adds mannmate-backend + mannmate-frontend only
pm2 save                       # persist the full list (both projects)
pm2 status                     # mannmate-backend & mannmate-frontend -> "online"
```

> Redeploys via `deploy/deploy.sh` use `pm2 reload ecosystem.config.js`, which is
> scoped to the apps named in our file — it never restarts the other project.

Quick local sanity check (before Nginx):
```bash
curl -s http://127.0.0.1:5100/health   # backend health
curl -sI http://127.0.0.1:3100         # frontend responds
```

---

## 6. Nginx reverse proxy (add a site to the existing Nginx)

The other project's Nginx config stays untouched — we only add a new site file.
**Do not** remove `sites-enabled/default` or any existing site, and do not
restart Nginx (use `reload`, which is graceful and won't drop the other site).

```bash
# See what's already there first (don't disturb these):
ls -l /etc/nginx/sites-enabled/

sudo cp deploy/nginx/mannmate.com.conf /etc/nginx/sites-available/mannmate.com
sudo ln -s /etc/nginx/sites-available/mannmate.com /etc/nginx/sites-enabled/
sudo nginx -t                  # test the combined config BEFORE reloading
sudo systemctl reload nginx    # graceful — existing site keeps serving
```

> If `nginx -t` complains about a duplicate `map ... $connection_upgrade`, the
> other project already defines one in the `http` context. In that case delete
> the `map` block at the top of `mannmate.com.conf` and re-test.

Visit `http://mannmate.com` — the site should load over plain HTTP.

---

## 7. Enable HTTPS

```bash
sudo certbot --nginx -d mannmate.com -d www.mannmate.com
```

Choose to redirect HTTP→HTTPS when prompted. Certbot rewrites the Nginx config
to add the `:443` server block and sets up auto-renewal (`certbot renew` via a
systemd timer). Test renewal: `sudo certbot renew --dry-run`.

---

## 8. Update third-party services for the new domain

- **Google Cloud Console → Credentials → your OAuth client:**
  - Authorized JavaScript origins: `https://mannmate.com`, `https://www.mannmate.com`
  - Authorized redirect URIs: `https://mannmate.com/auth/google/callback`
- **MongoDB Atlas → Network Access:** add the VPS public IP to the allowlist.
- **Razorpay dashboard:** set webhook/callback URLs to the `https://mannmate.com` domain.
- **Gmail:** use an App Password (not your login password) for `SMTP_PASSWORD`.

---

## 9. Verify

- `https://mannmate.com` loads over HTTPS (valid padlock).
- Sign-up / login works (JWT + Google).
- Start a peer/AI call — the WebRTC connection establishes (this exercises
  Socket.IO over `wss://mannmate.com/socket.io/`).
- `https://mannmate.com/health` returns OK.

---

## 10. Redeploying after code changes

```bash
cd /var/www/mannmate
chmod +x deploy/deploy.sh   # once, after the first clone
./deploy/deploy.sh
```

This pulls `main`, installs deps, rebuilds the frontend, and zero-downtime
reloads PM2.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| 502 Bad Gateway | `pm2 status` (apps online?), `pm2 logs`, ports 3100/5100 listening (`sudo ss -tulpn \| grep -E ':(3100\|5100)'`) |
| WebRTC / calls don't connect | Browser console for `wss://mannmate.com/socket.io/` errors; confirm the `/socket.io/` block in Nginx + that you're on HTTPS |
| CORS errors | `FRONTEND_URL` in `backend/.env` must match the exact origin(s) |
| Google login fails | Redirect URI / JS origin mismatch in Google Cloud Console |
| DB connection fails | VPS IP added to Atlas Network Access; `MONGODB_URI` correct |
| Logs | `pm2 logs mannmate-backend` / `pm2 logs mannmate-frontend`; Nginx: `sudo tail -f /var/log/nginx/error.log` |

## Security checklist
- [ ] `JWT_SECRET` set to a strong random value (not the default).
- [ ] App ports 3100/5100 bound to localhost only (behind Nginx), not exposed publicly.
- [ ] HTTPS enforced (HTTP redirects to HTTPS).
- [ ] Atlas Network Access scoped to the VPS IP (not `0.0.0.0/0`) for production.
- [ ] No real `.env` files committed to git (only the `*.example` templates).
