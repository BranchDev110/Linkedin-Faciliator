#!/usr/bin/env bash
# First-time Ubuntu VPS setup for LI Facilitator (run as root or with sudo).
# Installs Docker, nginx (host, reverse proxy in front of the dockerized app),
# and Certbot for Let's Encrypt TLS.
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

echo "==> Installing nginx + Certbot (host reverse proxy) ..."
apt-get install -y nginx certbot python3-certbot-nginx

# Nginx must be able to reach the app's bound 127.0.0.1:HOST_PORT — ensure the
# default site doesn't shadow our per-app sites-enabled entries.
if [ -e /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi
systemctl enable --now nginx

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${DEPLOY_USER}"
fi

usermod -aG docker "${DEPLOY_USER}"

mkdir -p "${APP_ROOT}"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_ROOT}"

# Allow the deploy user to reload nginx without sudo (for cert renewal hooks /
# `systemctl reload nginx` after deploys, if you choose to wire it in later).
cat > /etc/sudoers.d/lif-nginx-reload <<EOF
${DEPLOY_USER} ALL=(root) NOPASSWD: /usr/sbin/nginx -t, /usr/bin/systemctl reload nginx, /usr/bin/systemctl status nginx
EOF
chmod 0440 /etc/sudoers.d/lif-nginx-reload

echo "==> VPS base setup complete."
echo "Next steps (as ${DEPLOY_USER}):"
echo "  1. Clone the repo into ${APP_ROOT}"
echo "  2. Copy deploy/env/production.env.example -> deploy/env/production.env"
echo "     (set WEB_URL, API_URL, JWT_SECRET, OPENAI_API_KEY — these are consumed by the app, not by nginx)"
echo "  3. docker login ghcr.io"
echo "  4. Add a host-nginx site config (see docs/DEPLOYMENT.md):"
echo "       sudo cp deploy/nginx/lif-app.conf.example /etc/nginx/sites-available/lif-app.conf"
echo "       sudo nano /etc/nginx/sites-available/lif-app.conf   # set server_name + HOST_PORT"
echo "       sudo ln -s /etc/nginx/sites-available/lif-app.conf /etc/nginx/sites-enabled/"
echo "       sudo nginx -t && sudo systemctl reload nginx"
echo "  5. Issue a cert (after DNS A record points your domain to the VPS):"
echo "       sudo certbot --nginx -d app.your-domain.com"
echo "  6. bash deploy/scripts/remote-deploy.sh production"