# extension-scrape

A minimal Chrome extension that extracts LinkedIn job description info from a posting page and POSTs it to the scrape API described in [`../EXTERNAL_SCRAPE_API.md`](../EXTERNAL_SCRAPE_API.md).

## What it does

1. On a LinkedIn job posting page (e.g. `https://www.linkedin.com/jobs/view/<id>`), extracts:
   - `companyName`
   - `companyIcon` (company logo URL)
   - `jobTitle`
   - `jobDescription`
   - `jobLink` (the off-site "Apply on company website" URL when available; falls back to the LinkedIn URL)
2. Displays the extracted info in a sidebar.
3. On the **Send to scrape API** button, POSTs the payload as JSON to `SCRAPE_API_ENDPOINT` with `source: "linkedin"`.
4. Shows a toast with the server's response (`Sent to server`, `Already in catalog`, or the server's error message).

## What it does NOT do

- No authentication, no profile, no sign-in flow.
- No resume generation, no skill extraction, no "applied" tracking.
- No `cookies` permission, no background service worker, no dashboard integration.

## Configuration

Edit the root `.env`:

```
SCRAPE_SENDER=li-job-scraper
SCRAPE_API_ENDPOINT=http://localhost:8979/api/expose/jobs
```

Both values are baked into the bundle at build time via esbuild `define`.

## Build

```
cd extension-scrape
npm install
npm run build
```

Outputs to `dist/`. Load `dist/` as an unpacked extension in `chrome://extensions` (Developer mode).

For continuous rebuilds: `npm run watch`.

## Required CORS configuration on the API server

The sidebar iframe loads from `chrome-extension://…` so `fetch(SCRAPE_API_ENDPOINT)` is a cross-origin request. The API's local-dev CORS allowlist (see `api/src/main.ts`) does **not** include `chrome-extension://*` by default. To allow the extension to post in local dev, set:

```
CORS_ORIGINS=chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

(Chrome extension IDs are stable per unpacked-extension install — copy yours from `chrome://extensions`.)

In production with `NODE_ENV=production` and `WEB_URL` set, the allowlist is restricted to those origins; either add `chrome-extension://*` to `CORS_ORIGINS` or open the CORS check.

## File map

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest (no `cookies`, no background SW) |
| `build.mjs` | esbuild orchestrator; reads root `.env` |
| `sidebar.html` / `sidebar.css` | Sidebar layout + toast styles |
| `src/content.ts` | LinkedIn content script; observes DOM and emits `JOB_DETECTED` |
| `src/extract-job.ts` | DOM extraction (copied from `extension/`) |
| `src/linkedin-voyager*.ts` | Voyager hook (kept for completeness; only used passively) |
| `src/sidebar-host.ts` | Iframe host with toggle pill |
| `src/sidebar.ts` | Sidebar app: render extracted job, send to API, toast |
| `src/config.ts` | `SENDER` + `API_ENDPOINT` from build-time defines |