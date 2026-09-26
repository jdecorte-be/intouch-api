# intouch-api

Backend API for **InTouch**, an events and community app. Built with [NestJS](https://nestjs.com) 11, Prisma 7 (PostgreSQL) and [SuperTokens](https://supertokens.com) for authentication.

## Features

- **Auth**: email/password and Google sign-in, sessions, password reset (SuperTokens), plus onboarding and account endpoints
- **Events**: public discovery, user-created events, admin management and visibility control
- **Social**: comments, interest toggles, event reports, chats (group and direct, with reactions and read state), notifications
- **Admin**: stats, members (roles, bans), events and report moderation
- **Utilities**: Mapbox address suggestions, generated avatars, health check, transactional email via Resend

## Requirements

- Node.js >= 24
- PostgreSQL
- A SuperTokens core (self-hosted or managed)

## Getting started

```bash
npm install
cp .env.example .env     # then fill in the values
npx prisma generate
npx prisma migrate dev   # apply migrations to your local database
npm run start:dev
```

The API listens on `PORT` (default `4000`).

## Environment variables

See [`.env.example`](.env.example) for the full list.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port (default `4000`) |
| `APP_BASE_URL` | Public URL of this API |
| `WEB_APP_URL` | URL of the web client |
| `CORS_ORIGINS` | Comma-separated allowed origins (all allowed if empty) |
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY` | SuperTokens core connection |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email; emails are logged instead of sent if unset |
| `MAPBOX_ACCESS_TOKEN` | Address suggestions |
| `UMAMI_HEALTHCHECK_URL` | Optional; `/health` also checks Umami when set |

Google redirect URIs to register: `<WEB_APP_URL>/auth/callback` (web) and `<APP_BASE_URL>/auth/mobile-callback` (native app, bridges to the `intouchapp://auth-callback` deep link).

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Run in watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled build |
| `npm run lint` | ESLint (with autofix) |
| `npm run format` | Prettier |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run test:cov` | Coverage |

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

## Project layout

```
src/
  auth/ supertokens/ session/   authentication and guards
  events/ comments/ event-interest/ reports/
  chats/ notifications/ members/ users/ admin-stats/
  geocode/ avatars/ health/
  common/                       mailer, password, filters, formatting helpers
  prisma/                       Prisma service
prisma/                         schema and migrations
test/                           e2e tests
```

## Database

Schema lives in `prisma/schema.prisma`. Create a migration with `npx prisma migrate dev --name <name>`; production applies them with `npx prisma migrate deploy`.

## Deployment

Deployed via Nixpacks (`nixpacks.toml`): `npm ci`, `prisma generate`, `npm run build`, then on start `prisma migrate deploy && npm run start:prod`. A `.dockerignore` is included for Docker-based deploys.
