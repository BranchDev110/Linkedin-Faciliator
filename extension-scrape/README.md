# extension-scrape

A minimal Chrome extension that extracts LinkedIn job description info from a posting page and POSTs it to the scrape API described in [`../EXTERNAL_SCRAPE_API.md`](../EXTERNAL_SCRAPE_API.md).

## What it does

1. On a LinkedIn job posting page (e.g. `https://www.linkedin.com/jobs/view/<id>`), extracts:
   - job title, company name, company logo URL
   - job description
   - apply link (the off-site "Apply on company website" URL when available; falls back to the LinkedIn URL)
   - company LinkedIn page URL (from the top-card company-name link)
   - posted-ago text
   - fit-level tags — the text of every button in `.job-details-fit-level-preferences`
   - location and applicants from `.job-details-jobs-unified-top-card__tertiary-description-container`
2. Displays the extracted info in Chrome's native **side panel** (docked on the right), including the tag chips and the applicants line.
3. On the **Scrape** button, POSTs `POST {SCRAPE_API_ENDPOINT}/api/jobs/ingest` with the ingest payload below.
4. Shows a toast with the server's response (`Sent to server`, `Already in catalog`, or the server's error message).

### Ingest payload

```jsonc
{
  "createdBy": "<SCRAPE_SENDER>",
  "jobs": [
    {
      "title": "Senior Software Engineer",
      "company": { "name": "McAfee", "logo": "https://…", "tags": [] },
      "description": "…",
      "applyLink": "https://careers.mcafee.com/job/123",
      "companyLink": "https://www.linkedin.com/company/mcafee",
      "postedAgo": "Reposted 2 weeks ago",
      "tags": ["Remote", "Full-time"],
      "skills": [],
      "details": { "location": "Los Angeles, CA" },
      "applicants": { "count": 47, "text": "47 applicants" },
      "id": "4123456789",
      "scrapeFrom": "LinkedIn"
    }
  ]
}
```

`applicants` is omitted when LinkedIn shows no applicant line. `id` is the raw numeric LinkedIn job id
(the `/check` call still uses the `linkedin-<id>` form).

## What it does NOT do

- No authentication, no profile, no sign-in flow.
- No resume generation, no skill extraction, no "applied" tracking.
- No `cookies` permission, no dashboard integration. The background service worker does nothing but point the toolbar action at the side panel.

## Configuration

Edit the root `.env`:

```
SCRAPE_SENDER=li-job-scraper
# Base URL of the scrape API (no path)
SCRAPE_API_ENDPOINT=https://athensai.remotepairnet.net
# Optional overrides (default to <base>/api/jobs/ingest and <base>/api/jobs/check):
# SCRAPE_INGEST_API_ENDPOINT=https://athensai.remotepairnet.net/api/jobs/ingest
# SCRAPE_CHECK_API_ENDPOINT=https://athensai.remotepairnet.net/api/jobs/check
```

`SCRAPE_API_ENDPOINT` is the **base URL**. If it still points at a full endpoint path (older
configs), the build falls back to that URL's origin. All values are baked into the bundle at build
time via esbuild `define`.

## Opening the panel

Click the extension's toolbar icon on any LinkedIn tab — that opens Chrome's native side panel on the
right (Chrome 114+). There is no injected button on the page: the extension no longer renders anything
into LinkedIn's DOM, so it never shifts the page layout.

The panel is global, not per-tab: it stays open while you browse and mirrors whichever tab is active.
On open, on tab switch, and on LinkedIn's own SPA navigation it pulls the current job from that tab's
content script; the ⟳ button in the panel header forces a re-scan. On a non-LinkedIn tab it falls back
to the empty state.

### "Already recorded" check — currently disabled

The `/api/jobs/check` lookup is not working, so the check engine is commented out in
[`src/sidebar.ts`](src/sidebar.ts) (`refreshJobRecordedStatus` and its call site) — the panel no longer
POSTs to `/api/jobs/check` and the **Scrape** button is enabled as soon as a job with a description and
an apply link is detected. `checkJobExists()` in [`src/api.ts`](src/api.ts) is kept but unused;
uncomment the blocks in `src/sidebar.ts` to restore the lookup.

There is no duplicate gating at all now: clicking **Scrape** POSTs the job straight to
`/api/jobs/ingest`, every time. The button only disables while a request is in flight (**Sending…**),
and the server's answer — including its own duplicate response — is reported in the toast.

## Build

```
cd extension-scrape
npm install
npm run build
```

Outputs to `dist/`. Load `dist/` as an unpacked extension in `chrome://extensions` (Developer mode).

For continuous rebuilds: `npm run watch`.

## Required CORS configuration on the API server

The side panel page loads from `chrome-extension://…` so `fetch(SCRAPE_API_ENDPOINT)` is a cross-origin request. The API's local-dev CORS allowlist (see `api/src/main.ts`) does **not** include `chrome-extension://*` by default. To allow the extension to post in local dev, set:

```
CORS_ORIGINS=chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

(Chrome extension IDs are stable per unpacked-extension install — copy yours from `chrome://extensions`.)

In production with `NODE_ENV=production` and `WEB_URL` set, the allowlist is restricted to those origins; either add `chrome-extension://*` to `CORS_ORIGINS` or open the CORS check.

## File map

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest (`sidePanel` permission, `side_panel.default_path`) |
| `build.mjs` | esbuild orchestrator; reads root `.env` |
| `sidebar.html` / `sidebar.css` | Side panel layout + toast styles (light/dark aware) |
| `src/content.ts` | LinkedIn content script; observes DOM and emits `JOB_DETECTED` |
| `src/extract-job.ts` | DOM extraction (copied from `extension/`) |
| `src/linkedin-voyager*.ts` | Voyager hook (kept for completeness; only used passively) |
| `src/background.ts` | Service worker; makes the toolbar action open the side panel |
| `src/sidebar.ts` | Side panel app: track active tab, render extracted job, check if recorded, send to API, toast |
| `src/api.ts` | Ingest + check API helpers (`IngestPayload`, `jobID`, ngrok headers) |
| `src/config.ts` | `SENDER`, `API_BASE_URL`, `API_ENDPOINT`, and `CHECK_API_ENDPOINT` from build-time defines |