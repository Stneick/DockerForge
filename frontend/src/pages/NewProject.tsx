import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Upload, Github, Sparkles, ArrowRight } from "lucide-react";

import { useCreateProject } from "@/api/hooks";
import { ApiError } from "@/api/http";
import { useWorkbenchTab } from "@/components/workbench/useWorkbenchTab";
import { Button } from "@/components/ui/Button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";

export function NewProjectPage() {
  useWorkbenchTab({ kind: "new-project", title: "New project", id: "/projects/new" });
  const navigate = useNavigate();
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    create.mutate(
      { name: name.trim(), description: description.trim() || null },
      {
        onSuccess: (p) => {
          toast.success("Project created", "Now add your source.");
          navigate(`/projects/${p.id}`);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create project"),
      },
    );
  };

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="grid-tex pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(circle_at_50%_0%,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-xl px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-line2 bg-surface2 text-cyan shadow-glow">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-2xs uppercase tracking-[0.18em] text-cyan">new project</div>
            <h1 className="text-xl font-extrabold tracking-tight">Start a new forge</h1>
          </div>
        </div>

        <form onSubmit={submit} className="panel space-y-4 p-5">
          <div>
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="api-gateway"
              maxLength={100}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="desc">Description <span className="text-dim">(optional)</span></Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this service do?"
              maxLength={500}
              rows={3}
            />
          </div>
          {error && <FieldError>{error}</FieldError>}

          <div className="rounded-lg border border-line bg-bg2 p-3.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Sparkles className="h-3.5 w-3.5 text-cyan" /> Next: add source &amp; auto-detect
            </p>
            <div className="mt-2.5 flex items-center gap-4 font-mono text-2xs text-dim">
              <span className="flex items-center gap-1.5"><Upload className="h-3 w-3" /> upload archive</span>
              <span className="flex items-center gap-1.5"><Github className="h-3 w-3" /> clone repo</span>
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" loading={create.isPending} className="w-full">
            Create project <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
