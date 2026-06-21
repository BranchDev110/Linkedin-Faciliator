#!/usr/bin/env bash
# Print one-time CI/CD setup steps for GitHub Actions → VPS deploy.
set -euo pipefail

REPO="${1:-BranchDev110/Linkedin-Faciliator}"
APP_PATH="${2:-/opt/li-facilitator-production}"

cat <<EOF
================================================================================
LI Facilitator — one-time CI/CD setup (production branch → VPS)
================================================================================

Repository: ${REPO}
VPS app path: ${APP_PATH}

--------------------------------------------------------------------------------
1) GitHub Actions secrets
   GitHub → ${REPO} → Settings → Secrets and variables → Actions → New secret

   PRODUCTION_HOST        VPS IP or hostname (e.g. 83.229.67.146)
   PRODUCTION_USER        SSH user (e.g. root or deploy)
   PRODUCTION_SSH_KEY     Private SSH key (PEM) that can SSH into the VPS
   PRODUCTION_APP_PATH    ${APP_PATH}
   GHCR_READ_TOKEN        GitHub PAT with read:packages (for docker pull on VPS)

--------------------------------------------------------------------------------
2) GitHub Environment (optional but recommended)
   Settings → Environments → New environment → name: production
   Add the same secrets there if you want environment-scoped deploy + reviewers.

--------------------------------------------------------------------------------
3) SSH key for GitHub Actions → VPS

   On your Mac:
     ssh-keygen -t ed25519 -C "github-actions-production" -f ./github-actions-production -N ""

   On the VPS (as PRODUCTION_USER):
     mkdir -p ~/.ssh && chmod 700 ~/.ssh
     echo "<paste github-actions-production.pub>" >> ~/.ssh/authorized_keys
     chmod 600 ~/.ssh/authorized_keys

   In GitHub secret PRODUCTION_SSH_KEY paste the contents of:
     ./github-actions-production   (the private key file)

--------------------------------------------------------------------------------
4) VPS git pull access (deploy job runs git pull)

   On the VPS:
     ssh-keygen -t ed25519 -C "vps-git-read" -f ~/.ssh/vps-git-read -N ""
     cat ~/.ssh/vps-git-read.pub

   GitHub → ${REPO} → Settings → Deploy keys → Add deploy key
   - Paste the public key
   - Read-only is enough

   On the VPS (~/.ssh/config):
     Host github.com
       HostName github.com
       User git
       IdentityFile ~/.ssh/vps-git-read
       IdentitiesOnly yes

   Test:
     cd ${APP_PATH} && git pull origin production

--------------------------------------------------------------------------------
5) GHCR read token (docker pull on VPS)

   GitHub → Settings → Developer settings → Personal access tokens
   Create token with scope: read:packages

   Store as GitHub secret: GHCR_READ_TOKEN

   (Alternative: make the package public in GitHub → Packages → package settings)

--------------------------------------------------------------------------------
6) Verify manual deploy once on VPS

   cd ${APP_PATH}
   export APP_IMAGE=ghcr.io/branchdev110/linkedin-faciliator:production
   bash deploy/scripts/remote-deploy.sh production
   curl http://127.0.0.1:3002/api/health

--------------------------------------------------------------------------------
7) Trigger automatic deploy

   Merge or push to the production branch:
     git push origin production

   Watch: GitHub → Actions → "Deploy Production"

   Each push to production will:
     1. Build Docker image
     2. Push to ghcr.io/branchdev110/linkedin-faciliator:production
     3. SSH to VPS → git pull → docker pull → restart app

================================================================================
EOF
