# DockerForge

> A self-hosted web application that turns source code into an optimized, ready-to-run Docker image — no Dockerfile required.


DockerForge lets you upload a project (or point it at a Git repository), automatically detects its language and framework, generates a best-practice Dockerfile from a curated template library, builds the image while streaming the build logs live to your browser, and lets you download the result as a `.tar` archive or push it straight to a container registry.

It is designed as a **self-hosted internal tool** — think Jenkins or Portainer — that runs on a single machine via Docker Compose with multi-user authentication. It is **not** a public SaaS.

---

## Features

- **Source ingestion** — upload an archive or clone a public/private Git repository.
- **Automatic detection** — identifies language, framework, dependency file, entry point, and exposed port, with a confidence score.
- **Dockerfile generation** — renders an optimized, multi-stage, non-root Dockerfile from a Jinja2 template library covering Python, Node.js, Go, Java, Rust, C, and C++.
- **Dockerfile linting** — every generated (or hand-edited) Dockerfile is checked with [hadolint](https://github.com/hadolint/hadolint).
- **Live build logs** — build output is streamed to the browser in real time over Server-Sent Events.
- **Build management** — full build history, image-layer breakdown, side-by-side build comparison, cancel, and retry.
- **Delivery** — download the built image as a `.tar`, or push it to a Docker registry with your credentials.
- **Image lifecycle** — built images are cleaned up automatically after a configurable TTL, plus a periodic prune of dangling images.
- **Authentication** — multi-user registration and login using JWT access/refresh tokens delivered via `httponly` cookies.

## How it works

```
upload / clone  →  detect  →  generate Dockerfile  →  build  →  download / push
                                    (+ lint)        (live logs)
```

1. Create a project and provide its source (upload or Git clone).
2. DockerForge analyzes the source and proposes a language, framework, and Dockerfile — which you can review and edit in the browser.
3. Trigger a build. The request is queued to a background worker that runs `docker build`, streaming each log line back to the UI.
4. On success, inspect the image's layers and size, then download it as a tar archive or push it to a registry.

## Architecture

DockerForge runs as a set of containers orchestrated by Docker Compose:

| Service | Role |
|---|---|
| `caddy` | Reverse proxy with automatic HTTPS (Let's Encrypt); fronts the whole app |
| `dockerforge-frontend` | React SPA served by Nginx; proxies `/api/` to the backend |
| `dockerforge-api` | FastAPI application — REST API, auth, SSE log streaming |
| `worker` | arq worker — runs Docker builds and pushes off the request path |
| `postgres` | PostgreSQL 16 — primary datastore |
| `redis` | Redis 7 — arq job queue **and** build-log stream transport |
| `migrate` | One-shot Alembic migration job, runs before the API/worker start |

The API and the worker both mount the host Docker socket (`/var/run/docker.sock`) and share the project-source volume. Builds are dispatched from the API to the worker through Redis; the worker publishes log lines to a Redis Stream, which the API relays to the browser over SSE.

> A complete description with component, deployment, and sequence diagrams lives in [`docs/technical-documentation.md`](docs/technical-documentation.md).

## Tech stack

**Backend**
- Python 3.12, FastAPI, Uvicorn
- SQLAlchemy 2.0 (async) + asyncpg, Alembic
- Pydantic v2 / pydantic-settings
- arq (Redis-backed task queue)
- docker (docker-py SDK), Jinja2
- PyJWT, pwdlib[argon2], loguru
- hadolint (bundled in the image)

**Frontend**
- React 18 + TypeScript, Vite 6
- Tailwind CSS 3, Radix UI, Framer Motion, lucide-react
- TanStack Query, Zustand, React Router 6
- Monaco editor (in-browser Dockerfile editing)

**Infrastructure**
- PostgreSQL 16, Redis 7
- Caddy 2 (TLS/reverse proxy), Nginx 1.27 (static frontend)
- Docker + Docker Compose

> Backend dependencies are pinned in `requirements.txt`; the full versioned list is in the Installation chapter of the technical documentation.

## Quick start

**Prerequisites:** Docker Engine and the Docker Compose plugin on the host, with access to the Docker socket.

```bash
# 1. Clone the repository
git clone <repository-url> dockerforge
cd dockerforge

# 2. Create the backend environment file
cp backend/.env.example backend/.env
# then edit backend/.env — set a strong JWT_SECRET_KEY, set DB_HOST=postgres,
#   and, for production, ENVIRONMENT=prod
```

```bash
# 3. Build and start the stack
cd docker
docker compose up -d --build
```

The migration job runs automatically before the API starts. Once everything is healthy, open the app:

- App: `http://localhost` (or your `DOMAIN`)
- API docs (Swagger UI, dev mode only): `http://localhost/docs`

Register your first user from the UI, create a project, and run your first build.

> Full step-by-step installation, configuration reference, and troubleshooting are in [`docs/technical-documentation.md`](docs/technical-documentation.md).

## Project structure

```
dockerforge/
├── backend/                  # FastAPI application + arq worker
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint, lifespan, exception handlers
│   │   ├── worker.py         # arq worker: build, push, cleanup, prune tasks
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── database.py       # Async SQLAlchemy engine/session
│   │   ├── api/              # Route handlers (auth, users, projects, builds, languages, settings)
│   │   ├── services/         # Business logic (detector, dockerfile_generator, docker_client, lint, ...)
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response models
│   │   ├── core/             # Security, dependencies, languages config, logging, utils
│   │   └── templates/        # Jinja2 Dockerfile templates by language/framework
│   ├── alembic/              # Database migrations
│   └── requirements.txt
├── frontend/                 # React + TypeScript + Vite SPA
├── docker/
│   ├── docker-compose.yml    # Full stack definition
│   ├── Dockerfile.backend    # Multi-stage backend image (bundles hadolint)
│   ├── Dockerfile.frontend   # Vite build → Nginx
│   └── Caddyfile             # Reverse proxy + HTTPS
├── docs/                     # Technical documentation (architecture, API, install, user manual)
└── README.md
```

## Configuration

Backend configuration is supplied via `backend/.env` (see `backend/.env.example`). Key variables include the database connection (`DB_*`), JWT settings (`JWT_*`), build concurrency (`BUILD_MAX_CONCURRENT`), and the source storage path (`PROJECTS_SOURCE_DIR`). Runtime build limits (timeouts, log retention, image cleanup) are stored in the database and editable through the in-app settings. The full reference is in the technical documentation.

## Documentation

- **Technical documentation** (architecture, API reference, installation, user manual): [`docs/technical-documentation.md`](docs/technical-documentation.md) (also provided as a compiled PDF)
- **API spec** (OpenAPI 3.x): [`docs/openapi.json`](docs/openapi.json)
- **Interactive API explorer** (Swagger UI, dev mode): `/docs` on a running instance

## Development

To run the backend outside Docker, start Postgres and Redis (e.g. via the Compose file), then:

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload     # API
arq app.worker.WorkerSettings     # worker (separate terminal)
```

The frontend runs with `npm install && npm run dev` in `frontend/`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup, coding conventions, and the pull-request workflow.

## License

Released under the MIT License. See [`LICENSE`](LICENSE) for details.

## Authors

A bachelor's thesis project (Caucasus University) by:

- **Davit Khachaturovi** — backend
- **Nika Parkosadze** — frontend
