# GEN1 CLASS — deployment notes

This is a **frontend prototype** on the isolated feature/gen1-classroom branch. Existing main and gen1.co.il are untouched.

## Current implementation
- Mobile-friendly RTL Hebrew student gallery and search
- Multi-file submission UI (index.html, CSS, JS, images) and limited sandbox preview
- Admin login and moderation UI (not operational without backend)
- Future learning content placeholders

## Required secure backend
Host an API separately (e.g. Cloudflare Worker + R2 + D1) with:
- POST /submissions — rate-limited, validate size, file types, path and content; store in private pending storage; return {id}
- GET /projects — approved projects only; return [{id,title,nickname,url}]
- POST /admin/login — verify salted password hash for admin username nadav; short-lived session token
- GET /admin/submissions — pending requests, authenticated
- GET /admin/projects — published projects, authenticated
- POST /admin/projects/:id/approve|reject|rename|delete — authenticated and audited

Never put GitHub API tokens, admin credentials or student full names in public client code or public GitHub repository. Student sites containing JS must be hosted on a **separate origin** from the main application and admin, not merely under /projects on gen1.co.il. Use a moderation queue, abuse controls, malware checks, CSP, size and quota limits, and parent/school consent policies. Public display should use nickname, not full name.

After backend deployment, set window.GEN1_API_URL in config.js. The backend must restrict CORS to the deployed classroom origin, and secure the admin endpoints server-side.

## Test
Open classroom.html via a static host. Upload and admin actions are intentionally disabled until backend configuration; do not claim these are live.
