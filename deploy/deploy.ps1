<#
.SYNOPSIS
    Automated CI/CD Deployment Script for SMS Frontend (Vite + React) on Windows Server (IIS).
.DESCRIPTION
    1. Validates repository, target branch, and environment (Dev, UAT, Prod).
    2. Resolves environment-specific API Base URL:
       - Dev:  http://122.170.13.77:90/SMSapi
       - UAT:  https://api-uat.checkthesite.com/api
       - Prod: https://api.checkthesite.com/api
    3. Automatically creates a timestamped backup of the current live site folder.
    4. Runs fast npm dependency check and optimized Vite production build for the target mode.
    5. Syncs the production build artifacts ('dist' folder) to live IIS web directory.
    6. Ensures React SPA URL Rewrite web.config is present.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$TargetBranch = "develop",

    [Parameter(Mandatory = $false)]
    [ValidateSet("Dev", "UAT", "Prod", "development", "uat", "prod", "production", "")]
    [string]$Environment = "",

    [Parameter(Mandatory = $false)]
    [string]$IisSitePath = "",

    [Parameter(Mandatory = $false)]
    [string]$ApiBaseUrl = "",

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
    # 1. Resolve Environment from Branch or Parameter
    if ([string]::IsNullOrWhiteSpace($Environment)) {
        if ($TargetBranch -match "uat") {
            $Environment = "UAT"
        } elseif ($TargetBranch -in @("main", "master", "prod", "production")) {
            $Environment = "Prod"
        } else {
            $Environment = "Dev"
        }
    } else {
        # Normalize casing
        if ($Environment -in @("uat", "UAT")) {
            $Environment = "UAT"
        } elseif ($Environment -in @("prod", "production", "Prod")) {
            $Environment = "Prod"
        } else {
            $Environment = "Dev"
        }
    }

    # 2. Determine Environment-Specific Defaults
    $viteMode = "production"
    $defaultApiUrl = ""
    $defaultIisPath = ""

    switch ($Environment) {
        "Dev" {
            $viteMode = "development"
            $defaultApiUrl = "http://122.170.13.77:90/SMSapi"
            if (-not (Test-Path $IisSitePath) -and (Test-Path "C:\inetpub\wwwroot\Plexoc\SMS")) {
                $defaultIisPath = "C:\inetpub\wwwroot\Plexoc\SMS"
            } elseif (-not (Test-Path $IisSitePath) -and (Test-Path "C:\inetpub\wwwroot\SMS_UI")) {
                $defaultIisPath = "C:\inetpub\wwwroot\SMS_UI"
            } else {
                $defaultIisPath = "C:\inetpub\wwwroot\SMS"
            }
        }
        "UAT" {
            $viteMode = "uat"
            $defaultApiUrl = "https://api-uat.checkthesite.com/api"
            if (-not (Test-Path $IisSitePath) -and (Test-Path "C:\inetpub\wwwroot\Plexoc\SMS_UAT")) {
                $defaultIisPath = "C:\inetpub\wwwroot\Plexoc\SMS_UAT"
            } else {
                $defaultIisPath = "C:\inetpub\wwwroot\SMS_UAT"
            }
        }
        "Prod" {
            $viteMode = "production"
            $defaultApiUrl = "https://api.checkthesite.com/api"
            if (-not (Test-Path $IisSitePath) -and (Test-Path "C:\inetpub\wwwroot\Plexoc\SMS_Prod")) {
                $defaultIisPath = "C:\inetpub\wwwroot\Plexoc\SMS_Prod"
            } elseif (-not (Test-Path $IisSitePath) -and (Test-Path "C:\inetpub\wwwroot\SMS_Prod")) {
                $defaultIisPath = "C:\inetpub\wwwroot\SMS_Prod"
            } else {
                $defaultIisPath = "C:\inetpub\wwwroot\SMS"
            }
        }
    }

    if ([string]::IsNullOrWhiteSpace($ApiBaseUrl)) {
        $ApiBaseUrl = $defaultApiUrl
    }
    if ([string]::IsNullOrWhiteSpace($IisSitePath)) {
        $IisSitePath = $defaultIisPath
    }

    Write-Step "Starting SMS Frontend Deployment ($Environment Environment)..."
    Write-Host "Environment:     $Environment (Mode: $viteMode)"
    Write-Host "API Base URL:    $ApiBaseUrl"
    Write-Host "Target IIS Path: $IisSitePath"
    Write-Host "Target Branch:   $TargetBranch"
    Write-Host "Repository Dir:  $RepoDir"

    # 3. Verify Directories
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

    # 4. Update Source from Git (optional, skipped if handled by GitHub Actions runner)
    Push-Location $RepoDir
    try {
        if (-not $SkipGitPull) {
            Write-Step "Updating repository working tree to latest '$TargetBranch'..."
            git fetch origin $TargetBranch
            git checkout $TargetBranch
            git reset --hard "origin/$TargetBranch"
        }
        
        # 5. Install Dependencies (smart check: verify node_modules and critical packages)
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

        # 6. Build Production Bundle (Vite with target mode & API base URL)
        Write-Step "Building Vite React bundle for '$Environment' ($ApiBaseUrl)..."
        $env:CI = "false"
        $env:VITE_API_BASE_URL = $ApiBaseUrl
        cmd.exe /c "npm run build -- --mode $viteMode"
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

    # 7. Sync to IIS Directory with ROBOCOPY
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

    # 8. Verify web.config for React SPA Routing in IIS
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
    Write-Success " Environment: $Environment | API URL: $ApiBaseUrl"
    Write-Success " Target:      $IisSitePath"
    Write-Success " Live files backed up before sync."
    Write-Success "=========================================================="
    exit 0
}
catch {
    Write-Failure "Frontend Deployment FAILED: $_"
    exit 1
}
