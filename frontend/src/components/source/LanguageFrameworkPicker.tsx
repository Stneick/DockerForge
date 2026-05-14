import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";
import { langLogo, fwLogo } from "@/lib/logos";
import { BrandLogo } from "@/components/BrandLogo";
import type { LanguageResponse, SupportedLanguage } from "@/types/api";

/**
 * Visual stack picker with real brand logos. Auto-detected language/framework
 * are pre-selected and flagged, but every card is selectable — detection is a
 * recommendation, not a lock-in.
 */
export function LanguageFrameworkPicker({
  languages,
  language,
  framework,
  detectedLanguage,
  detectedFramework,
  confidence,
  onChange,
}: {
  languages: LanguageResponse[];
  language: SupportedLanguage | null;
  framework: string | null;
  detectedLanguage?: SupportedLanguage | null;
  detectedFramework?: string | null;
  confidence?: number;
  onChange: (next: { language: SupportedLanguage | null; framework: string | null }) => void;
}) {
  const selectedLang = languages.find((l) => l.name === language) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <p className="label-mono mb-2.5">Language</p>
        <div className="flex flex-wrap gap-2.5">
          {languages.map((lang) => {
            const active = language === lang.name;
            const isDetected = detectedLanguage === lang.name;
            return (
              <button
                key={lang.name}
                type="button"
                onClick={() =>
                  onChange({
                    language: lang.name,
                    framework: lang.frameworks.some((f) => f.name === framework)
                      ? framework
                      : (lang.frameworks[0]?.name ?? null),
                  })
                }
                className={cn(
                  "group relative flex w-[100px] flex-col items-center gap-2.5 rounded-2xl border p-3 transition-all",
                  active
                    ? "border-cyan bg-cyan/[0.06] shadow-glow-sm"
                    : "border-line2 hover:-translate-y-0.5 hover:border-cyan-dim hover:bg-surface2",
                )}
              >
                {isDetected && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full border border-ok/50 bg-bg px-1.5 py-0.5 font-mono text-[9px] font-bold text-ok">
                    {confidence != null ? formatPercent(confidence) : "found"}
                  </span>
                )}
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-bg2 ring-1 ring-inset ring-line">
                  <BrandLogo file={langLogo(lang.name)} alt={lang.display_name} className="h-7 w-7" />
                </span>
                <span className={cn("text-xs font-semibold", active ? "text-cyan" : "text-text")}>
                  {lang.display_name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedLang && selectedLang.frameworks.length > 0 && (
        <div>
          <p className="label-mono mb-2.5">Framework</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {selectedLang.frameworks.map((fw) => {
              const active = framework === fw.name;
              const isDetected = detectedFramework === fw.name;
              return (
                <button
                  key={fw.name}
                  type="button"
                  onClick={() => onChange({ language: selectedLang.name, framework: fw.name })}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    active
                      ? "border-cyan bg-cyan/[0.06] shadow-glow-sm"
                      : "border-line2 hover:border-cyan-dim hover:bg-surface2",
                  )}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-bg2 ring-1 ring-inset ring-line">
                    <BrandLogo file={fwLogo(fw.name)} alt={fw.display_name} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-sm font-semibold", active ? "text-cyan" : "text-text")}>
                      {fw.display_name}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-2xs text-dim">
                      {fw.default_port != null && <span>:{fw.default_port}</span>}
                      {isDetected && <span className="text-ok">● detected</span>}
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-cyan" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
