# 4. API and Interface Documentation

## 4.1 Conventions

The DockerForge backend exposes a versioned REST API. All endpoints are mounted
under a single prefix and served behind the Nginx/Caddy edge.

- **Base path:** `/api/v1`. Behind the reverse proxy the public base URL is
  `https://<domain>/api/v1`; in local development it is `http://localhost/api/v1`.
- **API version:** `0.8` (reported by `GET /`).
- **Content type:** `application/json` for request and response bodies, except
  source upload (`multipart/form-data`), image download (`application/x-tar`), and
  the log-streaming endpoints (`text/event-stream`).
- **Authentication:** session cookies, not bearer headers. After `register`/`login`
  the server sets two `httponly` cookies — `access_token` and `refresh_token`.
  Browsers send them automatically; programmatic clients must use a cookie jar and
  send credentials with each request (e.g. `fetch(..., {credentials: "include"})` or
  `curl -b/-c`). Because the API sets `Access-Control-Allow-Credentials: true`, the
  allowed CORS origins are an explicit list (`CORS_ORIGINS`), not `*`.
- **Validation:** request bodies are validated by Pydantic v2; invalid input returns
  `422` (see §4.3).
- **Pagination:** list endpoints accept `page` (≥1) and `per_page` (1–100) and return
  an envelope: `{ "items": [...], "pagination": { page, per_page, total_items, total_pages } }`.
- **Interactive docs:** when `ENVIRONMENT=dev`, Swagger UI is served at `/docs` and
  ReDoc at `/redoc`. Both are disabled in production. The machine-readable OpenAPI
  3.x document is available at `/openapi.json` (dev) and is also committed to the
  repository at [`docs/openapi.json`](openapi.json).

## 4.2 Authentication and Sessions

Authentication uses short-lived JWT access tokens (15 minutes) and longer-lived
refresh tokens (7 days), both delivered as `httponly` cookies. Tokens never appear
in a response body. The `access_token` cookie is scoped to `/`; the `refresh_token`
cookie is scoped to `/api/v1/auth`, so it is only transmitted to the auth endpoints.

Registration enforces input policies:

- **Username:** 3–30 characters, letters/numbers/underscore/hyphen only, and may not
  start or end with `_` or `-`.
- **Password:** 8–128 characters, with at least one lowercase letter, one uppercase
  letter, one digit, and one special character.

When an access token expires, the client calls `POST /auth/refresh`; the server
validates the refresh token, **revokes it, and issues a new pair** (rotation). The
same password policy applies to `POST /users/me/password`, which additionally
requires the current password.

## 4.3 Error Handling and Status Codes

### Error response shapes

Most errors are raised as standard exceptions and serialize to:

```json
{ "detail": "Human-readable message" }
```

Validation failures (`422`) use FastAPI's structured form:

```json
{ "detail": [ { "loc": ["body", "password"], "msg": "...", "type": "value_error" } ] }
```

Two responses use distinct shapes. When the Docker daemon is unreachable, the API
returns `503` with:

```json
{ "error": "Service Unavailable", "message": "...", "resolution": "Ensure Docker ... is running ..." }
```

An unhandled server error returns `500` with `{ "detail": "Internal server error" }`.

### Status codes

| Code | Meaning in DockerForge |
|---|---|
| 200 OK | Successful read, update, logout, download, settings change |
| 201 Created | Registration, project creation, build trigger, build retry |
| 202 Accepted | Asynchronous action queued (push, cancel) |
| 400 Bad Request | Missing language/framework for preview/lint; build not successful for download; build has no image tag |
| 401 Unauthorized | Invalid/expired access token, wrong token type, user no longer exists, or missing refresh token on refresh/logout |
| 403 Forbidden | No `access_token` cookie present on a protected endpoint |
| 404 Not Found | Resource absent **or** owned by another user (ownership is masked as 404); expired/absent live log stream |
| 409 Conflict | Action invalid for current state — building with no source, retry/cancel on a finished or running build, reading logs while a build is still in progress, comparing builds that were not both successful |
| 410 Gone | The build image has already been cleaned up (download/push/delete) |
| 422 Unprocessable Entity | Request body failed validation |
| 500 Internal Server Error | Unhandled error; settings row missing |
| 503 Service Unavailable | Docker daemon unavailable, or the build/push queue (Redis) is unreachable |

## 4.4 Endpoint Reference

All paths below are relative to the `/api/v1` base. Unless noted, endpoints require
authentication (a valid `access_token` cookie).

### System

**`GET /`** *(unauthenticated, not under `/api/v1`)* — liveness probe. Returns
`{ name, version, status, timestamp }`.

### Auth — `/auth`

**`POST /auth/register`** — create an account. Body: `{ email, username, password }`.
→ `201` `AuthUserResponse` `{ user, token_type, expires_in }`; sets auth cookies.
Errors: `422` (policy violations), `409`/`400` (email or username already taken).

**`POST /auth/login`** — Body: `{ email, password }`. → `200` `AuthUserResponse`; sets
auth cookies. Errors: `401` (bad credentials).

**`POST /auth/refresh`** — uses the `refresh_token` cookie. → `200`
`{ "message": "Tokens refreshed" }`; sets a new cookie pair. Errors: `401` (missing
or invalid refresh token).

**`POST /auth/logout`** — uses the `refresh_token` cookie. → `200`
`{ "message": "Successfully logged out" }`; clears cookies and revokes the token.

### Users — `/users`

**`GET /users/me`** — → `200` `UserProfile`
`{ id, email, username, total_projects, total_builds, created_at, updated_at }`.

**`PATCH /users/me`** — Body (any subset): `{ username?, email? }`. → `200`
`UserProfile`.

**`POST /users/me/password`** — Body: `{ current_password, new_password }`. → `200`.
Errors: `401` (wrong current password), `422` (policy).

### Projects — `/projects`

**`POST /projects`** — Body: `{ name, description? }` (name 1–100, description ≤500).
→ `201` `Project`.

**`GET /projects`** — Query: `page`, `per_page`, `sort_by` (`created_at` |
`updated_at` | `name`), `order` (`asc` | `desc`). → `200` `ProjectListResponse`.

**`GET /projects/{project_id}`** — → `200` `Project`. Errors: `404`.

**`PATCH /projects/{project_id}`** — Body (any subset of project fields, e.g.
`language`, `framework`, `startup_command`, `base_image`, `env_vars`, `port`). →
`200` `Project`.

**`DELETE /projects/{project_id}`** — → `200` `{ "message": ... }`. Cascades to the
project's builds.

### Source ingestion — `/projects/{project_id}/...`

**`POST /projects/{project_id}/upload`** — `multipart/form-data` with a `file` field
(a `.zip`/`.tar` archive). Enforces the configured max upload size. → `200`
`SourceAnalysisResponse`. Errors: `413`/`400` (too large), `400` (bad archive).

**`POST /projects/{project_id}/clone`** — Body: `{ repo_url, branch?, access_token? }`.
`repo_url` must be an `https://github.com/...` URL; `branch` defaults to `main` and is
charset-validated; `access_token` (optional) is used for private repositories via a
git header (never embedded in the URL). → `200` `SourceAnalysisResponse`. Errors:
`422` (invalid URL/branch), `400` (clone failed), `408` (clone timeout).

**`POST /projects/{project_id}/detect`** — re-run language/framework detection against
the already-present source. → `200` `SourceAnalysisResponse`. Errors: `409` (no
source).

`SourceAnalysisResponse` contains the detection result:
`{ detected_language, detected_framework, confidence, detected_dependency_file, suggested_startup_command, detected_entry_point, detected_binary_name, detected_build_output_dir, detected_build_package, detected_base_image, detected_port, detected_files, has_existing_dockerfile, note, warnings }`.

### Dockerfile — `/projects/{project_id}/dockerfile/...`

**`POST /projects/{project_id}/dockerfile/preview`** — generate the Dockerfile and
`.dockerignore` from the project's current settings, with optional inline overrides.
Body (optional `DockerfileOverrides`): `{ base_image?, language?, framework?, dependency_file?, startup_command?, entry_point?, binary_name?, build_output_dir?, build_package?, port?, env_vars? }`.
→ `200` `{ dockerfile_content, dockerignore_content, base_image, warnings }`. Errors:
`400` (language/framework not set, or unsupported framework).

**`POST /projects/{project_id}/dockerfile/lint`** — lint a Dockerfile with hadolint.
Body (optional): `{ dockerfile? }`. If omitted, the project's Dockerfile is generated
first and linted. → `200` `{ issues: [ { code, message, level, line, column } ] }`
where `level` is `error` | `warning` | `info` | `style`. Errors: `503` (hadolint not
installed), `408` (hadolint timeout), `400` (language/framework not set).

### Builds — `/projects/{project_id}/builds`

**`POST .../builds`** — trigger a build. Body (all optional):
`{ custom_dockerfile?, custom_dockerignore?, image_tag?, env_vars?, build_args?, no_cache? }`.
`image_tag` is validated against Docker reference rules (lowercase repository,
≤255 chars). → `201` `Build`. Errors: `409` (no source), `503` (queue unavailable).

**`GET .../builds`** — Query: `page`, `per_page`, `status?`
(`pending`|`building`|`success`|`failed`|`cancelled`). → `200` `BuildListResponse`.

**`GET .../builds/compare`** — Query: `build_a_id`, `build_b_id` (both UUIDs). →
`200` `BuildComparisonResponse`
`{ build_a, build_b, size_diff_bytes, size_diff_human, duration_diff_seconds, layer_comparison: [ { instruction, size_a, size_b, diff_bytes, status } ] }`
where `status` is `unchanged` | `changed` | `added` | `removed`. This compares image
artifacts (size, layers), so both builds must have succeeded. Errors: `409` (a build
was not successful). *(This route is registered before `/{build_id}` so `compare` is
not captured as a build id.)*

**`GET .../builds/compare/config`** — Query: `build_a_id`, `build_b_id` (both UUIDs). →
`200` `BuildConfigComparisonResponse`
`{ build_a, build_b, dockerfile_changed, dockerfile_diff, dockerignore_changed, dockerignore_diff, config_changes: [ { key, value_a, value_b } ] }`
where `*_diff` are unified-diff strings (empty when unchanged) and `config_changes`
lists the differing keys of the build's `build_config` snapshot. Unlike `/compare`,
this diffs only build *inputs* (Dockerfile, `.dockerignore`, config) so it works for
builds in **any** status — e.g. comparing a failed build to the successful one that
followed it. *(Two-segment path, so it is not captured by `/{build_id}`.)*

**`GET .../builds/{build_id}`** — → `200` `BuildDetail` (adds `image_size_bytes`,
`image_size_human`, `layers[]`, and `build_config` to the base `Build`).

**`GET .../builds/{build_id}/logs`** — persisted logs for a finished build. → `200`
`{ build_id, status, logs: [ { line, message, stream, timestamp } ] }`. Errors: `409`
(build still in progress — use `/events` instead).

**`GET .../builds/{build_id}/events`** — live log stream (SSE). See §4.5.

**`GET .../builds/{build_id}/download`** — stream the built image as a `.tar`
(`Content-Disposition: attachment`). Errors: `400` (not successful), `410` (image
cleaned), `404` (image missing from Docker).

**`POST .../builds/{build_id}/push`** — push the image to a registry. Body:
`{ target_tag, repository, username, password }`. → `202` `{ "message": "Push started" }`.
Errors: `400` (not successful / no tag), `410` (image cleaned), `503` (queue
unavailable). Progress is streamed via the push events endpoint.

**`GET .../builds/{build_id}/push/events`** — live push-progress stream (SSE). See §4.5.

**`POST .../builds/{build_id}/retry`** — re-queue a build reusing the original
Dockerfile and config. → `201` `Build`. Errors: `404`, `409` (original still running),
`409` (no source).

**`POST .../builds/{build_id}/cancel`** — request cancellation of a pending/running
build. → `202` `{ "message": ... }`. Errors: `409` (build not in progress).

**`DELETE .../builds/{build_id}/image`** — remove the built image now (before its TTL).
→ `200` `{ "message": "Build image deleted" }`. Errors: `409` (build not successful),
`410` (already cleaned), `400` (no image tag).

### Languages — `/languages`

**`GET /languages`** *(no auth)* — the supported language/framework catalogue that
also drives detection and template selection. → `200`
`{ languages: [ { name, display_name, default_base_image, supports_multi_stage, frameworks: [ { name, display_name, default_entry_point, default_startup_command, default_port, note } ] } ] }`.

### Settings — `/settings`

**`GET /settings`** — current runtime configuration plus the read-only,
environment-derived process settings. → `200` `AppSettings`
`{ build_timeout_seconds, build_memory_limit, image_cleanup_enabled, image_ttl_seconds, max_upload_size_mb, git_clone_timeout_seconds, build_log_stream_ttl_seconds, build_log_stream_max_entries, hadolint_timeout_seconds, updated_at, build_max_concurrent, arq_job_timeout_seconds, project_source_dir }`.

**`PATCH /settings`** — update any subset of the mutable fields. Validated bounds:
`build_timeout_seconds` 30–7200, `image_ttl_seconds` 60–86400, `max_upload_size_mb`
1–2048, `git_clone_timeout_seconds` 10–3600, `build_log_stream_ttl_seconds` 60–86400,
`build_log_stream_max_entries` 100–100000, `hadolint_timeout_seconds` 5–300, and
`build_memory_limit` matching `^\d+(k|m|g)$` (e.g. `512m`, `1g`). The
environment-derived fields (`build_max_concurrent`, `arq_job_timeout_seconds`,
`project_source_dir`) are read-only and ignored if supplied. → `200` `AppSettings`.

## 4.5 Real-Time Interfaces (Server-Sent Events)

Two endpoints stream events as `text/event-stream`. Each event is a single line:

```
data: {"status":"building","log":{"line":12,"message":"Step 3/9 : RUN ...","stream":"stdout","timestamp":"..."}}

```

For **build logs** (`/builds/{id}/events`), the payload is a `StreamEvent`:
`{ status, log: { line, message, stream, timestamp } }`. The stream replays the full
history (the server reads the Redis Stream from id `0`) and then tails live entries.
It closes when a terminal event arrives (`status` of `success`, `failed`, or
`cancelled`). If the build has already finished **and** its stream has expired, the
endpoint returns `404`; clients should then fall back to `GET .../logs`.

For **push progress** (`/builds/{id}/push/events`), the payload mirrors Docker's push
status objects, terminating on a final status or error event.

Clients consume these with the browser `EventSource` API (which reconnects
automatically) or any SSE-capable HTTP client.

## 4.6 Usage Examples

The examples use `curl` with a cookie jar (`cookies.txt`) to persist the session.

**Register and authenticate**

```bash
BASE=http://localhost/api/v1

# Register (also logs in by setting cookies)
curl -c cookies.txt -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","username":"dev","password":"Sup3r$ecret"}'

# Or log in on an existing account
curl -c cookies.txt -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@example.com","password":"Sup3r$ecret"}'
```

**Create a project and provide source**

```bash
# Create the project
PID=$(curl -b cookies.txt -X POST "$BASE/projects" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-api","description":"demo"}' | jq -r .id)

# Option A: upload an archive
curl -b cookies.txt -X POST "$BASE/projects/$PID/upload" \
  -F "file=@./my-api.zip"

# Option B: clone a public GitHub repo
curl -b cookies.txt -X POST "$BASE/projects/$PID/clone" \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/owner/my-api","branch":"main"}'
```

**Preview the Dockerfile, then build**

```bash
# Preview (optionally override fields)
curl -b cookies.txt -X POST "$BASE/projects/$PID/dockerfile/preview" \
  -H "Content-Type: application/json" -d '{}'

# Trigger a build
BID=$(curl -b cookies.txt -X POST "$BASE/projects/$PID/builds" \
  -H "Content-Type: application/json" \
  -d '{"image_tag":"my-api:latest","no_cache":false}' | jq -r .id)

# Stream live build logs
curl -b cookies.txt -N "$BASE/projects/$PID/builds/$BID/events"
```

**Download or push the image**

```bash
# Download the built image as a tar archive
curl -b cookies.txt -OJ "$BASE/projects/$PID/builds/$BID/download"

# Push to a registry (progress on the push/events stream)
curl -b cookies.txt -X POST "$BASE/projects/$PID/builds/$BID/push" \
  -H "Content-Type: application/json" \
  -d '{"repository":"myuser/my-api","target_tag":"latest","username":"myuser","password":"<token>"}'
```

**Compare two builds (image artifacts — both must have succeeded)**

```bash
curl -b cookies.txt \
  "$BASE/projects/$PID/builds/compare?build_a_id=$BID_A&build_b_id=$BID_B"
```

**Compare two builds' inputs (Dockerfile + config — any status)**

```bash
curl -b cookies.txt \
  "$BASE/projects/$PID/builds/compare/config?build_a_id=$BID_A&build_b_id=$BID_B"
```

## 4.7 OpenAPI Specification

The API is described by an OpenAPI 3.x document generated directly from the FastAPI
application, so it always matches the implemented routes and schemas. The committed
copy lives at [`docs/openapi.json`](openapi.json); on a development instance the same
document is served live at `/openapi.json`, with interactive exploration at `/docs`
(Swagger UI) and `/redoc`.
