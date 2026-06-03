import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, Trash2, AlertTriangle } from "lucide-react";

import { useDeleteProject, useUpdateProject } from "@/api/hooks";
import { ApiError } from "@/api/http";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Banner } from "@/components/ui/misc";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { toast } from "@/components/ui/Toast";
import type { Project } from "@/types/api";

function ProjectSettingsForm({
  project,
  onClose,
}: {
  project: Project;
  onClose?: () => void;
}) {
  const update = useUpdateProject(project.id);
  const del = useDeleteProject();
  const navigate = useNavigate();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
  }, [project.id, project.name, project.description]);

  const dirty = name !== project.name || description !== (project.description ?? "");

  const save = () => {
    update.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: () => toast.success("Project updated"),
        onError: (e) =>
          toast.error("Update failed", e instanceof ApiError ? e.message : undefined),
      },
    );
  };

  const remove = () => {
    del.mutate(project.id, {
      onSuccess: () => {
        toast.success("Project deleted");
        onClose?.();
        navigate("/");
      },
      onError: (e) =>
        toast.error("Delete failed", e instanceof ApiError ? e.message : undefined),
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-line2 bg-bg2/40 p-4">
        <h3 className="text-sm font-semibold">General</h3>
        <div>
          <Label htmlFor="pname">Name</Label>
          <Input
            id="pname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div>
          <Label htmlFor="pdesc">Description</Label>
          <Textarea
            id="pdesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={save}
            loading={update.isPending}
            disabled={!dirty || !name.trim()}
          >
            <Save className="h-4 w-4" /> Save changes
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-fail/30 bg-fail/[0.04] p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fail">
          <AlertTriangle className="h-4 w-4" /> Danger zone
        </h3>
        <p className="mt-1.5 text-sm text-muted">
          Deleting a project removes its source, builds, and history. This cannot be undone.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger" className="mt-4">
              <Trash2 className="h-4 w-4" /> Delete project
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Delete this project?"
            description={`"${project.name}" and all of its ${project.total_builds} build(s) will be permanently removed.`}
          >
            <Banner tone="warning" icon={<AlertTriangle className="h-4 w-4" />} className="mb-4">
              This action is irreversible.
            </Banner>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button variant="danger" onClick={remove} loading={del.isPending}>
                <Trash2 className="h-4 w-4" /> Delete permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Project settings"
        description={project.name}
        className="max-h-[min(85vh,640px)] overflow-y-auto"
      >
        <ProjectSettingsForm project={project} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
