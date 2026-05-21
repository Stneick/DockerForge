import { CodeEditor } from "@/components/forge/MonacoView";
import { EmptyState } from "@/components/ui/misc";
import { FileCode2 } from "lucide-react";

/** Read-only Monaco view of the exact Dockerfile a build used. */
export function DockerfileView({ content }: { content: string | null }) {
  if (!content) {
    return (
      <EmptyState icon={<FileCode2 className="h-6 w-6" />} title="No Dockerfile recorded" />
    );
  }
  return <CodeEditor value={content} language="dockerfile" readOnly />;
}
