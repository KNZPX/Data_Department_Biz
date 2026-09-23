"use client";

import React from "react";

interface BizAnalyticLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtext?: string;
}

export function BizAnalyticLogo({
  className = "",
  size = "md",
  showText = true,
  subtext = "Enterprise Analytics Portal",
}: BizAnalyticLogoProps) {
  const dimensions = {
    sm: { icon: "h-7 w-7", text: "text-sm", sub: "text-[9px]" },
    md: { icon: "h-9 w-9", text: "text-base", sub: "text-[10px]" },
    lg: { icon: "h-12 w-12", text: "text-xl", sub: "text-xs" },
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Modern Analytics Vector Icon: Ascending Growth Bars & Dynamic Trend Pulse */}
      <div
        className={`relative ${dimensions.icon} shrink-0 grid place-items-center rounded-2xl bg-gradient-to-br from-[#B45309] via-[#D97706] to-[#F59E0B] p-1.5 shadow-sm shadow-[#B45309]/25 ring-1 ring-[#B45309]/30`}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
          aria-label="Biz-Analytic Logo"
        >
          {/* Subtle grid backdrop */}
          <line x1="6" y1="28" x2="30" y2="28" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="6" y1="20" x2="30" y2="20" stroke="white" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="6" y1="12" x2="30" y2="12" stroke="white" strokeOpacity="0.15" strokeWidth="1" strokeDasharray="2 2" />

          {/* Bar 1 (Left - Small) */}
          <rect x="7" y="19" width="4.5" height="9" rx="1.5" fill="white" fillOpacity="0.75" />
          {/* Bar 2 (Mid-Left - Medium) */}
          <rect x="13.5" y="14" width="4.5" height="14" rx="1.5" fill="white" fillOpacity="0.9" />
          {/* Bar 3 (Mid-Right - High) */}
          <rect x="20" y="9" width="4.5" height="19" rx="1.5" fill="white" />
          {/* Bar 4 (Right - Peak with highlight) */}
          <rect x="26.5" y="6" width="4.5" height="22" rx="1.5" fill="white" />

          {/* Dynamic Trend Vector / Upward Pulse Line */}
          <path
            d="M8 20L15.5 13L21.5 17L29 7"
            stroke="#FEF3C7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Trendline Apex Spark Node */}
          <circle cx="29" cy="7" r="2.2" fill="#FEF3C7" />
          <circle cx="29" cy="7" r="1" fill="#B45309" />
        </svg>
      </div>

      {/* Brand Wordmark & Department Tag */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight text-slate-900 uppercase font-sans ${dimensions.text}`}
            >
              BIZ<span className="text-[#B45309]">-ANALYTIC</span>
            </span>
            <span className="rounded-full bg-[#B45309]/10 px-1.5 py-0.5 text-[8.5px] font-bold text-[#B45309] border border-[#B45309]/25 font-sans tracking-wide">
              BI HUB
            </span>
          </div>
          {subtext && (
            <span
              className={`mt-1 font-medium tracking-wide text-slate-500 font-sans ${dimensions.sub}`}
            >
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
