# Deployment guide (Docker + Ubuntu VPS)

This guide covers Docker deployment to an Ubuntu VPS with **staging** and **production** environments driven by GitHub Actions.

## Architecture

```
GitHub (staging branch)  ──►  GHCR image :staging  ──►  Staging VPS (:3001)
GitHub (production branch) ──► GHCR image :production ──► Production VPS (:3002)
                                      │
                                      ├── app (NestJS + React SPA)
                                      └── mongo (MongoDB 7)
```

Nginx on the host terminates TLS and proxies to the app container.

## 1. Prepare the Ubuntu VPS

Run once on a fresh Ubuntu 22.04/24.04 server (as root):

```bash
curl -fsSL https://raw.githubusercontent.com/BranchDev110/Linkedin-Faciliator/staging/deploy/scripts/setup-vps.sh | bash
```

Or clone the repo and run `sudo bash deploy/scripts/setup-vps.sh`.

### Two environments on one VPS

| Path | Branch | App port (host) | Domain example |
|------|--------|-----------------|----------------|
| `/opt/li-facilitator-staging` | `staging` | 3001 | `staging.your-domain.com` |
| `/opt/li-facilitator-production` | `production` | 3002 | `app.your-domain.com` |

You can also use **separate VPS instances** for stronger isolation (recommended for production).

## 2. Clone and configure on the VPS

As the deploy user:

```bash
# Staging
git clone git@github.com:BranchDev110/Linkedin-Faciliator.git /opt/li-facilitator-staging
cd /opt/li-facilitator-staging
git checkout staging
cp deploy/env/staging.env.example deploy/env/staging.env
nano deploy/env/staging.env

# Production (same or different server)
git clone git@github.com:BranchDev110/Linkedin-Faciliator.git /opt/li-facilitator-production
cd /opt/li-facilitator-production
git checkout production
cp deploy/env/production.env.example deploy/env/production.env
nano deploy/env/production.env
```

### Required env vars

| Variable | Description |
|----------|-------------|
| `WEB_URL` | Public URL users open in the browser |
| `API_URL` | Same as `WEB_URL` (API is served on same host) |
| `JWT_SECRET` | Long random string (unique per environment) |
| `OPENAI_API_KEY` | OpenAI key for AI features |
| `MONGODB_URI` | Use `mongodb://mongo:27017/...` inside Docker Compose |

## 3. Pull images from GitHub Container Registry

The VPS must authenticate to GHCR:

1. Create a GitHub **Personal Access Token** with `read:packages`.
2. On the VPS:
   ```bash
   echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

## 4. Manual deploy (first time)

```bash
cd /opt/li-facilitator-staging
bash deploy/scripts/remote-deploy.sh staging
```

```bash
cd /opt/li-facilitator-production
bash deploy/scripts/remote-deploy.sh production
```

Verify:

```bash
curl http://127.0.0.1:3001/api/health   # staging
curl http://127.0.0.1:3002/api/health   # production
```

## 5. Nginx + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/li-facilitator.conf.example /etc/nginx/sites-available/li-facilitator
sudo nano /etc/nginx/sites-available/li-facilitator   # update domains
sudo ln -s /etc/nginx/sites-available/li-facilitator /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging.your-domain.com -d app.your-domain.com
```

## 6. GitHub Actions secrets

Repository **Settings → Secrets and variables → Actions**:

### Staging

| Secret | Example |
|--------|---------|
| `STAGING_HOST` | `203.0.113.10` |
| `STAGING_USER` | `deploy` |
| `STAGING_SSH_KEY` | Private SSH key (PEM) |
| `STAGING_APP_PATH` | `/opt/li-facilitator-staging` |

### Production

| Secret | Example |
|--------|---------|
| `PRODUCTION_HOST` | `203.0.113.20` |
| `PRODUCTION_USER` | `deploy` |
| `PRODUCTION_SSH_KEY` | Private SSH key (PEM) |
| `PRODUCTION_APP_PATH` | `/opt/li-facilitator-production` |

### GitHub Environments (recommended)

Create **staging** and **production** environments under **Settings → Environments**.

For **production**, enable **Required reviewers** so deploy jobs wait for approval after merge.

## 7. CI/CD behavior

| Event | Workflow | Result |
|-------|----------|--------|
| PR → `staging` or `production` | `CI` | Build + Docker smoke test |
| Push to `staging` | `Deploy Staging` | Push `:staging` image → deploy staging VPS |
| Push to `production` | `Deploy Production` | Push `:production` image → deploy production VPS |

## 8. Local Docker development

```bash
cp .env.example .env
# edit JWT_SECRET, OPENAI_API_KEY

docker compose up -d --build
open http://localhost:3001/dashboard
```

## 9. Troubleshooting

**Container unhealthy**
```bash
docker compose -f docker-compose.yml -f docker-compose.staging.yml logs app
```

**Cannot pull GHCR image**
```bash
docker login ghcr.io
docker pull ghcr.io/branchdev110/linkedin-faciliator:staging
```

**MongoDB data persistence** — data lives in Docker volumes (`staging_mongo_data`, `production_mongo_data`). Back up with:
```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml exec mongo \
  mongodump --archive=/data/db/backup.archive
```

## Related docs

- [Branching workflow](./BRANCHING.md)
