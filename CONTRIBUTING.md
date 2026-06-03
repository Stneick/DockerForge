# Contributing to DockerForge

Thanks for your interest in contributing. This document covers the development
setup, coding conventions, and the workflow for submitting changes.

DockerForge is a bachelor's thesis project with a small team: the backend
(FastAPI + arq worker) and the frontend (React + TypeScript) are maintained
separately. Please keep changes scoped to the side you are working on.

## Prerequisites

- Docker Engine + Docker Compose plugin
- Python 3.12 (backend)
- Node.js 22 (frontend)
- Git

## Backend development setup

```bash
cd backend
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
```

Bring up Postgres and Redis (the easiest way is the Compose file), copy the
environment file, run migrations, then start the API and worker:

```bash
cp .env.example .env                # edit DB_*, REDIS_*, JWT_SECRET_KEY as needed
alembic upgrade head
uvicorn app.main:app --reload       # API on :8000
arq app.worker.WorkerSettings       # worker, in a separate terminal
```

Both the API and the worker need access to the Docker socket to run builds.

Install the pre-commit hooks once after cloning:

```bash
pre-commit install
```

## Frontend development setup

```bash
cd frontend
npm install
npm run dev                         # Vite dev server
```

Useful scripts: `npm run build`, `npm run typecheck`, `npm run lint`.

## Coding conventions

### Backend (Python)

The toolchain is enforced by pre-commit (see `.pre-commit-config.yaml`); run
`pre-commit run --all-files` before pushing. In short:

- **Formatting:** Black (line length 100), Python 3.12 target.
- **Linting:** Ruff with the `E, F, I, UP, B, SIM` rule sets (`E501` and `B008`
  are intentionally ignored — long lines and FastAPI `Depends()` defaults).
- **Type checking:** mypy with the SQLAlchemy and Pydantic plugins
  (`backend/mypy.ini`). Add type hints to all function signatures.
- **Async everywhere:** no synchronous database or I/O calls — use `async`/`await`,
  `AsyncSession`, and the SQLAlchemy 2.0 `select()` style (never the legacy
  `Query` API).
- **Naming:** `snake_case` for files, functions, and directories; singular
  SQLAlchemy model names (`User`, `Project`, `Build`).
- **Pydantic:** schemas returned from ORM objects use
  `model_config = ConfigDict(from_attributes=True)`.
- Prefer `pathlib.Path` over `os.path`, and f-strings over `.format()`/`%`.

### Dockerfile templates

Generated Dockerfiles and the templates in `app/templates/` are linted with
hadolint (`.hadolint.yaml`, failure threshold: `warning`). A few version-pinning
rules are intentionally disabled — see the comments in that file before
re-enabling them.

### Frontend (TypeScript)

- TypeScript strict mode; resolve all `tsc` errors (`npm run typecheck`).
- ESLint must pass (`npm run lint`).

## Database migrations

Schema changes go through Alembic — never edit the database by hand.

```bash
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```

Use descriptive migration messages, and test both `upgrade` and `downgrade`.

## Testing

There is currently no automated test suite. Until one exists, verify backend
changes manually against a running instance — the Swagger UI at `/docs`
(available in dev mode) is the quickest way to exercise endpoints. Confirm that
a representative build still succeeds end to end before opening a pull request.

## Commit and pull-request workflow

1. Create a branch off the main development branch:
   `git checkout -b feature/short-description`.
2. Make focused commits with clear, imperative messages
   (e.g. `add layer comparison endpoint`).
3. Ensure `pre-commit run --all-files` passes (backend) or `npm run lint &&
   npm run typecheck` passes (frontend).
4. Open a pull request describing **what** changed and **why**, and link any
   related issue.
5. Keep pull requests scoped to a single concern; split unrelated changes.

## Reporting issues

When filing an issue, include reproduction steps, the expected vs. actual
behavior, and relevant logs (API/worker output, or the in-app build logs).
