// PM2 process manager config for the mannmate.com (StressReliefChat) VPS deployment.
//
// Usage (from repo root on the server):
//   pm2 start ecosystem.config.js          # start both apps
//   pm2 startup                            # print the boot-on-reboot command (run what it prints)
//   pm2 save                               # persist current process list across reboots
//   pm2 reload ecosystem.config.js --update-env   # zero-downtime reload after a deploy
//
// Notes:
//  - Both apps run in `fork` mode with a single instance. Socket.IO (WebRTC
//    signaling) requires a single process unless you add a sticky-session
//    adapter, so do NOT switch these to cluster mode.
//  - Secrets are loaded from each app's own env file (backend reads backend/.env
//    via dotenv; Next.js reads frontend/.env.production at build & runtime).
module.exports = {
  apps: [
    {
      name: 'mannmate-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5100, // 5000 is taken by another project on this VPS
      },
      max_memory_restart: '400M',
      autorestart: true,
      time: true, // prefix log lines with timestamps
    },
    {
      name: 'mannmate-frontend',
      cwd: './frontend',
      // Call the Next.js binary directly so PM2 owns the process (clean reloads).
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3100', // 3000 is taken by another project on this VPS
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3100,
      },
      max_memory_restart: '600M',
      autorestart: true,
      time: true,
    },
  ],
};
