#!/usr/bin/env node

/**
 * ngrok Setup Helper for StressReliefChat Local Testing
 * 
 * Usage:
 *   node setup-ngrok.js --auth-token <YOUR_NGROK_TOKEN>
 *   node setup-ngrok.js --tunnel-backend
 *   node setup-ngrok.js --tunnel-frontend
 *   node setup-ngrok.js --tunnel-all
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const authToken = args[args.indexOf('--auth-token') + 1];
const command = args[0];

// ngrok config file path
const ngrokConfigPath = path.join(process.env.HOME || process.env.USERPROFILE, '.ngrok2', 'ngrok.yml');

function setupAuthToken(token) {
  if (!token) {
    console.error('❌ Error: ngrok auth token required');
    console.error('Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken');
    console.error('Usage: node setup-ngrok.js --auth-token <YOUR_TOKEN>');
    process.exit(1);
  }

  try {
    console.log('🔐 Setting ngrok auth token...');
    execSync(`ngrok config add-authtoken ${token}`, { stdio: 'inherit' });
    console.log('✅ Auth token configured successfully!');
  } catch (error) {
    console.error('❌ Failed to set auth token:', error.message);
    process.exit(1);
  }
}

function startTunnel(port, name, region = 'us') {
  try {
    console.log(`🚀 Starting ngrok tunnel for ${name} on port ${port}...`);
    console.log(`📡 Region: ${region}`);
    execSync(`ngrok http ${port} --region=${region}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ Failed to start ${name} tunnel:`, error.message);
    process.exit(1);
  }
}

function printInstructions() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║           StressReliefChat ngrok Setup Instructions           ║
╚════════════════════════════════════════════════════════════════╝

1️⃣  GET ngrok TOKEN:
   → Visit: https://dashboard.ngrok.com/get-started/your-authtoken
   → Copy your auth token

2️⃣  CONFIGURE AUTH TOKEN:
   $ npm run setup-ngrok -- --auth-token YOUR_TOKEN

3️⃣  START TUNNELS (choose one):
   
   Option A - Run both simultaneously (separate terminals):
     Terminal 1: npm run tunnel:backend
     Terminal 2: npm run tunnel:frontend
   
   Option B - Run from root with concurrently:
     $ npm run tunnel
   
   Option C - Manually start individual tunnels:
     $ ngrok http 5000 --subdomain=stressrelief-backend
     $ ngrok http 3000 --subdomain=stressrelief-frontend

4️⃣  UPDATE ENVIRONMENT VARIABLES:
   
   Add to your frontend/.env.local:
     NEXT_PUBLIC_API_URL=https://your-ngrok-url.ngrok.io
   
   Add to your backend/.env:
     CORS_ORIGINS=http://localhost:3000,https://your-frontend-ngrok-url.ngrok.io

5️⃣  TEST CALL FEATURE:
   
   → Open frontend via ngrok URL (from Terminal 1 logs)
   → Create/login a listener account
   → Open another browser (incognito) with same ngrok URL
   → Login as user
   → Start a call and verify WebRTC works

6️⃣  MONITOR ngrok REQUESTS:
   
   → Visit: http://127.0.0.1:4040/inspector/http
   → This shows all requests passing through ngrok tunnels

TROUBLESHOOTING:

❓ "ngrok command not found"
   → Run: npm install -g ngrok
   → Or use local: npx ngrok http 5000

❓ "Authentication failed"
   → Check auth token: ngrok config --authtoken check
   → Regenerate token at: https://dashboard.ngrok.com

❓ "Subdomain already in use"
   → Use different subdomain or let ngrok assign random URL
   → Edit ngrok.yml to change settings

✅ QUICK START:
   $ npm install:all
   $ npm run tunnel
   $ # Check ngrok URLs in terminal outputs
   $ # Update NEXT_PUBLIC_API_URL in frontend
  `);
}

// Main
if (command === '--help' || command === '-h') {
  printInstructions();
} else if (command === '--auth-token' && authToken) {
  setupAuthToken(authToken);
} else if (command === '--tunnel-backend') {
  startTunnel(5000, 'Backend');
} else if (command === '--tunnel-frontend') {
  startTunnel(3000, 'Frontend');
} else if (command === '--tunnel-all') {
  console.log('ℹ️  To run both tunnels, use: npm run tunnel');
  console.log('   This will start both frontend and backend tunnels in parallel.');
} else {
  console.log('StressReliefChat ngrok Setup Helper\n');
  console.log('Usage:');
  console.log('  node setup-ngrok.js --auth-token <TOKEN>   - Configure ngrok token');
  console.log('  node setup-ngrok.js --tunnel-backend        - Start backend tunnel');
  console.log('  node setup-ngrok.js --tunnel-frontend       - Start frontend tunnel');
  console.log('  node setup-ngrok.js --help                  - Show detailed instructions\n');
  printInstructions();
}
