#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const launcherPath = path.join(repoRoot, 'scripts', 'cpcli-launcher.mjs');
const sessionDir = process.env.COUPANG_SESSION_DIR?.trim()
  ? path.resolve(process.env.COUPANG_SESSION_DIR)
  : path.join(os.homedir(), '.coupang-session');
const credentialsPath = path.join(sessionDir, 'credentials.json');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
  });
}

const npmCheck = run('npm', ['--version']);
const launcherCheck = run(process.execPath, [launcherPath, '--help']);

console.log('=== OpenClaw smoke ===');
console.log(`repo: ${repoRoot}`);
console.log(`launcher: ${launcherPath}`);
console.log(`session: ${sessionDir}`);
console.log('');

if (npmCheck.status === 0) {
  console.log(`npm: OK (${npmCheck.stdout.trim()})`);
} else {
  console.log('npm: FAIL');
  if (npmCheck.stderr) console.log(npmCheck.stderr.trim());
}

if (launcherCheck.status === 0) {
  console.log('launcher: OK');
} else {
  console.log('launcher: FAIL');
  if (launcherCheck.stderr) console.log(launcherCheck.stderr.trim());
}

console.log(`credentials: ${fs.existsSync(credentialsPath) ? 'FOUND' : 'MISSING'} (${credentialsPath})`);
console.log('');
console.log('next:');
console.log(`1. ${process.execPath} ${launcherPath} --help`);
console.log('2. npx playwright install chromium');
console.log(`3. create ${credentialsPath} if missing`);
console.log(`4. COUPANG_HEADLESS=1 ${process.execPath} ${launcherPath} status`);
console.log(`5. COUPANG_HEADLESS=1 ${process.execPath} ${launcherPath} price-check --json "마이노멀 바닐라 아이스크림 파인트"`);

process.exit(launcherCheck.status === 0 ? 0 : 1);
