"use client";

import React, { useRef, useState } from "react";
import { clsx } from "clsx";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(37, 99, 235, 0.08)",
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setPosition({
      x: e.clientX - rect.left
      ,y: e.clientY - rect.top
    });
    setOpacity(1);
  }

  function handleMouseLeave() {
    setOpacity(0);
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={clsx(
        "group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.02),0_4px_12px_0_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(15,23,42,0.08)]",
        className
      )}
      {...props}
    >
      {/* Spotlight Radial Background Glow */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300"
        style={{
          opacity,
          background: "radial-gradient(400px circle at " + position.x + "px " + position.y + "px, " + spotlightColor + ", transparent 70%)",
        }}
      />

      {/* Spotlight Border Glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl border border-[#2563EB]/30 opacity-0 transition-opacity duration-300"
        style={{
          opacity,
          maskImage: "radial-gradient(220px circle at " + position.x + "px " + position.y + "px, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(220px circle at " + position.x + "px " + position.y + "px, black 30%, transparent 80%)",
        }}
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}