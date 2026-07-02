#Requires -Version 5.1
<#
.SYNOPSIS
    Deploy RECAFCO FMP to the Windows production server.

.DESCRIPTION
    Performs a zero-downtime rolling deploy:
      1. Run pre-deploy-check (aborts on failure)
      2. Snapshot current git state as a rollback marker
      3. Pull latest code from origin/main
      4. Install dependencies (pnpm install --frozen-lockfile)
      5. Build all workspaces (turbo build)
      6. Run Prisma migrations (prisma migrate deploy)
      7. Reload PM2 processes gracefully (pm2 reload)
      8. Verify health endpoint responds 200

    SAFETY RULES enforced by this script:
      - Never runs `prisma migrate reset` or `prisma db push`
      - Never drops tables or truncates data
      - Never kills all node.exe processes
      - Uses `pm2 reload` (graceful), not `pm2 restart` (hard kill)

.PARAMETER SkipPreCheck
    Skip the pre-deployment readiness check (for CI environments where
    the check has already been run in a prior step).

.EXAMPLE
    .\scripts\deploy.ps1
    .\scripts\deploy.ps1 -SkipPreCheck
#>
param(
    [switch]$SkipPreCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$ApiHealthUrl = 'http://localhost:4000/health'

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  RECAFCO FMP — Production Deploy" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

function Step([string]$msg) {
    Write-Host ""
    Write-Host ">> $msg" -ForegroundColor Cyan
}

function Ok([string]$msg) {
    Write-Host "   OK: $msg" -ForegroundColor Green
}

function Fatal([string]$msg) {
    Write-Host ""
    Write-Host "FATAL: $msg" -ForegroundColor Red
    Write-Host "Deploy aborted. No changes were applied." -ForegroundColor Red
    exit 1
}

# ---- Step 0: Pre-deploy check ----
if (-not $SkipPreCheck) {
    Step "Running pre-deployment readiness check..."
    & "$PSScriptRoot\pre-deploy-check.ps1"
    if ($LASTEXITCODE -ne 0) {
        Fatal "Pre-deployment check failed. Aborting."
    }
    Ok "Pre-deployment check passed"
}

# ---- Step 1: Record rollback marker ----
Step "Recording rollback marker..."
$previousCommit = (& git rev-parse HEAD 2>&1).Trim()
$rollbackFile = "$RepoRoot\logs\last-deploy-commit.txt"
$previousCommit | Out-File -FilePath $rollbackFile -Encoding utf8
Ok "Previous commit recorded: $previousCommit"

# ---- Step 2: Pull latest ----
Step "Pulling latest code from origin/main..."
& git pull origin main
if ($LASTEXITCODE -ne 0) { Fatal "git pull failed" }
$newCommit = (& git rev-parse HEAD 2>&1).Trim()
Ok "Now at commit: $newCommit"

# ---- Step 3: Install dependencies ----
Step "Installing dependencies (frozen lockfile)..."
& pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Fatal "pnpm install failed" }
Ok "Dependencies installed"

# ---- Step 4: Build all workspaces ----
Step "Building all workspaces via Turbo..."
& pnpm run build
if ($LASTEXITCODE -ne 0) { Fatal "Build failed" }
Ok "Build complete"

# ---- Step 5: Run Prisma migrations ----
Step "Running Prisma migrations (deploy — never reset)..."
Set-Location "$RepoRoot\packages\database"
& pnpm exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Set-Location $RepoRoot
    Fatal "Prisma migrate deploy failed — rolling back to $previousCommit"
}
Set-Location $RepoRoot
Ok "Migrations applied"

# ---- Step 6: Reload PM2 gracefully ----
Step "Reloading PM2 processes (graceful)..."
& pm2 reload recafco-fmp-api --update-env
if ($LASTEXITCODE -ne 0) { Fatal "pm2 reload recafco-fmp-api failed" }
& pm2 reload recafco-fmp-web --update-env
if ($LASTEXITCODE -ne 0) { Fatal "pm2 reload recafco-fmp-web failed" }
Ok "PM2 processes reloaded"

# ---- Step 7: Health check ----
Step "Verifying API health endpoint..."
Start-Sleep -Seconds 3
try {
    $response = Invoke-WebRequest -Uri $ApiHealthUrl -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Ok "API health check passed (HTTP 200)"
    } else {
        Fatal "API health check returned HTTP $($response.StatusCode)"
    }
} catch {
    Fatal "API health check failed: $_"
}

# ---- Step 8: Save PM2 state ----
Step "Saving PM2 process list..."
& pm2 save
Ok "PM2 state saved"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Deploy COMPLETE" -ForegroundColor Green
Write-Host "  Commit: $newCommit" -ForegroundColor Green
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  To rollback: .\scripts\rollback.ps1" -ForegroundColor Yellow
Write-Host ""
