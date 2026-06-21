# Deployment guide (Docker + Ubuntu VPS)

Production runs on a **single Ubuntu VPS**. **`main` is staging** (local + CI only). Only **`production`** deploys to the server.

## Flow

```
Local dev (staging on your machine)
        │
        ▼
   PR → main (staging branch)     CI only — no VPS deploy
        │
        ▼
   PR → production                 maintainers only
        │
        ▼
GitHub Actions → GHCR → SSH → Ubuntu VPS
```

## Architecture on the VPS

```
Internet ──► Nginx (HTTPS) ──► Docker app (:3001) ──► MongoDB container
```

One compose stack per server at e.g. `/opt/li-facilitator-production`.

## 1. Prepare the Ubuntu VPS

Run once on Ubuntu 22.04/24.04 (as root):

```bash
git clone git@github.com:BranchDev110/Linkedin-Faciliator.git /tmp/li-facilitator
bash /tmp/li-facilitator/deploy/scripts/setup-vps.sh
```

## 2. Clone production branch on the VPS

As the deploy user:

```bash
git clone git@github.com:BranchDev110/Linkedin-Faciliator.git /opt/li-facilitator-production
cd /opt/li-facilitator-production
git checkout production
cp deploy/env/production.env.example deploy/env/production.env
nano deploy/env/production.env
```

### Required env vars (`deploy/env/production.env`)

| Variable | Description |
|----------|-------------|
| `WEB_URL` | Public URL, e.g. `https://app.your-domain.com` |
| `API_URL` | Same as `WEB_URL` |
| `JWT_SECRET` | Long random secret |
| `OPENAI_API_KEY` | OpenAI API key |
| `MONGODB_URI` | `mongodb://mongo:27017/li-facilitator-production` |

## 3. Authenticate to GitHub Container Registry

On the VPS:

```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Use a PAT with **`read:packages`**.

## 4. First manual deploy

```bash
cd /opt/li-facilitator-production
bash deploy/scripts/remote-deploy.sh production
curl http://127.0.0.1:3002/api/health
```

After CI is configured, future deploys happen automatically when you merge to **`production`**.

## 5. Nginx + HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/li-facilitator.conf.example /etc/nginx/sites-available/li-facilitator
sudo nano /etc/nginx/sites-available/li-facilitator   # set your domain, port 3002
sudo ln -s /etc/nginx/sites-available/li-facilitator /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.your-domain.com
```

## 6. GitHub Actions secrets (auto-deploy)

When you **push or merge to `production`**, GitHub Actions will:

1. Build the Docker image  
2. Push to `ghcr.io/branchdev110/linkedin-faciliator:production`  
3. SSH into the VPS, `git pull`, pull the new image, and restart the stack  

### One-time setup checklist

Print the full checklist:

```bash
bash deploy/scripts/setup-github-deploy.sh
```

**Settings → Secrets and variables → Actions** (or **Environments → production**):

| Secret | Example | Required |
|--------|---------|----------|
| `PRODUCTION_HOST` | `83.229.67.146` | Yes |
| `PRODUCTION_USER` | `root` (or `deploy`) | Yes |
| `PRODUCTION_SSH_KEY` | Private SSH key (PEM) for Actions → VPS | Yes |
| `PRODUCTION_APP_PATH` | `/opt/li-facilitator-production` | Yes |
| `GHCR_READ_TOKEN` | GitHub PAT with `read:packages` | Yes* |

\*Or make the GHCR package **public** (GitHub → Packages → package → Change visibility) and skip `GHCR_READ_TOKEN`.

### VPS requirements for CI/CD

1. **SSH access** — Actions connects with `PRODUCTION_SSH_KEY`  
2. **Git pull** — add a read-only [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) on the repo for the VPS user  
3. **`deploy/env/production.env`** — already on the VPS (not in git); survives deploys  
4. **Docker** — installed and the deploy user can run `docker compose`  

### Test the pipeline

```bash
git checkout production
git merge main          # after testing on main
git push origin production
```

Then open **GitHub → Actions → Deploy Production** and watch the run.

On success, verify on the VPS:

```bash
curl http://127.0.0.1:3002/api/health
```

### Optional: require approval before deploy

**Settings → Environments → `production`**

- Enable **Required reviewers** so deploy waits for approval after merge to `production`

## 7. What triggers deploy

| Event | Result |
|-------|--------|
| PR → `main` or `production` | CI build + Docker smoke test only |
| Push / merge to **`production`** | Build image → push GHCR → deploy VPS |

Pushes to **`main` (staging) do not deploy** to the server.

## 8. Local staging (`main`)

**`main` is your staging branch.** Test there before promoting to production:

```bash
# Option A — native (closest to daily dev)
npm run dev:api
npm run dev:web

# Option B — Docker (closer to production stack)
cp .env.example .env
npm run docker:up
open http://localhost:3001/dashboard
```

Pushes to **`main` do not deploy** to the VPS. Only **`production`** does.

## 9. Troubleshooting

```bash
cd /opt/li-facilitator-production
docker compose -f docker-compose.yml -f docker-compose.production.yml logs app
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

## Related

- [Branching workflow](./BRANCHING.md)

## Optional: `docker-compose.staging.yml`

Optional **local** Docker override for testing the staging line on your machine (same idea as `main`). **Not deployed to any server.** Production VPS uses `docker-compose.production.yml` only.
