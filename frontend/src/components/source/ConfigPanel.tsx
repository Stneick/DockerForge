import { useMemo, useState } from "react";
import {
  AlertTriangle, Info, FileText, Sparkles, RotateCcw, Save, ArrowRight,
  Boxes, Play, Package, Braces,
} from "lucide-react";

import { useLanguages, useUpdateProject } from "@/api/hooks";
import { ApiError } from "@/api/http";
import { relevantFields, FIELD_LABELS } from "@/lib/fields";
import { langLogo, fwLogo } from "@/lib/logos";
import { formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { KeyValueEditor } from "@/components/ui/KeyValueEditor";
import { Banner } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageFrameworkPicker } from "./LanguageFrameworkPicker";
import type {
  EnvVar, Project, SourceAnalysisResponse, SupportedLanguage, UpdateProjectRequest,
} from "@/types/api";

interface Draft {
  language: SupportedLanguage | null;
  framework: string | null;
  dependency_file: string;
  startup_command: string;
  entry_point: string;
  binary_name: string;
  build_output_dir: string;
  build_package: string;
  base_image: string;
  port: string;
  env_vars: EnvVar[];
}

function makeDraft(project: Project, det?: SourceAnalysisResponse | null): Draft {
  const pick = <T,>(a: T | null | undefined, b: T | null | undefined) => a ?? b ?? null;
  return {
    language: (pick(det?.detected_language, project.language) as SupportedLanguage) ?? null,
    framework: pick(det?.detected_framework, project.framework),
    dependency_file: pick(det?.detected_dependency_file, project.dependency_file) ?? "",
    startup_command: pick(det?.suggested_startup_command, project.startup_command) ?? "",
    entry_point: pick(det?.detected_entry_point, project.entry_point) ?? "",
    binary_name: pick(det?.detected_binary_name, project.binary_name) ?? "",
    build_output_dir: pick(det?.detected_build_output_dir, project.build_output_dir) ?? "",
    build_package: pick(det?.detected_build_package, project.build_package) ?? "",
    base_image: pick(det?.detected_base_image, project.base_image) ?? "",
    port: (pick(det?.detected_port, project.port) ?? "")?.toString() ?? "",
    env_vars: project.env_vars ?? [],
  };
}

export function ConfigPanel({
  project,
  detection,
  onApplied,
}: {
  project: Project;
  detection?: SourceAnalysisResponse | null;
  onApplied?: () => void;
}) {
  const { data: languages = [] } = useLanguages();
  const update = useUpdateProject(project.id);
  const [draft, setDraft] = useState<Draft>(() => makeDraft(project, detection));

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const langDef = languages.find((l) => l.name === draft.language);
  const fwDef = langDef?.frameworks.find((f) => f.name === draft.framework);
  const fields = relevantFields(draft.language);

  const depOptions = useMemo(() => {
    const files = new Set<string>();
    if (draft.dependency_file) files.add(draft.dependency_file);
    detection?.detected_files?.forEach((f) => files.add(f));
    return Array.from(files).map((f) => ({ value: f, label: f }));
  }, [detection, draft.dependency_file]);

  const note = detection?.note ?? fwDef?.note ?? null;

  const apply = () => {
    const payload: UpdateProjectRequest = {
      language: draft.language,
      framework: draft.framework || null,
      dependency_file: draft.dependency_file || null,
      startup_command: draft.startup_command || null,
      entry_point: fields.includes("entry_point") ? draft.entry_point || null : null,
      binary_name: fields.includes("binary_name") ? draft.binary_name || null : null,
      build_output_dir: fields.includes("build_output_dir") ? draft.build_output_dir || null : null,
      build_package: fields.includes("build_package") ? draft.build_package || null : null,
      base_image: draft.base_image || null,
      port: draft.port ? Number(draft.port) : null,
      env_vars: draft.env_vars.filter((v) => v.key.trim()),
    };
    update.mutate(payload, {
      onSuccess: () => { toast.success("Configuration saved"); onApplied?.(); },
      onError: (e) => toast.error("Save failed", e instanceof ApiError ? e.message : undefined),
    });
  };

  return (
    <div className="space-y-5">
      {/* detection hero */}
      {detection && detection.detected_language && (
        <DetectionHero detection={detection} />
      )}

      {detection?.warnings?.map((w, i) => (
        <Banner key={i} tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>{w}</Banner>
      ))}
      {note && <Banner tone="info" icon={<Info className="h-4 w-4" />}>{note}</Banner>}
      {detection?.has_existing_dockerfile && (
        <Banner tone="info" icon={<FileText className="h-4 w-4" />}>
          An existing <span className="mono">Dockerfile</span> was found — you can still generate and edit a fresh one in the Forge.
        </Banner>
      )}

      {/* horizontal split: visual stack picker | editable config */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={<Boxes className="h-4 w-4" />} title="Stack">
          <LanguageFrameworkPicker
            languages={languages}
            language={draft.language}
            framework={draft.framework}
            detectedLanguage={detection?.detected_language}
            detectedFramework={detection?.detected_framework}
            confidence={detection?.confidence}
            onChange={({ language, framework }) => setDraft((d) => ({ ...d, language, framework }))}
          />
        </Section>

        <div className="space-y-5">
          <Section icon={<Play className="h-4 w-4" />} title="Runtime">
            <div className="space-y-4">
              <Field label="Startup command">
                <Input mono value={draft.startup_command} onChange={(e) => set("startup_command", e.target.value)} placeholder="uvicorn main:app --host 0.0.0.0 --port 8000" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Port">
                  <Input mono type="number" value={draft.port} onChange={(e) => set("port", e.target.value)} placeholder="8000" />
                </Field>
                {fields.filter((f) => f === "entry_point" || f === "binary_name").map((f) => (
                  <Field key={f} label={FIELD_LABELS[f].label} hint={FIELD_LABELS[f].hint}>
                    <Input mono value={draft[f]} onChange={(e) => set(f, e.target.value)} placeholder={FIELD_LABELS[f].placeholder} />
                  </Field>
                ))}
              </div>
            </div>
          </Section>

          <Section icon={<Package className="h-4 w-4" />} title="Build">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Dependency file">
                {depOptions.length > 1 ? (
                  <Select mono value={draft.dependency_file} onValueChange={(v) => set("dependency_file", v)} options={depOptions} placeholder="select…" />
                ) : (
                  <Input mono value={draft.dependency_file} onChange={(e) => set("dependency_file", e.target.value)} placeholder="requirements.txt" />
                )}
              </Field>
              <Field label="Base image" hint="optional override">
                <Input mono value={draft.base_image} onChange={(e) => set("base_image", e.target.value)} placeholder={langDef?.default_base_image ?? "auto"} />
              </Field>
              {fields.filter((f) => f === "build_output_dir" || f === "build_package").map((f) => (
                <Field key={f} label={FIELD_LABELS[f].label} hint={FIELD_LABELS[f].hint}>
                  <Input mono value={draft[f]} onChange={(e) => set(f, e.target.value)} placeholder={FIELD_LABELS[f].placeholder} />
                </Field>
              ))}
            </div>
          </Section>

          <Section icon={<Braces className="h-4 w-4" />} title="Environment">
            <KeyValueEditor value={draft.env_vars} onChange={(v) => set("env_vars", v)} />
          </Section>
        </div>
      </div>

      {detection?.detected_files && detection.detected_files.length > 0 && (
        <div>
          <p className="label-mono mb-2">Files found in source</p>
          <div className="flex flex-wrap gap-1.5">
            {detection.detected_files.slice(0, 24).map((f) => (
              <span key={f} className="rounded-md border border-line2 bg-bg2 px-2 py-0.5 font-mono text-2xs text-muted">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* sticky action bar */}
      <div className="sticky bottom-0 flex items-center justify-between rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => setDraft(makeDraft(project, detection))} disabled={update.isPending}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </Button>
        <Button variant="primary" onClick={apply} loading={update.isPending} disabled={!draft.language}>
          <Save className="h-4 w-4" /> Save configuration
        </Button>
      </div>
    </div>
  );
}

function DetectionHero({ detection }: { detection: SourceAnalysisResponse }) {
  const pct = Math.round((detection.confidence ?? 0) * 100);
  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-dim/50 bg-gradient-to-br from-cyan/[0.07] to-transparent p-5">
      <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-cyan">
        <Sparkles className="h-3.5 w-3.5" /> detected stack
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-bg2 ring-1 ring-inset ring-line">
            <BrandLogo file={langLogo(detection.detected_language)} alt="language" className="h-8 w-8" />
          </span>
          {detection.detected_framework && (
            <>
              <ArrowRight className="h-4 w-4 text-dim" />
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-bg2 ring-1 ring-inset ring-line">
                <BrandLogo file={fwLogo(detection.detected_framework)} alt="framework" className="h-8 w-8" />
              </span>
            </>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-lg font-extrabold tracking-tight">
            {detection.detected_language}
            {detection.detected_framework && <span className="text-muted"> · {detection.detected_framework}</span>}
          </div>
          <div className="text-sm text-muted">
            We pre-filled the configuration below — adjust anything, you have the final say.
          </div>
        </div>

        {/* confidence ring */}
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{ background: `radial-gradient(closest-side, rgb(var(--bg2)) 76%, transparent 77%), conic-gradient(rgb(var(--cyan)) ${pct}%, rgb(var(--surface3)) 0)` }}
        >
          <div className="text-center">
            <div className="text-sm font-extrabold">{formatPercent(detection.confidence)}</div>
            <div className="font-mono text-[9px] text-dim">match</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-gradient-to-b from-surface to-bg2">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="text-cyan">{icon}</span>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}{hint && <span className="ml-1.5 font-normal normal-case text-dim">· {hint}</span>}</Label>
      {children}
    </div>
  );
}

export { makeDraft };
