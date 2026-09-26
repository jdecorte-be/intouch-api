# InTouch API

[![Test](https://github.com/jdecorte-be/intouch-api/actions/workflows/test.yml/badge.svg)](https://github.com/jdecorte-be/intouch-api/actions/workflows/test.yml)

Welcome! This is the backend for InTouch, a mobile app for discovering local events and groups, joining their chats, and hosting your own activities.

## What's in the API

- **Auth and onboarding**: email and Google sign-in, sessions and password reset via SuperTokens, plus onboarding and account endpoints
- **Events**: public discovery feed, user-hosted events and groups, admin management and visibility control
- **Social**: comments, interest toggles, event reports, and notifications
- **Chat**: group and direct threads with messages, images, reactions, and read state
- **Admin**: stats, member roles and bans, event and report moderation
- **Utilities**: Mapbox address suggestions, generated default avatars, health check, transactional email via Resend

## Development resources

This is a [NestJS](https://nestjs.com) application written in TypeScript, backed by PostgreSQL.

- **NestJS 11** on Express, with global validation (`class-validator`, unknown properties rejected), `helmet`, compression, and a global exception filter
- **Prisma 7** with the `pg` driver adapter; schema and migrations in `prisma/`
- **SuperTokens** for email/password, Google, and sessions (`src/supertokens/supertokens.config.ts`); guards in `src/session/`
- **Rate limiting**: 100 requests/min per client globally (`@nestjs/throttler`), plus 20/min on `/auth` and 30/min on `/geocode` (`express-rate-limit`)
- **Jest** unit tests that mock Prisma, so they need no database

### Project structure

```
src/
  auth/ supertokens/ session/         authentication, guards, current-user decorator
  events/ comments/ event-interest/   events, discovery, comments, interest
  reports/ notifications/             reports and in-app notifications
  chats/                              threads, messages, reactions
  members/ users/ admin-stats/        admin tools and public profiles
  geocode/ avatars/ health/           Mapbox proxy, generated avatars, health check
  common/                             mailer, password hashing, filters, format helpers
  prisma/                             Prisma service
prisma/                               schema and migrations
test/                                 end-to-end tests
```

Controllers stay thin; business logic lives in the `*.service.ts` files.

## Getting started

You need Node.js 24+, PostgreSQL, and a SuperTokens core (self-hosted or managed).

```bash
make setup               # npm ci, prisma generate, creates .env from .env.example
# fill in .env, then:
make migrate             # apply migrations to your local database
make dev                 # start in watch mode
```

Without `make`:

```bash
npm ci && npx prisma generate
cp .env.example .env
npx prisma migrate dev
npm run start:dev
```

The API listens on `PORT` (default `4000`). Check it with `curl localhost:4000/health`.

### Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `4000`) |
| `APP_BASE_URL` | Public URL of this API |
| `WEB_APP_URL` | URL of the web client |
| `CORS_ORIGINS` | Comma-separated allowed origins. Required when `NODE_ENV=production`; all origins allowed in development if empty |
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY` | SuperTokens core connection |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email; emails are logged instead of sent if unset |
| `MAPBOX_ACCESS_TOKEN` | Address suggestions |
| `UMAMI_HEALTHCHECK_URL` | Optional; `/health` also checks Umami when set |

Google redirect URIs to register: `<WEB_APP_URL>/auth/callback` (web) and `<APP_BASE_URL>/auth/mobile-callback` (native app, bridges to the `intouchapp://auth-callback` deep link).

### Scripts

Run `make help` for all shortcuts. The main ones:

| Make | npm | Description |
| --- | --- | --- |
| `make dev` | `npm run start:dev` | Run in watch mode |
| `make build` | `npm run build` | Compile to `dist/` |
| `make start` | `npm run start:prod` | Run the compiled build |
| `make lint` | `npm run lint` | ESLint (with autofix) |
| `make format` | `npm run format` | Prettier |
| `make test` | `npm test` | Unit tests |
| `make test-cov` | `npm run test:cov` | Unit tests with coverage |
| `make test-e2e` | `npm run test:e2e` | End-to-end tests (need a database and SuperTokens) |
| `make migrate name=<name>` | `npx prisma migrate dev` | Create and apply a migration |

CI (`.github/workflows/test.yml`) generates the Prisma client, builds, and runs the unit tests on every push to `master` and `dev` and on pull requests. On `master` it then records a GitHub `production` deployment.

## API overview

SuperTokens serves its own routes (sign up, sign in, sign out, refresh, Google, password reset) under `/auth`. Everything else is routed by Nest.

| Area | Routes |
| --- | --- |
| Auth | `GET /auth/session`, `GET /auth/mobile-callback`, `PATCH /auth/onboarding`, `PATCH /auth/account`, `POST /auth/account/password-reset` |
| Events | `GET /events`, `GET /events/mine`, `GET /events/:id`, `POST /events`, `PATCH /events/:id`, `DELETE /events/:id` |
| Comments | `GET/POST /events/:id/comments`, `DELETE /events/:id/comments/:commentId` |
| Interest | `GET /events/:id/interest`, `POST /events/:id/interest/toggle` |
| Reports | `GET/POST/DELETE /events/:id/report` |
| Chats | `GET /chats`, `GET /chats/:threadId`, `POST /chats/join`, `POST /chats/direct`, `POST /chats/:threadId/{read,messages,leave}`, `POST /chats/:threadId/messages/:messageId/reactions` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| Users | `GET /me`, `GET /users/:id/profile` |
| Utilities | `GET /geocode/address-suggestions`, `GET /avatars/beam/:seed`, `GET /health` |
| Admin | `/admin/stats`, `/admin/events`, `/admin/members`, `/admin/reports` |

Admin routes are protected by an admin guard. `GET /events` and `GET /geocode/address-suggestions` are public and open to any origin.

### Conventions

- **Errors** are always JSON: `{ "error": "message" }`. Validation failures also include `details`, the list of per-field messages.
- **Validation** rejects unknown properties in request bodies.
- **Proxy**: the API expects to run behind one reverse proxy (`trust proxy` is set to 1).

## Database

The schema lives in `prisma/schema.prisma`. Create a migration with `make migrate name=<name>`; production applies migrations with `npx prisma migrate deploy`.

## Deployment

Production runs on [Dokploy](https://dokploy.com), built with Nixpacks (`nixpacks.toml`): `npm ci`, `prisma generate`, `npm run build`, then on start `prisma migrate deploy && npm run start:prod`. Set the environment variables from [`.env.example`](.env.example) in the Dokploy application settings. A `.dockerignore` is included for Docker-based deploys.

## Contributions

> [!NOTE]
> This is a proprietary project. Outside contributions are not accepted unless agreed in writing beforehand.

If you have access and want to change something:

- Check for existing issues before filing a new one.
- Discuss larger changes before opening a PR.
- Reuse existing modules and patterns, and keep controllers thin.
- Add or update unit tests, and run `make lint` and `make test` before submitting.

## Security disclosures

If you discover a security issue, please report it privately to the maintainer rather than opening a public issue.

## License

Proprietary. Copyright (c) 2026 John Decorte. All rights reserved. No use, copying, or distribution without written permission.
