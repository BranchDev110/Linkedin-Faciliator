# Deployment guide (Docker + host nginx + Ubuntu VPS)

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
Internet ──► nginx on host (TLS, :80/:443)
                    │
                    ▼  proxy_pass http://127.0.0.1:3001
            Docker app container (:3001)
                    │
                    ▼
            MongoDB container
```

- nginx runs on the **host** (apt-installed), **not** in a container.
- The app container is bound to `127.0.0.1:3001` only — the public internet
  cannot reach it directly; only host nginx can.
- Certbot issues a Let's Encrypt cert per subdomain and edits the nginx site
  in place to add TLS.

## 1. Prepare the Ubuntu VPS

Run once on Ubuntu 22.04/24.04 (as root):

```bash
git clone git@github.com:BranchDev110/Linkedin-Facilitator.git /tmp/li-facilitator
bash /tmp/li-facilitator/deploy/scripts/setup-vps.sh
```

This installs Docker, nginx, Certbot, creates the `deploy` user, and grants it
the right sudoers for `nginx -t` and `systemctl reload nginx`.

## 2. DNS

Create an A record pointing your subdomain at the VPS IP **before** you run
Certbot in step 5:

```
app.your-domain.com   A   <VPS_IP>
```

## 3. Clone production branch on the VPS

As the deploy user:

```bash
git clone git@github.com:BranchDev110/Linkedin-Facilitator.git /opt/li-facilitator-production
cd /opt/li-facilitator-production
git checkout production
cp deploy/env/production.env.example deploy/env/production.env
nano deploy/env/production.env
```

### Required env vars (`deploy/env/production.env`)

| Variable | Description |
|----------|-------------|
| `HOST_PORT` | Host port the app is bound on (default `3001`). Must match the nginx `proxy_pass` port. |
| `WEB_URL`  | Public HTTPS URL, e.g. `https://app.your-domain.com` |
| `API_URL`  | Same as `WEB_URL` |
| `JWT_SECRET` | Long random secret |
| `OPENAI_API_KEY` | OpenAI API key |
| `MONGODB_URI` | `mongodb://mongo:27017/li-facilitator` |

The nginx config (not this file) controls TLS and the listening port.

## 4. Authenticate to GitHub Container Registry

On the VPS:

```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Use a PAT with **`read:packages`**.

## 5. Host nginx site + TLS

```bash
# 5a. Drop in the nginx site config
sudo cp deploy/nginx/lif-app.conf.example /etc/nginx/sites-available/lif-app.conf
sudo nano /etc/nginx/sites-available/lif-app.conf   # set server_name + HOST_PORT in proxy_pass
sudo ln -s /etc/nginx/sites-available/lif-app.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5b. Verify the app port is listening only on localhost
sudo ss -tlnp | grep ':3001 '         # should show 127.0.0.1:3001 only

# 5c. Issue a Let's Encrypt cert (DNS A record must already point to the VPS)
sudo certbot --nginx -d app.your-domain.com
```

Certbot edits the site block in place to add the `listen 443 ssl` server and
the HTTP→HTTPS redirect. Auto-renewal is installed as a systemd timer:

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

If you later add another subdomain (e.g. `staging.your-domain.com`), make a
second site file, symlink it, and run `certbot --nginx -d ...` against it
**separately**. Don't combine into one cert.

## 6. First manual deploy

```bash
cd /opt/li-facilitator-production
bash deploy/scripts/remote-deploy.sh production
curl http://127.0.0.1:3001/api/health    # should return ok
curl -I https://app.your-domain.com      # should be 200/301/302
```

After CI is configured, future deploys happen automatically when you merge to
**`production`**.

## 7. GitHub Actions secrets (auto-deploy)

When you **push or merge to `production`**, GitHub Actions will:

1. Build the Docker image
2. Push to `ghcr.io/branchdev110/linkedin-facilitator:production`
3. SSH into the VPS, `git pull`, pull the new image, restart the stack, and
   hit `http://127.0.0.1:3001/api/health` to confirm

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
curl -I https://app.your-domain.com
```

### Optional: require approval before deploy

**Settings → Environments → `production`**

- Enable **Required reviewers** so deploy waits for approval after merge to `production`

## 8. What triggers each workflow

| Event | CI | Deploy Production |
|-------|----|-------------------|
| PR → `main` or `production` | Builds + Docker smoke test | — |
| Push to **`main`** (staging) | Builds + Docker smoke test | — |
| Push to **`production`** | — | Build image → GHCR → deploy VPS |

Pushes to **`main` do not deploy** to the VPS. Only **`production`** does.

**Why two workflows?** CI is a quality gate (compile + smoke test). Deploy Production is the release step (push image + restart VPS). They are separate on purpose; only Deploy touches the server.

## 9. Local staging (`main`)

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

## 10. Sanity checklist before calling it done

```bash
# containers only listening on localhost
sudo ss -tlnp | grep -E '3001'

# nginx config valid
sudo nginx -t

# HTTPS works end-to-end
curl -I https://app.your-domain.com
```

## 11. Troubleshooting

```bash
cd /opt/li-facilitator-production
docker compose -f docker-compose.yml -f docker-compose.production.yml logs app
docker compose -f docker-compose.yml -f docker-compose.production.yml ps

# nginx site config issues
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/lif-app.error.log   # if you enabled per-site logs

# cert renewal
sudo certbot renew --dry-run
sudo systemctl list-timers | grep certbot
```

## Related

- [Branching workflow](./BRANCHING.md)

## Optional: `docker-compose.staging.yml`

Optional **local** Docker override for testing the staging line on your machine (same idea as `main`). **Not deployed to any server.** Production VPS uses `docker-compose.production.yml` only.