"use client";

// Export the board (or what's selected) as a picture, like Excalidraw's
// "Export image": PNG or SVG, with or without the background, at 1–3×, or
// straight to the clipboard. Also saves a .excalidraw file.
import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCopy, Download, FileJson, Loader2, X } from "lucide-react";
import { clsx } from "clsx";
import type { Rect } from "./model";
import { ACTIVE_BTN, DIALOG } from "./ui";

type Scope = "all" | "selection";

export type ExportSource = {
  /** The board's world layer (everything drawn, in board units). */
  node: () => HTMLElement | null;
  all: Rect | null;
  selection: { ids: Set<string>; bounds: Rect } | null;
};

const PAD = 32;

/**
 * The fonts a board can use (the handwriting font, the app's font, mono), Thai
 * and Latin only, as data URLs so they work inside an exported picture. Fetched
 * once; without it the picture falls back to the computer's fonts.
 */
let fontCss: Promise<string> | null = null;
function boardFonts(): Promise<string> {
  if (!fontCss)
    fontCss = (async () => {
      const sans = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").split(",")[0].replace(/["']/g, "").trim() || "IBM Plex Sans Thai";
      const fam = (f: string, w?: string) => `family=${f.replace(/ /g, "+")}${w ? `:wght@${w}` : ""}`;
      const res = await fetch(`https://fonts.googleapis.com/css2?${fam("Sriracha")}&${fam(sans, "400;600;700")}&${fam("IBM Plex Mono", "400")}&display=block`);
      if (!res.ok) return "";
      const css = await res.text();
      const faces = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)].filter((m) => m[1] === "thai" || m[1] === "latin").map((m) => m[2]);
      const inlined = await Promise.all(
        faces.map(async (face) => {
          const url = /url\(([^)]+)\)/.exec(face)?.[1]?.replace(/["']/g, "");
          if (!url) return "";
          const blob = await fetch(url).then((r) => (r.ok ? r.blob() : null));
          if (!blob) return "";
          const data = await new Promise<string>((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = () => resolve("");
            fr.readAsDataURL(blob);
          });
          return data ? face.replace(url, data) : "";
        })
      );
      return inlined.filter(Boolean).join("\n");
    })().catch(() => "");
  return fontCss;
}

async function capture(src: ExportSource, scope: Scope, o: { scale: number; background: boolean; format: "png" | "svg" | "blob" }) {
  const { toBlob, toPng, toSvg } = await import("html-to-image");
  const node = src.node();
  const b = scope === "selection" && src.selection ? src.selection.bounds : src.all;
  if (!node || !b) throw new Error("Nothing to export");
  const keep = scope === "selection" && src.selection ? src.selection.ids : null;
  const fonts = await boardFonts();
  const opts = {
    // Only the board's own fonts (an empty string skips embedding the whole app's fonts).
    fontEmbedCSS: fonts,
    width: Math.ceil(b.w + PAD * 2),
    height: Math.ceil(b.h + PAD * 2),
    pixelRatio: o.scale,
    // Inside the canvas's dark filter, white comes out near-black.
    backgroundColor: o.background ? "#FFFFFF" : undefined,
    style: { transform: `translate(${PAD - b.x}px, ${PAD - b.y}px)`, transformOrigin: "0 0", left: "0px", top: "0px" },
    cacheBust: false,
    filter: (n: Node) => {
      if (!(n instanceof Element)) return true;
      if (n.hasAttribute("data-export-skip")) return false;
      const id = n.getAttribute("data-anim");
      return !(keep && id && !keep.has(id));
    },
  };
  if (o.format === "svg") return toSvg(node, opts);
  if (o.format === "png") return toPng(node, opts);
  return toBlob(node, opts);
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

export function ExportDialog({
  source,
  name,
  dark,
  onDark,
  onExcalidraw,
  onClose,
}: {
  source: ExportSource;
  name: string;
  dark: boolean;
  onDark: (on: boolean) => void;
  /** Save the same items as a .excalidraw file. */
  onExcalidraw: (scope: Scope) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<Scope>(source.selection ? "selection" : "all");
  const [background, setBackground] = useState(true);
  const [scale, setScale] = useState(2);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const file = name.replace(/[^\w\-ก-๙ ]+/g, "_").trim() || "board";
  const srcRef = useRef(source);
  useEffect(() => {
    srcRef.current = source;
  });

  // Preview at 1× whenever an option changes.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      capture(srcRef.current, scope, { scale: 1, background, format: "png" })
        .then((url) => {
          if (!alive) return;
          setPreview(url as string);
          setError(null);
        })
        .catch((e) => alive && setError(e instanceof Error ? e.message : "Couldn't draw the preview"));
    }, 120);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [scope, background, dark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(kind: "png" | "svg" | "copy") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "copy") {
        const blob = capture(source, scope, { scale, background, format: "blob" }).then((b) => {
          if (!(b instanceof Blob)) throw new Error("Couldn't make the picture");
          return b;
        });
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } else {
        const url = (await capture(source, scope, { scale, background, format: kind })) as string;
        download(url, `${file}.${kind}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const seg = (on: boolean) => clsx("h-8 rounded-md px-3 text-[13px] font-medium transition", on ? ACTIVE_BTN : "text-[#1C1C1E] hover:bg-[#F1F2F5]");

  return (
    <div data-ui className="fixed inset-0 z-[90] grid place-items-center bg-[#1C1C1E]/30 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="wb-export-title" className={clsx(DIALOG, "max-w-[860px]")}>
        <div className="flex items-center justify-between border-b border-[#E9EAEF] px-5 py-3.5">
          <h2 id="wb-export-title" className="text-[16px] font-semibold text-[#1C1C1E]">
            Export image
          </h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-[#656B81] hover:bg-[#F1F2F5]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div
            className="grid min-h-[260px] place-items-center overflow-hidden rounded-lg border border-[#E9EAEF] p-3"
            style={{ backgroundImage: "conic-gradient(#F1F2F5 25%, #fff 0 50%, #F1F2F5 0 75%, #fff 0)", backgroundSize: "16px 16px" }}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a generated data URL
              <img src={preview} alt="Export preview" className="max-h-[52vh] max-w-full object-contain shadow-sm" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-[#4262FF]" />
            )}
          </div>
          <div className="space-y-4 text-[13px]">
            <div>
              <p className="mb-1.5 font-semibold text-[#656B81]">What</p>
              <div className="flex gap-1 rounded-lg bg-[#F5F6F8] p-1">
                <button type="button" className={seg(scope === "all")} onClick={() => setScope("all")}>
                  Whole board
                </button>
                <button type="button" disabled={!source.selection} className={clsx(seg(scope === "selection"), !source.selection && "opacity-40")} onClick={() => setScope("selection")}>
                  Selection
                </button>
              </div>
            </div>
            <label className="flex items-center justify-between gap-2">
              <span className="font-medium text-[#1C1C1E]">Background</span>
              <Switch on={background} onChange={setBackground} />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="font-medium text-[#1C1C1E]">
                Dark <span className="font-normal text-[#9A9DAA]">(also switches the board)</span>
              </span>
              <Switch on={dark} onChange={onDark} />
            </label>
            <div>
              <p className="mb-1.5 font-semibold text-[#656B81]">Scale</p>
              <div className="flex gap-1 rounded-lg bg-[#F5F6F8] p-1">
                {[1, 2, 3].map((s) => (
                  <button key={s} type="button" className={seg(scale === s)} onClick={() => setScale(s)}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="rounded-md bg-[#FFF0EE] px-2.5 py-2 text-[12.5px] text-[#C22B12]">{error}</p>}
            <div className="grid gap-1.5 pt-1">
              <button type="button" onClick={() => void run("png")} disabled={!!busy} className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[#4262FF] font-semibold text-white hover:bg-[#3550E6] disabled:opacity-60">
                {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PNG
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => void run("svg")} disabled={!!busy} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E0E2E8] font-medium hover:bg-[#F5F6F8] disabled:opacity-60">
                  {busy === "svg" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} SVG
                </button>
                <button type="button" onClick={() => void run("copy")} disabled={!!busy} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E0E2E8] font-medium hover:bg-[#F5F6F8] disabled:opacity-60">
                  {busy === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : copied ? <Check className="h-4 w-4 text-[#0CA789]" /> : <ClipboardCopy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button type="button" onClick={() => onExcalidraw(scope)} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E0E2E8] font-medium hover:bg-[#F5F6F8]">
                <FileJson className="h-4 w-4" /> Save as .excalidraw
              </button>
              <p className="text-[11.5px] leading-snug text-[#9A9DAA]">.excalidraw opens on excalidraw.com, and can be opened back here from the board menu.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={clsx("relative h-5 w-9 shrink-0 rounded-full transition-colors", on ? "bg-[#4262FF]" : "bg-[#C3C6D4]")}
    >
      <span className={clsx("absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}
