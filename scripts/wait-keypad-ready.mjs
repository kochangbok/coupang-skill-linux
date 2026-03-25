#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sessionDir = process.env.COUPANG_SESSION_DIR?.trim()
  ? path.resolve(process.env.COUPANG_SESSION_DIR)
  : path.join(os.homedir(), '.coupang-session');
const readyPath = path.join(sessionDir, 'keypad-ready');
const timeoutSeconds = Number.parseInt(process.argv[2] ?? '180', 10);
const timeoutMs = Number.isFinite(timeoutSeconds) ? timeoutSeconds * 1000 : 180_000;
const startedAt = Date.now();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

while (Date.now() - startedAt < timeoutMs) {
  if (fs.existsSync(readyPath)) {
    console.log('KEYPAD_READY');
    process.exit(0);
  }
  await sleep(1000);
}

console.log('TIMEOUT');
process.exit(1);
