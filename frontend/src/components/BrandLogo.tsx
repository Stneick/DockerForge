import { Boxes } from "lucide-react";

import { cn } from "@/lib/cn";
import { isDarkLogo } from "@/lib/logos";

/** Renders a devicon brand SVG from /public/logos. Falls back to a generic
 *  glyph when there's no logo (e.g. Makefile, "default" frameworks). */
export function BrandLogo({
  file,
  alt,
  className,
}: {
  file: string | null;
  alt: string;
  className?: string;
}) {
  if (!file) {
    return <Boxes className={cn("text-dim", className)} />;
  }
  return (
    <img
      src={`/logos/${file}.svg`}
      alt={alt}
      draggable={false}
      loading="lazy"
      className={cn("object-contain", isDarkLogo(file) && "logo-invert-on-dark", className)}
    />
  );
}
