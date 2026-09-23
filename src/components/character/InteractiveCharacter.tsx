"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ============================================================================
 * INTERACTIVE MOUSE TRACKING CHARACTER (3D CHIBI)
 * ============================================================================
 * Component สำหรับแสดงตัวละคร 3D Cute Chibi ที่ขยับใบหน้าและกลอกสายตามองตาม
 * เคอร์เซอร์เมาส์ / การสัมผัสหน้าจอแบบเรียลไทม์ ด้วย Math & Physics LERP
 */

// ============================================================================
// CONFIGURATION: จุดปรับตั้งค่า Sensitivity & Physics Parameters
// ============================================================================
export const CHARACTER_CONFIG = {
  // 1. ความเอียงใบหน้า 3D (3D Head Tilt Limits ในหน่วยองศา - deg)
  MAX_TILT_X: 16, // ความเอียงสูงสุดเมื่อก้ม/เงยหน้า (แนะนำ: 12 - 20 องศา)
  MAX_TILT_Y: 22, // ความเอียงสูงสุดเมื่อหันซ้าย/ขวา (แนะนำ: 15 - 26 องศา)
  HEAD_PERSPECTIVE: 750, // ความลึกแบบ 3D Perspective (ยิ่งค่าน้อย ยิ่งมีมิติความลึกเด่นชัด)

  // 2. ขอบเขตการกลอกลูกตาดำ (Pupil Clamping Radius ในหน่วย px)
  MAX_PUPIL_RADIUS: 9.5, // รัศมีสูงสุดที่ลูกตาดำเคลื่อนที่ได้ ไม่ให้หลุดขอบเบ้าตา (แนะนำ: 8 - 11px)
  PUPIL_DISTANCE_FACTOR: 0.045, // อัตราส่วนแปลงระยะห่างเมาส์เป็นระยะเคลื่อนที่ของตา

  // 3. ความนุ่มนวลและสปีดการตอบสนอง (Linear Interpolation - LERP Factors)
  // * ค่ายิ่งต่ำ (เช่น 0.04) = หน่วงนุ่มนวล ลื่นไหลมาก
  // * ค่ายิ่งสูง (เช่น 0.15) = ตอบสนองรวดเร็วตามเคอร์เซอร์ทันที
  HEAD_LERP: 0.075, // ความไวในการหันศีรษะ (Smooth Head Follow)
  EYE_LERP: 0.13, // ความไวในการกลอกลูกตา (Smooth Eye Follow)

  // 4. การกระพริบตาอัตโนมัติ (Natural Eye Blink)
  BLINK_INTERVAL_MS: 4200, // สุ่มกระพริบตาทุกๆ ~4.2 วินาที
};

interface InteractiveCharacterProps {
  className?: string;
  size?: number; // ขนาดความกว้าง-สูงของตัวละคร (px)
  showCardBadge?: boolean;
}

export function InteractiveCharacter({
  className = "",
  size = 190,
  showCardBadge = true,
}: InteractiveCharacterProps) {
  // DOM References สำหรับอัปเดต transform โดยตรงใน Animation Frame (Zero-lag 60fps)
  const containerRef = useRef<HTMLDivElement>(null);
  const headMeshRef = useRef<HTMLDivElement>(null);
  const leftPupilRef = useRef<SVGGElement>(null);
  const rightPupilRef = useRef<SVGGElement>(null);
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);

  // Animation & Physics Tracking State (เก็บบน Ref เพื่อไม่ให้เกิด React Re-render)
  const physicsRef = useRef({
    // พิกัดเป้าหมาย (Targets)
    targetTiltX: 0,
    targetTiltY: 0,
    targetLeftPupilX: 0,
    targetLeftPupilY: 0,
    targetRightPupilX: 0,
    targetRightPupilY: 0,

    // พิกัดปัจจุบัน (Current Interpolated Values)
    currTiltX: 0,
    currTiltY: 0,
    currLeftPupilX: 0,
    currLeftPupilY: 0,
    currRightPupilX: 0,
    currRightPupilY: 0,

    // สถานะเมาส์อยู่ในหน้าจอหรือไม่
    isHovering: false,
  });

  // State สำหรับแอนิเมชันกระพริบตา (Blink)
  const [isBlinking, setIsBlinking] = useState(false);

  // --------------------------------------------------------------------------
  // 1. Natural Blinking Loop
  // --------------------------------------------------------------------------
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => {
        setIsBlinking(false);
      }, 160); // ระยะเวลากระพริบ 160ms
    }, CHARACTER_CONFIG.BLINK_INTERVAL_MS + (Math.random() * 1500 - 750));

    return () => clearInterval(blinkInterval);
  }, []);

  // --------------------------------------------------------------------------
  // 2. Mouse & Touch Tracking Math Engine
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /**
     * คำนวณเป้าหมายการหันหน้า (3D Tilt) และการกลอกตา (Pupil Clamping)
     */
    function updateTracking(clientX: number, clientY: number) {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const characterCenterX = rect.left + rect.width / 2;
      const characterCenterY = rect.top + rect.height / 2;

      // 1. คำนวณ Normalized Coordinates (-1.0 ถึง +1.0)
      const viewportHalfW = window.innerWidth / 2;
      const viewportHalfH = window.innerHeight / 2;

      const deltaX = clientX - characterCenterX;
      const deltaY = clientY - characterCenterY;

      const normX = Math.max(-1, Math.min(1, deltaX / viewportHalfW));
      const normY = Math.max(-1, Math.min(1, deltaY / viewportHalfH));

      // 2. 3D Head Tilt Targets (องศา)
      // เมื่อเมาส์อยู่ล่าง -> rotateX เป็นลบ (หน้าก้มลง)
      // เมื่อเมาส์อยู่ขวา -> rotateY เป็นบวก (หน้าหันไปทางขวา)
      physicsRef.current.targetTiltY = normX * CHARACTER_CONFIG.MAX_TILT_Y;
      physicsRef.current.targetTiltX = -normY * CHARACTER_CONFIG.MAX_TILT_X;

      // 3. Pupil Eye Tracking ด้วย Math.atan2 และ Clamping รัศมี
      // คำนวณสำหรับตาซ้าย
      if (leftEyeRef.current) {
        const eyeRect = leftEyeRef.current.getBoundingClientRect();
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;

        const eyeDx = clientX - eyeCenterX;
        const eyeDy = clientY - eyeCenterY;

        const angle = Math.atan2(eyeDy, eyeDx);
        const distance = Math.hypot(eyeDx, eyeDy);

        // จำกัดระยะไม่ให้เกิน MAX_PUPIL_RADIUS
        const clampedDist = Math.min(
          distance * CHARACTER_CONFIG.PUPIL_DISTANCE_FACTOR,
          CHARACTER_CONFIG.MAX_PUPIL_RADIUS
        );

        physicsRef.current.targetLeftPupilX = Math.cos(angle) * clampedDist;
        physicsRef.current.targetLeftPupilY = Math.sin(angle) * clampedDist;
      }

      // คำนวณสำหรับตาขวา
      if (rightEyeRef.current) {
        const eyeRect = rightEyeRef.current.getBoundingClientRect();
        const eyeCenterX = eyeRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top + eyeRect.height / 2;

        const eyeDx = clientX - eyeCenterX;
        const eyeDy = clientY - eyeCenterY;

        const angle = Math.atan2(eyeDy, eyeDx);
        const distance = Math.hypot(eyeDx, eyeDy);

        const clampedDist = Math.min(
          distance * CHARACTER_CONFIG.PUPIL_DISTANCE_FACTOR,
          CHARACTER_CONFIG.MAX_PUPIL_RADIUS
        );

        physicsRef.current.targetRightPupilX = Math.cos(angle) * clampedDist;
        physicsRef.current.targetRightPupilY = Math.sin(angle) * clampedDist;
      }
    }

    // Mouse Move Handler
    function handleMouseMove(e: MouseEvent) {
      physicsRef.current.isHovering = true;
      updateTracking(e.clientX, e.clientY);
    }

    // Mouse Leave Handler (Fallback: ค่อยๆ เลื่อนกลับมาตำแหน่งตรงกลาง 0,0)
    function handleMouseLeave() {
      physicsRef.current.isHovering = false;
      physicsRef.current.targetTiltX = 0;
      physicsRef.current.targetTiltY = 0;
      physicsRef.current.targetLeftPupilX = 0;
      physicsRef.current.targetLeftPupilY = 0;
      physicsRef.current.targetRightPupilX = 0;
      physicsRef.current.targetRightPupilY = 0;
    }

    // Touch Event Handlers (สำหรับหน้าจอมือถือ)
    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateTracking(touch.clientX, touch.clientY);
      }
    }

    function handleTouchEnd() {
      handleMouseLeave();
    }

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    // ------------------------------------------------------------------------
    // 3. Smooth LERP Physics Animation Loop (requestAnimationFrame)
    // ------------------------------------------------------------------------
    let animationFrameId: number;

    function renderLoop() {
      const p = physicsRef.current;
      const { HEAD_LERP, EYE_LERP } = CHARACTER_CONFIG;

      // Linear Interpolation: current += (target - current) * factor
      p.currTiltX += (p.targetTiltX - p.currTiltX) * HEAD_LERP;
      p.currTiltY += (p.targetTiltY - p.currTiltY) * HEAD_LERP;

      p.currLeftPupilX += (p.targetLeftPupilX - p.currLeftPupilX) * EYE_LERP;
      p.currLeftPupilY += (p.targetLeftPupilY - p.currLeftPupilY) * EYE_LERP;

      p.currRightPupilX += (p.targetRightPupilX - p.currRightPupilX) * EYE_LERP;
      p.currRightPupilY += (p.targetRightPupilY - p.currRightPupilY) * EYE_LERP;

      // นำค่าที่ Lerp แล้วอัปเดตลง DOM Transforms โดยตรง
      if (headMeshRef.current) {
        headMeshRef.current.style.transform =
          `rotateX(${p.currTiltX.toFixed(2)}deg) rotateY(${p.currTiltY.toFixed(2)}deg)`;
      }

      if (leftPupilRef.current) {
        leftPupilRef.current.style.transform =
          `translate(${p.currLeftPupilX.toFixed(2)}px, ${p.currLeftPupilY.toFixed(2)}px)`;
      }

      if (rightPupilRef.current) {
        rightPupilRef.current.style.transform =
          `translate(${p.currRightPupilX.toFixed(2)}px, ${p.currRightPupilY.toFixed(2)}px)`;
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    }

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      style={{
        width: size,
        perspective: `${CHARACTER_CONFIG.HEAD_PERSPECTIVE}px`,
      }}
    >
      {/* Glow Ambient Shadow Underneath */}
      <div
        className="pointer-events-none absolute -bottom-3 h-5 rounded-full bg-[#B45309]/15 blur-md transition-all duration-300"
        style={{ width: size * 0.7 }}
      />

      {/* 3D Head & Body Container (Receives perspective rotateX, rotateY) */}
      <div
        ref={headMeshRef}
        className="relative flex items-center justify-center transition-transform will-change-transform"
        style={{
          transformStyle: "preserve-3d",
          width: size,
          height: size,
        }}
      >
        <svg
          viewBox="0 0 240 240"
          className="w-full h-full drop-shadow-[0_12px_24px_rgba(28,37,46,0.12)]"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Skin Tone Gradient */}
            <linearGradient id="chibiSkin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFF2E7" />
              <stop offset="60%" stopColor="#FFE3D0" />
              <stop offset="100%" stopColor="#F9CFB4" />
            </linearGradient>

            {/* Hair Color Gradient - Rich Warm Anime Brown */}
            <linearGradient id="chibiHair" x1="0%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#6C3E29" />
              <stop offset="45%" stopColor="#532C1B" />
              <stop offset="100%" stopColor="#381B10" />
            </linearGradient>

            {/* Hair Highlight Light Reflection */}
            <linearGradient id="hairHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9C5D41" stopOpacity="0" />
              <stop offset="50%" stopColor="#C98967" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#9C5D41" stopOpacity="0" />
            </linearGradient>

            {/* Pupil Iris Gradient - Warm Deep Amber & Espresso Brown */}
            <radialGradient id="pupilIris" cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#8C430E" />
              <stop offset="45%" stopColor="#451A03" />
              <stop offset="90%" stopColor="#1C0E06" />
              <stop offset="100%" stopColor="#0B0502" />
            </radialGradient>

            {/* Navy Blazer / Hood Collar Gradient */}
            <linearGradient id="chibiHoodie" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2A3E5C" />
              <stop offset="70%" stopColor="#1B293E" />
              <stop offset="100%" stopColor="#121D2D" />
            </linearGradient>

            {/* Inner Shirt Pattern / Analytics Symbol Gradient */}
            <linearGradient id="chibiShirt" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>

            {/* Eye Sclera Soft Inner Shadow Filter */}
            <filter id="eyeShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#713F12" floodOpacity="0.18" />
            </filter>

            {/* Cheeks Blush Radial Gradient */}
            <radialGradient id="chibiBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FB7185" stopOpacity="0.55" />
              <stop offset="70%" stopColor="#FDA4AF" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#FDA4AF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* =================================================================
              LAYER 1: Body, Shoulders & Navy Blazer / Hoodie Collar
              ================================================================= */}
          <g id="body-layer">
            {/* Shoulders / Torso */}
            <path
              d="M 52 216 C 52 186, 88 178, 120 178 C 152 178, 188 186, 188 216 Z"
              fill="url(#chibiHoodie)"
            />
            {/* Inner Shirt (V-neck opening) */}
            <path
              d="M 98 180 L 120 205 L 142 180 Z"
              fill="url(#chibiShirt)"
            />
            {/* Little Analytics Mini Bar Chart on Shirt */}
            <rect x="114" y="186" width="2" height="6" rx="0.5" fill="#B45309" />
            <rect x="117.5" y="184" width="2" height="8" rx="0.5" fill="#D97706" />
            <rect x="121" y="182" width="2" height="10" rx="0.5" fill="#F59E0B" />
            <path d="M 114 186 Q 118 183 123 181" stroke="#B45309" strokeWidth="0.8" fill="none" />

            {/* Blazer Lapels */}
            <path
              d="M 88 180 L 108 216 L 82 216 Z"
              fill="#22334A"
            />
            <path
              d="M 152 180 L 132 216 L 158 216 Z"
              fill="#22334A"
            />
            {/* Gold Lapel Pin Badge (Biz-Analytic Spark) */}
            <circle cx="98" cy="192" r="3" fill="#D97706" />
            <circle cx="98" cy="192" r="1.5" fill="#FDE68A" />
          </g>

          {/* =================================================================
              LAYER 2: Ears & Back Hair
              ================================================================= */}
          <g id="back-hair-and-ears">
            {/* Back Hair Volume */}
            <ellipse cx="120" cy="106" rx="66" ry="62" fill="url(#chibiHair)" />

            {/* Left Ear */}
            <circle cx="58" cy="116" r="13" fill="url(#chibiSkin)" />
            <circle cx="59" cy="116" r="7" fill="#F4B89A" opacity="0.6" />

            {/* Right Ear */}
            <circle cx="182" cy="116" r="13" fill="url(#chibiSkin)" />
            <circle cx="181" cy="116" r="7" fill="#F4B89A" opacity="0.6" />
          </g>

          {/* =================================================================
              LAYER 3: Head & Facial Features
              ================================================================= */}
          <g id="head-layer">
            {/* Cute Rounded Chibi Face */}
            <path
              d="M 64 105 C 64 64, 176 64, 176 105 C 176 148, 154 165, 120 165 C 86 165, 64 148, 64 105 Z"
              fill="url(#chibiSkin)"
            />

            {/* Cute Rosy Cheeks (Blush) */}
            <ellipse cx="79" cy="126" rx="9" ry="6" fill="url(#chibiBlush)" />
            <ellipse cx="161" cy="126" rx="9" ry="6" fill="url(#chibiBlush)" />

            {/* Cheerful Nose (Tiny subtle dot) */}
            <circle cx="120" cy="123" r="1.5" fill="#E09F80" />

            {/* Cute Smile Mouth */}
            <path
              d="M 111 133 Q 120 142 129 133"
              stroke="#83321B"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="#D9534F"
            />
            {/* Tongue highlight */}
            <path
              d="M 116 136 Q 120 138 124 136"
              stroke="#FFAAA6"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* =================================================================
              LAYER 4: Eyeballs & Pupils (Separate Left/Right Eye Tracking)
              ================================================================= */}
          <g
            id="eyes-group"
            style={{
              transformOrigin: "120px 110px",
              transform: isBlinking ? "scaleY(0.08)" : "scaleY(1)",
              transition: isBlinking
                ? "transform 0.08s cubic-bezier(0.4, 0, 0.2, 1)"
                : "transform 0.16s cubic-bezier(0, 0, 0.2, 1)",
            }}
          >
            {/* Eyebrows */}
            <path
              d="M 76 91 Q 91 85 98 90"
              stroke="#532C1B"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 142 90 Q 149 85 164 91"
              stroke="#532C1B"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
            />

            {/* --- LEFT EYE --- */}
            <g id="left-eye" ref={leftEyeRef}>
              {/* Sclera (Eye White with soft clipping) */}
              <clipPath id="leftEyeClip">
                <ellipse cx="91" cy="112" rx="15" ry="17" />
              </clipPath>

              {/* Eye White Base */}
              <ellipse
                cx="91"
                cy="112"
                rx="15"
                ry="17"
                fill="#FFFFFF"
                filter="url(#eyeShadow)"
              />

              {/* Upper Eyelid Shadow Inside Sclera */}
              <path
                d="M 76 102 Q 91 98 106 102 L 106 107 Q 91 103 76 107 Z"
                fill="#F3D5C5"
                opacity="0.8"
                clipPath="url(#leftEyeClip)"
              />

              {/* Left Eye Tracked Pupil (Moved dynamically by lerp) */}
              <g clipPath="url(#leftEyeClip)">
                <g ref={leftPupilRef} className="will-change-transform">
                  {/* Pupil Base with Iris Gradient */}
                  <ellipse cx="91" cy="112" rx="10.5" ry="12" fill="url(#pupilIris)" />
                  {/* Deep Black Core */}
                  <circle cx="91" cy="112" r="6" fill="#0A0402" />

                  {/* Primary Specular Light Glint (Large top-left sparkle) */}
                  <ellipse cx="88" cy="107.5" rx="3.8" ry="4.2" fill="#FFFFFF" opacity="0.95" />
                  {/* Secondary Subtle Sparkle (Bottom-right dot) */}
                  <circle cx="94.5" cy="116.5" r="1.8" fill="#FFFFFF" opacity="0.75" />
                  {/* Amber Iris Rim Glow */}
                  <circle cx="91" cy="117" r="4.5" fill="#D97706" opacity="0.4" />
                </g>
              </g>

              {/* Top Eyelash Accent */}
              <path
                d="M 75 106 Q 91 97 107 106"
                stroke="#3D1D10"
                strokeWidth="2.8"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 103 103 Q 107 101 109 99"
                stroke="#3D1D10"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            {/* --- RIGHT EYE --- */}
            <g id="right-eye" ref={rightEyeRef}>
              <clipPath id="rightEyeClip">
                <ellipse cx="149" cy="112" rx="15" ry="17" />
              </clipPath>

              {/* Eye White Base */}
              <ellipse
                cx="149"
                cy="112"
                rx="15"
                ry="17"
                fill="#FFFFFF"
                filter="url(#eyeShadow)"
              />

              {/* Upper Eyelid Shadow Inside Sclera */}
              <path
                d="M 134 102 Q 149 98 164 102 L 164 107 Q 149 103 134 107 Z"
                fill="#F3D5C5"
                opacity="0.8"
                clipPath="url(#rightEyeClip)"
              />

              {/* Right Eye Tracked Pupil (Moved dynamically by lerp) */}
              <g clipPath="url(#rightEyeClip)">
                <g ref={rightPupilRef} className="will-change-transform">
                  <ellipse cx="149" cy="112" rx="10.5" ry="12" fill="url(#pupilIris)" />
                  <circle cx="149" cy="112" r="6" fill="#0A0402" />

                  {/* Primary Specular Light Glint */}
                  <ellipse cx="146" cy="107.5" rx="3.8" ry="4.2" fill="#FFFFFF" opacity="0.95" />
                  {/* Secondary Subtle Sparkle */}
                  <circle cx="152.5" cy="116.5" r="1.8" fill="#FFFFFF" opacity="0.75" />
                  {/* Amber Iris Rim Glow */}
                  <circle cx="149" cy="117" r="4.5" fill="#D97706" opacity="0.4" />
                </g>
              </g>

              {/* Top Eyelash Accent */}
              <path
                d="M 133 106 Q 149 97 165 106"
                stroke="#3D1D10"
                strokeWidth="2.8"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 137 103 Q 133 101 131 99"
                stroke="#3D1D10"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          </g>

          {/* =================================================================
              LAYER 5: Styled Front Anime Hair & Bangs (With 3D Parallax Depth)
              ================================================================= */}
          <g id="front-hair">
            {/* Main Bangs Left Strand */}
            <path
              d="M 58 98 C 55 60, 90 48, 120 48 C 145 48, 172 56, 180 82 C 168 76, 142 75, 126 84 C 112 92, 102 108, 92 108 C 82 108, 68 106, 58 98 Z"
              fill="url(#chibiHair)"
            />

            {/* Swept Front Bang Center */}
            <path
              d="M 104 66 C 116 78, 124 96, 114 109 C 122 103, 134 94, 138 82 C 148 94, 156 102, 164 104 C 162 92, 168 82, 178 86 C 182 66, 156 50, 120 50 Z"
              fill="#5D3220"
            />

            {/* Cute Side Hair Curls */}
            <path
              d="M 64 94 Q 52 110 59 126 Q 66 114 70 106 Z"
              fill="url(#chibiHair)"
            />
            <path
              d="M 176 94 Q 188 110 181 126 Q 174 114 170 106 Z"
              fill="url(#chibiHair)"
            />

            {/* Hair Top Specular Highlight Ring */}
            <path
              d="M 85 64 Q 120 54 155 64"
              stroke="url(#hairHighlight)"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        </svg>
      </div>

      {/* Optional Badge Indicator */}
      {showCardBadge && (
        <div className="mt-1 flex items-center gap-1.5 rounded-full bg-white/90 border border-slate-200/80 px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs backdrop-blur-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B45309] animate-pulse" />
          <span>Interactive Mouse Tracking Chibi</span>
        </div>
      )}
    </div>
  );
}
