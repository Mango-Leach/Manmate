const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const services = [
  {
    name: 'frontend',
    cwd: path.join(rootDir, 'frontend'),
    args: [path.join(rootDir, 'frontend', 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', '3000'],
  },
  {
    name: 'backend',
    cwd: path.join(rootDir, 'backend'),
    args: [path.join(rootDir, 'backend', 'node_modules', 'nodemon', 'bin', 'nodemon.js'), 'server.js'],
  },
];

const children = services.map(({ cwd, args }) => spawn(process.execPath, args, {
  cwd,
  stdio: 'inherit',
  windowsHide: true,
}));

let stopping = false;

function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    killer.unref();
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach(stopChild);
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Unable to start a development service:', error.message);
    shutdown(1);
  });
  child.on('exit', (code) => shutdown(code || 0));
}

process.once('SIGINT', () => shutdown(0));
process.once('SIGTERM', () => shutdown(0));
