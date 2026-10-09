# Route 53 Console Clone

A functional clone of the AWS Route 53 console. You can sign in, manage **hosted zones**, and manage
**DNS records** of nine types (A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA) through a UI that follows
the AWS console's look and workflows. Every change goes through a FastAPI backend and is stored in SQLite.

> This is a demo. It isn't affiliated with Amazon Web Services, doesn't talk to AWS, and doesn't publish
> DNS anywhere. Sign-in, IAM, accounts and billing are mocked. Never enter real AWS credentials.

## Live demo

| | URL |
| --- | --- |
| **Application** | **https://aws-route53-clone-two.vercel.app** |
| API (FastAPI) | https://alpha12.eu.pythonanywhere.com/api/health |
| API docs (OpenAPI) | https://alpha12.eu.pythonanywhere.com/api/docs |
| Source | https://github.com/Angadshuklaa/aws-route53-clone |

**Demo sign-in:** Account ID `123456789012`, IAM user name `demo`, password `Route53Demo!`. The sign-in
page also has a **Fill in demo credentials** button.

Notes about the public demo:
- Everyone shares one demo account, so you may see other visitors' changes. The demo starts with 12
  hosted zones whose names and addresses come from documentation-reserved ranges.
- The backend runs on PythonAnywhere's free plan, which needs a one-click renewal each month
  (see [Deployment](#deployment)).

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Database schema](#database-schema)
- [API overview](#api-overview)
- [Deployment](#deployment)
- [Testing](#testing)
- [Known limitations](#known-limitations)

## Features

**Authentication (mocked):** sign-in page with one demo IAM user. Sessions are stored server-side in
SQLite and identified by an HTTP-only cookie, so they survive reloads and new tabs. Sign out deletes the
session. Protected pages redirect to sign-in and return you to the page you asked for.

**Hosted zones**
- Paginated table with server-side search (name, ID or description), a type filter, sortable columns,
  configurable page size, visible columns, wrapped lines and striped rows.
- Full-page **Create hosted zone** form: domain name, description, public/private type, VPC and Region
  for private zones, and tags. New zones get an apex NS record (four awsdns-style name servers) and an
  SOA record, as in Route 53.
- Zone details page: an expandable details panel with copyable name and ID, name servers and VPC,
  plus **Records** and **Hosted zone tags** tabs.
- **Edit** (description, tags, VPC) in a modal. As in Route 53, the domain name and type can't change.
- **Delete** with a confirmation modal where you must type `delete`. The zone's records are removed
  with it (`ON DELETE CASCADE`).

**DNS records**
- All nine required types, each with its own fields: A/AAAA addresses, CNAME/NS/PTR targets, TXT text,
  MX priority + mail server, SRV priority + weight + port + target, and CAA flags + tag + value.
  Multi-value records support up to 100 values each.
- Create and edit in a modal that shows the zone name after the record-name input, TTL shortcuts
  (1m/1h/1d) and inline validation that matches the backend's rules.
- Search by name, type or value, a type filter that works together with search, sorting by name, type
  or TTL, pagination, and column preferences.
- A side **split panel** shows the selected record's details, like the current Route 53 console.
- Route 53 rules are enforced: one record set per name and type, no CNAME at the apex, no CNAME
  alongside other records, apex NS/SOA can't be deleted, and records can only be reached through their
  own zone.

**Console shell:** top navigation with a working hosted-zone search, a Global region indicator, a
settings menu and an account menu. Side navigation, breadcrumbs, info links that open help panels, flash
notifications for every create, update, delete and failure, and loading, empty, no-match and error
states throughout.

**Placeholders:** Dashboard, Health checks, Profiles, Traffic policies and Resolver (VPCs, inbound and
outbound endpoints, rules, query logging) are reachable from the navigation. Each shows a "Coming soon"
page in the console style.

**Bonus features (all implemented)**

| Bonus | What it does |
| --- | --- |
| BIND import | **Import zone file** on the Records tab. Upload or paste a zone file. Supports `$ORIGIN`, `$TTL`, `@`, relative names, blank owners and multi-line records. Reports created, updated, skipped and failed entries with line numbers; existing records are skipped unless you choose to overwrite them. |
| Export | **Export zone file** downloads a BIND `.zone` file or a JSON document of the zone and its records. A BIND export can be imported again without changes. |
| Dark mode | Settings menu → Visual mode. Stored in the browser and applied before first paint. A Compact density option is there too. |
| Keyboard shortcuts | `/` focuses the table filter, `c` creates, `r` refreshes, `g` then `h` opens Hosted zones, `?` lists the shortcuts. They're ignored while you type in a field or have a dialog open. |
| Bulk operations | Select several records and delete them together. Apex NS/SOA records are skipped, and partial failures are listed per record. |

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, [Cloudscape Design System](https://cloudscape.design) (the open-source design system behind the AWS console) |
| Backend | Python 3.13, FastAPI, Pydantic 2, SQLAlchemy 2, Uvicorn, dnspython (zone file RDATA parsing) |
| Database | SQLite (WAL mode, foreign keys enforced), versioned SQL migrations |
| Tests | pytest (API, database, persistence), Playwright (end-to-end, desktop and mobile) |

## Architecture

```
 Browser
   │  https://<frontend>/route53/v2/...   (pages)
   │  https://<frontend>/api/...          (same-origin API calls, session cookie)
   ▼
 Next.js frontend  ── rewrite /api/:path* ──►  FastAPI backend  ──►  SQLite file on persistent disk
 (Vercel)                                       (uvicorn)              (WAL, foreign keys on)
```

- **Frontend:** Next.js renders the console pages. The `/route53/v2/*` routes sit behind a client-side
  auth guard that calls `GET /api/auth/me`. All data access goes through `lib/api/` (a typed `fetch`
  wrapper); no zone or record data is hard-coded or kept only in React state.
- **Same-origin API:** `next.config.ts` rewrites `/api/*` to the FastAPI service (`API_PROXY_TARGET`).
  The browser therefore only talks to the frontend's own origin, and the session cookie is first-party
  (`SameSite=Lax`, `Secure`, `HttpOnly`). This keeps sign-in working in browsers that block third-party
  cookies. Calling the API directly from the browser is also supported
  (`NEXT_PUBLIC_API_BASE_URL` plus CORS; see [Configuration](#configuration)).
- **Backend layers:** `app/api/` (routers, dependencies, HTTP status codes) → `app/services/` (business
  rules: DNS validation, conflict checks, BIND parsing) → `app/models/` (SQLAlchemy ORM) →
  `app/database.py` (engine, pragmas, migrations). Request and response schemas live in `app/schemas/`.
  Errors use one JSON shape: `{"error": {"code", "message", "details": [{"field", "message"}]}}`.
- **Auth:** `POST /api/auth/login` checks the demo credentials, creates a row in `sessions` holding a
  SHA-256 hash of a random token, and sets the token in an HTTP-only cookie. Every protected route
  resolves that cookie to a non-expired session or returns 401.
- **Persistence:** on startup the backend applies pending `app/migrations/*.sql` files, recording them in
  `schema_migrations`. It never drops or recreates tables. Demo data is seeded once per database, tracked
  by a marker row in `app_metadata`, so restarts and redeploys never duplicate data or bring back deleted
  zones.

## Local setup

Prerequisites: Python 3.11+ (3.13 recommended), Node.js 20.9+ and npm.

### Backend (http://127.0.0.1:8000)

```bash
cd backend
python3 -m venv .venv                       # or: uv venv --python 3.13 .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:create_app --factory --reload
```

The first start creates `backend/data/route53.db`, applies migrations and seeds 12 demo hosted zones.
Interactive API docs are at http://127.0.0.1:8000/api/docs. To start with an empty database, set
`SEED_DEMO_DATA=false`. To reset, stop the server and delete `backend/data/`.

### Frontend (http://localhost:3000)

```bash
cd frontend
npm install
npm run dev
```

`next dev` proxies `/api/*` to `http://127.0.0.1:8000` by default. Open http://localhost:3000 and sign
in with the demo credentials:

| Field | Value |
| --- | --- |
| Account ID | `123456789012` |
| IAM user name | `demo` |
| Password | `Route53Demo!` |

The sign-in page also has a **Fill in demo credentials** button.

## Configuration

### Backend environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | `production` makes the session cookie `Secure` by default. |
| `DATABASE_PATH` | `backend/data/route53.db` | SQLite file. In production this **must** be on persistent storage. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated origins allowed to make credentialed cross-origin calls. Wildcards are rejected. |
| `SESSION_COOKIE_NAME` | `r53_session` | Session cookie name. |
| `SESSION_COOKIE_SECURE` | `true` in production | Set the `Secure` flag. |
| `SESSION_COOKIE_SAMESITE` | `lax` | `lax`, `strict` or `none`. `none` requires `Secure`. |
| `SESSION_TTL_HOURS` | `12` | Session lifetime. |
| `DEMO_ACCOUNT_ID` / `DEMO_USERNAME` / `DEMO_PASSWORD` | `123456789012` / `demo` / `Route53Demo!` | The mocked IAM user. |
| `SEED_DEMO_DATA` | `true` | Seed the demo zones the first time a database is created. |
| `LOG_LEVEL` | `INFO` | Python log level. |

See `backend/.env.example`.

### Frontend environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `API_PROXY_TARGET` | build time (server) | Public base URL of the FastAPI service, e.g. `https://api.example.com`. Next.js proxies `/api/*` there. `next build` fails if neither this nor `NEXT_PUBLIC_API_BASE_URL` is set, so a production build can't silently fall back to localhost. |
| `NEXT_PUBLIC_API_BASE_URL` | build time (browser) | Optional. Makes the browser call the API cross-origin instead of through the proxy. Requires the backend to allow the origin in `CORS_ALLOWED_ORIGINS` and to use `SESSION_COOKIE_SAMESITE=none` with `SESSION_COOKIE_SECURE=true`. |

See `frontend/.env.example`.

## Database schema

Defined in [`backend/app/migrations/0001_initial_schema.sql`](backend/app/migrations/0001_initial_schema.sql).
Timestamps are ISO-8601 UTC strings.

```
hosted_zones 1 ──< dns_records 1 ──< dns_record_values
     1
     └──< hosted_zone_tags
sessions          app_metadata          schema_migrations
```

**`hosted_zones`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | Route 53-style ID: `Z` + 20 characters |
| `name` | TEXT NOT NULL | Lowercase domain without trailing dot; indexed |
| `type` | TEXT NOT NULL | `PUBLIC` or `PRIVATE` (CHECK) |
| `comment` | TEXT NOT NULL | Description, up to 256 characters |
| `vpc_id`, `vpc_region` | TEXT NULL | Required for private zones, NULL for public zones (CHECK) |
| `created_at`, `updated_at` | TEXT NOT NULL | |

Partial unique indexes allow one public zone per name and one private zone per name per VPC.

**`hosted_zone_tags`**: `zone_id` (FK → `hosted_zones.id`, `ON DELETE CASCADE`), `key`, `value`.
Primary key `(zone_id, key)`.

**`dns_records`**: one row per record set (name + type), as with Route 53 simple routing.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | |
| `zone_id` | TEXT NOT NULL | FK → `hosted_zones.id`, `ON DELETE CASCADE` |
| `name` | TEXT NOT NULL | FQDN, lowercase, no trailing dot; must be the zone or a subdomain of it |
| `type` | TEXT NOT NULL | CHECK in A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA, SOA |
| `ttl` | INTEGER NOT NULL | CHECK 0–2147483647 |
| `created_at`, `updated_at` | TEXT NOT NULL | |

`UNIQUE (zone_id, name, type)`, plus an index on `(zone_id, type)` for type filtering.

**`dns_record_values`**: the values of a record set. Type-specific data uses typed columns, so nothing
is packed into strings that would need parsing later.

| Column | Used by | Notes |
| --- | --- | --- |
| `record_id` | all | FK → `dns_records.id`, `ON DELETE CASCADE` |
| `position` | all | Value order; `UNIQUE (record_id, position)` |
| `value` | all | IPv4/IPv6 address, target host name, TXT text, CAA value, or SOA RDATA |
| `priority` | MX, SRV | CHECK 0–65535 |
| `weight`, `port` | SRV | CHECK 0–65535 |
| `flags`, `tag` | CAA | flags CHECK 0–255; tag is `issue`, `issuewild`, `issuemail` or `iodef` |

**`sessions`**: `token_hash` (PK, SHA-256 of the cookie token), `username`, `account_id`, `created_at`,
`expires_at` (indexed). Expired sessions are rejected and cleaned up at sign-in.

**`app_metadata`** (key/value bookkeeping, such as when the demo data was seeded) and
**`schema_migrations`** (applied migration versions).

SQLite enforces foreign keys only when `PRAGMA foreign_keys = ON` is set on each connection. The engine
sets it on every connection, together with WAL journaling and a busy timeout.

## API overview

Base path `/api`. Every endpoint except `/api/health` and `/api/auth/login` needs the session cookie.
The OpenAPI UI is at `/api/docs` and the schema at `/api/openapi.json`.

### Authentication

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Body `{"account_id", "username", "password"}`. Returns the user and sets the `r53_session` cookie. 401 `INVALID_CREDENTIALS` on a mismatch. |
| `POST` | `/api/auth/logout` | Deletes the session and clears the cookie. 204. |
| `GET` | `/api/auth/me` | Current user and session expiry, or 401. |

### Hosted zones

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/hosted-zones` | Query: `search` (name, ID or description), `type` (`PUBLIC`/`PRIVATE`), `page` (default 1), `page_size` (1–100, default 10), `sort_by` (`name`, `type`, `record_count`, `created_at`), `sort_order` (`asc`/`desc`). Returns `{items, total, page, page_size, total_pages}`. |
| `POST` | `/api/hosted-zones` | Body `{"name", "type", "comment", "vpc_id", "vpc_region", "tags": [{"key","value"}]}`. 201 with the zone; 409 if the zone already exists. |
| `GET` | `/api/hosted-zones/{zone_id}` | The zone, with `record_count` and `name_servers`. |
| `PUT` | `/api/hosted-zones/{zone_id}` | Replaces the editable fields: `comment`, `tags`, and `vpc_id`/`vpc_region` for private zones. Sending `name` returns 422. |
| `DELETE` | `/api/hosted-zones/{zone_id}` | Deletes the zone and all its records. 204. |
| `GET` | `/api/hosted-zones/{zone_id}/export?format=bind\|json` | Downloads the zone as a BIND zone file or JSON. |
| `POST` | `/api/hosted-zones/{zone_id}/import` | Body `{"content": "<zone file>", "overwrite": false}`. Returns `{created, updated, skipped[], errors[]}` with line numbers. |

### Records

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/hosted-zones/{zone_id}/records` | Query: `search` (name, type or value), `type` (repeatable), `page`, `page_size` (default 20), `sort_by` (`name`, `type`, `ttl`), `sort_order`. |
| `POST` | `/api/hosted-zones/{zone_id}/records` | Create a record set. 201. |
| `GET` | `/api/hosted-zones/{zone_id}/records/{record_id}` | 404 if the record belongs to a different zone. |
| `PUT` | `/api/hosted-zones/{zone_id}/records/{record_id}` | Replace the name, type, TTL and values. |
| `DELETE` | `/api/hosted-zones/{zone_id}/records/{record_id}` | 204. Apex NS/SOA records return 400. |
| `POST` | `/api/hosted-zones/{zone_id}/records/batch-delete` | Body `{"record_ids": [..]}`. Returns `{deleted: [ids], failed: [{id, message}]}`. |

Record payloads:

```jsonc
// A / AAAA / CNAME / NS / PTR / TXT
{"name": "www.example.com", "type": "A", "ttl": 300,
 "values": [{"value": "192.0.2.10"}, {"value": "192.0.2.11"}]}
// MX
{"name": "example.com", "type": "MX", "ttl": 3600, "values": [{"priority": 10, "value": "mail.example.com"}]}
// SRV
{"name": "_sip._tcp.example.com", "type": "SRV", "ttl": 3600,
 "values": [{"priority": 10, "weight": 60, "port": 5060, "value": "sip.example.com"}]}
// CAA
{"name": "example.com", "type": "CAA", "ttl": 3600, "values": [{"flags": 0, "tag": "issue", "value": "amazon.com"}]}
```

Responses include `values` (structured), `formatted_values` (as Route 53 displays them, e.g.
`10 60 5060 sip.example.com` or `"v=spf1 -all"`), `is_system`, `routing_policy` and timestamps.

### Operations

`GET /api/health` returns `{"status": "ok", "database": "ok", "version", "time"}`, or 503 when the
database can't be read.

### Errors

| Status | When |
| --- | --- |
| 400 `BAD_REQUEST` | The operation isn't allowed, e.g. a CNAME at the apex or deleting the apex SOA record |
| 401 `UNAUTHORIZED` / `INVALID_CREDENTIALS` | No valid session, or wrong sign-in details |
| 404 `NOT_FOUND` | Unknown zone, record, or a record in a different zone |
| 409 `CONFLICT` | Duplicate zone, duplicate record set, or a CNAME conflict |
| 422 `VALIDATION_ERROR` | Invalid input. `details` lists each field, such as `values[0].priority` |
| 500 `INTERNAL_ERROR` | Unexpected failure. Logged server-side; no stack trace is returned |

Example:

```bash
curl -c jar -H 'Content-Type: application/json' \
  -d '{"account_id":"123456789012","username":"demo","password":"Route53Demo!"}' \
  http://127.0.0.1:8000/api/auth/login
curl -b jar 'http://127.0.0.1:8000/api/hosted-zones?search=example&page_size=5'
```

## Deployment

The public demo runs entirely on free plans:

| Part | Host | Details |
| --- | --- | --- |
| Frontend | Vercel (Hobby) | Next.js build. `API_PROXY_TARGET=https://alpha12.eu.pythonanywhere.com` is set for Production and Preview. `frontend/vercel.json` pins the framework to Next.js. |
| Backend | PythonAnywhere (free Beginner, EU) | FastAPI served by PythonAnywhere's uWSGI through [`backend/wsgi.py`](backend/wsgi.py) (a2wsgi adapter). HTTPS is enforced. |
| Database | SQLite at `/home/Alpha12/route53-data/route53.db` | Stored on the account's persistent home disk, outside the git checkout, so deploys never replace it. |

### Why this layout

- **Same-origin cookies.** The browser only talks to `aws-route53-clone-two.vercel.app`, and Vercel
  proxies `/api/*` to PythonAnywhere. The session cookie (`HttpOnly; Secure; SameSite=Lax`) is
  therefore first-party, so it works in Safari and other browsers that block third-party cookies.
  The backend also allows that origin in `CORS_ALLOWED_ORIGINS`, with credentials, for direct calls;
  other origins are rejected.
- **Durable SQLite.** Free container and serverless hosts, such as Render's free tier and Vercel
  functions, have ephemeral disks, where SQLite data would be lost on restart. PythonAnywhere's home directories are persistent.
- **WSGI on the free plan.** PythonAnywhere's free plan serves WSGI apps, so `backend/wsgi.py` wraps
  FastAPI with a2wsgi. uWSGI imports the app in a master process and then forks, so the wrapper is
  created lazily inside the worker, and database connections opened before the fork are discarded.
  Lifespan events don't run under WSGI, so migrations run when the module is imported.

### Backend (PythonAnywhere)

1. Create a free account, open a **Bash console**, and run:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/Angadshuklaa/aws-route53-clone/main/backend/deploy/pythonanywhere-setup.sh | bash
   ```
   [The script](backend/deploy/pythonanywhere-setup.sh) clones the repository, builds
   `backend/.venv` with Python 3.13, writes `backend/.env` with production settings (only if it
   doesn't already exist), and applies migrations. On a new database it also seeds the demo data.
2. Create a **Manual configuration** web app for Python 3.13, either from the Web tab or with the API
   (`POST /api/v0/user/<user>/webapps/`). Then set:
   - Virtualenv: `/home/<user>/aws-route53-clone/backend/.venv`
   - Source code: `/home/<user>/aws-route53-clone/backend`
   - Force HTTPS: on
   - WSGI file (`/var/www/<user>_eu_pythonanywhere_com_wsgi.py`):
     ```python
     import sys
     BACKEND_DIR = "/home/<user>/aws-route53-clone/backend"
     if BACKEND_DIR not in sys.path:
         sys.path.insert(0, BACKEND_DIR)
     from wsgi import application  # noqa: E402,F401
     ```
3. Production settings, in `backend/.env` on the server:
   ```
   APP_ENV=production
   DATABASE_PATH=/home/<user>/route53-data/route53.db
   SESSION_COOKIE_SECURE=true
   SESSION_COOKIE_SAMESITE=lax
   SEED_DEMO_DATA=true
   CORS_ALLOWED_ORIGINS=https://aws-route53-clone-two.vercel.app
   ```
4. **Deploying updates:** run the same setup command again, then reload the web app (Web tab, or
   `POST /api/v0/user/<user>/webapps/<domain>/reload/`). The script pulls the code and updates
   dependencies. It leaves `backend/.env` and `~/route53-data` alone, and migrations only apply
   versions that haven't run yet.
5. **Monthly renewal (free plan):** PythonAnywhere disables free web apps after a month unless someone
   clicks **"Run until 1 month from today"** on the Web tab. The current deadline is **2026-11-09**.
   Disabling the web app doesn't delete any files, so the database is still there when you renew.

### Frontend (Vercel)

```bash
cd frontend
vercel link                                   # once
vercel env add API_PROXY_TARGET production    # value: https://alpha12.eu.pythonanywhere.com
vercel deploy --prod
```

Vercel can also deploy on every push once the Git integration is connected (`vercel git connect`,
root directory `frontend`). The build fails if `API_PROXY_TARGET` is missing, so it can't fall back to
localhost.

### Other hosts

`backend/Dockerfile` and [`backend/scripts/start.sh`](backend/scripts/start.sh) run the API under
uvicorn on any container host that has a persistent volume, such as Fly.io or Railway. Mount the
volume at `/data`; the image sets `DATABASE_PATH=/data/route53.db`.

## Testing

```bash
# Backend: API, validation, relationships, persistence across restarts, BIND import/export
cd backend && .venv/bin/python -m pytest

# Frontend: lint, type-check, production build
cd frontend && npm run lint && npm run typecheck && API_PROXY_TARGET=http://127.0.0.1:8000 npm run build

# End-to-end (needs both servers running, or a deployment)
cd frontend && npx playwright install chromium && npm run test:e2e
E2E_BASE_URL=https://your-frontend.example npm run test:e2e   # against a deployment
```

The end-to-end suite signs in through the UI and covers:
- authentication: redirects, wrong credentials, validation, reloads and sign-out
- hosted zones: create (including private zones), search, edit, cancel, delete, duplicate detection,
  the type filter and pagination
- all nine record types: create, edit and delete through the form, with a reload to confirm persistence
- validation from the client and from the API
- search combined with the type filter, bulk delete, BIND import with an invalid line, and export
- isolation between zones
- navigation to every placeholder section, top-navigation search, dark mode, keyboard shortcuts, and a
  phone-sized viewport

Test zones are prefixed `e2e-` and removed afterwards.

### Verified results (2026-10-09)

| Check | Result |
| --- | --- |
| Backend `pytest` | 66 passed |
| Frontend `npm run lint`, `npm run typecheck`, `next build` | clean |
| Playwright against local servers | 15 passed (14 desktop, 1 mobile) |
| Playwright against **https://aws-route53-clone-two.vercel.app** | 15 passed (14 desktop, 1 mobile) |
| Production session cookie | `HttpOnly; Secure; SameSite=lax`, first-party on the Vercel domain |
| Production CORS | Preflight from the Vercel origin allowed with credentials; other origins rejected (400) |
| Persistence across a backend restart | A test zone and TXT record created through the public site were still present after the web app was reloaded |
| Persistence across a redeploy | After re-running the deploy script and reloading: still 13 zones, the test record intact, schema reported up to date, no re-seeding |

## Known limitations

- Only simple routing is supported. Weighted, latency, failover, geolocation and alias records,
  DNSSEC, health checks and query logging aren't implemented, and the placeholder sections say so.
- Record types beyond the nine required ones (plus the managed SOA) aren't supported. The importer
  reports them as skipped.
- There is one shared demo account, so everyone using the public demo sees the same data.
- TXT and CAA values are limited to printable ASCII so that exports are valid zone files.
- SQLite with a single API process suits a demo. A multi-instance deployment would need a different
  database.
- The free PythonAnywhere web app must be renewed monthly (see [Deployment](#deployment)), and
  free-plan CPU limits can make the first request after a quiet period slower.
