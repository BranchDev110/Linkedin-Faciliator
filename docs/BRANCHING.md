# Branching & release workflow

LI Facilitator uses a **two-branch deployment model**:

| Branch | Environment | Who merges | Deploys to |
|--------|-------------|------------|------------|
| `staging` | Staging / dev integration | All developers (via PR) | Staging VPS |
| `production` | Live production | Release managers only | Production VPS |

`main` is kept for historical compatibility. **Use `staging` and `production` for all new work.**

## Daily developer flow

```
staging ── feature/ABC ── PR ──► staging ── auto deploy staging
```

1. Branch from **`staging`**:
   ```bash
   git checkout staging
   git pull origin staging
   git checkout -b feature/my-change
   ```
2. Commit and push your branch.
3. Open a **Pull Request → `staging`**.
4. CI runs (build API, web, extension, Docker smoke test).
5. After review, merge the PR.
6. GitHub Actions **deploys to the staging VPS** automatically.

## Production release flow

```
staging ── PR ──► production ── auto deploy production
```

Only maintainers / release managers:

1. Open a **Pull Request: `staging` → `production`** when staging is verified.
2. Require approval from a [CODEOWNER](../.github/CODEOWNERS).
3. Merge to **`production`**.
4. GitHub Actions **deploys to the production VPS** automatically.

Developers should **not** push directly to `production`.

## One-time branch setup (repo admin)

After cloning, create the long-lived branches from current `main`:

```bash
git checkout main
git pull origin main

git checkout -b staging
git push -u origin staging

git checkout -b production
git push -u origin production
```

### GitHub repository settings

1. **Settings → General → Default branch** → set to **`staging`** (so new PRs target staging by default).
2. **Settings → Branches → Branch protection rules**

   **`staging`**
   - Require pull request before merging
   - Require status checks: `CI / build`, `CI / docker`
   - Allow developer merges after review

   **`production`**
   - Require pull request before merging
   - Require approvals (1+)
   - Require review from Code Owners
   - Require status checks: `CI / build`, `CI / docker`
   - Restrict who can push (release managers only)
   - Do **not** allow bypassing settings

3. **Settings → Environments**
   - Create **`staging`** environment (optional secrets override)
   - Create **`production`** environment with **required reviewers** before deploy job runs

## Hotfixes

For urgent production fixes:

```bash
git checkout production
git pull origin production
git checkout -b hotfix/critical-fix
# fix, commit, PR to production
# then back-merge production → staging
```

## Chrome extension builds

The extension is built in CI for verification. To point the extension at staging or production:

```bash
WEB_URL=https://staging.your-domain.com \
API_URL=https://staging.your-domain.com \
npm run build:extension
```

Distribute the built `extension/dist/` folder to testers or publish a release artifact separately.
