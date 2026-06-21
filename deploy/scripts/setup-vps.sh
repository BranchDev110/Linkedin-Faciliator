#!/usr/bin/env bash
# First-time Ubuntu VPS setup for LI Facilitator (run as root or with sudo).
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_ROOT="${APP_ROOT:-/opt/li-facilitator}"

echo "==> Installing Docker ..."
apt-get update
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${DEPLOY_USER}"
fi

usermod -aG docker "${DEPLOY_USER}"

mkdir -p "${APP_ROOT}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_ROOT}"

echo "==> VPS base setup complete."
echo "Next steps (as ${DEPLOY_USER}):"
echo "  1. Clone the repo into ${APP_ROOT}"
echo "  2. Copy deploy/env/staging.env.example -> deploy/env/staging.env (and production)"
echo "  3. docker login ghcr.io"
echo "  4. bash deploy/scripts/remote-deploy.sh staging"
