import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <DockerfileRain />
    </div>
  );
}

const DF_LINES = [
  "FROM python:3.12-slim AS base",
  "ENV PYTHONUNBUFFERED=1",
  "WORKDIR /app",
  "COPY requirements.txt .",
  "RUN pip install -r requirements.txt",
  "Step 4/9 : RUN pip install -r requirements.txt",
  " ---> a1f4c9d2b7e0",
  "Collecting fastapi==0.110.0",
  "Successfully built 8bee1901f1e5",
  "COPY . .",
  "EXPOSE 8000",
  'CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]',
  "FROM golang:1.24-alpine AS builder",
  "RUN go build -o /app/server ./cmd/server",
  "Step 7/14 : COPY --from=builder /app/server .",
  " ---> Running in 3f9a2c1b",
  "RUN apk add --no-cache ca-certificates",
  "Successfully tagged go-cache-test:latest",
  "--- Build finished with status: SUCCESS ---",
];

/** Extra repeats so the column stays filled while one cycle scrolls through. */
const LOOP_COPIES = 3;

function lineClass(line: string) {
  return cn(
    /^Step|^---|Successfully/.test(line)
      ? "text-cyan/25"
      : line.startsWith(" --->")
        ? "text-dim/20"
        : "text-muted/15",
  );
}

function LineBlock({ lines, blockKey }: { lines: string[]; blockKey: string }) {
  return (
    <>
      {lines.map((l, i) => (
        <div key={`${blockKey}-${i}`} className={lineClass(l)}>
          {l}
        </div>
      ))}
    </>
  );
}

function RainColumn({ offset, duration }: { offset: number; duration: number }) {
  const cycleRef = useRef<HTMLDivElement>(null);
  const [cycleH, setCycleH] = useState(0);
  const cycle = [...DF_LINES.slice(offset), ...DF_LINES];

  useLayoutEffect(() => {
    const el = cycleRef.current;
    if (!el) return;
    const measure = () => setCycleH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [offset]);

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className="flex w-full flex-col whitespace-pre font-mono text-xs leading-7 will-change-transform"
        style={
          cycleH > 0
            ? {
                ["--cycle-h" as string]: `${cycleH}px`,
                animation: `df-rise-px ${duration}s linear infinite`,
              }
            : undefined
        }
      >
        {Array.from({ length: LOOP_COPIES }, (_, i) => (
          <div key={i} ref={i === 0 ? cycleRef : undefined} className="flex flex-col">
            <LineBlock lines={cycle} blockKey={String(i)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DockerfileRain() {
  return (
    <div className="absolute inset-0 flex gap-12 px-10 [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_72%,transparent)]">
      <RainColumn offset={0} duration={44} />
      <RainColumn offset={7} duration={36} />
    </div>
  );
}
