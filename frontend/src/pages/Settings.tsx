import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check, X, User, KeyRound, Palette, Type, Server, Info, Save, Minus, Plus,
} from "lucide-react";

import { useChangePassword, useSettings, useUpdateProfile, useUpdateSettings } from "@/api/hooks";
import { ApiError } from "@/api/http";
import { useAuthStore } from "@/store/auth";
import { usePrefs } from "@/store/prefs";
import { useDaemonHealth } from "@/hooks/useDaemonHealth";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/cn";
import { isPasswordValid, PASSWORD_RULES } from "@/lib/password";
import { useWorkbenchTab } from "@/components/workbench/useWorkbenchTab";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import type { AppSettings, UpdateAppSettingsRequest } from "@/types/api";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User, group: "Account" },
  { id: "account", label: "Password", icon: KeyRound, group: "Account" },
  { id: "appearance", label: "Appearance", icon: Palette, group: "Workbench" },
  { id: "editor", label: "Editor", icon: Type, group: "Workbench" },
  { id: "application", label: "Application", icon: Server, group: "System" },
  { id: "about", label: "About", icon: Info, group: "System" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export function SettingsPage() {
  useWorkbenchTab({ kind: "settings", title: "Settings", pinned: true, id: "/settings" });
  const [params, setParams] = useSearchParams();
  const active = (params.get("section") as SectionId) ?? "profile";
  const setActive = (id: SectionId) => setParams((p) => { p.set("section", id); return p; });

  const groups = Array.from(new Set(SECTIONS.map((s) => s.group)));

  return (
    <div className="flex h-full">
      {/* left settings nav */}
      <div className="w-56 shrink-0 overflow-y-auto border-r border-line bg-chrome p-2">
        <div className="px-2 py-2 text-sm font-bold">Settings</div>
        {groups.map((g) => (
          <div key={g} className="mb-2">
            <div className="px-2 py-1 label-mono">{g}</div>
            {SECTIONS.filter((s) => s.group === g).map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                    active === s.id ? "bg-cyan/10 text-cyan" : "text-muted hover:bg-surface2 hover:text-text",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-8">
          {active === "profile" && <ProfileSection />}
          {active === "account" && <PasswordSection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "editor" && <EditorSection />}
          {active === "application" && <ApplicationSection />}
          {active === "about" && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

function SectionHead({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{desc}</p>
    </div>
  );
}

function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const update = useUpdateProfile();
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const dirty = username !== user?.username || email !== user?.email;

  const save = () =>
    update.mutate({ username, email }, {
      onSuccess: (u) => { setUser(u); toast.success("Profile updated"); },
      onError: (e) => toast.error("Update failed", e instanceof ApiError ? e.message : undefined),
    });

  return (
    <div>
      <SectionHead title="Profile" desc="Your account identity." />
      <div className="space-y-4">
        <div>
          <Label>Username</Label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex items-center gap-4 pt-1 text-2xs text-dim">
          <span>{user?.total_projects ?? 0} projects</span>
          <span>{user?.total_builds ?? 0} builds</span>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} loading={update.isPending} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function PasswordSection() {
  const change = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const valid = isPasswordValid(next) && current.length > 0;

  const save = () =>
    change.mutate({ current_password: current, new_password: next }, {
      onSuccess: () => { toast.success("Password changed"); setCurrent(""); setNext(""); },
      onError: (e) => toast.error("Change failed", e instanceof ApiError ? e.message : undefined),
    });

  return (
    <div>
      <SectionHead title="Password" desc="Change your password." />
      <div className="space-y-4">
        <div>
          <Label>Current password</Label>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <Label>New password</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </div>
        {next.length > 0 && (
          <ul className="grid grid-cols-2 gap-1.5">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(next);
              return (
                <li key={rule.id} className={cn("flex items-center gap-1.5 text-2xs", ok ? "text-ok" : "text-dim")}>
                  {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-40" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-end">
          <Button variant="primary" onClick={save} loading={change.isPending} disabled={!valid}>
            <Save className="h-4 w-4" /> Update password
          </Button>
        </div>
      </div>
    </div>
  );
}

function AppearanceSection() {
  const themeId = usePrefs((s) => s.themeId);
  const setTheme = usePrefs((s) => s.setTheme);
  return (
    <div>
      <SectionHead title="Appearance" desc="Pick a color theme — it restyles the entire workbench, editor, and terminal." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {THEMES.map((th) => {
          const active = th.id === themeId;
          return (
            <button
              key={th.id}
              onClick={() => setTheme(th.id)}
              className={cn(
                "overflow-hidden rounded-xl border text-left transition-all",
                active ? "border-cyan shadow-glow-sm" : "border-line2 hover:border-cyan-dim",
              )}
            >
              {/* faux window preview */}
              <div className="relative h-20" style={{ background: rgb(th.tokens.bg) }}>
                <div className="absolute left-2 right-2 top-2 flex h-3 items-center gap-1 rounded" style={{ background: rgb(th.tokens.chrome) }}>
                  <span className="ml-1 h-1.5 w-1.5 rounded-full" style={{ background: rgb(th.tokens.cyan) }} />
                </div>
                <div className="absolute bottom-2 left-2 right-8 top-7 rounded" style={{ background: rgb(th.tokens.surface) }} />
                <div className="absolute bottom-2 right-2 top-7 w-5 rounded" style={{ background: rgb(th.tokens.editor) }} />
              </div>
              <div className="flex items-center justify-between border-t border-line px-3 py-2" style={active ? { background: "rgb(var(--cyan)/0.08)" } : undefined}>
                <span className={cn("text-xs font-semibold", active && "text-cyan")}>{th.name}</span>
                {active && <Check className="h-3.5 w-3.5 text-cyan" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FONT_OPTIONS = [
  { value: "'JetBrains Mono', ui-monospace, monospace", label: "JetBrains Mono" },
  { value: "'Fira Code', ui-monospace, monospace", label: "Fira Code" },
  { value: "'Cascadia Code', ui-monospace, monospace", label: "Cascadia Code" },
  { value: "Consolas, ui-monospace, monospace", label: "Consolas" },
  { value: "ui-monospace, SFMono-Regular, monospace", label: "System Mono" },
];

function EditorSection() {
  const editor = usePrefs((s) => s.editor);
  const setEditor = usePrefs((s) => s.setEditor);

  return (
    <div>
      <SectionHead title="Editor" desc="How the Dockerfile editor and diffs render. Changes apply live." />
      <div className="space-y-5">
        <Row label="Font size" hint="12–20 px">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="secondary" onClick={() => setEditor({ fontSize: Math.max(12, editor.fontSize - 1) })}>
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center font-mono text-sm">{editor.fontSize}</span>
            <Button size="icon" variant="secondary" onClick={() => setEditor({ fontSize: Math.min(20, editor.fontSize + 1) })}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Row>

        <Row label="Font family">
          <Select
            value={editor.fontFamily}
            onValueChange={(v) => setEditor({ fontFamily: v })}
            options={FONT_OPTIONS}
            className="w-56"
          />
        </Row>

        <Row label="Word wrap" hint="wrap long lines">
          <Switch checked={editor.wordWrap} onCheckedChange={(v) => setEditor({ wordWrap: v })} />
        </Row>

        <Row label="Minimap" hint="code overview on the right">
          <Switch checked={editor.minimap} onCheckedChange={(v) => setEditor({ minimap: v })} />
        </Row>

        {/* live preview */}
        <div>
          <Label>Preview</Label>
          <pre
            className="overflow-x-auto rounded-lg border border-line bg-editor p-3 leading-relaxed"
            style={{ fontFamily: editor.fontFamily, fontSize: editor.fontSize, whiteSpace: editor.wordWrap ? "pre-wrap" : "pre" }}
          >
<span style={{ color: "rgb(var(--cyan))", fontWeight: 700 }}>FROM</span> <span style={{ color: "rgb(var(--termfg))" }}>python:3.12-slim</span>{"\n"}
<span style={{ color: "rgb(var(--cyan))", fontWeight: 700 }}>RUN</span> <span style={{ color: "rgb(var(--termfg))" }}>pip install -r requirements.txt</span>{"\n"}
<span style={{ color: "rgb(var(--cyan))", fontWeight: 700 }}>CMD</span> <span style={{ color: "#a5e887" }}>["uvicorn","main:app"]</span>
          </pre>
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-2xs text-dim">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

const NUMERIC_FIELDS: { key: keyof UpdateAppSettingsRequest; label: string }[] = [
  { key: "build_timeout_seconds", label: "Build timeout (s)" },
  { key: "image_ttl_seconds", label: "Image TTL (s)" },
  { key: "max_upload_size_mb", label: "Max upload (MB)" },
  { key: "git_clone_timeout_seconds", label: "Clone timeout (s)" },
  { key: "build_log_stream_ttl_seconds", label: "Log stream TTL (s)" },
  { key: "hadolint_timeout_seconds", label: "hadolint timeout (s)" },
];

function ApplicationSection() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const current = draft ?? settings ?? null;

  const save = () => {
    if (!current) return;
    update.mutate(
      {
        build_timeout_seconds: current.build_timeout_seconds,
        build_memory_limit: current.build_memory_limit,
        image_cleanup_enabled: current.image_cleanup_enabled,
        image_ttl_seconds: current.image_ttl_seconds,
        max_upload_size_mb: current.max_upload_size_mb,
        git_clone_timeout_seconds: current.git_clone_timeout_seconds,
        build_log_stream_ttl_seconds: current.build_log_stream_ttl_seconds,
        hadolint_timeout_seconds: current.hadolint_timeout_seconds,
      },
      {
        onSuccess: () => toast.success("App settings saved"),
        onError: (e) => toast.error("Save failed", e instanceof ApiError ? e.message : undefined),
      },
    );
  };

  return (
    <div>
      <SectionHead title="Application" desc="Server-side build limits and cleanup. Affects all users." />
      {isLoading || !current ? (
        <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {NUMERIC_FIELDS.map((f) => (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input mono type="number" value={String(current[f.key] ?? "")} onChange={(e) => setDraft({ ...current, [f.key]: Number(e.target.value) })} />
              </div>
            ))}
            <div>
              <Label>Memory limit</Label>
              <Input mono value={current.build_memory_limit} onChange={(e) => setDraft({ ...current, build_memory_limit: e.target.value })} placeholder="512m" />
            </div>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-line bg-bg2 px-3.5 py-3">
            <span className="text-sm"><span className="font-medium">Auto-cleanup images</span><span className="ml-2 text-xs text-dim">delete built images after TTL</span></span>
            <Switch checked={current.image_cleanup_enabled} onCheckedChange={(v) => setDraft({ ...current, image_cleanup_enabled: v })} />
          </label>

          <EnvReadonlyBlock settings={current} />

          <div className="flex justify-end">
            <Button variant="primary" onClick={save} loading={update.isPending} disabled={!draft}>
              <Save className="h-4 w-4" /> Save settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EnvReadonlyBlock({ settings }: { settings: AppSettings }) {
  const fields: { key: keyof Pick<AppSettings, "build_max_concurrent" | "arq_job_timeout_seconds" | "project_source_dir">; label: string; env: string }[] = [
    { key: "build_max_concurrent", label: "Max concurrent builds", env: "BUILD_MAX_CONCURRENT" },
    { key: "arq_job_timeout_seconds", label: "ARQ job timeout (s)", env: "ARQ_JOB_TIMEOUT_SECONDS" },
    { key: "project_source_dir", label: "Projects source directory", env: "PROJECTS_SOURCE_DIR" },
  ];

  return (
    <div className="rounded-lg border border-line bg-bg2/50 p-4">
      <div className="mb-3">
        <div className="text-sm font-medium">Environment variables</div>
        <p className="mt-1 text-2xs leading-relaxed text-dim">
          Read-only here. Edit <span className="font-mono text-muted">backend/.env</span> and restart
          the API + worker containers to apply.
        </p>
      </div>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <Label className="mb-0">{f.label}</Label>
              <span className="font-mono text-2xs text-dim">{f.env}</span>
            </div>
            <Input
              mono
              readOnly
              tabIndex={-1}
              value={String(settings[f.key] ?? "")}
              className="cursor-default border-line bg-surface/60 text-muted opacity-100"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AboutSection() {
  const daemon = useDaemonHealth();
  return (
    <div>
      <SectionHead title="About" desc="DockerForge workbench." />
      <div className="space-y-2 font-mono text-sm">
        <Line k="app" v="DockerForge frontend" />
        <Line k="version" v="0.1.0" />
        <Line k="api" v="/api/v1 (same origin)" />
        <Line k="daemon" v={daemon === "ok" ? "● ready" : daemon === "down" ? "● down" : "○ unknown"} tone={daemon === "ok" ? "ok" : daemon === "down" ? "fail" : undefined} />
      </div>
    </div>
  );
}

function Line({ k, v, tone }: { k: string; v: string; tone?: "ok" | "fail" }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-dim">{k}</span>
      <span className={tone === "ok" ? "text-ok" : tone === "fail" ? "text-fail" : "text-muted"}>{v}</span>
    </div>
  );
}

/** "R G B" token → "rgb(r,g,b)" for inline preview styling. */
function rgb(triple: string): string {
  return `rgb(${triple.split(/\s+/).join(",")})`;
}
