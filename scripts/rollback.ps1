#Requires -Version 5.1
<#
.SYNOPSIS
    Roll back RECAFCO FMP to the previous deployment commit.

.DESCRIPTION
    Reads the commit hash written by the last deploy.ps1 run and checks
    out that commit, rebuilds, and reloads PM2.

    IMPORTANT: This script does NOT reverse Prisma migrations. If a
    migration was applied during the failed deploy, it remains applied.
    Schema changes are additive-only, so the previous code version can
    still run against the newer schema. If a migration itself is broken,
    restore from a pg_dump backup instead.

    SAFETY RULES enforced by this script:
      - Never runs `prisma migrate reset` or `prisma db push`
      - Never drops tables or truncates data
      - Uses `pm2 reload` (graceful), not hard kill

.EXAMPLE
    .\scripts\rollback.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host "  RECAFCO FMP — Rollback" -ForegroundColor Yellow
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host ""

$rollbackFile = "$RepoRoot\logs\last-deploy-commit.txt"

if (-not (Test-Path $rollbackFile)) {
    Write-Host "ERROR: Rollback marker not found at $rollbackFile" -ForegroundColor Red
    Write-Host "No previous deployment commit recorded. Cannot rollback automatically." -ForegroundColor Red
    exit 1
}

$targetCommit = (Get-Content $rollbackFile -Raw).Trim()
if (-not $targetCommit) {
    Write-Host "ERROR: Rollback marker file is empty." -ForegroundColor Red
    exit 1
}

Write-Host "Rolling back to commit: $targetCommit" -ForegroundColor Yellow
Write-Host ""

$currentCommit = (& git rev-parse HEAD 2>&1).Trim()
if ($currentCommit -eq $targetCommit) {
    Write-Host "Already at the rollback target commit. Nothing to do." -ForegroundColor Green
    exit 0
}

Write-Host ">> Checking out previous commit..."
& git checkout $targetCommit -- .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git checkout failed" -ForegroundColor Red
    exit 1
}
Write-Host "   OK: Checked out $targetCommit"

Write-Host ""
Write-Host ">> Installing dependencies..."
& pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: pnpm install failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host ">> Rebuilding..."
& pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed at rollback commit" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host ">> Reloading PM2 (graceful)..."
& pm2 reload recafco-fmp-api --update-env
& pm2 reload recafco-fmp-web --update-env
& pm2 save

Write-Host ""
Write-Host ">> Verifying health endpoint..."
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri 'http://localhost:4000/health' -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "   OK: Health check passed" -ForegroundColor Green
    } else {
        Write-Host "   WARN: Health check returned HTTP $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   WARN: Health check failed: $_ — inspect pm2 logs" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Rollback COMPLETE — now at: $targetCommit" -ForegroundColor Green
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  NOTE: Applied Prisma migrations were NOT reversed." -ForegroundColor Yellow
Write-Host "  If schema changes are incompatible, restore from pg_dump backup." -ForegroundColor Yellow
Write-Host ""
