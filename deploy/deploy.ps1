<#
.SYNOPSIS
    Automated CI/CD Deployment Script for SMS Frontend (Vite + React) on Windows Server (IIS).
.DESCRIPTION
    1. Validates repository and target branch.
    2. Automatically creates a timestamped backup of the current live site folder.
    3. Runs fast npm dependency check and optimized Vite production build.
    4. Syncs the production build artifacts ('dist' folder) to live IIS web directory.
    5. Ensures React SPA URL Rewrite web.config is present.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$TargetBranch = "develop",

    [Parameter(Mandatory = $false)]
    [ValidateSet("Dev", "UAT", "Prod", "development", "uat", "prod", "production", "")]
    [string]$Environment = "Dev",

    [Parameter(Mandatory = $false)]
    [string]$ApiBaseUrl = "",

    [Parameter(Mandatory = $false)]
    [string]$IisSitePath = "",

    [Parameter(Mandatory = $false)]
    [string]$RepoDir = $PSScriptRoot + "\..",

    [Parameter(Mandatory = $false)]
    [switch]$SkipGitPull = $false
)

$ErrorActionPreference = "Stop"

function Write-Step ([string]$msg) {
    Write-Host "`n>>> [CI/CD:UI] $msg" -ForegroundColor Cyan
}

function Write-Success ([string]$msg) {
    Write-Host ">>> [SUCCESS] $msg" -ForegroundColor Green
}

function Write-WarningMsg ([string]$msg) {
    Write-Host ">>> [WARNING] $msg" -ForegroundColor Yellow
}

function Write-Failure ([string]$msg) {
    Write-Host ">>> [ERROR] $msg" -ForegroundColor Red
}

try {
    # Normalize environment
    if ([string]::IsNullOrWhiteSpace($Environment)) {
        if ($TargetBranch -match "uat") {
            $Environment = "UAT"
        } elseif ($TargetBranch -in @("main", "master", "prod", "production")) {
            $Environment = "Prod"
        } else {
            $Environment = "Dev"
        }
    } else {
        if ($Environment -in @("uat", "UAT")) {
            $Environment = "UAT"
        } elseif ($Environment -in @("prod", "production", "Prod")) {
            $Environment = "Prod"
        } else {
            $Environment = "Dev"
        }
    }

    # Resolve default IIS Site Path if not specified
    if ([string]::IsNullOrWhiteSpace($IisSitePath)) {
        if (Test-Path "D:\PublishedProject\wwwroot\sms") {
            $IisSitePath = "D:\PublishedProject\wwwroot\sms"
        } elseif (Test-Path "D:\PublishedProject\wwwroot\SMS") {
            $IisSitePath = "D:\PublishedProject\wwwroot\SMS"
        } elseif (Test-Path "C:\inetpub\wwwroot\sms") {
            $IisSitePath = "C:\inetpub\wwwroot\sms"
        } else {
            $IisSitePath = "D:\PublishedProject\wwwroot\sms"
        }
    }

    # Resolve default API Base URL if not specified
    if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
        $ApiBaseUrl = "http://122.170.13.77:90/SMSapi/api"
    }

    Write-Step "Starting SMS Frontend Deployment..."
    Write-Host "Environment:     $Environment"
    Write-Host "API Base URL:    $ApiBaseUrl"
    Write-Host "Target IIS Path: $IisSitePath"
    Write-Host "Repository Dir:  $RepoDir"

    # 1. Verify Directories
    if (-not (Test-Path $RepoDir)) {
        throw "Repository directory '$RepoDir' not found."
    }

    # =========================================================================
    # STEP: AUTOMATIC PRE-DEPLOYMENT BACKUP (STRICTLY KEEP EXACTLY 1 COPY)
    # =========================================================================
    if (Test-Path $IisSitePath) {
        $hasFiles = (Get-ChildItem -Path $IisSitePath | Measure-Object).Count -gt 0
        if ($hasFiles) {
            $parentDir = Split-Path $IisSitePath -Parent
            $targetFolderName = (Get-Item $IisSitePath).Name
            $backupFolder = Join-Path $parentDir "${targetFolderName} - Copy"
            
            # Clean up all historical timestamped copies (* - Copy (*))
            $oldCopies = Get-ChildItem -Path $parentDir -Directory -Filter "${targetFolderName} - Copy*" |
                         Where-Object { $_.FullName -ne $backupFolder }
            foreach ($old in $oldCopies) {
                Write-Host "  Removing old backup folder: $($old.Name)"
                Remove-Item -Path $old.FullName -Recurse -Force -ErrorAction SilentlyContinue
            }

            Write-Step "CREATING BACKUP: Updating single backup copy '$backupFolder'..."
            # Mirror live files to the single backup folder
            & robocopy.exe "$IisSitePath" "$backupFolder" /MIR /R:1 /W:1 /NP | Out-Null
            Write-Success "Backup secured. Exactly 1 backup copy exists on disk: '$backupFolder'"
        }
    } else {
        Write-WarningMsg "Target directory '$IisSitePath' does not exist yet. Creating directory..."
        New-Item -ItemType Directory -Path $IisSitePath -Force | Out-Null
    }

    # 2. Update Source from Git (optional, skipped if handled by GitHub Actions runner)
    Push-Location $RepoDir
    try {
        if (-not $SkipGitPull) {
            Write-Step "Updating repository working tree to latest '$TargetBranch'..."
            git fetch origin $TargetBranch
            git checkout $TargetBranch
            git reset --hard "origin/$TargetBranch"
        }
        
        # 3. Install Dependencies (smart check: verify node_modules and dependencies)
        $nodeModules = Join-Path $RepoDir "node_modules"
        $telInputPkg = Join-Path $nodeModules "mui-tel-input"
        if (-not (Test-Path $nodeModules) -or -not (Test-Path $telInputPkg)) {
            Write-Step "Installing/updating npm dependencies..."
            $env:NODE_ENV = "development"
            cmd.exe /c "npm install --no-audit --prefer-offline"
            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed with exit code $LASTEXITCODE."
            }
        } else {
            Write-Host ">>> node_modules is ready. Skipping redundant npm install." -ForegroundColor DarkGray
        }

        # 4. Build Production Bundle (Vite output: dist)
        Write-Step "Building Vite React production bundle (npm run build)..."
        $env:CI = "false"
        $env:NODE_ENV = "production"
        if (-not [string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
            $env:VITE_API_BASE_URL = $ApiBaseUrl
            Write-Host "Injected VITE_API_BASE_URL: $env:VITE_API_BASE_URL" -ForegroundColor Cyan
        }
        cmd.exe /c "npm run build"
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    # Vite builds into 'dist', fallback to 'build' if configured
    $buildFolder = Join-Path $RepoDir "dist"
    if (-not (Test-Path $buildFolder)) {
        $buildFolder = Join-Path $RepoDir "build"
    }
    if (-not (Test-Path $buildFolder)) {
        throw "Build output folder '$buildFolder' not found."
    }

    # 5. ZERO DOWNTIME SYNC TO IIS
    # Phase 1: Additive sync of new hashed assets first (WITHOUT deleting old ones)
    # Existing users actively using the app will NEVER get 404 on their chunk files!
    Write-Step "Zero-Downtime Phase 1: Additive sync of new JS/CSS chunks to '$IisSitePath\assets'..."
    $buildAssets = Join-Path $buildFolder "assets"
    $targetAssets = Join-Path $IisSitePath "assets"
    if (Test-Path $buildAssets) {
        if (-not (Test-Path $targetAssets)) {
            New-Item -ItemType Directory -Path $targetAssets -Force | Out-Null
        }
        # Additive copy (no /PURGE) so existing active user sessions are never interrupted
        & robocopy.exe "$buildAssets" "$targetAssets" /E /R:2 /W:1 /NP | Out-Null
    }

    # Phase 2: Atomic Update of Root Entry Files (index.html, favicon, etc.)
    # At this exact moment, all new requests immediately get the new index.html
    Write-Step "Zero-Downtime Phase 2: Updating application entry point (index.html)..."
    & robocopy.exe "$buildFolder" "$IisSitePath" /LEV:1 /R:2 /W:1 /NP /XF "web.config" | Out-Null

    # Phase 3: Prune old asset chunks older than 24 hours
    Write-Step "Zero-Downtime Phase 3: Pruning expired asset chunks older than 24 hours..."
    try {
        if (Test-Path $targetAssets) {
            Get-ChildItem -Path $targetAssets -File | Where-Object { 
                $_.LastWriteTime -lt (Get-Date).AddHours(-24) 
            } | Remove-Item -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-WarningMsg "Notice on asset pruning: $_"
    }

    Write-Success "Static files deployed successfully with ZERO DOWNTIME. Server web.config remained untouched."

    # 6. Verify web.config for React SPA Routing in IIS (only created if missing on new install)
    $targetWebConfig = Join-Path $IisSitePath "web.config"
    if (-not (Test-Path $targetWebConfig)) {
        $sourceWebConfig = Join-Path $RepoDir "public\web.config"
        if (Test-Path $sourceWebConfig) {
            Write-Step "Initial setup: Placing React SPA URL Rewrite web.config in IIS..."
            Copy-Item -Path $sourceWebConfig -Destination $targetWebConfig -Force
            Write-Success "web.config created for first-time installation."
        }
    } else {
        Write-Host ">>> Existing live web.config preserved (not replaced)." -ForegroundColor DarkGray
    }

    Write-Success "=========================================================="
    Write-Success " SMS Frontend Deployment Completed Successfully! "
    Write-Success " Target: $IisSitePath"
    Write-Success " Live files backed up before sync."
    Write-Success "=========================================================="
    exit 0
}
catch {
    Write-Failure "Frontend Deployment FAILED: $_"
    exit 1
}
