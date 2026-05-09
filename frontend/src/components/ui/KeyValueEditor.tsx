import { Plus, Trash2 } from "lucide-react";

import { Button } from "./Button";
import { Input } from "./Input";
import type { EnvVar } from "@/types/api";

/** Editable list of key/value pairs (env vars, build args). */
export function KeyValueEditor({
  value,
  onChange,
  keyPlaceholder = "KEY",
  valuePlaceholder = "value",
  addLabel = "Add variable",
}: {
  value: EnvVar[];
  onChange: (next: EnvVar[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}) {
  const update = (i: number, patch: Partial<EnvVar>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { key: "", value: "" }]);

  return (
    <div className="space-y-2">
      {value.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            mono
            value={row.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className="flex-1"
          />
          <span className="text-dim">=</span>
          <Input
            mono
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-dim transition-colors hover:bg-fail/10 hover:text-fail"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
