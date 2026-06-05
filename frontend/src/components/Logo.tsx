import { cn } from "@/lib/cn";

export const LOGO_SRC = "/logo.png";
export const LOGO_ICON_SRC = "/dockerforge-textless.png";
export const LOGO_TEXT_SRC = "/dockerforge-text.png";

/** Top portion of logo.png — whale + anvil only, above the baked-in wordmark. */
const LOGO_ICON_HEIGHT_RATIO = 0.46;

export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="DockerForge"
      draggable={false}
      className={cn("h-8 w-auto object-contain object-left", className)}
    />
  );
}

/** Compact mark for the tab bar — icon only; wordmark is rendered separately. */
export function LogoBadge({
  className,
  crop = "full",
}: {
  className?: string;
  crop?: "full" | "icon";
}) {
  if (crop === "icon") {
    const clipBottom = `${(1 - LOGO_ICON_HEIGHT_RATIO) * 100}%`;

    return (
      <span
        className={cn(
          "inline-flex h-7 shrink-0 items-start overflow-hidden rounded-md",
          className,
        )}
      >
        <img
          src={LOGO_SRC}
          alt=""
          aria-hidden
          draggable={false}
          className="w-auto max-w-none select-none"
          style={{
            height: `calc(100% / ${LOGO_ICON_HEIGHT_RATIO})`,
            clipPath: `inset(0 0 ${clipBottom} 0)`,
          }}
        />
      </span>
    );
  }

  return <LogoMark className={cn("shrink-0", className)} />;
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-[15px] font-extrabold tracking-tight", className)}>
      docker<span className="text-cyan">forge</span>
    </span>
  );
}

/** Text PNG is square; the wordmark sits in a thin horizontal band — crop to that band. */
const LOGO_TEXT_BAND_RATIO = 0.56;

function AuthTextMark({
  className,
  bandClassName,
}: {
  className?: string;
  bandClassName?: string;
}) {
  const inset = `${((1 - LOGO_TEXT_BAND_RATIO) / 2) * 100}%`;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center overflow-hidden", bandClassName, className)}
    >
      <img
        src={LOGO_TEXT_SRC}
        alt="DockerForge"
        draggable={false}
        className={cn("w-auto max-w-none select-none object-contain", className)}
        style={{
          height: `calc(100% / ${LOGO_TEXT_BAND_RATIO})`,
          clipPath: `inset(${inset} 0 ${inset} 0)`,
        }}
      />
    </span>
  );
}

/** Auth pages — whale/anvil icon + DockerForge wordmark PNG, side by side. */
export function AuthLogo({
  className,
  sizeClassName = "h-24",
  iconClassName,
}: {
  className?: string;
  /** Text band outer height. */
  sizeClassName?: string;
  /** Icon height — defaults one step above the text band. */
  iconClassName?: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={LOGO_ICON_SRC}
        alt=""
        aria-hidden
        draggable={false}
        className={cn("w-auto shrink-0 object-contain", iconClassName ?? sizeClassName)}
      />
      <AuthTextMark bandClassName={sizeClassName} className="-ml-6" />
    </div>
  );
}
