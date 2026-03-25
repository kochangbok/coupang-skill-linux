#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const localCli = path.join(repoRoot, 'dist', 'cli.js');
const localNodeModules = path.join(repoRoot, 'node_modules');
const localCommander = path.join(localNodeModules, 'commander', 'package.json');
const localPlaywright = path.join(localNodeModules, 'playwright', 'package.json');
const args = process.argv.slice(2);
const skipLocal = process.env.CPCLI_LAUNCHER_SKIP_LOCAL === '1';
const skipPath = process.env.CPCLI_LAUNCHER_SKIP_PATH === '1';
const npmEnv = {
  ...process.env,
  PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
  npm_config_ignore_scripts: '1',
};

function spawnAndExit(command, commandArgs, extraEnv = {}) {
  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });

  child.on('error', (error) => {
    console.error(`[cpcli-launcher] failed to start ${command}:`, error.message);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

function commandExists(command) {
  const pathValue = process.env.PATH ?? '';
  const suffixes = process.platform === 'win32'
    ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];

  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const suffix of suffixes) {
      const candidate = path.join(dir, process.platform === 'win32' ? `${command}${suffix}` : command);
      if (fs.existsSync(candidate)) {
        return true;
      }
    }
  }

  return false;
}

const canUseLocalBuild = fs.existsSync(localCli) && fs.existsSync(localCommander) && fs.existsSync(localPlaywright);

if (!skipLocal && canUseLocalBuild) {
  spawnAndExit(process.execPath, [localCli, ...args]);
} else if (!skipPath && commandExists('cpcli')) {
  spawnAndExit('cpcli', args);
} else if (commandExists('npm')) {
  const npmPrefix = fs.mkdtempSync(path.join(os.tmpdir(), 'cpcli-launcher-'));
  const packed = spawnSync(
    'npm',
    ['pack', '--quiet', '--pack-destination', npmPrefix],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: npmEnv,
    },
  );

  if (packed.status !== 0) {
    console.error('[cpcli-launcher] failed to pack local repo for npm exec fallback.');
    if (packed.stdout) process.stderr.write(packed.stdout);
    if (packed.stderr) process.stderr.write(packed.stderr);
    process.exit(packed.status ?? 1);
  }

  const tarballName = packed.stdout.trim().split(/\r?\n/).pop();
  if (!tarballName) {
    console.error('[cpcli-launcher] npm pack did not return a tarball path.');
    process.exit(1);
  }

  const tarballPath = path.join(npmPrefix, tarballName);
  spawnAndExit('npm', ['exec', '--yes', '--prefix', npmPrefix, '--package', tarballPath, '--', 'cpcli', ...args], npmEnv);
} else {
  console.error('[cpcli-launcher] cpcli 실행 경로를 찾지 못했습니다.');
  console.error(`[cpcli-launcher] tried local dist: ${localCli}`);
  console.error('[cpcli-launcher] install Node/npm or build the repo once with `npm ci && npm run build`.');
  process.exit(1);
}
