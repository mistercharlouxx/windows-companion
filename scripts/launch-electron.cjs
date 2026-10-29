const { spawn } = require('node:child_process');
const electron = require('electron');

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

if (process.argv.includes('--dev')) {
  environment.VITE_DEV_SERVER_URL = 'http://127.0.0.1:5173';
}

const forwarded = process.argv.slice(2).filter(value => value !== '--dev');
const child = spawn(electron, ['.', ...forwarded], {
  cwd: process.cwd(),
  env: environment,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('exit', (code) => process.exit(code ?? 0));
