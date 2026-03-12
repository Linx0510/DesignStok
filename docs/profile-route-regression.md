# /profile regression timeline

## Summary
The `/profile` transition regressed in commit `c26f174` (merged as `3d80928`).

## What changed
- Before `c26f174`, `index.js` mounted `routes/users` at root (`app.use('/', require('./routes/users'))`), so `/profile` was served by `routes/users.js`.
- In `c26f174`, root mounting was switched to `routes/profile`.
- In `15cf753`, routing was reverted/fixed by mounting `routes/users` at root again (`app.use('/', userRoutes)`), explicitly marked as a `/profile` routing fix.

## Why this is the likely break point
- `c26f174` is the first commit that changes root mounting away from `routes/users`.
- The follow-up fix commit `15cf753` directly references `/profile` routing and restores root wiring through `routes/users`.
