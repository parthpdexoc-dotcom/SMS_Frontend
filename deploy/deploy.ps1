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
    [string]$IisSitePath = "C:\inetpub\wwwroot\SMS",

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
    Write-Step "Starting SMS Frontend Deployment..."
    
    # Auto-detect path if Plexoc subdirectory is used
    if (-not (Test-Path $IisSitePath) -and (Test-Path "C:\inetpub\wwwroot\Plexoc\SMS")) {
        $IisSitePath = "C:\inetpub\wwwroot\Plexoc\SMS"
    } elseif (-not (Test-Path $IisSitePath) -and (Test-Path "C:\inetpub\wwwroot\SMS_UI")) {
        $IisSitePath = "C:\inetpub\wwwroot\SMS_UI"
    }

    Write-Host "Target IIS Path: $IisSitePath"
    Write-Host "Repository Dir:  $RepoDir"

    # 1. Verify Directories
    if (-not (Test-Path $RepoDir)) {
        throw "Repository directory '$RepoDir' not found."
    }

    # =========================================================================
    # STEP: AUTOMATIC PRE-DEPLOYMENT BACKUP
    # =========================================================================
    if (Test-Path $IisSitePath) {
        $hasFiles = (Get-ChildItem -Path $IisSitePath | Measure-Object).Count -gt 0
        if ($hasFiles) {
            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $parentDir = Split-Path $IisSitePath -Parent
            $backupBase = Join-Path $parentDir "Backups"
            if (-not (Test-Path $backupBase)) {
                New-Item -ItemType Directory -Path $backupBase -Force | Out-Null
            }
            $targetFolderName = (Get-Item $IisSitePath).Name
            $backupFolder = Join-Path $backupBase "${targetFolderName}_$timestamp"
            
            Write-Step "CREATING BACKUP: Copying live UI files to '$backupFolder' before deployment..."
            New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
            
            # Fast recursive copy to backup folder
            & robocopy.exe "$IisSitePath" "$backupFolder" /E /R:1 /W:1 /NP | Out-Null
            Write-Success "Full UI backup created successfully at: '$backupFolder'"
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

    # 5. Sync to IIS Directory with ROBOCOPY
    Write-Step "Deploying build output to IIS directory: '$IisSitePath'..."
    
    # Robocopy flags:
    # /E   : Copy all subdirectories, including empty ones.
    # /PURGE: Delete destination files that no longer exist in source (cleans up old hashed JS/CSS chunks).
    # /R:2 : Retry twice on lock.
    # /W:2 : Wait 2 seconds.
    # /NP  : No progress percentage.
    $robocopyArgs = @(
        "$buildFolder",
        "$IisSitePath",
        "/E",
        "/PURGE",
        "/R:2",
        "/W:2",
        "/NP"
    )

    & robocopy.exe @robocopyArgs | Out-Null
    $roboExit = $LASTEXITCODE

    if ($roboExit -ge 8) {
        throw "Robocopy failed with exit code $roboExit."
    }

    # 6. Verify web.config for React SPA Routing in IIS
    $targetWebConfig = Join-Path $IisSitePath "web.config"
    if (-not (Test-Path $targetWebConfig)) {
        $sourceWebConfig = Join-Path $RepoDir "public\web.config"
        if (Test-Path $sourceWebConfig) {
            Write-Step "Ensuring React SPA URL Rewrite web.config is present in IIS..."
            Copy-Item -Path $sourceWebConfig -Destination $targetWebConfig -Force
        }
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
