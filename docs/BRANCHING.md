# Branching & release workflow

This repo uses **two long-lived branches**. There is no separate branch named `staging` — **`main` is staging**.

| Branch | Also known as | Deploys to VPS? |
|--------|---------------|-----------------|
| **`main`** | **Staging** — integration & pre-release | **No** |
| **`production`** | **Production** — live system | **Yes** |

Staging happens on **`main` + your local machine**, not on a second server.

## Model

```
feature/*  ──PR──►  main (staging)  ──PR──►  production  ──CI/CD──►  Ubuntu VPS
                         │
                   test locally
                   CI on every PR
```

- **`main`** = where all developers merge day-to-day work (this is your **staging** line)
- **`production`** = what runs on the VPS; only maintainers merge here

You do **not** need a branch called `staging` or a staging VPS. **`main` fills that role.**

## Daily developer flow (staging)

1. Branch from **`main`**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/my-change
   ```
2. Develop and test **locally** (your staging environment):
   ```bash
   npm run dev:api
   npm run dev:web
   # or: npm run docker:up
   ```
3. Push and open a **Pull Request → `main`**.
4. CI runs (build API, web, extension, Docker smoke test).
5. After review, merge to **`main`**.

Code is now on **staging (`main`)** but **not** on the VPS yet.

## Production release (VPS deploy)

Only maintainers / release managers:

1. When **`main`** is verified locally, open **PR: `main` → `production`**.
2. Require approval from a [CODEOWNER](../.github/CODEOWNERS) (recommended).
3. Merge to **`production`**.
4. GitHub Actions builds the Docker image and **deploys to the Ubuntu VPS**.

## One-time setup

```bash
git checkout main
git pull origin main

git checkout -b production
git push -u origin production
```

### GitHub settings

1. **Default branch** → **`main`** (staging — all feature PRs target this).
2. **Branch protection — `main` (staging)**
   - Require pull request before merging
   - Require CI checks: `CI / build`, `CI / docker`
3. **Branch protection — `production`**
   - Require pull request before merging
   - Require approvals / Code Owner review
   - Restrict who can push
4. **Environment `production`**
   - Optional: required reviewers before deploy runs

## Hotfixes

```bash
git checkout production
git pull origin production
git checkout -b hotfix/critical-fix
# fix, test locally, PR → production
# then back-merge production → main (keep staging in sync)
```

## Chrome extension

Point the extension at production when releasing:

```bash
WEB_URL=https://app.your-domain.com \
API_URL=https://app.your-domain.com \
npm run build:extension
```

For local staging against your machine:

```bash
WEB_URL=http://localhost:5173 \
API_URL=http://localhost:3001 \
npm run build:extension
```
