import { useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";

import { usePushSession } from "@/store/pushSession";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/Dialog";

/**
 * Credentials form for starting a push. On submit it kicks off a global push
 * session (see store/pushSession) and closes — the progress stream then shows
 * in the build's bottom Dock as a "Push" tab.
 */
export function PushDialog({
  projectId,
  buildId,
  trigger,
}: {
  projectId: string;
  buildId: string;
  trigger: React.ReactNode;
}) {
  const start = usePushSession((s) => s.start);
  const sessionForThis = usePushSession((s) =>
    s.current && s.current.buildId === buildId ? s.current : null,
  );

  const [open, setOpen] = useState(false);
  const [repository, setRepository] = useState("");
  const [targetTag, setTargetTag] = useState("latest");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Prefill from the last session for this build (handy for "push another tag").
  useEffect(() => {
    if (open && sessionForThis) {
      setRepository((r) => r || sessionForThis.repository);
      setTargetTag((t) => (t === "latest" ? sessionForThis.targetTag : t));
      setUsername((u) => u || sessionForThis.username);
    }
  }, [open, sessionForThis]);

  const submit = () => {
    start({
      projectId,
      buildId,
      repository: repository.trim(),
      targetTag: targetTag.trim() || "latest",
      username,
      password,
    });
    setOpen(false);
    setPassword("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title="Push to registry"
        description="Push this image to a Docker registry. Progress will stream in the bottom panel."
        className="w-[min(94vw,560px)]"
      >
        <div className="space-y-4">
          <div>
            <Label>Repository</Label>
            <Input mono value={repository} onChange={(e) => setRepository(e.target.value)} placeholder="docker.io/youruser/app" />
          </div>
          <div>
            <Label>Tag</Label>
            <Input mono value={targetTag} onChange={(e) => setTargetTag(e.target.value)} placeholder="latest" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Username</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <Label>Password / token</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="primary" onClick={submit} disabled={!repository.trim() || !username || !password}>
            <UploadCloud className="h-4 w-4" /> Push
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
