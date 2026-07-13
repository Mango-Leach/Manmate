#!/usr/bin/env bash
# Redeploy mannmate.com (StressReliefChat) on the VPS.
# Always pulls from the 'main' branch.
# Installs deps, rebuilds the frontend, reloads PM2 with zero downtime.
#
# Usage (from anywhere on the server):
#   ./deploy/deploy.sh
#
# Assumes: git remote configured, PM2 installed, and env files already present
# (backend/.env and frontend/.env.production are NOT in git — see Deployment_guide.md).

set -euo pipefail

DEPLOY_BRANCH="main"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> [1/5] Switching to branch: $DEPLOY_BRANCH"
git fetch origin

# npm ci/install can leave local edits to lockfiles (e.g. npm version drift).
# They're fully derived from package.json, so discard any local diff before pulling
# rather than letting it block the merge.
git checkout -- backend/package-lock.json frontend/package-lock.json 2>/dev/null || true

git checkout "$DEPLOY_BRANCH"
git pull origin "$DEPLOY_BRANCH" --ff-only

echo "==> [2/5] Installing backend dependencies (production only)"
( cd backend && npm ci --omit=dev )

echo "==> [3/5] Installing frontend dependencies + building"
( cd frontend && npm ci && npm run build )

echo "==> [4/5] Reloading PM2 processes (zero downtime)"
pm2 reload ecosystem.config.js --update-env
pm2 save

echo ""
echo "==> [5/5] Done. Current status:"
pm2 status
