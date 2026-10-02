"use client";

import React, { useState, useMemo } from "react";
import { Copy, Check, Sparkles, FileCode, Maximize2, Minimize2, Eye, Code } from "lucide-react";
import { clsx } from "clsx";
import { formatDax, tokenizeDax, DaxToken } from "@/lib/daxFormatter";

interface DaxCodeViewerProps {
  code: string;
  className?: string;
  maxHeight?: string;
  showLineNumbers?: boolean;
  allowFormat?: boolean;
  defaultFormatted?: boolean;
  onCopy?: () => void;
  title?: string;
  /** "light" fits the white app; "dark" is the original editor look. */
  theme?: "dark" | "light";
  /** Hide the built-in copy button (when the page offers its own). */
  hideCopy?: boolean;
}

const TOKEN_TITLES: Record<string, string> = {
  function: "DAX function",
  keyword: "DAX keyword",
  measure: "Measure reference",
  table: "Table reference",
  column: "Column reference",
  operator: "Operator",
  number: "Number",
  string: "Text",
  comment: "Comment",
};

const THEMES = {
  dark: {
    box: "rounded-2xl bg-[#090d16] border border-slate-800 shadow-xl",
    bar: "bg-[#0e1626] border-b border-slate-800/80",
    title: "text-slate-300",
    legend: "border-slate-800 text-slate-400",
    btn: "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 hover:bg-slate-700",
    btnOn: "bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40",
    gutter: "text-slate-600 border-slate-800/80",
    raw: "text-emerald-400",
    empty: "bg-slate-900 border-slate-800 text-slate-500",
    tokens: {
      function: "text-sky-400 font-semibold",
      keyword: "text-indigo-400 font-semibold",
      measure: "text-amber-300 font-semibold bg-amber-400/15 px-1 rounded-xs ring-1 ring-amber-400/25",
      table: "text-emerald-400 font-medium",
      column: "text-teal-300 font-medium",
      operator: "text-rose-400 font-semibold px-0.5",
      number: "text-purple-300",
      string: "text-lime-300",
      comment: "text-slate-500 italic",
      punct: "text-slate-400",
      text: "text-slate-200",
    },
  },
  light: {
    box: "rounded-lg bg-slate-50 border border-slate-200",
    bar: "bg-white border-b border-slate-200",
    title: "text-slate-600",
    legend: "border-slate-200 text-slate-500",
    btn: "bg-white text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50",
    btnOn: "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100",
    gutter: "text-slate-400 border-slate-200",
    raw: "text-slate-800",
    empty: "bg-slate-50 border-slate-200 text-slate-400",
    tokens: {
      function: "text-blue-700 font-semibold",
      keyword: "text-violet-700 font-semibold",
      measure: "text-amber-800 font-semibold bg-amber-50 px-1 rounded-xs ring-1 ring-amber-200",
      table: "text-emerald-700 font-medium",
      column: "text-teal-700 font-medium",
      operator: "text-rose-600 font-semibold px-0.5",
      number: "text-purple-700",
      string: "text-green-700",
      comment: "text-slate-400 italic",
      punct: "text-slate-500",
      text: "text-slate-800",
    },
  },
} as const;

export const DaxCodeViewer: React.FC<DaxCodeViewerProps> = ({
  code,
  className,
  maxHeight = "max-h-72",
  showLineNumbers = true,
  allowFormat = true,
  defaultFormatted = true,
  onCopy,
  title = "DAX Expression",
  theme = "dark",
  hideCopy = false,
}) => {
  const [isFormatted, setIsFormatted] = useState(defaultFormatted);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"highlighted" | "raw">("highlighted");

  // Format code if enabled
  const displayCode = useMemo(() => {
    if (!code) return "";
    return isFormatted ? formatDax(code) : code;
  }, [code, isFormatted]);

  // Tokenize code for syntax highlighting
  const tokens = useMemo(() => {
    return tokenizeDax(displayCode);
  }, [displayCode]);

  // Calculate lines for line-number gutter
  const lines = useMemo(() => {
    return displayCode.split("\n");
  }, [displayCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy DAX:", e);
    }
  };

  const T = THEMES[theme];
  const renderToken = (token: DaxToken, index: number) => {
    const cls = T.tokens[token.type as keyof typeof T.tokens] ?? T.tokens.text;
    return (
      <span key={index} className={cls} title={TOKEN_TITLES[token.type]}>
        {token.value}
      </span>
    );
  };

  if (!code || !code.trim()) {
    return (
      <div className={clsx("p-3 rounded-xl border text-xs italic font-mono", T.empty)}>
        No DAX formula defined
      </div>
    );
  }

  return (
    <div
      className={clsx(
        T.box,
        "overflow-hidden flex flex-col font-mono text-xs transition-all",
        className
      )}
    >
      {/* Top Ribbon / Toolbox Bar */}
      <div className={clsx("flex items-center justify-between px-3 py-1.5 text-[11px]", T.bar)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-slate-400">
            <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span className={clsx("truncate font-semibold text-[11px]", T.title)} title={title}>
              {title}
            </span>
          </div>

          {/* Syntax Legend Pill Indicators (the light theme sits in narrow panels; hover a token instead) */}
          <div className={clsx("hidden shrink-0 items-center gap-2 pl-2 border-l text-[11px]", theme === "dark" && "xl:flex", T.legend)}>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span>Function</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Measure</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Table</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span>Operator</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-1.5 pl-2">
          {allowFormat && (
            <button
              type="button"
              onClick={() => setIsFormatted((prev) => !prev)}
              className={clsx(
                "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer",
                isFormatted ? T.btnOn : T.btn
              )}
              title={isFormatted ? "Showing indented programming format" : "Click to auto-indent & format DAX"}
            >
              <Sparkles className="h-2.5 w-2.5 text-blue-400" />
              <span>{isFormatted ? "Formatted" : "Format DAX"}</span>
            </button>
          )}

          {/* Toggle View Mode: Highlighted vs Plain Text */}
          <button
            type="button"
            onClick={() => setViewMode((prev) => (prev === "highlighted" ? "raw" : "highlighted"))}
            className={clsx("flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer", T.btn)}
            title="Toggle between highlighted code and plain raw text"
          >
            {viewMode === "highlighted" ? (
              <>
                <Code className="h-2.5 w-2.5" />
                <span>Raw</span>
              </>
            ) : (
              <>
                <Eye className="h-2.5 w-2.5" />
                <span>Colors</span>
              </>
            )}
          </button>

          {/* Expand/Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={clsx("p-1 rounded-lg transition cursor-pointer", T.btn)}
            title={isExpanded ? "Collapse height" : "Expand full height"}
          >
            {isExpanded ? <Minimize2 className="h-2.5 w-2.5" /> : <Maximize2 className="h-2.5 w-2.5" />}
          </button>

          {/* Copy Button */}
          {!hideCopy && <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] shadow-xs transition cursor-pointer active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-2.5 w-2.5 text-emerald-300" />
                <span className="text-emerald-200">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-2.5 w-2.5" />
                <span>Copy formula</span>
              </>
            )}
          </button>}
        </div>
      </div>

      {/* Code Container with Optional Line Numbers */}
      <div
        className={clsx(
          "overflow-auto p-3 flex relative scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent leading-relaxed",
          isExpanded ? "max-h-[80vh]" : maxHeight
        )}
      >
        {/* Line Numbers Gutter */}
        {showLineNumbers && (
          <div className={clsx("text-right pr-3 mr-3 border-r font-mono text-[11px] leading-relaxed shrink-0", T.gutter)}>
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}

        {/* Code Content */}
        <div className="flex-1 overflow-x-auto">
          {viewMode === "highlighted" ? (
            <pre className="whitespace-pre font-mono text-[11.5px] leading-relaxed">
              {tokens.map((token, i) => renderToken(token, i))}
            </pre>
          ) : (
            <pre className={clsx("whitespace-pre font-mono text-[11.5px] leading-relaxed", T.raw)}>
              {displayCode}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
