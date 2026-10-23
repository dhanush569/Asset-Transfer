# Machine Asset Transfer — Frontend

A responsive React app (Create React App) for the Machine Asset Transfer
workflow: login, dashboard, the 4-step new-transfer flow (machine details +
photos → electrical checklist → mechanical checklist → missing
parameters/abnormalities + two-stage approval routing), an approvals inbox,
and user/plant management.

It talks to `mat-backend` entirely over its REST API — no direct database
access from this app.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: REACT_APP_API_URL=https://your-backend-project.vercel.app
npm start          # http://localhost:3000
```

Log in with any of the seeded accounts from the backend (see its README),
e.g. `RM-2291` / `password123`.

## Deploying

This builds to static files, so it deploys anywhere static hosting works —
Vercel is the simplest match for the backend setup:

```bash
npm run build
vercel --prod        # or: push to GitHub and "Import Project" on vercel.com
```

Set `REACT_APP_API_URL` under the Vercel project's **Environment
Variables** to your deployed backend's URL, then redeploy — CRA bakes
`REACT_APP_*` variables into the build at build time, so changing it
requires a rebuild, not just a restart.

Like the backend, this gets a free `*.vercel.app` subdomain immediately;
attach a real domain later from the same project settings.

## Structure

```
src/
  api/client.js          fetch wrapper — attaches the bearer token, handles JSON/multipart
  context/AuthContext.jsx  login state, persisted token in localStorage
  components/
    Layout.jsx              sidebar (desktop) / top bar (mobile) nav shell
    ProtectedRoute.jsx        redirects to /login if not authenticated
    PhotoSlot.jsx              tap-to-capture/upload photo tile, used throughout
  pages/
    LoginPage.jsx
    DashboardPage.jsx          transfer list for the user's plant
    NewTransferPage.jsx         the 4-step wizard (the core of the app)
    ApprovalsPage.jsx           transfers awaiting the current user's sign-off
    UserManagementPage.jsx       companies/plants + employees, add forms, active toggle
  index.css                  design tokens + all component styles (no CSS framework)
```

## Responsive design

Single CSS file, mobile-first breakpoints:
- **≥720px**: fixed left sidebar navigation.
- **<720px**: sidebar collapses into a horizontal scrollable top bar (phones/tablets in portrait).
- Photo grids drop from 4 to 2 columns under 480px.
- Forms stack to a single column under 640px.
- Safe-area insets are respected (`env(safe-area-inset-*)`) for phones with notches/home indicators.

Photo capture uses `<input type="file" accept="image/*" capture="environment">`,
which opens the rear camera directly on phones/tablets and falls back to a
normal file picker on desktop.

## Notes

- This has **not** been run or built in this environment (no network
  access here to `npm install`) — written carefully, but treat first run
  as a normal first test.
- `NewTransferPage.jsx` uses `structuredClone`, supported in all modern
  browsers (Chrome 98+, Safari 15.4+, Firefox 94+). If you need to support
  older browsers, swap it for `JSON.parse(JSON.stringify(...))`.
- CORS: the backend currently allows all origins (`cors()` with no
  options) so this works out of the box. Tighten it to your frontend's
  exact origin before going to production.
- There's no client-side route guarding by role beyond hiding the "User
  Management" nav link for non-admins — the backend still enforces role
  checks on every write, which is where the real authorization boundary is.
