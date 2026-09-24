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
}

export const DaxCodeViewer: React.FC<DaxCodeViewerProps> = ({
  code,
  className,
  maxHeight = "max-h-72",
  showLineNumbers = true,
  allowFormat = true,
  defaultFormatted = true,
  onCopy,
  title = "DAX Expression",
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

  const renderToken = (token: DaxToken, index: number) => {
    switch (token.type) {
      case "function":
        return (
          <span key={index} className="text-sky-400 font-bold" title="DAX Function">
            {token.value}
          </span>
        );
      case "keyword":
        return (
          <span key={index} className="text-indigo-400 font-extrabold uppercase tracking-wide" title="DAX Keyword">
            {token.value}
          </span>
        );
      case "measure":
        return (
          <span
            key={index}
            className="text-amber-300 font-semibold bg-amber-400/15 px-1 py-0.2 rounded-xs ring-1 ring-amber-400/25 shadow-xs"
            title="Measure Reference"
          >
            {token.value}
          </span>
        );
      case "table":
        return (
          <span key={index} className="text-emerald-400 font-medium" title="Table Reference">
            {token.value}
          </span>
        );
      case "column":
        return (
          <span key={index} className="text-teal-300 font-medium" title="Column Reference">
            {token.value}
          </span>
        );
      case "operator":
        return (
          <span key={index} className="text-rose-400 font-bold px-0.5" title="Operator">
            {token.value}
          </span>
        );
      case "number":
        return (
          <span key={index} className="text-purple-300 font-mono font-medium" title="Numeric Literal">
            {token.value}
          </span>
        );
      case "string":
        return (
          <span key={index} className="text-lime-300 font-mono" title="String Literal">
            {token.value}
          </span>
        );
      case "comment":
        return (
          <span key={index} className="text-slate-500 italic font-mono" title="Comment">
            {token.value}
          </span>
        );
      case "punct":
        return (
          <span key={index} className="text-slate-400">
            {token.value}
          </span>
        );
      default:
        return (
          <span key={index} className="text-slate-200">
            {token.value}
          </span>
        );
    }
  };

  if (!code || !code.trim()) {
    return (
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs italic font-mono">
        No DAX formula defined
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-2xl bg-[#090d16] border border-slate-800 shadow-xl overflow-hidden flex flex-col font-mono text-xs transition-all",
        className
      )}
    >
      {/* Top Ribbon / Toolbox Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e1626] border-b border-slate-800/80 text-[11px] select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <FileCode className="h-3.5 w-3.5 text-blue-400" />
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
              {title}
            </span>
          </div>

          {/* Syntax Legend Pill Indicators */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800 text-[9px] text-slate-400">
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
        <div className="flex items-center gap-1.5">
          {allowFormat && (
            <button
              type="button"
              onClick={() => setIsFormatted((prev) => !prev)}
              className={clsx(
                "flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer",
                isFormatted
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/40"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
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
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-[10px] font-medium transition cursor-pointer"
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
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition cursor-pointer"
            title={isExpanded ? "Collapse height" : "Expand full height"}
          >
            {isExpanded ? <Minimize2 className="h-2.5 w-2.5" /> : <Maximize2 className="h-2.5 w-2.5" />}
          </button>

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] shadow-xs transition cursor-pointer active:scale-95"
          >
            {copied ? (
              <>
                <Check className="h-2.5 w-2.5 text-emerald-300" />
                <span className="text-emerald-200">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-2.5 w-2.5" />
                <span>Copy</span>
              </>
            )}
          </button>
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
          <div className="select-none text-slate-600 text-right pr-3 mr-3 border-r border-slate-800/80 font-mono text-[11px] leading-relaxed shrink-0">
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
            <pre className="whitespace-pre font-mono text-[11.5px] text-emerald-400 leading-relaxed">
              {displayCode}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
