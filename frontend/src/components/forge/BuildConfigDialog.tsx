import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hammer, Tag, DatabaseZap } from "lucide-react";

import { useTriggerBuild } from "@/api/hooks";
import { ApiError } from "@/api/http";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { KeyValueEditor } from "@/components/ui/KeyValueEditor";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { Banner } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import type { EnvVar } from "@/types/api";

export function BuildConfigDialog({
  projectId,
  dockerfile,
  dockerignore,
  hasErrors,
  trigger,
}: {
  projectId: string;
  dockerfile: string;
  dockerignore: string;
  hasErrors: boolean;
  trigger: React.ReactNode;
}) {
  const navigate = useNavigate();
  const build = useTriggerBuild(projectId);
  const [open, setOpen] = useState(false);
  const [imageTag, setImageTag] = useState("");
  const [noCache, setNoCache] = useState(false);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [buildArgs, setBuildArgs] = useState<EnvVar[]>([]);

  const start = () => {
    build.mutate(
      {
        custom_dockerfile: dockerfile,
        custom_dockerignore: dockerignore,
        image_tag: imageTag.trim() || null,
        env_vars: envVars.filter((v) => v.key.trim()),
        build_args: buildArgs.filter((v) => v.key.trim()),
        no_cache: noCache,
      },
      {
        onSuccess: (b) => {
          setOpen(false);
          toast.success("Build started", "Streaming logs…");
          navigate(`/projects/${projectId}/builds/${b.id}`);
        },
        onError: (e) => toast.error("Could not start build", e instanceof ApiError ? e.message : undefined),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title="Forge a build"
        description="This builds the Dockerfile exactly as shown in the editor."
        className="w-[min(94vw,560px)]"
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {hasErrors && (
            <Banner tone="warning">
              hadolint reported errors. You can still build, but it may fail.
            </Banner>
          )}

          <div>
            <Label>Image tag <span className="text-dim">(optional)</span></Label>
            <div className="relative">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              <Input
                mono
                value={imageTag}
                onChange={(e) => setImageTag(e.target.value.toLowerCase())}
                placeholder="my-app:latest  ·  auto-generated if blank"
                className="pl-9"
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border border-line bg-bg2 px-3.5 py-3">
            <span className="flex items-center gap-2.5 text-sm">
              <DatabaseZap className="h-4 w-4 text-cyan" />
              <span>
                <span className="font-medium">No cache</span>
                <span className="ml-2 text-xs text-dim">rebuild every layer from scratch</span>
              </span>
            </span>
            <Switch checked={noCache} onCheckedChange={setNoCache} />
          </label>

          <div>
            <Label>Build args</Label>
            <KeyValueEditor value={buildArgs} onChange={setBuildArgs} addLabel="Add build arg" />
          </div>

          <div>
            <Label>Runtime environment variables</Label>
            <KeyValueEditor value={envVars} onChange={setEnvVars} addLabel="Add variable" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="primary" onClick={start} loading={build.isPending}>
            <Hammer className="h-4 w-4" /> Start build
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
