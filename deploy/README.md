# SMS Frontend CI/CD Setup for GitHub Actions & Windows Server (IIS)

This repository is configured with automated CI/CD using **GitHub Actions** and a **GitHub Self-Hosted Runner** installed on your Windows Server.

---

## ⚡ High Performance & Instant Deployments

1. **Smart Dependency Caching**:
   - `node_modules` is cached on the runner and preserved across runs using `clean: false`.
   - Redundant `npm install` is skipped on subsequent builds, cutting deployment time down to under 1 minute.
2. **Clean Artifact Sync (`robocopy /PURGE`)**:
   - Only modified Vite bundles are synced to IIS, and outdated hashed chunks are automatically purged to prevent disk bloat.
3. **Automated IIS SPA Routing (`web.config`)**:
   - Automatically maintains URL Rewrite rules so direct browser refreshes and deep client-side routes in React Router work without 404 errors.

---

## 🛡️ Automatic Pre-Deployment Backup

Before any new files are copied or synchronized, the deployment script automatically creates a full, timestamped copy of your existing live directory:
- 📁 `C:\inetpub\wwwroot\Backups\SMS_YYYYMMDD_HHMMSS`

Your previous live release is safely archived before every deployment.

---

## ⚙️ Architecture & Sequence

```
[Developer / Git Push]
         │ (Pushes to develop / Develop / main)
         ▼
[GitHub Repository: SMS_Frontend]
         │
         ▼ (Secure HTTPS Outbound Poll - No open firewall ports required)
[Windows Server: GitHub Self-Hosted Runner]
         │
         ├── 1. Code Checkout via actions/checkout@v4 (clean: false)
         ├── 2. Setup Node.js 20
         ├── 3. Pre-Deployment Backup to C:\inetpub\wwwroot\Backups\SMS_YYYYMMDD_HHMMSS
         ├── 4. npm install (first time only) & npm run build (Vite output: dist)
         ├── 5. Robocopy /PURGE sync to C:\inetpub\wwwroot\SMS
         └── 6. Verify SPA URL Rewrite web.config in IIS
```

---

## 🚀 Setting Up the GitHub Self-Hosted Runner (One-Time Setup)

To allow GitHub Actions to deploy directly to your IIS server:

### 1. Run Configuration Command
Open PowerShell as **Administrator** on the Windows Server:
```powershell
New-Item -ItemType Directory -Path "C:\actions-runner-sms-ui" -Force | Out-Null
Set-Location "C:\actions-runner-sms-ui"

# Copy runner zip or download
Copy-Item "C:\actions-runner\actions-runner.zip" "C:\actions-runner-sms-ui\" -Force
Expand-Archive -Path "actions-runner.zip" -DestinationPath "." -Force

# Configure runner as an automatic Windows Service
.\config.cmd --url https://github.com/parthpdexoc-dotcom/SMS_Frontend --token <SMS_FRONTEND_TOKEN> --runasservice
```

---

## 🧪 Triggering Deployments

### 1. Automatic Deployment on Push
Any push to `develop`, `Develop`, or `main` automatically triggers deployment.

### 2. Manual Trigger via GitHub UI
1. Go to **Actions** tab in GitHub.
2. Select **Deploy Frontend to IIS**.
3. Click **Run workflow**.

### 3. Manual Local Deployment (PowerShell)
You can test the deployment locally at any time:
```powershell
powershell -ExecutionPolicy Bypass -File "deploy\deploy.ps1" -IisSitePath "C:\inetpub\wwwroot\SMS"
```
