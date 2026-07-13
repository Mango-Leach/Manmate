# Deployment Guide — mannmate.com

## Branch Strategy

```
feature/xxx  →  main  (VPS deploys this)
```

The VPS deploys directly from `main`. No separate `production` branch.

---

## Step 1 — Merge your branch into main

```bash
# On your local machine
git checkout main
git merge feature/your-branch
git push origin main
```

---

## Step 2 — SSH into VPS and deploy

```bash
ssh root@62.72.12.185
cd apps/mannmate
./deploy/deploy.sh
```

`deploy/deploy.sh` handles the pull (discarding local lockfile drift first), `npm ci` for both apps, the frontend build, and a zero-downtime `pm2 reload` + `pm2 save`.

<details>
<summary>Manual steps (if not using deploy.sh)</summary>

```bash
ssh root@62.72.12.185
cd apps/mannmate
git checkout -- backend/package-lock.json frontend/package-lock.json
git pull origin main
cd backend && npm install && cd ..
cd frontend && npm install && npm run build && cd ..
pm2 reload ecosystem.config.js --update-env
pm2 save
```

</details>

---

## Useful VPS Commands

```bash
pm2 status                        # check apps are running
pm2 logs mannmate-backend         # backend logs
pm2 logs mannmate-frontend        # frontend logs
pm2 restart mannmate-backend      # manual restart
curl http://127.0.0.1:5100/health # backend health check
```

---

## VPS Quick Reference

| Item | Value |
|------|-------|
| IP | `62.72.12.185` |
| Code path | `/root/apps/mannmate` |
| PM2 apps | `mannmate-frontend` · `mannmate-backend` |
| Env files | `backend/.env` · `frontend/.env.production` |
