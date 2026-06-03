# 6. User Manual

This manual describes how to use DockerForge through its web interface. It assumes
the application is already installed and running (see Chapter 5) and is reachable at
your deployment URL — `https://<your-domain>` in production, or `http://localhost`
for a local install.

> **About the screenshots.** Image placeholders below reference `images/NN-*.png`.
> Replace each with a screenshot of the corresponding screen. Suggested captures are
> noted in italics beneath each placeholder.

## 6.1 Creating an Account and Signing In

DockerForge is multi-user; each person has their own account and only sees their own
projects and builds.

1. Open the application URL. You will land on the sign-in screen.
2. To create an account, choose **Create account** and provide an email, a username,
   and a password.
   - Username: 3–30 characters, letters/numbers/underscore/hyphen, not starting or
     ending with `_`/`-`.
   - Password: 8–128 characters, including at least one lowercase letter, one
     uppercase letter, one digit, and one special character.
3. After creating your account (or signing in) you are taken straight to your
   dashboard. Your session is kept in secure cookies, so you stay signed in until you
   sign out or the session expires.

![Sign-in and registration](images/01-login.png)
*Figure 6.1 — The sign-in / registration screen.*

To sign out, use the account menu and choose **Sign out**.

## 6.2 The Dashboard

The dashboard lists your projects, most recently updated first. Each entry shows the
project name, its detected language/framework (once source has been analysed), and
its most recent build activity. From here you can open a project, create a new one,
or page through the list.

![Projects dashboard](images/02-dashboard.png)
*Figure 6.2 — The projects dashboard with the list of projects.*

## 6.3 Creating a Project

1. Click **New Project**.
2. Enter a **name** (1–100 characters) and an optional **description**.
3. Confirm to create the project. It opens with no source yet — your next step is to
   provide the source code.

![Create project dialog](images/03-create-project.png)
*Figure 6.3 — Creating a new project.*

## 6.4 Providing Source Code

A project needs source code before it can be analysed or built. There are two ways to
provide it.

**Option A — Upload an archive.** Drag a `.zip` or `.tar` archive of your project onto
the upload area, or browse for it. The archive is extracted on the server and analysed
automatically. (Uploads are size-limited; see your administrator's settings.)

**Option B — Clone a Git repository.** Enter an `https://github.com/...` repository URL
and a branch (defaults to `main`). For a private repository, also provide a personal
access token; it is used only for the clone and is never stored in the project.

![Providing source: upload or clone](images/04-source.png)
*Figure 6.4 — Uploading an archive or cloning a Git repository.*

As soon as the source is in place, DockerForge analyses it and shows the detection
result.

## 6.5 Reviewing Detection and Configuring the Project

After analysis, DockerForge proposes a configuration: the detected **language** and
**framework**, a **confidence** score, the **dependency file** it found, a suggested
**startup command**, **entry point**, **port**, and (where relevant) a base image,
binary name, or build output directory. A warning is shown if more than one language
was detected.

Review these values and adjust anything that isn't right — detection is a helpful
starting point, not the final word. You can edit the language, framework, startup
command, entry point, exposed port, base image, and environment variables. If you
change the source later, use **Detect** to re-run analysis.

![Detection results and project settings](images/05-detection.png)
*Figure 6.5 — Detection results with editable project settings.*

## 6.6 Previewing and Editing the Dockerfile

Before building, you can see exactly what will be built.

1. Open **Dockerfile Preview**. DockerForge generates an optimized, multi-stage,
   non-root Dockerfile from your project's settings, alongside a matching
   `.dockerignore`.
2. The Dockerfile opens in an editor. You may edit it freely; your edited version is
   what gets built.
3. As you edit, the Dockerfile is **linted with hadolint** — issues appear inline with
   their rule code (e.g. `DL3008`), severity, and line number, so you can clean them
   up before building.

![Dockerfile preview and editor with lint markers](images/06-dockerfile.png)
*Figure 6.6 — The Dockerfile preview/editor with inline lint feedback.*

## 6.7 Running a Build and Watching Live Logs

1. From the project, start a build. You can optionally set an **image tag**, toggle
   **no-cache**, and supply build arguments or environment variables.
2. The build is queued and runs on the server. The build view streams **live logs** as
   each step executes, with standard output and errors distinguished.
3. You can leave and return to the build view; the log feed reconnects and replays the
   output. If you no longer need the build, use **Cancel** to stop it.

![Live build logs](images/07-build-logs.png)
*Figure 6.7 — Streaming build logs in real time.*

## 6.8 Build Results: Image, Layers, Download, and Push

When a build succeeds, the build detail view shows the resulting **image tag**, its
total **size**, and a per-**layer** breakdown (instruction and size). From here you can:

- **Download** the image as a `.tar` archive (load it elsewhere with `docker load`).
- **Push** the image to a container registry — provide the target repository, tag, and
  registry credentials. Push progress streams live, like build logs.

Built images are removed automatically after a configurable time-to-live, so download
or push them while they are still available. You can also delete an image manually.

![Successful build with layer breakdown](images/08-build-result.png)
*Figure 6.8 — A successful build showing image size and layers.*

## 6.9 Managing Builds: History, Retry, and Comparison

Each project keeps a full **build history** with status, trigger type, duration, and
timestamps. From the history you can:

- **Retry** a build — re-runs it with the same Dockerfile and configuration.
- **Compare** two builds — DockerForge produces a layer-by-layer diff, marking each
  layer as unchanged, changed, added, or removed, along with the overall image-size and
  duration differences. This is useful for seeing what made an image grow or shrink.
  Because it compares the resulting images, both builds must have succeeded.
- **Compare configurations** of two builds — a separate diff of the build *inputs*
  (Dockerfile, `.dockerignore`, and configuration snapshot) that works for builds in any
  status. This is useful for answering "what changed between the build that failed and
  the one that worked?"

![Side-by-side build comparison](images/09-history-compare.png)
*Figure 6.9 — A side-by-side build comparison.*

## 6.10 Project Statistics

The project statistics view aggregates your build activity: total and successful
builds, success rate, average/fastest/slowest durations, average and total image
sizes, and a cached-versus-no-cache comparison that shows the effect of Docker layer
caching on build time.

![Project statistics](images/10-stats.png)
*Figure 6.10 — Aggregated project build statistics.*

## 6.11 Account and Application Settings

From the **account** menu you can update your username or email and change your
password (changing the password requires your current one).

Administrators can adjust **application settings** at runtime — build timeout, build
memory limit, image time-to-live and cleanup, maximum upload size, git-clone timeout,
log-stream retention, and the hadolint timeout — without restarting the server.

![Settings](images/11-settings.png)
*Figure 6.11 — Runtime application settings.*

## 6.12 Worked Examples

### Example A — Dockerizing a FastAPI service from GitHub

1. Create a project named `orders-api`.
2. Clone `https://github.com/your-org/orders-api` on branch `main`.
3. DockerForge detects **Python / FastAPI**, finds `requirements.txt`, and suggests
   `uvicorn app.main:app --host 0.0.0.0 --port 8000` on port 8000.
4. Open the Dockerfile preview — a multi-stage, non-root image using
   `python:3.12-slim`. Resolve any lint warnings.
5. Build with the tag `orders-api:latest`, watch the logs, and on success review the
   image size and layers.
6. Push to your registry, or download the `.tar`.

### Example B — A React (Vite) SPA from an uploaded archive

1. Create a project named `web-dashboard` and upload its `.zip`.
2. DockerForge detects **Node / Vite SPA** and notes that the build produces static
   files served by Nginx.
3. If the app reads build-time environment variables, add them in the project settings
   — for a Vite SPA they are baked in during `npm run build`.
4. Preview the multi-stage Dockerfile (build with Node, serve with Nginx), then build
   and download or push the result.

### Example C — Measuring the impact of layer caching

1. For an existing project, run a build with **no-cache** enabled, then run a normal
   (cached) build.
2. Open **Project Statistics** to see the cached-versus-no-cache duration comparison.
3. Use **Compare** on the two builds to see, layer by layer, where the time and image
   size differences come from.
