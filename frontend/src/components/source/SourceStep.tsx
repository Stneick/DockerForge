import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Github } from "lucide-react";

import { projectsApi } from "@/api/projects";
import { qk } from "@/api/queryKeys";
import { ApiError } from "@/api/http";
import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/Toast";
import { UploadDropzone } from "./UploadDropzone";
import { CloneForm } from "./CloneForm";
import type { CloneRequest, SourceAnalysisResponse } from "@/types/api";

type Method = "upload" | "clone";

export function SourceStep({
  projectId,
  onDetected,
}: {
  projectId: string;
  onDetected: (result: SourceAnalysisResponse) => void;
}) {
  const [method, setMethod] = useState<Method>("upload");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const qc = useQueryClient();

  const finish = (result: SourceAnalysisResponse) => {
    qc.invalidateQueries({ queryKey: qk.project(projectId) });
    toast.success("Source analyzed", "Review the detected configuration below.");
    onDetected(result);
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setProgress(0);
    try {
      const res = await projectsApi.upload(projectId, file, setProgress);
      finish(res);
    } catch (e) {
      toast.error("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async (body: CloneRequest) => {
    setBusy(true);
    try {
      const res = await projectsApi.clone(projectId, body);
      finish(res);
    } catch (e) {
      toast.error("Clone failed", e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <MethodCard
          active={method === "upload"}
          onClick={() => setMethod("upload")}
          icon={<Upload className="h-5 w-5" />}
          title="Upload archive"
          desc="Drop a .zip / .tar.gz of your source"
        />
        <MethodCard
          active={method === "clone"}
          onClick={() => setMethod("clone")}
          icon={<Github className="h-5 w-5" />}
          title="Clone from GitHub"
          desc="Pull source straight from a repo"
        />
      </div>

      {method === "upload" ? (
        <UploadDropzone onUpload={handleUpload} uploading={busy} progress={progress} />
      ) : (
        <CloneForm onClone={handleClone} cloning={busy} />
      )}
    </div>
  );
}

function MethodCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
        active
          ? "border-cyan bg-cyan/[0.06] shadow-glow-sm"
          : "border-line2 hover:border-cyan-dim hover:bg-surface2",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", active ? "text-cyan" : "text-dim")}>{icon}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{desc}</p>
      </div>
    </button>
  );
}
