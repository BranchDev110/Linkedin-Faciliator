# LI Facilitator

**LI Facilitator** is a LinkedIn job-application assistant that extracts job descriptions from LinkedIn, analyzes them with AI, generates tailored resume bullets and resumes from your templates, and tracks applications and AI spend across multiple profiles.

> **Short description (for GitHub About):**  
> Chrome extension + dashboard for LinkedIn job applications — AI skill extraction, resume bullets, DOCX resume generation, and application tracking.

## Features

### Chrome extension (LinkedIn sidebar)
- In-page sidebar on LinkedIn job postings
- Auto-detect and refresh job title, company, location, and full job description
- **Extract Skills** — AI parses the JD into structured skills (cached per LinkedIn job ID)
- **Generate All Resume Bullets** — tailored bullets per company on the selected profile
- **One-Click Done** — extract skills → generate bullets → finalize resume → save application in one flow
- **Generate Resume** — fill your DOCX or text resume template and download
- Per-job AI cost widget (skill extraction + resume bullets)
- Application status: **Recorded** / **Applied**
- One saved application and one resume per **profile + LinkedIn job**

### Web dashboard
- Sign up / sign in with email and password
- Manage multiple **profiles** (contact info, companies, prompts, bullet counts, resume templates)
- View **applications** and generated **resumes**
- **Dashboard** with application activity and AI pricing charts (Recharts)

### API
- JWT authentication
- MongoDB persistence (users, profiles, applications, resumes, shared job skills cache)
- OpenAI-powered skill extraction, bullet generation, and resume content
- DOCX template filling (docxtemplater) and local file storage for templates and resumes

## Architecture

```
┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│  Chrome Extension    │────▶│   React Dashboard    │────▶│     NestJS API       │
│  (LinkedIn sidebar)  │     │   (Vite + React)     │     │   (REST + JWT)       │
└──────────┬───────────┘     └──────────────────────┘     └──────────┬───────────┘
           │                                                            │
           └────────────────────────────────────────────────────────────┘
                                        │
                           ┌────────────▼────────────┐
                           │  MongoDB + file storage │
                           │  (resumes, templates)   │
                           └─────────────────────────┘
```

## Project structure

| Directory     | Description |
|---------------|-------------|
| `api/`        | NestJS backend — auth, profiles, applications, resumes, OpenAI, file storage |
| `web/`        | React dashboard — profiles, applications, resumes, analytics |
| `extension/`  | Chrome Manifest V3 extension — LinkedIn job extraction and sidebar UI |

## Prerequisites

- **Node.js 18+**
- **MongoDB** (local or Atlas)
- **OpenAI API key** (for skill extraction, bullets, and resume content)

## Setup

### 1. Environment variables

Create a root `.env`:

```bash
cp .env.example .env
```

```env
WEB_URL=http://localhost:5173
API_URL=http://localhost:3001

MONGODB_URI=mongodb://127.0.0.1:27017/li-facilitator
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
```

For the web app:

```bash
cp web/.env.example web/.env
```

```env
VITE_API_URL=/api
```

For production or ngrok, set `WEB_URL` and `API_URL` to your public URL (see `.env.example`).

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally

```bash
# Terminal 1 — API (port 3001)
npm run dev:api

# Terminal 2 — Web dashboard (port 5173)
npm run dev:web

# Terminal 3 — Build extension
npm run build:extension
```

### 4. Load the Chrome extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/dist/`
4. Reload the extension after each rebuild

## Typical workflow

1. **Dashboard** — create a profile, add companies with prompts and bullet counts, upload a DOCX resume template.
2. **LinkedIn** — open a job posting and open the LI Facilitator sidebar.
3. **Refresh JD** — load the job description from the page.
4. Select your profile.
5. Run **One-Click Done** or use the steps individually:
   - Extract Skills
   - Generate All Resume Bullets
   - Generate Resume
6. Download the generated resume and mark the application **Applied** when submitted.

## API overview

All protected routes require `Authorization: Bearer <jwt>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Sign in |
| GET | `/auth/me` | Current user |
| GET/POST/PATCH/DELETE | `/profiles` | Manage profiles |
| POST | `/profiles/:id/resume-template` | Upload resume template |
| GET/POST/PATCH | `/applications` | List, create, update applications |
| POST | `/applications/extract-skills` | AI skill extraction from JD |
| GET | `/applications/skills?linkedInJobId=` | Cached skills for a job |
| GET | `/applications/lookup?linkedInJobId=&profileId=` | Find application for job + profile |
| POST | `/resumes/generate` | Generate or update resume |
| POST | `/resumes/generate-all-bullets` | Generate bullets for all companies |
| GET | `/files/:encodedPath` | Download resume or template file |

## Data model (MongoDB)

| Collection | Purpose |
|------------|---------|
| `users` | Accounts (email + password hash) |
| `profiles` | Application personas, companies, templates |
| `applications` | Job + profile applications, skills, bullets, AI costs, status |
| `resumes` | Generated resume files and metadata (one per application) |
| `job_skills` | Shared AI-extracted skills cache keyed by LinkedIn job ID |

## Tech stack

| Layer | Stack |
|-------|--------|
| Extension | Chrome Manifest V3, TypeScript, esbuild |
| Frontend | React 18, Vite, React Router, Recharts |
| Backend | NestJS, Mongoose, JWT, bcrypt, OpenAI |
| Documents | docxtemplater, mammoth |
| Database | MongoDB |

## Scripts

```bash
npm run dev:api          # Start API in watch mode
npm run dev:web          # Start Vite dev server
npm run build:api          # Build API
npm run build:web          # Build dashboard
npm run build:extension    # Build extension to extension/dist/
```

## License

Private / unlicensed unless otherwise specified by the repository owner.
