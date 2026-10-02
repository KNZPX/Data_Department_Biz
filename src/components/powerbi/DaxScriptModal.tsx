"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Loader2, X } from "lucide-react";
import { clsx } from "clsx";
import { Modal } from "@/components/ui";

type Item = { id: string; name: string; tableName: string; expression: string | null; formatString?: string | null; type: string; modelCode: string };
type Format = "tmdl" | "daxquery" | "tabular";

const FORMATS: { id: Format; label: string; where: string; steps: string[]; ext: string }[] = [
  {
    id: "tmdl",
    label: "TMDL script",
    where: "Power BI Desktop, TMDL view",
    ext: "tmdl",
    steps: ["Open the .pbix / .pbip in Power BI Desktop", "Go to TMDL view (left rail)", "Paste the script and press Apply"],
  },
  {
    id: "daxquery",
    label: "DAX query",
    where: "Power BI Desktop, DAX query view",
    ext: "dax",
    steps: ["Go to DAX query view", "Paste the query and run it", "Click “Update model with changes” above DEFINE"],
  },
  {
    id: "tabular",
    label: "Tabular Editor",
    where: "Tabular Editor 2 or 3, C# script",
    ext: "csx",
    steps: ["Connect Tabular Editor to the model", "Open a new C# script and paste", "Run, then save changes to the model"],
  },
];

const tmdlName = (s: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s) ? s : `'${s.replace(/'/g, "''")}'`);
const daxTable = (s: string) => `'${s.replace(/'/g, "''")}'`;
const daxMeasure = (s: string) => `[${s.replace(/]/g, "]]")}]`;
const csString = (s: string) => `@"${s.replace(/"/g, '""')}"`;
const indent = (text: string, tabs: number) => text.split("\n").map((l) => "\t".repeat(tabs) + l).join("\n");

export function buildScript(format: Format, items: Item[], folder: string): string {
  const byTable = new Map<string, Item[]>();
  for (const it of items) byTable.set(it.tableName, [...(byTable.get(it.tableName) || []), it]);

  if (format === "tmdl") {
    const blocks = Array.from(byTable.entries()).map(([table, list]) => {
      const measures = list
        .map((m) => {
          const lines = [`\t\tmeasure ${tmdlName(m.name)} = \`\`\``, indent(m.expression || "BLANK()", 4), "\t\t\t\t```"];
          if (m.formatString) lines.push(`\t\t\tformatString: ${m.formatString}`);
          if (folder.trim()) lines.push(`\t\t\tdisplayFolder: ${folder.trim()}`);
          return lines.join("\n");
        })
        .join("\n\n");
      return `\tref table ${tmdlName(table)}\n\n${measures}`;
    });
    return `createOrReplace\n\n${blocks.join("\n\n")}\n`;
  }

  if (format === "daxquery") {
    const defs = items
      .map((m) => `\tMEASURE ${daxTable(m.tableName)}${daxMeasure(m.name)} =\n${indent(m.expression || "BLANK()", 2)}`)
      .join("\n\n");
    const cols = items.map((m) => `\t"${m.name.replace(/"/g, '""')}", ${daxMeasure(m.name)}`).join(",\n");
    return `DEFINE\n${defs}\n\nEVALUATE\nROW(\n${cols}\n)\n`;
  }

  const lines = items.map(
    (m) =>
      `{\n    var t = Model.Tables[${csString(m.tableName)}];\n    var m = t.Measures.Contains(${csString(m.name)}) ? t.Measures[${csString(m.name)}] : t.AddMeasure(${csString(m.name)});\n    m.Expression = ${csString(m.expression || "BLANK()")};${
        m.formatString ? `\n    m.FormatString = ${csString(m.formatString)};` : ""
      }${folder.trim() ? `\n    m.DisplayFolder = ${csString(folder.trim())};` : ""}\n}`
  );
  return `// Adds or updates ${items.length} measure(s)\n${lines.join("\n")}\nInfo("Done: ${items.length} measure(s).");\n`;
}

export function DaxScriptModal({ model, onClose }: { model: string; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Format>("tmdl");
  const [folder, setFolder] = useState("Custom measures");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/powerbi/dax?model=${encodeURIComponent(model)}&type=custom&limit=1000`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      const list = ((json.items || []) as Item[]).filter((i) => i.expression);
      setItems(list);
      setChecked(new Set(list.map((i) => i.id)));
      setLoading(false);
    })();
  }, [model]);

  const shown = items.filter((i) => !q.trim() || `${i.name} ${i.tableName}`.toLowerCase().includes(q.toLowerCase()));
  const selected = useMemo(() => items.filter((i) => checked.has(i.id)), [items, checked]);
  const script = useMemo(() => (selected.length ? buildScript(format, selected, folder) : ""), [format, selected, folder]);
  const fmt = FORMATS.find((f) => f.id === format)!;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function download() {
    const blob = new Blob([script], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `add_${selected.length}_measures.${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Modal className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="gen-title" className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="gen-title" className="text-lg font-semibold text-slate-900">Add measures to Power BI in one go</h2>
            <p className="text-sm text-slate-500">
              Tick the team-written measures, pick where you&rsquo;ll run it, and paste. Power Query (M) can&rsquo;t create measures — these three can.
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[360px_1fr]">
          {/* Picker */}
          <div className="flex min-h-0 flex-col border-r border-slate-100">
            <div className="space-y-2 p-4">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter measures" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {selected.length} of {items.length} selected
                </span>
                <span className="flex gap-3">
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => setChecked(new Set(items.map((i) => i.id)))}>
                    All
                  </button>
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => setChecked(new Set())}>
                    None
                  </button>
                </span>
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {loading && (
                <li className="p-6 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
                </li>
              )}
              {!loading && items.length === 0 && <li className="p-6 text-sm text-slate-500">No team-written measures in this model yet. Add one with “Add Custom DAX”.</li>}
              {shown.map((i) => (
                <li key={i.id}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <input type="checkbox" checked={checked.has(i.id)} onChange={() => toggle(i.id)} className="mt-0.5 h-4 w-4 accent-blue-600" />
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[13px] text-slate-900">{i.name}</span>
                      <span className="block truncate text-xs text-slate-500">{i.tableName}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {/* Output */}
          <div className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={clsx("rounded-lg px-3 py-1.5 text-sm", format === f.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}
                >
                  {f.label}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                Display folder
                <input value={folder} onChange={(e) => setFolder(e.target.value)} className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs" />
              </label>
            </div>
            <div className="flex items-start gap-4 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="shrink-0 font-medium text-slate-800">{fmt.where}</span>
              <ol className="flex flex-wrap gap-x-4 gap-y-1">
                {fmt.steps.map((s, i) => (
                  <li key={s}>
                    {i + 1}. {s}
                  </li>
                ))}
              </ol>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto bg-[#0B1322] p-4 font-mono text-[12.5px] leading-relaxed text-slate-100 select-text">
              {script || "-- Tick at least one measure"}
            </pre>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button type="button" disabled={!script} onClick={download} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                <Download className="h-4 w-4" /> Download .{fmt.ext}
              </button>
              <button
                type="button"
                disabled={!script}
                onClick={() => {
                  void navigator.clipboard.writeText(script);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : `Copy script (${selected.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
