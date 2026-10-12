"use client";

import { useMemo, useState } from "react";
import type { AppConfig, LoadedConfig } from "@/lib/types";

type ListKey = keyof AppConfig;

const SECTIONS: {
  key: ListKey;
  title: string;
  help: string;
  placeholder: string;
  suggestions: string[];
}[] = [
  {
    key: "targetSectors",
    title: "Focus sectors",
    help: "Deals in these sectors rank first. Each sector also gets its own news search.",
    placeholder: "Add a sector, e.g. Healthtech",
    suggestions: ["Fintech", "Climate", "SaaS", "AI", "Healthtech", "D2C", "Edtech", "Deeptech", "Mobility", "Agritech"],
  },
  {
    key: "targetStages",
    title: "Focus stages",
    help: "Rounds at these stages rank first.",
    placeholder: "Add a stage, e.g. Series B",
    suggestions: ["Pre-seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Debt"],
  },
  {
    key: "watchlist",
    title: "Watchlist companies",
    help: "Any announcement involving these companies is flagged at the top of the brief.",
    placeholder: "Add a company, e.g. Zepto",
    suggestions: [],
  },
];

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; source: LoadedConfig["source"] }
  | { kind: "error"; message: string };

const same = (a: AppConfig, b: AppConfig) => JSON.stringify(a) === JSON.stringify(b);

export default function ConfigEditor({ initial }: { initial: LoadedConfig }) {
  const [saved, setSaved] = useState<AppConfig>(initial.config);
  const [draft, setDraft] = useState<AppConfig>(initial.config);
  const [source, setSource] = useState(initial.source);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const dirty = useMemo(() => !same(saved, draft), [saved, draft]);

  function add(key: ListKey, raw: string) {
    // Allow pasting a comma-separated list.
    const values = raw.split(",").map((v) => v.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (!values.length) return;
    setDraft((d) => {
      const existing = new Set(d[key].map((v) => v.toLowerCase()));
      const next = [...d[key]];
      for (const v of values) {
        if (!existing.has(v.toLowerCase())) {
          existing.add(v.toLowerCase());
          next.push(v.slice(0, 60));
        }
      }
      return { ...d, [key]: next };
    });
    setStatus({ kind: "idle" });
  }

  function remove(key: ListKey, value: string) {
    setDraft((d) => ({ ...d, [key]: d[key].filter((v) => v !== value) }));
    setStatus({ kind: "idle" });
  }

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      setSaved(data.config);
      setDraft(data.config);
      setSource(data.source);
      setStatus({ kind: "saved", source: data.source });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Save failed." });
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            source === "supabase" ? "bg-good-soft text-good" : "bg-warn-soft text-warn"
          }`}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {source === "supabase" ? "Saved in database" : "Using local config file"}
        </span>
        {initial.warning && <span className="text-warn">{initial.warning}</span>}
      </div>

      {SECTIONS.map((s) => (
        <ListCard
          key={s.key}
          title={s.title}
          help={s.help}
          placeholder={s.placeholder}
          items={draft[s.key]}
          suggestions={s.suggestions.filter(
            (sug) => !draft[s.key].some((v) => v.toLowerCase() === sug.toLowerCase())
          )}
          onAdd={(v) => add(s.key, v)}
          onRemove={(v) => remove(s.key, v)}
        />
      ))}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-lg shadow-black/5">
        <p className="text-sm" role="status" aria-live="polite">
          {status.kind === "saving" && <span className="text-muted">Saving…</span>}
          {status.kind === "saved" && <span className="text-good">Saved. The next refresh will use these settings.</span>}
          {status.kind === "error" && <span className="text-bad">{status.message}</span>}
          {status.kind === "idle" && (
            <span className="text-muted">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
          )}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setDraft(saved);
                setStatus({ kind: "idle" });
              }}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || status.kind === "saving"}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#0e1014]"
          >
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}

function ListCard({
  title,
  help,
  placeholder,
  items,
  suggestions,
  onAdd,
  onRemove,
}: {
  title: string;
  help: string;
  placeholder: string;
  items: string[];
  suggestions: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [input, setInput] = useState("");
  const inputId = `add-${title.toLowerCase().replace(/\s+/g, "-")}`;

  function submit() {
    onAdd(input);
    setInput("");
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs tabular-nums text-faint">{items.length}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{help}</p>

      <ul className="mt-4 flex min-h-9 flex-wrap gap-2">
        {items.length === 0 && (
          <li className="py-1.5 text-sm italic text-faint">None yet — add one below.</li>
        )}
        {items.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm"
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item}`}
              className="grid h-5 w-5 place-items-center rounded-full text-faint hover:bg-line hover:text-ink"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {placeholder}
        </label>
        <input
          id={inputId}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-surface-2 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-faint">Quick add:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onAdd(s)}
              className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
