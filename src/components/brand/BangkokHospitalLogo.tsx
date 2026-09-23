import React from "react";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtext?: string;
}

export function BangkokHospitalLogo({
  className = "",
  size = "md",
  showText = true,
  subtext = "Enterprise Analytics Portal",
}: LogoProps) {
  const iconSize = size === "sm" ? 28 : size === "lg" ? 44 : 36;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Bangkok Hospital Official Dual-Tone Emblem */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
        aria-label="Bangkok Hospital Logo"
      >
        {/* Left Navy Wing/Bracket (#002D72) */}
        <path
          d="M8 12C8 9.79086 9.79086 8 12 8H18V18H14V30H18V40H12C9.79086 40 8 38.2091 8 36V12Z"
          fill="#002D72"
        />
        {/* Right Navy Wing/Bracket (#002D72) */}
        <path
          d="M40 12C40 9.79086 38.2091 8 36 8H30V18H34V30H30V40H36C38.2091 40 40 38.2091 40 36V12Z"
          fill="#002D72"
        />
        {/* Center Crimson Medical Cross (#AB2328) */}
        <path
          d="M21 11C21 9.89543 21.8954 9 23 9H25C26.1046 9 27 9.89543 27 11V21H37C38.1046 21 39 21.8954 39 23V25C39 26.1046 38.1046 27 37 27H27V37C27 38.1046 26.1046 39 25 39H23C21.8954 39 21 38.1046 21 37V27H11C9.89543 27 9 26.1046 9 25V23C9 21.8954 9.89543 21 11 21H21V11Z"
          fill="#AB2328"
        />
      </svg>

      {/* Typography: Bangkok Hospital Brand Wordmark */}
      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black tracking-tight text-[#002D72] uppercase ${
                size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-base"
              }`}
            >
              BANGKOK HOSPITAL
            </span>
            <span className="rounded-full bg-[#AB2328]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#AB2328] border border-[#AB2328]/20 font-sans tracking-wide">
              BDMS
            </span>
          </div>
          {subtext && (
            <span
              className={`font-medium tracking-wide text-slate-500 mt-0.5 ${
                size === "sm" ? "text-[9px]" : "text-[10px]"
              }`}
            >
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
