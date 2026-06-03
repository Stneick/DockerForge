# 7. Recommendations and Future Work

This chapter records the engineering lessons that emerged while building DockerForge,
documents the language-detection heuristic developed during the project, states the
system's known limitations honestly, and lists the enhancements that would most
improve it.

## 7.1 Engineering Lessons Learned

### 7.1.1 Upstream error messages cannot be trusted — validate every parameter

The most costly debugging episode of the project came from a Docker build call that
consistently failed with `invalid reference format` for the image tag `go-test:latest`
— a tag that is unambiguously valid. Considerable effort went into the tag itself:
logging its exact bytes, checking for hidden/zero-width characters, normalising
encoding, and comparing against Docker's reference grammar. Everything confirmed the
tag was correct.

The actual cause was an unrelated parameter. The build was passing a `container_limits`
dictionary that included `nano_cpus`. `nano_cpus` is a valid option for *creating a
container* but **not** for the Docker SDK's image `build()` call; the API rejected the
request and returned a misleading message naming the tag rather than the offending
field. Removing `nano_cpus` from `container_limits` resolved it immediately, and CPU
limits for builds are simply handled differently from runtime container limits — which
is why the current `AppSettings.container_limits` deliberately exposes only `memory`
and `memswap`.

**Recommendation / lesson:** when a third-party API reports an error, treat the named
field as a hint, not a diagnosis. Validate *all* parameters of the failing call, not
just the one the message blames. A short, parameter-by-parameter elimination would
have found this in minutes; trusting the message cost days.

### 7.1.2 Reproducible builds require explicit version pinning

The backend originally declared dependencies without version constraints. This is
convenient early on but means two installs weeks apart can resolve to different
versions, and a transitively-provided package (here, `redis`, pulled in by `arq`) can
silently disappear or change. Pinning every direct dependency to a known-good version
— and promoting `redis` to a direct dependency because the code imports it directly —
makes the image reproducible and removes a class of "works on my machine" failures.

**Recommendation:** pin direct dependencies; depend explicitly on what you import
rather than relying on transitive provision; keep platform-specific transitive
packages out of the shared requirements file so the same file builds on every target
OS.

### 7.1.3 A single source of truth for configuration prevents drift

Language and framework knowledge is centralised in one `LANGUAGES` structure that
drives detection, template selection, the public `/languages` endpoint, and default
values at once. An earlier design scattered this information, which made adding a
framework a multi-file change prone to inconsistency. Consolidating it means a new
framework is a single, type-checked edit.

### 7.1.4 "Detect, suggest, confirm" is more robust than full automation

Heuristic detection is never perfect. Rather than silently acting on a guess,
DockerForge surfaces what it detected (with a confidence score and warnings) and lets
the user confirm or override before anything is built. This pattern turns occasional
detection errors from hard failures into a quick edit, and it scales gracefully to
projects the heuristics don't fully understand.

### 7.1.5 Choose the simplest transport that fits the problem

Real-time log delivery went through three designs — pub/sub, pub/sub plus a replay
buffer, and finally Redis Streams — before settling on the one primitive that handled
live tailing, history replay, and reconnection without a race condition. Likewise,
Server-Sent Events were chosen over WebSockets because logs are one-directional.
**Lesson:** match the mechanism to the actual communication shape; added capability
that goes unused is added complexity and added failure modes.

### 7.1.6 Mind the platform and the toolchain's real capabilities

Two issues reinforced this. First, `asyncio.create_subprocess_exec` raises
`NotImplementedError` under the default Windows event loop, so git clone was moved to
`subprocess.run` wrapped in a thread — simpler and portable, with no downside for a
one-shot command. Second, the Dockerfile templates were briefly upgraded to use
BuildKit cache mounts, then reverted: the docker-py SDK drives the **legacy** build
engine, which does not support BuildKit features, so the templates were kept
legacy-safe. **Lesson:** confirm that the layer actually executing your instructions
supports the features you write for it.

## 7.2 The Language-Detection Heuristic (Research Outcome)

DockerForge identifies a project's language with a lightweight scoring model rather
than a learned classifier, which keeps it fast, dependency-free, and fully
explainable.

**Scoring.** For each candidate language, the detector scans the project's root files
and the set of file extensions present:

- **+2** for each recognised dependency file found at the project root
  (`requirements.txt`, `package.json`, `go.mod`, `pom.xml`, `Cargo.toml`, …).
- **+1** for a matching source extension — applied to **C, C++, and Rust only**, where
  the dependency-file signal is weak or shared. (Python, Node, Go, and Java are scored
  on dependency files alone, since a stray `.py` or `.js` is a poor signal next to a
  manifest.)

**Confidence.** Let *s₁* be the highest score and *s₂* the runner-up. If only one
language scores, confidence is `1.0`. Otherwise:

```
confidence = s1 / (s1 + s2)
```

bounded between `0.5` (a tie — maximum ambiguity) and `1.0` (a single contender). The
winning language's framework is then inferred by a language-specific pass (for example,
inspecting `package.json` dependencies to distinguish NestJS, a Vite SPA, or Express).

**Design rationale.** Dependency files are weighted above extensions because a manifest
is a far stronger signal of intent than scattered source files — a JavaScript project
may contain a `setup.py` helper, but its `package.json` should still dominate. C-versus-C++
ambiguity is resolved by exclusion: a project scores as C only if it has C sources and
*no* C++ sources.

**Known limitation.** Because confidence is a ratio, it cannot distinguish a 3-to-1
score from a 6-to-2 score — both yield `0.75`. This is defensible (in both cases the
winner is three times stronger than the runner-up, and absolute magnitude adds little
certainty), but it does mean the score reflects *relative* dominance, not evidence
volume.

**Recommended improvements.** Add entry-point file presence (`main.py`, `index.js`,
`main.go`) as an additional weighted signal; read an existing `Procfile`/`Dockerfile`
for startup hints; and detect a Java main class from `pom.xml`/`build.gradle`.

## 7.3 Known Limitations

**Build isolation / security.** Building user-supplied source with `docker build` on a
shared host daemon is inherently sensitive. DockerForge mitigates this with build
timeouts, a memory limit, non-privileged builds, per-build temporary contexts,
symlink-escape and path-traversal checks, and managed-label cleanup of leaked images —
but it does not provide hard tenant isolation. A production-grade, multi-tenant
deployment should add a stronger sandbox: a gVisor runtime, rootless Docker, or
one-build-per-VM/microVM isolation.

**Concurrency.** The worker builds at most `BUILD_MAX_CONCURRENT` images at once
(default 2). This is appropriate for self-hosted team use but is not a horizontally
scaled build farm.

**Single-owner projects.** Each project belongs to exactly one user, and access is
masked as `404` for anyone else. This keeps the model simple but means a project
cannot currently be shared across a team (see the collaboration enhancement below).

**Detection coverage.** The 13 templates cover the most common frameworks but not
Next.js, Poetry-based Python, PHP, Ruby, or .NET. Makefile-based C/C++ projects cannot
have their binary name auto-detected (the user must specify it), and a TypeScript
project without a `start` script may receive an imperfect startup-command suggestion.

**Automated tests.** The project currently has no automated test suite; verification is
manual (via the Swagger UI and end-to-end builds). Adding tests is the single highest-
value robustness improvement (see below).

## 7.4 Recommended Future Enhancements

- **A test suite.** Unit tests for the detector and Dockerfile generator (pure,
  deterministic functions ideal for testing), plus integration tests for the build
  pipeline against a disposable Postgres/Redis, would protect against regressions and
  is the most worthwhile next investment.
- **Project collaboration (shared projects).** Allow multiple users to work on the same
  project rather than the current strictly single-owner model — shared membership with
  role-based permissions (for example owner / editor / viewer), so a team can manage a
  project's source, builds, and settings together. This would extend the ownership
  check from a single `user_id` to a project-membership relation and surface shared
  projects in each member's dashboard.
- **Stronger build sandboxing.** gVisor, rootless Docker, or per-build microVMs to move
  from "mitigated" to "isolated" execution of untrusted code.
- **Broader framework support.** Next.js (parsing `next.config.js` output mode), Poetry
  (`poetry install`), and templates for PHP, Ruby, and .NET.
- **Richer detection signals.** Entry-point scoring, `Procfile`/existing-`Dockerfile`
  hints, and Java main-class detection, as described in §7.2.
- **Build-cache analysis.** Surface suggestions (e.g. reordering `COPY`/`RUN` steps) to
  improve cache hit rates, building on the existing layer-comparison data.
- **Webhook notifications.** Notify external systems on build completion to support
  CI-style automation.
```
