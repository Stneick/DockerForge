# 5. Installation and Configuration

DockerForge is designed to run as a Docker Compose stack on a single host. This is
the supported and recommended installation path; a non-Docker development setup is
described in §5.6.

## 5.1 Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Docker Engine | 24+ | Must expose the Unix socket `/var/run/docker.sock` |
| Docker Compose plugin | v2 | Invoked as `docker compose` (not `docker-compose`) |
| Git | any recent | To clone the repository |
| Open ports | 80, 443 | Published by the Caddy container (production) |

The host's Docker daemon is also the build engine — generated images are built on the
same daemon — so the account running Compose needs permission to use the Docker
socket. No separate Python or Node installation is required for the Docker path; all
builds happen inside containers.

## 5.2 Quick Start (Docker Compose)

```bash
# 1. Clone the repository
git clone <repository-url> dockerforge
cd dockerforge

# 2. Create the backend environment file
cp backend/.env.example backend/.env
```

**3. Edit `backend/.env`.** At minimum, for a Compose deployment:

- Set **`DB_HOST=postgres`** (the example ships `localhost`, which only works when the
  API runs directly on the host — see §5.7).
- Set a strong **`JWT_SECRET_KEY`**.
- For production, set **`ENVIRONMENT=prod`** (enables secure/strict cookies and
  disables the public `/docs`) and a real **`CORS_ORIGINS`**.
- Choose **`DB_USER` / `DB_PASSWORD` / `DB_NAME`** (defaults are all `dockerforge`).

**4. Match the Postgres container credentials.** The `postgres` service reads
`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` from the shell environment
(defaulting to `dockerforge`). These **must equal** the `DB_*` values in
`backend/.env`. If you keep the defaults, nothing more is needed. If you customise
them, export matching values (or place them in a `.env` file in the `docker/`
directory) before starting:

```bash
export POSTGRES_USER=dockerforge POSTGRES_PASSWORD=<your-password> POSTGRES_DB=dockerforge
```

**5. Set the domain (production).** Caddy obtains a Let's Encrypt certificate for
`DOMAIN`. For a public deployment, point a DNS A record at the host and export the
domain; for local use, leave it as `localhost`.

```bash
export DOMAIN=dockerforge.example.com   # production
# export DOMAIN=localhost               # local (default)
```

**6. Build and start the stack.**

```bash
cd docker
docker compose up -d --build
```

The `migrate` service runs `alembic upgrade head` and must finish before the API and
worker start. Once the stack is healthy:

```bash
docker compose ps          # all services "running"/"healthy"; migrate "exited (0)"
```

**7. Open the app** at `https://<DOMAIN>` (or `http://localhost` locally), register
the first user, create a project, and run a build.

To stop the stack: `docker compose down` (add `-v` to also delete the named volumes —
this erases the database, Redis data, and stored project sources).

## 5.3 Dependencies and Versions

### Runtime images (pulled or built by Compose)

| Image | Version | Role |
|---|---|---|
| `postgres` | 16 | Database |
| `redis` | 7-alpine | Job queue + log streams (AOF persistence) |
| `caddy` | 2 | TLS / reverse proxy |
| `nginx` | 1.27-alpine | Serves the built SPA, proxies `/api/` |
| `node` | 22-alpine | Frontend build stage |
| `python` | 3.12-slim | Backend build + runtime stages |
| `hadolint/hadolint` | v2.12.0 | Dockerfile linter (copied into the backend image) |

### Backend Python dependencies (pinned in `backend/requirements.txt`)

```
fastapi==0.136.3
uvicorn[standard]==0.49.0
sqlalchemy[asyncio]==2.0.50
asyncpg==0.31.0
alembic==1.18.4
pydantic-settings==2.14.1
pydantic[email]==2.13.4
PyJWT==2.13.0
pwdlib[argon2]==0.3.0
docker==7.1.0
jinja2==3.1.6
python-multipart==0.0.32
loguru==0.7.3
aiofiles==25.1.0
arq==0.28.0
redis==5.3.1
```

Development tooling (in `requirements-dev.txt`): Black, Ruff, mypy, pre-commit, and
fastapi-cli.

### Frontend dependencies

Declared in `frontend/package.json` and locked in `frontend/package-lock.json`; key
libraries are React 18.3, TypeScript 5.7, Vite 6.1, Tailwind CSS 3.4, TanStack Query
5, Zustand 5, React Router 6.29, and the Monaco editor. The frontend is built with
Node 22 (`npm ci`).

## 5.4 Configuration Reference

DockerForge has three layers of configuration: the backend application environment
(`backend/.env`), the Compose-level variables, and the runtime settings stored in the
database.

### 5.4.1 Backend application environment (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `DB_USER` | *(required)* | PostgreSQL username |
| `DB_PASSWORD` | *(required)* | PostgreSQL password |
| `DB_HOST` | `postgres` | DB host — use `postgres` under Compose; `localhost` for host-run API |
| `DB_PORT` | `5432` | DB port |
| `DB_NAME` | *(required)* | Database name |
| `REDIS_HOST` | `redis` | Redis host (service name under Compose) |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET_KEY` | *(required)* | HMAC signing key — set a long random value |
| `JWT_ALGORITHM` | `HS256` | JWT signing algorithm |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access-token lifetime |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh-token lifetime |
| `BUILD_MAX_CONCURRENT` | `2` | Worker build concurrency (restart required) |
| `ARQ_JOB_TIMEOUT_SECONDS` | `7800` | Hard per-job kill ceiling; must exceed the runtime `build_timeout_seconds` |
| `PROJECTS_SOURCE_DIR` | `/var/lib/dockerforge/projects` | Where uploaded/cloned source is stored (the shared volume mount point) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins (credentials are allowed, so this cannot be `*`) |
| `HOST` | `0.0.0.0` | Bind host |
| `PORT` | `8000` | Bind port |
| `WORKERS` | `4` | uvicorn worker count |
| `LOG_LEVEL` | `info` | Log level |
| `ENVIRONMENT` | `dev` | `dev` or `prod`; controls cookie `secure`/`samesite` and whether `/docs` and `/redoc` are exposed |

> dev behaviour is driven by `ENVIRONMENT`. It can be left in place or
> removed without effect.

### 5.4.2 Compose-level variables

These are read by Docker Compose itself (not the application) and default sensibly
for local use:

| Variable | Default | Purpose |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `dockerforge` | Postgres container init credentials — **must match the app's `DB_*`** |
| `DOMAIN` | `localhost` | Caddy site address (Let's Encrypt certificate subject) |

### 5.4.3 Runtime settings (database, editable via `PATCH /api/v1/settings`)

These can be changed at runtime without a restart (see §3.6 and §4.4). Defaults and
accepted ranges:

| Setting | Default | Range |
|---|---|---|
| `build_timeout_seconds` | 600 | 30–7200 |
| `build_memory_limit` | `512m` | pattern `\d+(k\|m\|g)` |
| `image_cleanup_enabled` | `true` | — |
| `image_ttl_seconds` | 3600 | 60–86400 |
| `max_upload_size_mb` | 100 | 1–2048 |
| `git_clone_timeout_seconds` | 120 | 10–3600 |
| `build_log_stream_ttl_seconds` | 300 | 60–86400 |
| `build_log_stream_max_entries` | 10000 | 100–100000 |
| `hadolint_timeout_seconds` | 30 | 5–300 |

Note that uploads are additionally capped by the Nginx `client_max_body_size`
directive (500 MB), so the effective upload limit is the smaller of that and
`max_upload_size_mb`.

## 5.5 Production Deployment

The repository ships a GitHub Actions workflow (`.github/workflows/deploy.yml`) that
deploys to a DigitalOcean Droplet on every push to `main`:

1. It connects over SSH (`appleboy/ssh-action`) to the host defined by the
   `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` secrets.
2. It performs a hard reset to `origin/main` in `/opt/dockerforge`.
3. It regenerates `backend/.env` from GitHub **Secrets** (`DB_PASSWORD`,
   `JWT_SECRET_KEY`) and **Variables** (`DOMAIN`, `CORS_ORIGINS`, `DB_USER`, `DB_NAME`,
   `ENVIRONMENT`, `DEBUG`), and exports the matching `POSTGRES_*` and `DOMAIN` values.
4. It runs `docker compose -f docker/docker-compose.yml up -d --build --remove-orphans`
   followed by `docker image prune -f`.

Deployment concurrency is limited to one run at a time. To deploy to your own host,
set those repository Secrets/Variables and ensure the host has Docker, the repository
checked out at `/opt/dockerforge`, DNS pointing at it, and ports 80/443 open.

## 5.6 Local Development (without the full stack)

To run the backend directly on your machine you still need PostgreSQL 16 and Redis 7
reachable (the Compose `postgres`/`redis` services do not publish host ports by
default, so either expose them or run your own instances). Then:

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows; use source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
# point .env at your local services:
#   DB_HOST=localhost   REDIS_HOST=localhost
alembic upgrade head
uvicorn app.main:app --reload    # API on :8000
arq app.worker.WorkerSettings    # worker, separate terminal
```

The frontend runs separately with `npm install && npm run dev` in `frontend/`.

## 5.7 Troubleshooting

**API exits at startup with "database unavailable, shutting down."**
Almost always `DB_HOST`. Under Docker Compose it must be `postgres` (the service
name), not `localhost` — the value `.env.example` ships. Also confirm the Compose
`POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` match the app's `DB_*`; a mismatch
means the database was initialised with different credentials. If you changed
credentials after the first run, the old ones persist in the `pgdata` volume — recreate
it with `docker compose down -v` (destroys data) or align the values.

**API or worker exits with "Redis unavailable."**
`REDIS_HOST` should be `redis` under Compose (the default). Check the Redis container
is healthy: `docker compose logs redis`.

**Startup fails with a Docker daemon error / endpoints return 503 with a "Service
Unavailable / Ensure Docker is running" body.**
The API and worker require the host Docker socket. Confirm `/var/run/docker.sock` is
mounted (it is in the provided Compose file) and that Docker is running on the host
and the container user can access the socket.

**Builds never start; triggering returns 503 "Build queue unavailable."**
The worker isn't running or Redis is down. Check `docker compose ps` and
`docker compose logs worker`.

**The `migrate` step failed and the API/worker won't start.**
The API and worker depend on `migrate` completing successfully. Inspect
`docker compose logs migrate`; a common cause is unreachable/misconfigured Postgres
(see the first item). Fix and re-run `docker compose up -d --build`.

**HTTPS isn't working / certificate errors.**
Caddy needs a publicly resolvable `DOMAIN` with DNS pointing at the host and ports
80/443 reachable to complete the ACME challenge. For local use set `DOMAIN=localhost`
(Caddy serves a local certificate) and access `https://localhost` or `http://localhost`.

**Large uploads are rejected.**
Two limits apply: the Nginx `client_max_body_size` (500 MB) and the runtime
`max_upload_size_mb` (default 100). Raise both as needed.

**Local `pip` import errors (e.g. `No module named 'redis'`).**
Install dependencies into the active virtualenv: `pip install -r requirements.txt`.
`redis` is a direct, pinned dependency.
