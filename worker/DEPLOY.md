# GEN1 CLASS — Cloudflare backend deployment

The GitHub repository hosts the frontend. Cloudflare Worker serves the API and approved student sites on a **different origin**.

1. Create Cloudflare D1 database `gen1-class-db` and R2 bucket `gen1-class-files`.
2. Copy the D1 database ID into `worker/wrangler.toml`.
3. From `worker/`, run `npx wrangler d1 execute gen1-class-db --remote --file=schema.sql`.
4. Set `FRONTEND_ORIGIN` in `worker/wrangler.toml` to the **exact** frontend origin (for example `https://www.gen1.co.il`).
5. Create a strong admin password, never store it in GitHub. Generate a 16-byte random salt and a 150000-iteration PBKDF2-SHA256 32-byte hash; set `ADMIN_PASSWORD_HASH` as `saltHex:hashHex` with `npx wrangler secret put ADMIN_PASSWORD_HASH`.
6. Set a random >=32 character `SESSION_SECRET` with `npx wrangler secret put SESSION_SECRET`.
7. Deploy using `npx wrangler deploy` from `worker/`.
8. Set `window.GEN1_API_URL` in the frontend `config.js` to the deployed Worker HTTPS origin (no trailing slash). The Worker URL MUST differ in origin from the main site, to isolate student JavaScript.
9. Test upload, moderation, links, deletion and mobile UI before promoting the frontend.

**Security:** No plaintext admin password in this repository. Admin username is `nadav`; set the password privately. Student full names are stored in D1 and never returned in the public gallery. Approved user HTML/JS runs on the separate Worker origin with sandbox CSP; do not host student files under the main domain. Uploads are rate-limited, file extension- and size-limited, and require approval. For production at school scale, add CAPTCHA, automated abuse scanning, privacy notices and retention rules, and school/parent permissions.

**Status:** GitHub files alone do not provision Cloudflare resources or configure secrets. Until steps 1–9 are completed, uploads and admin authentication are intentionally unavailable.
