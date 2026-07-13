# Local Testing Guide - ngrok & Call Feature

## Quick Start (3 Steps)

### 1. Configure ngrok Auth Token
```bash
npm run setup-ngrok -- --auth-token YOUR_NGROK_AUTH_TOKEN
```

Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Build & Start Tunnels
```bash
# Terminal 1: Run build
npm run build

# Terminal 2: Start both tunnels
npm run tunnel

# Wait for ngrok URLs to appear in console
```

---

## Prerequisites

✅ **ngrok Account** - [Free signup](https://ngrok.com)
✅ **Node.js** - v18+
✅ **npm** - v9+

---

## Step-by-Step Testing

### Phase 1: Environment Setup

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

2. **Build frontend:**
   ```bash
   cd frontend && npm run build
   cd ..
   ```

3. **Verify backend services:**
   ```bash
   cd backend && npm run lint
   npm test
   cd ..
   ```

### Phase 2: ngrok Configuration

1. **Get your ngrok auth token:**
   - Visit: https://dashboard.ngrok.com/get-started/your-authtoken
   - Copy the token

2. **Configure ngrok:**
   ```bash
   npm run setup-ngrok -- --auth-token YOUR_TOKEN_HERE
   ```

3. **Verify configuration:**
   ```bash
   ngrok config check
   ```

### Phase 3: Start Services

#### Option A: Concurrent Mode (Recommended)
```bash
npm run tunnel
```
This starts both frontend and backend tunnels simultaneously.

#### Option B: Separate Terminals
```bash
# Terminal 1: Backend tunnel
npm run tunnel:backend

# Terminal 2: Frontend tunnel  
npm run tunnel:frontend
```

#### Option C: Development Mode with Tunnels
```bash
# Terminal 1: Frontend dev + tunnel
cd frontend && npm run tunnel:frontend

# Terminal 2: Backend dev + tunnel
cd backend && npm run tunnel

# Terminal 3: Frontend dev server (optional)
cd frontend && npm run dev
```

### Phase 4: Update Environment Variables

#### Frontend Setup
Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://your-backend-ngrok-url.ngrok.io
```

From ngrok terminal output, copy the backend URL:
```
Forwarding   https://abc-123-def-456.ngrok.io -> http://localhost:5000
```
Copy: `https://abc-123-def-456.ngrok.io`

#### Backend Setup
Edit `backend/.env`:
```env
CORS_ORIGINS=http://localhost:3000,https://your-frontend-ngrok-url.ngrok.io,http://localhost:5000
```

From ngrok terminal output, copy the frontend URL and add it.

### Phase 5: Test Call Feature

1. **Open ngrok monitoring:**
   - Visit: http://127.0.0.1:4040/inspector/http
   - Watch real-time requests

2. **Test user flows:**

   **Flow 1: Listener Call**
   ```
   Browser 1 (Listener):
   - Open frontend ngrok URL
   - Login as listener
   - Set status "Available"
   
   Browser 2 (User):
   - Open frontend ngrok URL (incognito)
   - Login as regular user
   - Click "Start Call"
   - Request connects to listener
   - WebRTC streams should work
   ```

   **Flow 2: Cross-Device Testing**
   ```
   Device 1 (Listener):
   - Open ngrok frontend URL
   - Login as listener
   
   Device 2 (User):
   - Open ngrok frontend URL
   - Login as user
   - Start call (should work on different devices)
   ```

3. **Verify in ngrok Inspector:**
   - Check `/api/matching/start-matching` POST requests
   - Verify `/api/transcribe/upload` endpoints
   - Monitor WebSocket connections

---

## Troubleshooting

### ❌ ngrok command not found
```bash
# Option 1: Install globally
npm install -g ngrok

# Option 2: Use local npx
npx ngrok http 5000
```

### ❌ Authentication Failed
```bash
# Check current config
ngrok config check

# Reconfigure auth token
ngrok config add-authtoken YOUR_TOKEN

# Verify token at dashboard
https://dashboard.ngrok.com/get-started/your-authtoken
```

### ❌ Subdomain Already in Use
The default subdomain might be taken. Either:
1. Use a different subdomain in package.json scripts
2. Let ngrok auto-assign a random URL
3. Upgrade ngrok plan for reserved subdomains

### ❌ WebRTC Connection Fails
1. Check backend CORS configuration:
   ```bash
   grep CORS_ORIGINS backend/.env
   ```

2. Verify frontend API URL:
   ```bash
   grep NEXT_PUBLIC_API_URL frontend/.env.local
   ```

3. Monitor ngrok requests at: http://127.0.0.1:4040

### ❌ Tunnel Connection Drops
```bash
# Restart with increased timeout
ngrok http 5000 --region=us --log=stdout
```

### ❌ MongoDB Connection Issues
Make sure backend `.env` has valid `MONGODB_URI`:
```bash
# Test connection
cd backend && node -e "console.log(process.env.MONGODB_URI || 'NOT SET')"
```

---

## Advanced Configuration

### Custom Region
Edit `backend/package.json` and `frontend/package.json` tunnel scripts:
```json
"tunnel": "ngrok http 5000 --region=eu"
```

Available regions: `us`, `eu`, `au`, `ap`, `sa`, `jp`, `in`

### Static Subdomains (Pro Feature)
If you have ngrok Pro:
```bash
ngrok http 5000 --subdomain=my-stress-relief --region=us
```

### Reserved Domains
Configure in `~/.ngrok2/ngrok.yml`:
```yaml
tunnels:
  backend:
    proto: http
    addr: 5000
    subdomain: my-backend
  frontend:
    proto: http
    addr: 3000
    subdomain: my-frontend
```

Then start with:
```bash
ngrok start backend frontend
```

---

## Monitoring & Debugging

### Real-time Request Inspection
```bash
# In another terminal
open http://127.0.0.1:4040/inspector/http
```

### View ngrok Logs
```bash
# Verbose logging
ngrok http 5000 --log=stdout

# Save to file
ngrok http 5000 --log=file.log
```

### Test API Endpoints Directly
```bash
# Get auth token
curl https://your-ngrok-url.ngrok.io/api/auth/check

# Test matching
curl -X POST https://your-ngrok-url.ngrok.io/api/matching/start-matching \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"role":"listener"}'
```

---

## Performance Tips

1. **Use closest region:**
   ```bash
   ngrok http 5000 --region=us  # Change to your region
   ```

2. **Enable compression:**
   - Add to backend CORS: `compression` middleware
   - Already configured in code

3. **Monitor connection quality:**
   - Check ngrok inspector for latency
   - WebRTC should show low ping times

4. **Bandwidth considerations:**
   - Video calls need 1-2 Mbps
   - Audio calls need 50-100 Kbps
   - ngrok free tier has unlimited bandwidth

---

## Scripts Reference

```bash
# Full build and test
npm run build

# Install all dependencies
npm run install:all

# Run both tunnels
npm run tunnel

# Run backend tunnel only
npm run tunnel:backend

# Run frontend tunnel only
npm run tunnel:frontend

# Linting
npm run lint
npm run lint:fix

# Setup ngrok
npm run setup-ngrok -- --auth-token TOKEN

# Development mode (local)
cd frontend && npm run dev:all
```

---

## Expected Results

✅ **Successful Setup Indicators:**
- Both frontend and backend tunnels show green "online" status
- ngrok inspector shows HTTP requests flowing
- Frontend loads via ngrok URL without errors
- WebSocket connections establish (check Network tab)
- Call feature responds without CORS errors

❌ **Common Issues to Avoid:**
- Stale environment variables (clear cache & restart)
- MongoDB connectivity (verify `MONGODB_URI`)
- Invalid auth tokens (regenerate from dashboard)
- Firewall blocking ngrok (check firewall rules)

---

## Next Steps

After successful testing:

1. **Deploy to staging:**
   - Use production-grade tunneling service
   - Configure permanent domain
   - Set up monitoring/alerting

2. **Performance optimization:**
   - Enable caching strategies
   - Optimize WebRTC settings
   - Monitor call quality metrics

3. **Security hardening:**
   - Enable encryption for sensitive data
   - Configure rate limiting
   - Implement token refresh logic

---

**Need help?** Check ngrok docs: https://ngrok.com/docs
