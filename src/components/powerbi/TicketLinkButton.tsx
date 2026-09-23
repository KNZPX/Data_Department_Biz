"use client";

import { clsx } from "clsx";
import { ExternalLink, Ticket } from "lucide-react";

export function TicketLinkButton({
  url,
  title = "Open report on Power BI",
  dense = false,
  className,
}: {
  url: string;
  title?: string;
  dense?: boolean;
  className?: string;
}) {
  if (!url) return null;

  return (
    <div
      className={clsx(
        "relative flex self-stretch shrink-0 select-none",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <span
        aria-hidden="true"
        className="absolute -top-[6px] -left-[5px] h-2.5 w-2.5 rounded-full bg-slate-100 border border-slate-300 z-20 pointer-events-none"
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-[6px] -left-[5px] h-2.5 w-2.5 rounded-full bg-slate-100 border border-slate-300 z-20 pointer-events-none"
      />

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={title}
        className={clsx(
          "group flex h-full w-full min-w-[64px] flex-col items-center justify-center border-l border-dashed border-[#B45309]/25 bg-[#B45309]/5 text-[#B45309] transition duration-150 hover:bg-[#B45309]/10 active:scale-[0.98]",
          dense ? "px-2 py-1 gap-0.5 text-[10px]" : "px-3 py-1.5 gap-1"
        )}
      >
        <div className="flex items-center gap-1">
          <Ticket className="h-3.5 w-3.5 text-[#B45309] transition-transform group-hover:rotate-12" />
          <span className="font-mono text-[9px] font-black uppercase tracking-wider text-[#D97706]">
            BI
          </span>
        </div>
        <div className="flex items-center gap-0.5 font-bold text-[10px] leading-none text-[#B45309]">
          <span>OPEN</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-70 group-hover:opacity-100" />
        </div>
      </a>
    </div>
  );
}
