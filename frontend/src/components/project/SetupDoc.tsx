import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Replace } from "lucide-react";

import { useDetectSource } from "@/api/hooks";
import { ApiError } from "@/api/http";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { SourceStep } from "@/components/source/SourceStep";
import { ConfigPanel } from "@/components/source/ConfigPanel";
import type { Project, SourceAnalysisResponse } from "@/types/api";

/** The project's "Configuration" document: acquire source, then review +
 *  override the detected setup. */
export function SetupDoc({ project }: { project: Project }) {
  const navigate = useNavigate();
  const hasSource = project.source_uploaded || project.source_type !== "none";
  const [detection, setDetection] = useState<SourceAnalysisResponse | null>(null);
  const [replacing, setReplacing] = useState(false);
  const detect = useDetectSource(project.id);

  const reDetect = () =>
    detect.mutate(undefined, {
      onSuccess: (res) => {
        setDetection(res);
        toast.success("Re-analyzed source");
      },
      onError: (e) => toast.error("Detection failed", e instanceof ApiError ? e.message : undefined),
    });

  if (!hasSource || replacing) {
    return (
      <div className="mx-auto max-w-2xl">
        {replacing && (
          <Button variant="ghost" size="sm" className="mb-3" onClick={() => setReplacing(false)}>
            ← Back to configuration
          </Button>
        )}
        <div className="panel p-5">
          <h2 className="mb-1 text-base font-bold">Add source</h2>
          <p className="mb-4 text-sm text-muted">
            Upload an archive or clone a repo — DockerForge detects the stack and recommends a setup.
          </p>
          <SourceStep
            projectId={project.id}
            onDetected={(res) => {
              setDetection(res);
              setReplacing(false);
              navigate(`/projects/${project.id}?tab=setup`, { replace: true });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Configuration</h2>
          <p className="text-sm text-muted">
            {detection ? "Review the detected setup — adjust anything, then save." : "Tune how this project builds."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={reDetect} loading={detect.isPending}>
            <RefreshCw className="h-3.5 w-3.5" /> Re-detect
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReplacing(true)}>
            <Replace className="h-3.5 w-3.5" /> Replace source
          </Button>
        </div>
      </div>

      {!project.language && !detection ? (
        <EmptyState
          icon={<RefreshCw className="h-6 w-6" />}
          title="Source added, not yet analyzed"
          description="Run detection to get stack recommendations, or configure manually below."
          action={
            <Button variant="primary" onClick={reDetect} loading={detect.isPending}>
              <RefreshCw className="h-4 w-4" /> Analyze source
            </Button>
          }
        />
      ) : (
        <ConfigPanel
          project={project}
          detection={detection}
          onApplied={() => navigate(`/projects/${project.id}?tab=dockerfile`)}
        />
      )}
    </div>
  );
}
