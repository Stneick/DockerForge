import { useNavigate } from "react-router-dom";
import { Download, RotateCw, Ban, Trash2, AlertTriangle, UploadCloud } from "lucide-react";

import { buildsApi } from "@/api/builds";
import { useCancelBuild, useDeleteImage, useRetryBuild } from "@/api/hooks";
import { ApiError } from "@/api/http";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Banner } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { PushDialog } from "./PushDialog";
import type { BuildDetail } from "@/types/api";

export function BuildActions({ build, projectId }: { build: BuildDetail; projectId: string }) {
  const navigate = useNavigate();
  const retry = useRetryBuild(projectId);
  const cancel = useCancelBuild(projectId);
  const delImage = useDeleteImage(projectId);

  const isActive = build.status === "pending" || build.status === "building";
  const imageAvailable = build.status === "success" && !build.image_cleaned_at;

  const onRetry = () =>
    retry.mutate(build.id, {
      onSuccess: (b) => {
        toast.success("Re-running build");
        navigate(`/projects/${projectId}/builds/${b.id}`);
      },
      onError: (e) => toast.error("Retry failed", e instanceof ApiError ? e.message : undefined),
    });

  const onCancel = () =>
    cancel.mutate(build.id, {
      onSuccess: () => toast.info("Cancelling build…"),
      onError: (e) => toast.error("Cancel failed", e instanceof ApiError ? e.message : undefined),
    });

  const onDeleteImage = () =>
    delImage.mutate(build.id, {
      onSuccess: () => toast.success("Image deleted"),
      onError: (e) => toast.error("Delete failed", e instanceof ApiError ? e.message : undefined),
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {imageAvailable && (
        <a
          href={buildsApi.downloadUrl(projectId, build.id)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-cyan-dim bg-cyan/15 px-3 text-xs font-semibold text-cyan transition-all hover:bg-cyan/25 hover:shadow-glow-sm"
        >
          <Download className="h-3.5 w-3.5" /> Download .tar
        </a>
      )}

      {imageAvailable && (
        <PushDialog
          projectId={projectId}
          buildId={build.id}
          trigger={
            <Button variant="secondary" size="sm">
              <UploadCloud className="h-3.5 w-3.5" /> Push
            </Button>
          }
        />
      )}

      {build.status === "failed" || build.status === "cancelled" || build.status === "success" ? (
        <Button variant="secondary" size="sm" onClick={onRetry} loading={retry.isPending}>
          <RotateCw className="h-3.5 w-3.5" /> Retry
        </Button>
      ) : null}

      {isActive && (
        <Button variant="secondary" size="sm" onClick={onCancel} loading={cancel.isPending}>
          <Ban className="h-3.5 w-3.5" /> Cancel
        </Button>
      )}

      {imageAvailable && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Trash2 className="h-3.5 w-3.5" /> Delete image
            </Button>
          </DialogTrigger>
          <DialogContent title="Delete this image?" description="Frees disk space. The build record stays; you can rebuild to recreate the image.">
            <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />} className="mb-4">
              Download and push will no longer be available for this build.
            </Banner>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="danger" onClick={onDeleteImage} loading={delImage.isPending}>
                <Trash2 className="h-4 w-4" /> Delete image
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
