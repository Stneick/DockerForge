import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { editor } from "monaco-editor";
import {
  FileCode2,
  FileX2,
  Hammer,
  RefreshCw,
  GitCompareArrows,
  AlertTriangle,
  CheckCircle2,
  Info,
} from "lucide-react";

import { projectsApi } from "@/api/projects";
import { ApiError } from "@/api/http";
import { cn } from "@/lib/cn";
import { langMeta } from "@/lib/languageMeta";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/misc";
import { CenteredSpinner } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { Dock, Inspector, InspectorSection } from "@/components/workbench/panels";
import { CodeEditor, CodeDiff } from "./MonacoView";
import { LintPanel, lintSummary } from "./LintPanel";
import { BuildConfigDialog } from "./BuildConfigDialog";
import type { LintIssue, Project } from "@/types/api";

type FileKey = "dockerfile" | "dockerignore";
type Mode = "edit" | "diff";

export function Forge({ project, activeFile = "dockerfile" }: { project: Project; activeFile?: FileKey }) {
  if (!project.language || !project.framework) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          Set a language and framework in <span className="font-semibold">Configuration</span> before forging a
          Dockerfile.
        </Banner>
      </div>
    );
  }
  return <ForgeInner project={project} initialFile={activeFile} />;
}

function ForgeInner({ project, initialFile }: { project: Project; initialFile: FileKey }) {
  const preview = useQuery({
    queryKey: ["preview", project.id],
    queryFn: () => projectsApi.previewDockerfile(project.id),
    staleTime: 60_000,
  });

  const [dockerfile, setDockerfile] = useState("");
  const [dockerignore, setDockerignore] = useState("");
  const [baseDockerfile, setBaseDockerfile] = useState("");
  const [baseDockerignore, setBaseDockerignore] = useState("");
  const [activeFile, setActiveFile] = useState<FileKey>(initialFile);
  const [mode, setMode] = useState<Mode>("edit");
  const [sideBySide, setSideBySide] = useState(true);
  const [issues, setIssues] = useState<LintIssue[]>([]);
  const [linting, setLinting] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Follow explorer clicks (Dockerfile vs .dockerignore).
  useEffect(() => setActiveFile(initialFile), [initialFile]);

  useEffect(() => {
    if (preview.data) {
      setDockerfile(preview.data.dockerfile_content);
      setDockerignore(preview.data.dockerignore_content);
      setBaseDockerfile(preview.data.dockerfile_content);
      setBaseDockerignore(preview.data.dockerignore_content);
    }
  }, [preview.data]);

  useEffect(() => {
    if (!dockerfile) return;
    let cancelled = false;
    setLinting(true);
    const t = setTimeout(async () => {
      try {
        const res = await projectsApi.lintDockerfile(project.id, { dockerfile });
        if (!cancelled) setIssues(res.issues);
      } catch {
        if (!cancelled) setIssues([]);
      } finally {
        if (!cancelled) setLinting(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [dockerfile, project.id]);

  const regenerate = async () => {
    const res = await preview.refetch();
    if (res.data) {
      setDockerfile(res.data.dockerfile_content);
      setDockerignore(res.data.dockerignore_content);
      setBaseDockerfile(res.data.dockerfile_content);
      setBaseDockerignore(res.data.dockerignore_content);
      toast.success("Regenerated from current configuration");
    } else if (res.error) {
      toast.error("Could not regenerate", res.error instanceof ApiError ? res.error.message : undefined);
    }
  };

  if (preview.isLoading) return <CenteredSpinner label="generating Dockerfile…" />;
  if (preview.isError) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
          {preview.error instanceof ApiError ? preview.error.message : "Failed to generate a Dockerfile."}
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => preview.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        </Banner>
      </div>
    );
  }

  const isDockerfile = activeFile === "dockerfile";
  const value = isDockerfile ? dockerfile : dockerignore;
  const baseline = isDockerfile ? baseDockerfile : baseDockerignore;
  const setValue = isDockerfile ? setDockerfile : setDockerignore;
  const language = isDockerfile ? "dockerfile" : "plaintext";
  const edited = value !== baseline;
  const { errors, warnings } = lintSummary(issues);
  const meta = langMeta(project.language);

  const jumpTo = (line: number, column: number) => {
    setMode("edit");
    setActiveFile("dockerfile");
    const ed = editorRef.current;
    if (!ed) return;
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column });
    ed.focus();
  };

  return (
    <div className="flex h-full flex-col">
      {/* editor toolbar */}
      <div className="flex items-center gap-2 border-b border-line bg-bg2 px-2 py-1.5">
        <div className="flex overflow-hidden rounded-md border border-line2">
          <FileTab active={isDockerfile} onClick={() => setActiveFile("dockerfile")} icon={<FileCode2 className="h-3.5 w-3.5" />} edited={dockerfile !== baseDockerfile}>
            Dockerfile
          </FileTab>
          <FileTab active={!isDockerfile} onClick={() => setActiveFile("dockerignore")} icon={<FileX2 className="h-3.5 w-3.5" />} edited={dockerignore !== baseDockerignore}>
            .dockerignore
          </FileTab>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line2">
            <SegBtn active={mode === "edit"} onClick={() => setMode("edit")}>Edit</SegBtn>
            <SegBtn active={mode === "diff"} onClick={() => setMode("diff")} disabled={!edited} title={edited ? undefined : "No changes to diff"}>
              <GitCompareArrows className="mr-1 h-3.5 w-3.5" /> Diff
            </SegBtn>
          </div>
          {mode === "diff" && (
            <div className="flex overflow-hidden rounded-md border border-line2">
              <SegBtn active={sideBySide} onClick={() => setSideBySide(true)}>Split</SegBtn>
              <SegBtn active={!sideBySide} onClick={() => setSideBySide(false)}>Inline</SegBtn>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={regenerate} title="Regenerate from config">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </Button>
        </div>
      </div>

      {/* editor */}
      <div className="min-h-0 flex-1">
        {mode === "edit" ? (
          <CodeEditor
            value={value}
            language={language}
            issues={isDockerfile ? issues : undefined}
            onChange={setValue}
            onReady={(ed) => (editorRef.current = ed)}
          />
        ) : (
          <CodeDiff
            original={baseline}
            modified={value}
            language={language}
            sideBySide={sideBySide}
            modifiedEditable
            issues={isDockerfile ? issues : undefined}
            onChange={setValue}
          />
        )}
      </div>

      {/* DOCK: problems + preview warnings */}
      <Dock
        defaultTab="problems"
        tabs={[
          {
            id: "problems",
            label: "Problems",
            badge: issues.length > 0 ? issues.length : undefined,
            content: (
              <div className="h-full overflow-y-auto">
                <LintPanel issues={issues} loading={linting} onJump={jumpTo} />
              </div>
            ),
          },
          {
            id: "preview",
            label: "Output",
            content: (
              <div className="h-full space-y-2 overflow-y-auto p-3 font-mono text-xs text-muted">
                <div><span className="text-dim">base image</span> · <span className="text-cyan">{preview.data?.base_image}</span></div>
                {(preview.data?.warnings ?? []).length === 0 ? (
                  <div className="text-ok">no generator warnings</div>
                ) : (
                  preview.data?.warnings.map((w, i) => (
                    <div key={i} className="text-warn">⚠ {w}</div>
                  ))
                )}
              </div>
            ),
          },
        ]}
        headerRight={
          <span
            className={cn(
              "flex items-center gap-1 font-mono text-2xs font-semibold",
              errors > 0 ? "text-fail" : warnings > 0 ? "text-warn" : "text-ok",
            )}
          >
            {errors + warnings === 0 ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            hadolint{linting ? " …" : errors + warnings === 0 ? " clean" : ` ${errors + warnings}`}
          </span>
        }
      />

      {/* INSPECTOR: config summary + build */}
      <Inspector>
        <InspectorSection title="Forge">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {meta && (
                <span className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: meta.color }}>
                  {meta.short}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{project.name}</div>
                <div className="font-mono text-2xs text-dim">{project.language} · {project.framework}</div>
              </div>
            </div>
            <BuildConfigDialog
              projectId={project.id}
              dockerfile={dockerfile}
              dockerignore={dockerignore}
              hasErrors={errors > 0}
              trigger={
                <Button variant="primary" size="sm" className="w-full">
                  <Hammer className="h-3.5 w-3.5" /> Build image
                </Button>
              }
            />
          </div>
        </InspectorSection>

        <InspectorSection title="Config">
          <dl className="space-y-1.5 font-mono text-2xs">
            <Field k="base" v={preview.data?.base_image ?? project.base_image ?? "auto"} />
            <Field k="dep" v={project.dependency_file ?? "—"} />
            <Field k="port" v={project.port?.toString() ?? "—"} />
            <Field k="cmd" v={project.startup_command ?? "—"} />
          </dl>
        </InspectorSection>

        {(preview.data?.warnings ?? []).length > 0 && (
          <InspectorSection title="Notes">
            <div className="flex items-start gap-2 text-2xs text-warn">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{preview.data?.warnings[0]}</span>
            </div>
          </InspectorSection>
        )}
      </Inspector>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-9 shrink-0 text-dim">{k}</dt>
      <dd className="min-w-0 flex-1 truncate text-muted">{v}</dd>
    </div>
  );
}

function FileTab({ active, onClick, icon, edited, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; edited?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs transition-colors", active ? "bg-bg text-text" : "text-muted hover:bg-surface2")}>
      <span className={active ? "text-cyan" : "text-dim"}>{icon}</span>
      {children}
      {edited && <span className="h-1.5 w-1.5 rounded-full bg-cyan" />}
    </button>
  );
}

function SegBtn({ active, onClick, disabled, title, children }: { active: boolean; onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={cn("flex items-center px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40", active ? "bg-cyan text-onaccent" : "text-muted hover:bg-surface2")}>
      {children}
    </button>
  );
}
