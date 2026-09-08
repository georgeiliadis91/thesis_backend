# Backend (Strapi CMS)

This is a **separate git repo** (remote: `thesis_backend`) from the frontend
repo at `/home/geo/code/apodimoi-thesis`. That repo's
[root CLAUDE.md](/home/geo/code/apodimoi-thesis/CLAUDE.md) has project-wide
context; this file is backend-specific.

## Stack

- **Strapi 4.1.5**, `@strapi/plugin-i18n`, `@strapi/plugin-users-permissions`
- Postgres via `pg` (DB itself is run from the frontend repo's
  `docker-compose.yml`)
- `package.json` pins `"node": ">=12.x.x <=16.x.x"` — the local machine runs
  Node v22. If `npm i` / `strapi develop` misbehaves, suspect this mismatch
  first (use `nvm` to switch to Node 16) rather than upgrading Strapi.
- No TypeScript, no test suite — this is a config/content-driven CMS, most
  "logic" is Strapi content-type schemas plus a couple of custom
  controllers/extensions.

## Content types (`src/api/*/content-types/*/schema.json`)

`about`, `advisor`, `article`, `community`, `contact`, `home` (single type),
`layout` (single type), `lesson`, `radio`, `service`, `toponimia`. Most are
i18n-localized (`pluginOptions.i18n.localized`). `advisor` and `lesson` use
repeatable components (`advisor-list`, `lesson-list`).

Each API follows the standard Strapi trio: `controllers/`, `routes/`,
`services/`. Prefer Strapi's generated CRUD via `createCoreController` /
`createCoreRouter` patterns already used here over hand-written custom logic,
unless the task specifically needs custom behavior.

## Users & permissions

`src/extensions/users-permissions/strapi-server.js` customizes the built-in
users-permissions plugin:

- Adds `PUT /users/me` (self-update) and `GET /users/countries`.
- Sanitizes user output to strip `password`, `resetPasswordToken`,
  `confirmationToken`, `username`.
- Field-level visibility is driven by a `profile_data.permissions` map with
  values `private` / `public` / `authenticated` — check this when
  exposing any new user field on the frontend.

User geographic fields (island, dimotiki enotita, birthplace) that back the
frontend's map/chart views live on the user model via this extension —
check current field names here before wiring up new frontend stats rather
than assuming.

## Data

- `db_backup/` contains CSV exports of the full dataset (referenced by the
  root README's import instructions). Treat as data, not code: don't edit or
  regenerate it casually, and don't assume it's disposable.
- `.strapi-updater.json` is local Strapi telemetry/state — ignore it.

## ⚠️ Security note — already-committed secrets

The real `.env` (with live `APP_KEYS`, `JWT_SECRET`, `API_TOKEN_SALT`) is
tracked in this repo's git history — it was intentionally un-gitignored in
commit `3b71059` ("git ignore removal"). Treat those specific values as
already compromised:

- Don't reuse them as a template for "real" secrets anywhere else.
- Recommend the user rotate them before any production deployment.
- Never commit a new `.env` with real secrets — if asked to change env
  config, edit `.env.example` (which should stay templated) and tell the
  user to update their local `.env` by hand.

## Explicit permission required (in addition to root-level rules)

- Any change to `src/api/*/content-types/*/schema.json` (schema/migration
  implications) or new content types
- Anything under `db_backup/`
- `.env` contents or secret rotation
- `npm run build` / `npm run start` (production mode) or deploy-related config
