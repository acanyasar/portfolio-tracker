# Lessons Learned

## Server restart required after adding new routes
tsx has no hot-reload. Any time a new Express route is added, the dev server must be manually killed and restarted or the route will return SPA HTML instead of JSON.

## db:push may prompt interactively
`drizzle-kit push` prompts for confirmation when adding unique constraints to existing tables. If it blocks, apply the schema change directly via raw SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS`).

## Email HTML must use white backgrounds
Dark backgrounds on email `div` elements are stripped by most email clients, leaving white text on white = invisible. Always use white card body with dark text. Keep dark backgrounds only on header bars with light-colored text.

## Passport deserializeUser must include all fields used in request handlers
`deserializeUser` only returned `{ id, username }` — any other user fields (e.g. `dashboardWidgets`) read from `req.user` in route handlers will be `undefined`. Always include every field that route handlers need in the object passed to `done()`.

## Wouter hash routing breaks with query strings in the hash
In hash routing (`useHashLocation`), the URL `#/reset-password?token=xxx` makes wouter see the path as `/reset-password?token=xxx`. This fails to match a route declared as `/reset-password`, causing it to fall through to any catch-all (e.g. redirect to /login). Fix: use path params (`/reset-password/:token`) instead of query strings for hash-routed pages.

## Resend sender address must be from a verified domain
`onboarding@resend.dev` only delivers to the Resend account owner's email. For sending to any user, the FROM address must use a verified domain (e.g. `noreply@vectorfi.app`).
