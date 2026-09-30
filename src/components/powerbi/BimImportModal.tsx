"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, FileJson2, Loader2, Minus, PencilLine, Plus, Upload, X } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui";
import { guessModelCode, parseBim, sha256Hex, type BimItem, type ParsedBim } from "@/lib/bimModel";

type Fingerprint = { id: string; item_type: string; table_name: string; name: string; exp_hash: string };
type Diff = {
  created: BimItem[];
  changed: BimItem[];
  unchanged: number;
  removed: Fingerprint[];
};
type Stage = "pick" | "parsing" | "review" | "saving" | "done" | "error";

const KNOWN_MODELS = [
  { code: "PKT-D01", name: "PKT-D01 Strategy Semantic Model" },
  { code: "PKT-D02", name: "PKT-D02 Cost Semantic Model" },
];
const BATCH = 300;

function legacyOf(id: string) {
  const i = id.indexOf("~");
  return i === -1 ? null : id.slice(0, i);
}

async function computeDiff(parsed: ParsedBim, fps: Fingerprint[]): Promise<Diff> {
  const byId = new Map(fps.map((f) => [f.id, f]));
  const matched = new Set<string>();
  const created: BimItem[] = [];
  const changed: BimItem[] = [];
  let unchanged = 0;
  for (const it of parsed.items) {
    const legacy = legacyOf(it.id);
    const legacyFp = legacy ? byId.get(legacy) : undefined;
    const prev = byId.get(it.id) || (legacyFp && legacyFp.name === it.name ? legacyFp : undefined);
    if (!prev) {
      created.push(it);
      continue;
    }
    matched.add(prev.id);
    const hash = await sha256Hex(it.expression || "");
    if (hash === prev.exp_hash) unchanged++;
    else changed.push(it);
  }
  const removed = fps.filter((f) => !matched.has(f.id));
  return { created, changed, unchanged, removed };
}

export function BimImportModal({
  open,
  onClose,
  onImported,
  defaultModel,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  defaultModel?: string;
}) {
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [rawText, setRawText] = useState<string | null>(null);
  const [modelCode, setModelCode] = useState(defaultModel && defaultModel !== "ALL" ? defaultModel : "PKT-D01");
  const [parsed, setParsed] = useState<ParsedBim | null>(null);
  const [diff, setDiff] = useState<Diff | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ changed: number; created: number; removed: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [tab, setTab] = useState<"changed" | "created" | "removed">("changed");
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage("pick");
    setFileName("");
    setRawText(null);
    setParsed(null);
    setDiff(null);
    setProgress(0);
    setError(null);
    setSummary(null);
  }, []);

  const analyse = useCallback(async (text: string, code: string, name: string) => {
    setStage("parsing");
    setError(null);
    try {
      // Let the spinner paint before the heavy JSON.parse.
      await new Promise((r) => setTimeout(r, 30));
      const modelName = KNOWN_MODELS.find((m) => m.code === code)?.name || code;
      const p = parseBim(text, code, modelName);
      const res = await fetch(`/api/dax/import?model=${encodeURIComponent(code)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load the current model from the database.");
      if (json.model?.name) p.modelName = json.model.name;
      const d = await computeDiff(p, json.fingerprints || []);
      setParsed(p);
      setDiff(d);
      setFileName(name);
      setTab(d.changed.length ? "changed" : d.created.length ? "created" : "removed");
      setStage("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }, []);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".bim") && !file.name.toLowerCase().endsWith(".json")) {
      setError("Choose a .bim file (Tabular model definition).");
      setStage("error");
      return;
    }
    const text = await file.text();
    const guessed = guessModelCode(file.name);
    const code = guessed || modelCode;
    setModelCode(code);
    setRawText(text);
    await analyse(text, code, file.name);
  }

  async function commit() {
    if (!parsed || !diff) return;
    setStage("saving");
    setProgress(0);
    const post = async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/dax/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelCode: parsed.modelCode, modelName: parsed.modelName, ...payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Import step failed (${res.status})`);
      return json;
    };
    let importId = "";
    try {
      ({ importId } = await post({ action: "start", fileName }));
      await post({ action: "structure", importId, tables: parsed.tables, relationships: parsed.relationships });
      const totals = { created: 0, changed: 0, unchanged: 0 };
      const steps = Math.ceil(parsed.items.length / BATCH);
      for (let i = 0; i < steps; i++) {
        const r = await post({ action: "items", importId, items: parsed.items.slice(i * BATCH, (i + 1) * BATCH) });
        totals.created += r.created;
        totals.changed += r.changed;
        totals.unchanged += r.unchanged;
        setProgress(Math.round(((i + 1) / steps) * 95));
      }
      const { summary: s } = await post({
        action: "finalize",
        importId,
        fileName,
        compatibilityLevel: parsed.compatibilityLevel,
        stats: parsed.stats,
        counts: totals,
      });
      setProgress(100);
      setSummary({ changed: s.changed, created: s.created, removed: s.removed });
      setStage("done");
      onImported();
    } catch (e) {
      if (importId) void post({ action: "fail", importId, message: e instanceof Error ? e.message : String(e) }).catch(() => {});
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }

  const list = useMemo(() => {
    if (!diff) return [];
    if (tab === "changed") return diff.changed.map((i) => ({ key: i.id, table: i.tableName, name: i.name, type: i.itemType }));
    if (tab === "created") return diff.created.map((i) => ({ key: i.id, table: i.tableName, name: i.name, type: i.itemType }));
    return diff.removed.map((f) => ({ key: f.id, table: f.table_name, name: f.name, type: f.item_type }));
  }, [diff, tab]);

  if (!open) return null;

  const close = () => {
    if (stage === "saving") return;
    reset();
    onClose();
  };

  return (
    <Modal className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bim-import-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="bim-import-title" className="text-lg font-semibold text-slate-900">
              Update model from .bim
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Formulas and columns are replaced by the file. Definitions and notes your team wrote are kept.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={stage === "saving"}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {(stage === "pick" || stage === "error") && (
            <>
              <label className="mb-4 flex items-center gap-3 text-sm text-slate-700">
                <span className="shrink-0">Model</span>
                <select
                  value={modelCode}
                  onChange={(e) => setModelCode(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {KNOWN_MODELS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-400">Detected from the file name when possible</span>
              </label>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleFile(f);
                }}
                className={clsx(
                  "flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
                  dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
                )}
              >
                <Upload className="h-7 w-7 text-blue-600" />
                <span className="text-[15px] font-medium text-slate-900">Drop a .bim file or click to choose</span>
                <span className="text-sm text-slate-500">Exported from Tabular Editor or Power BI (up to ~50 MB)</span>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".bim,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = "";
                }}
              />
              {stage === "error" && error && (
                <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-coral/30 bg-coral/[0.06] p-4 text-sm">
                  <AlertCircle className="h-5 w-5 shrink-0 text-coral" />
                  <div>
                    <p className="font-medium text-slate-900">Nothing was saved</p>
                    <p className="mt-1 text-slate-600">{error}</p>
                    {rawText && (
                      <button
                        type="button"
                        className="mt-2 text-sm font-medium text-blue-600 hover:underline"
                        onClick={() => void analyse(rawText, modelCode, fileName || "model.bim")}
                      >
                        Try again as {modelCode}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {stage === "parsing" && (
            <div className="flex items-center gap-3 py-16 justify-center text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              Reading the model and comparing it with what&rsquo;s saved
            </div>
          )}

          {stage === "review" && parsed && diff && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <FileJson2 className="h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{fileName}</p>
                  <p className="text-xs text-slate-500">
                    {parsed.stats.tables} tables, {parsed.stats.measures} measures, {parsed.stats.columns} columns,{" "}
                    {parsed.stats.relationships} relationships
                  </p>
                </div>
                <select
                  value={modelCode}
                  onChange={(e) => {
                    setModelCode(e.target.value);
                    if (rawText) void analyse(rawText, e.target.value, fileName);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  aria-label="Target model"
                >
                  {KNOWN_MODELS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3" role="tablist">
                {(
                  [
                    ["changed", "Formula changed", diff.changed.length, PencilLine, "text-amber-700"],
                    ["created", "New", diff.created.length, Plus, "text-teal-live"],
                    ["removed", "Removed from model", diff.removed.length, Minus, "text-coral"],
                  ] as const
                ).map(([key, label, count, Icon, tone]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={clsx(
                      "rounded-xl p-3 text-left ring-1 transition",
                      tab === key ? "bg-white ring-blue-400" : "bg-white ring-slate-200 hover:ring-slate-300"
                    )}
                  >
                    <span className={clsx("flex items-center gap-1.5 text-xs", tone)}>
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                    <span className="mt-1 block text-2xl font-semibold tabular-nums text-slate-900">{count}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl ring-1 ring-slate-200">
                <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                  {list.length === 0 && <li className="p-4 text-sm text-slate-400">None.</li>}
                  {list.slice(0, 400).map((row) => (
                    <li key={row.key} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="text-slate-400">{row.table}</span>
                        <span className="text-slate-300"> / </span>
                        <span className="font-mono text-[13px] text-slate-900">{row.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{row.type}</span>
                    </li>
                  ))}
                  {list.length > 400 && <li className="p-3 text-xs text-slate-400">and {list.length - 400} more</li>}
                </ul>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                {diff.unchanged.toLocaleString()} items are identical and will only be re-stamped. Removed items are hidden,
                not deleted — they come back if a later file includes them again. Every formula change is written to the
                activity log with your name.
              </p>
            </div>
          )}

          {stage === "saving" && (
            <div className="py-12">
              <p className="text-sm text-slate-700">Saving to the database…</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">{progress}% — keep this window open</p>
            </div>
          )}

          {stage === "done" && summary && (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-teal-live" />
              <p className="mt-3 text-lg font-semibold text-slate-900">{parsed?.modelCode} is up to date</p>
              <p className="mt-1 text-sm text-slate-500">
                {summary.changed} formulas changed, {summary.created} new, {summary.removed} removed.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {stage === "review" && (
            <>
              <button type="button" onClick={reset} className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                Choose another file
              </button>
              <button
                type="button"
                onClick={() => void commit()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Update {parsed?.modelCode}
              </button>
            </>
          )}
          {stage === "done" && (
            <button type="button" onClick={close} className="rounded-xl bg-ink px-5 py-2 text-sm font-medium text-white">
              Done
            </button>
          )}
          {(stage === "pick" || stage === "error") && (
            <button type="button" onClick={close} className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
