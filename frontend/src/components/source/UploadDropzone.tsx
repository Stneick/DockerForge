import { useRef, useState } from "react";
import { UploadCloud, FileArchive, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/Button";

const ACCEPT = ".zip,.tar,.tar.gz,.tgz";
const ACCEPT_RE = /\.(zip|tar|tar\.gz|tgz)$/i;

export function UploadDropzone({
  onUpload,
  uploading,
  progress,
}: {
  onUpload: (file: File) => void;
  uploading: boolean;
  progress: number;
}) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!ACCEPT_RE.test(f.name)) {
      setError("Use a .zip, .tar, .tar.gz or .tgz archive");
      return;
    }
    setError(null);
    setFile(f);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => !file && inputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-cyan bg-cyan/[0.06]" : "border-line2 hover:border-cyan-dim",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {!file ? (
          <>
            <div className="grid h-12 w-12 place-items-center rounded-xl border border-line2 bg-surface2 text-cyan">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-text">
                Drop a source archive, or <span className="text-cyan">browse</span>
              </p>
              <p className="mt-1 font-mono text-2xs text-dim">.zip · .tar · .tar.gz · .tgz</p>
            </div>
          </>
        ) : (
          <div className="w-full">
            <div className="flex items-center gap-3 rounded-lg border border-line2 bg-bg2 p-3 text-left">
              <FileArchive className="h-5 w-5 shrink-0 text-cyan" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="font-mono text-2xs text-dim">{formatBytes(file.size)}</p>
              </div>
              {!uploading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-dim hover:bg-surface2 hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {uploading && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-bg2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan to-docker transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1.5 font-mono text-2xs text-cyan">
                  {progress < 100 ? `uploading ${progress}%` : "analyzing source…"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-fail">{error}</p>}
      {file && !uploading && (
        <Button variant="primary" className="mt-3 w-full" onClick={() => onUpload(file)}>
          Upload &amp; analyze
        </Button>
      )}
    </div>
  );
}
