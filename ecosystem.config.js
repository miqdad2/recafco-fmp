/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname, module */
/**
 * PM2 ecosystem config for RECAFCO FMP.
 *
 * Production server: Windows Server, hostname fmp.recafco.local
 * All three processes load .env from the repo root automatically
 * because PM2 starts each app from its own cwd and the start
 * scripts are plain `node dist/main.js` / `next start` invocations.
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup   # generates a Windows service or systemd unit
 */

'use strict';

const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    // -------------------------------------------------------------------------
    // API — NestJS backend on port 4000
    // -------------------------------------------------------------------------
    {
      name: 'recafco-fmp-api',
      cwd: path.join(ROOT, 'apps', 'api'),
      script: 'node',
      args: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: `--env-file ${path.join(ROOT, '.env')}`,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: path.join(ROOT, 'logs', 'api-error.log'),
      out_file: path.join(ROOT, 'logs', 'api-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env_production: {
        NODE_ENV: 'production',
      },
    },

    // -------------------------------------------------------------------------
    // Web — Next.js frontend on port 3000
    // -------------------------------------------------------------------------
    {
      name: 'recafco-fmp-web',
      cwd: path.join(ROOT, 'apps', 'web'),
      script: 'node',
      args: 'node_modules/.bin/next start --port 3000',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: path.join(ROOT, 'logs', 'web-error.log'),
      out_file: path.join(ROOT, 'logs', 'web-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env_production: {
        NODE_ENV: 'production',
      },
    },

    // -------------------------------------------------------------------------
    // Worker — background job processor
    // Not yet active (BullMQ/Redis integration pending).
    // Keep the entry here so the process name is registered and PM2 save
    // includes it; set status=stopped until the worker is wired up.
    // -------------------------------------------------------------------------
    {
      name: 'recafco-fmp-worker',
      cwd: path.join(ROOT, 'apps', 'worker'),
      script: 'node',
      args: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: `--env-file ${path.join(ROOT, '.env')}`,
      watch: false,
      autorestart: false,
      error_file: path.join(ROOT, 'logs', 'worker-error.log'),
      out_file: path.join(ROOT, 'logs', 'worker-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
