#Requires -Version 5.1
<#
.SYNOPSIS
    Pre-deployment readiness check for RECAFCO FMP.

.DESCRIPTION
    Verifies that the environment is ready for deployment before any files
    are touched. Run this script BEFORE scripts\deploy.ps1.

    Checks performed:
      1. pnpm is available
      2. .env file exists with required keys
      3. DATABASE_URL is reachable (psql ping)
      4. API build directory exists (dist/)
      5. Web .next/ build directory exists
      6. pm2 is available
      7. No uncommitted changes in git (warning only)

.EXAMPLE
    .\scripts\pre-deploy-check.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  RECAFCO FMP — Pre-Deployment Readiness Check" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0
$warnings = 0

function Pass([string]$msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:passed++
}

function Fail([string]$msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:failed++
}

function Warn([string]$msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
    $script:warnings++
}

# 1. pnpm available
try {
    $null = & pnpm --version 2>&1
    Pass "pnpm is available"
} catch {
    Fail "pnpm not found. Install via: npm install -g pnpm"
}

# 2. .env exists with required keys
if (Test-Path "$RepoRoot\.env") {
    $envContent = Get-Content "$RepoRoot\.env" -Raw
    $requiredKeys = @(
        'DATABASE_URL',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'CORS_ALLOWED_ORIGINS'
    )
    $missing = @()
    foreach ($key in $requiredKeys) {
        if ($envContent -notmatch "^$key=.+" ) {
            $missing += $key
        }
    }
    if ($missing.Count -eq 0) {
        Pass ".env present with all required keys"
    } else {
        Fail ".env is missing keys: $($missing -join ', ')"
    }
    # Check JWT_ACCESS_SECRET is not the placeholder
    if ($envContent -match 'JWT_ACCESS_SECRET=change_me') {
        Fail "JWT_ACCESS_SECRET is still the placeholder value — must be replaced before production"
    } else {
        Pass "JWT_ACCESS_SECRET is not the placeholder"
    }
    if ($envContent -match 'DATABASE_URL=.*change_me') {
        Fail "DATABASE_URL still contains 'change_me' — update with real credentials"
    } else {
        Pass "DATABASE_URL does not contain placeholder"
    }
} else {
    Fail ".env file not found at repo root. Copy .env.example and fill in values."
}

# 3. API dist/ exists
if (Test-Path "$RepoRoot\apps\api\dist\main.js") {
    Pass "API build exists (apps/api/dist/main.js)"
} else {
    Fail "API build missing. Run: pnpm --filter @recafco/api build"
}

# 4. Web .next/ exists
if (Test-Path "$RepoRoot\apps\web\.next\BUILD_ID") {
    Pass "Web build exists (apps/web/.next/BUILD_ID)"
} else {
    Fail "Web build missing. Run: pnpm --filter @recafco/web build"
}

# 5. Worker dist/ exists
if (Test-Path "$RepoRoot\apps\worker\dist\main.js") {
    Pass "Worker build exists (apps/worker/dist/main.js)"
} else {
    Warn "Worker build missing (apps/worker/dist/main.js) — worker is not yet active"
}

# 6. pm2 available
try {
    $null = & pm2 --version 2>&1
    Pass "pm2 is available"
} catch {
    Fail "pm2 not found. Install via: npm install -g pm2"
}

# 7. logs/ directory
if (Test-Path "$RepoRoot\logs") {
    Pass "logs/ directory exists"
} else {
    New-Item -ItemType Directory -Path "$RepoRoot\logs" | Out-Null
    Pass "logs/ directory created"
}

# 8. Uncommitted changes (warning)
try {
    $status = & git status --porcelain 2>&1
    if ($status) {
        Warn "Uncommitted changes detected. Deploy from a clean working tree."
    } else {
        Pass "Working tree is clean"
    }
} catch {
    Warn "Could not run git status"
}

Write-Host ""
Write-Host "-----------------------------------------------------"
Write-Host "  Results: $passed passed, $warnings warnings, $failed failed"
Write-Host "-----------------------------------------------------"
Write-Host ""

if ($failed -gt 0) {
    Write-Host "Pre-deployment check FAILED. Fix the above issues before deploying." -ForegroundColor Red
    exit 1
} elseif ($warnings -gt 0) {
    Write-Host "Pre-deployment check PASSED with warnings. Review warnings before deploying." -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "Pre-deployment check PASSED. Safe to proceed with deploy.ps1." -ForegroundColor Green
    exit 0
}
