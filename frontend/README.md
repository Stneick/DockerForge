# DockerForge Frontend

React + TypeScript frontend for the DockerForge image-foundry backend.
**Layout:** "Workbench" — an IDE-for-Dockerfiles (tab bar, projects-as-files
explorer, Monaco-centric center, slide-up live-log dock, inspector).
**Theme:** Cool Industrial (slate + cyan).

## Stack

- Vite · React 18 · TypeScript
- Tailwind (custom design system) · Radix primitives · Framer Motion · lucide-react
- TanStack Query (server state) · Zustand (auth + UI/tabs state)
- Monaco editor (Dockerfile editing, lint markers, diff)

## Develop

```bash
npm install
npm run dev      # http://localhost:3000  (must be :3000 — backend CORS origin)
```

The dev server proxies `/api` → `http://localhost:8000` (the FastAPI backend),
so the httponly auth cookies stay same-site. Start the backend separately:

```bash
# in the backend repo
uvicorn app.main:app --port 8000   # needs Postgres + Redis + Docker daemon
```

```bash
npm run build      # tsc -b && vite build
npm run typecheck  # types only
```

## Layout / structure

```
src/
  api/         HTTP wrapper (cookies + refresh-on-401), SSE reader,
               per-resource modules, TanStack Query hooks
  components/
    ui/        design system (Button, Card, Input, Badge, Dialog, Tabs,
               Select, Switch, Toast, Tooltip, Skeleton, …)
    workbench/ Shell, TabBar, Explorer + useWorkbenchTab
    CommandPalette.tsx   ⌘K palette
  pages/       auth/, Dashboard, ProjectDetail, BuildDetail, BuildCompare, …
  store/       auth (Zustand), tabs (open Workbench tabs)
  lib/         cn, format, password rules, language metadata, queryClient
  types/api.ts TypeScript mirror of the backend Pydantic schemas
mockups/       the 3 static layout studies (workbench chosen)
```

## Build status / roadmap

- [x] **Chunk 1 — Foundation:** scaffolding, theme, API client + types, auth
      (login/register), Workbench shell, ⌘K palette, routing, dashboard.
- [x] **Chunk 2 — Projects + source:** create project, drag-drop upload + GitHub
      clone, detection-as-recommendation cards (logo picker, accept/override), project
      surface with stage rail + builds list (compare-select) + settings.
- [x] **Chunk 3 — The Forge:** Monaco Dockerfile editor (theme, keyword autocomplete),
      debounced hadolint markers + problems panel, .dockerignore tab, diff against the
      generated baseline (split/inline), build trigger dialog. Monaco is code-split + local.
- [x] **Chunk 4 — Builds + live logs:** SSE log terminal (autoscroll, elapsed, fallback to
      static logs), build detail (status header, stat cards), layers bars, read-only
      Dockerfile, actions (download/cancel/retry/delete-image).
- [x] **Chunk 5 — Compare + push + stats + settings:** build comparison (deltas, dual
      layer bars, Monaco Dockerfile diff), push-to-registry dialog with SSE progress,
      project stats (success ring, cache effectiveness), settings (profile/password/app),
      error boundary.

All chunks build clean (`npm run build`). Verified against the live backend on :7000.
