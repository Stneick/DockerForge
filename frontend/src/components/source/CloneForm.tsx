import { useState } from "react";
import { Github, GitBranch, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import type { CloneRequest } from "@/types/api";

export function CloneForm({
  onClone,
  cloning,
}: {
  onClone: (body: CloneRequest) => void;
  cloning: boolean;
}) {
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [token, setToken] = useState("");

  const valid = /^https:\/\/github\.com\/.+/.test(repoUrl.trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onClone({
          repo_url: repoUrl.trim(),
          branch: branch.trim() || "main",
          access_token: token.trim() || null,
        });
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="repo">Repository URL</Label>
        <div className="relative">
          <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <Input
            id="repo"
            mono
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            className="pl-9"
            autoFocus
          />
        </div>
        <p className="mt-1 font-mono text-2xs text-dim">HTTPS GitHub URLs only.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="branch">Branch</Label>
          <div className="relative">
            <GitBranch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <Input
              id="branch"
              mono
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="token">Access token <span className="text-dim">(private)</span></Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
            <Input
              id="token"
              type="password"
              mono
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <Button type="submit" variant="primary" className="w-full" loading={cloning} disabled={!valid}>
        Clone &amp; analyze
      </Button>
    </form>
  );
}
