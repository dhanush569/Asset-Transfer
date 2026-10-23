# Machine Asset Transfer — Backend API

REST API for the inter-plant Machine Asset Transfer app: user & organization
management (Companies → Plants → Users), a machine transfer workflow with
electrical/mechanical condition checklists, photo uploads, and a two-stage
approval process (source plant approver → destination plant approver,
chosen per transfer).

This is a **reference backend** meant to be the exact contract your
frontend (a separate React app, see `mat-frontend/`) talks to. It deploys
to **Vercel**, using:

- **Supabase** (Postgres) for data
- **Supabase Storage** for uploaded photos
- The Express app exported as a single Vercel serverless function

You get a working `*.vercel.app` subdomain immediately on deploy — no
domain purchase needed. Add a custom domain later from the same Vercel
project settings whenever you're ready, no code changes required.

## 1. Create a Supabase project (free)

1. Sign up at https://supabase.com and create a new project (free tier).
2. Open the **SQL Editor** and run the contents of `supabase/schema.sql`
   (paste it in and click Run). This creates all four tables.
3. Open **Storage**, create a new bucket named `photos`, and mark it
   **Public** (so uploaded photo URLs are viewable without extra auth).
4. Open **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (not the `anon` key — this one bypasses Row
     Level Security, which the schema locks down by default) → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Deploy to Vercel

```bash
npm install -g vercel      # if you don't have the CLI
cd mat-backend
vercel                     # follow the prompts; creates a project + free subdomain
```

(Or: push this folder to a GitHub repo and click "Import Project" on
vercel.com — same result, with auto-deploy on every push.)

Under **Settings → Environment Variables** in the Vercel project, add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
| `SUPABASE_STORAGE_BUCKET` | `photos` |
| `JWT_SECRET` | any long random string |
| `JWT_EXPIRES_IN` | `12h` (optional, this is the default) |

Redeploy (`vercel --prod`, or push again) after adding the variables so
they take effect.

## 3. Seed the database

Run once, from your machine, pointed at the same Supabase project you
deployed with (create a local `.env` from `.env.example` first):

```bash
npm install
npm run seed
```

This creates the starter org/users below. **Run it again any time to
reset all data** — it wipes and recreates companies, plants, users and
transfers.

### Seeded login accounts

All seed users share the password `password123`:

| Employee ID | Name           | Plant        | Role         |
|-------------|----------------|--------------|--------------|
| RM-2291     | S. Karthik     | Varanavasi   | Operator     |
| RM-1187     | A. Meenakshi   | Varanavasi   | Approver     |
| RM-0942     | D. Rajan       | Pondicherry  | Approver     |
| RM-0561     | P. Suresh      | Chennai      | Plant Admin  |
| RM-0001     | System Admin   | Varanavasi   | Super Admin  |

Roles: `Operator`, `Approver`, `Plant Admin`, `Super Admin`.

## Running locally instead

```bash
npm install
cp .env.example .env     # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
npm run seed
npm start                 # http://localhost:4000
```

`npm run dev` restarts on file changes (Node 18+).

## Authentication

Every endpoint except `POST /api/auth/login` and `GET /api/health` requires:

```
Authorization: Bearer <token>
```

```
POST /api/auth/login
Body: { "employeeId": "RM-2291", "password": "password123" }
Returns: { "token": "...", "user": { ... } }

GET /api/auth/me
Returns the current user (from the token).
```

## Organization

```
GET  /api/companies
POST /api/companies              { name }                          — Super Admin

GET  /api/plants?companyId=
POST /api/plants                 { companyId, name, code }          — Super Admin / Plant Admin
```

## Users

```
GET   /api/users?plantId=&role=&active=true
POST  /api/users                 { employeeId, name, plantId, role, password? }   — Admin
PATCH /api/users/:id             { name?, plantId?, role?, active? }              — Admin

  active: true/false is the Active/Inactive toggle. Users are never deleted,
  so historical transfers keep valid references and inactive users simply
  can't log in.
```

## Photo uploads

```
POST /api/uploads/photo          multipart/form-data, field "photo"
Returns: { "url": "https://<project>.supabase.co/storage/v1/object/public/photos/...", ... }
```

Upload each photo first, then attach the returned `url` to a transfer's
photo array (`machinePhotos`, `electricalPhotos`, `mechanicalPhotos`, or
`abnormalityPhotoUrl`) via `PATCH /api/transfers/:id`.

## Checklists (reference data)

```
GET /api/checklists/electrical   → full electrical checklist (categories + items)
GET /api/checklists/mechanical   → full mechanical checklist + overall-status options
```

These are the master lists. When a transfer's `hasElectrical` or
`hasMechanical` flag is first set to `true`, the API automatically copies
the matching list into the transfer as its own editable checklist.

## Transfers — the core workflow

```
GET  /api/transfers?plantId=&status=
GET  /api/transfers/:id

POST /api/transfers
Body: { machineName, sapNo, equipmentNo, sourcePlantId, destinationPlantId }
→ creates a "draft" transfer.
```

While a transfer is `draft` (only the creator or an admin can edit):

```
PATCH /api/transfers/:id
Body: any of —
  machineName, sapNo, equipmentNo,
  machinePhotos            [{ side: "front"|"rear"|"left"|"right"|"extra", url, remark }]
  machineRemarks,
  hasElectrical (bool), electricalPhotos, electricalRemarks,
  hasMechanical (bool), mechanicalPhotos, mechanicalRemarks, mechanicalOverallStatus,
  missingParameters, abnormalities, abnormalityPhotoUrl

PATCH /api/transfers/:id/checklist
Body: { section: "electrical"|"mechanical", categoryIndex, itemIndex, checked, remark }
→ ticks/annotates one checklist item.
```

Submitting locks the draft and routes it for approval — **you choose who
approves at each stage** (per-transfer, via dropdown in the app), as long
as they're an active Approver at the right plant:

```
POST /api/transfers/:id/submit
Body: { approverStage1Id, approverStage2Id }
  approverStage1Id must be an Approver at the source plant.
  approverStage2Id must be an Approver at the destination plant.
→ status becomes "pending_stage1". Requires all 4 side photos to be present.
```

```
POST /api/transfers/:id/decide
Body: { decision: "approve"|"reject", comment? }
  Only the user assigned to the CURRENT stage (or a Plant/Super Admin) can call this.
  Stage 1 approve  → status becomes "pending_stage2"
  Stage 2 approve  → status becomes "approved"
  Reject at either stage → status becomes "rejected" (workflow stops)
```

### Status lifecycle

```
draft → pending_stage1 → pending_stage2 → approved
                 └──────────────┴──────────→ rejected
```

## Project layout

```
mat-backend/
  api/index.js            Vercel serverless entry point (exports the Express app)
  server.js                local-dev entry point (not used on Vercel)
  vercel.json               routes every request to api/index.js
  supabase/schema.sql        run this once in the Supabase SQL Editor
  src/
    app.js                 express app + route mounting
    db/supabaseClient.js      Supabase client (service role — server-side only)
    middleware/auth.js        JWT auth + role guard
    routes/                   one file per resource
    utils/checklists.js        master electrical/mechanical checklist data
    utils/caseMap.js            snake_case (Postgres) <-> camelCase (API) conversion
    utils/seed.js                wipes & recreates starter data
```

## Notes

- This has **not** been run in this environment (no network access here to
  `npm install` or reach Supabase) — it's written carefully, but treat first
  deploy as a normal first test. `GET /api/health` is a good smoke test.
- Passwords are bcrypt-hashed; `JWT_SECRET` must be a real secret before any
  real use — don't leave the placeholder in `.env.example`.
- The schema enables Row Level Security with no policies, so only the
  `service_role` key (used server-side, never shipped to a client) can read
  or write. Do not swap in the `anon` key anywhere in this codebase.
- The frontend (`mat-frontend/`) should: call `/api/auth/login`, store the
  token, and send it as a Bearer token on every subsequent call. Point it
  at your deployed `https://<project>.vercel.app` address (or your custom
  domain once you add one) via its `REACT_APP_API_URL` environment variable.
