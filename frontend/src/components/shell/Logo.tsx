import React from "react";

/**
 * ChickCheck mark: a hen's head framed by camera focus brackets —
 * poultry identity + computer vision in one glyph.
 */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="#2E7D4F" />
      <rect width="40" height="40" rx="11" fill="url(#cc-sheen)" />
      {/* focus brackets */}
      <g stroke="#F6EFD9" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M8 13V9.5A1.5 1.5 0 0 1 9.5 8H13" />
        <path d="M27 8h3.5A1.5 1.5 0 0 1 32 9.5V13" />
        <path d="M32 27v3.5a1.5 1.5 0 0 1-1.5 1.5H27" />
        <path d="M13 32H9.5A1.5 1.5 0 0 1 8 30.5V27" />
      </g>
      {/* comb */}
      <circle cx="16.2" cy="13.4" r="2.3" fill="#E39B3B" />
      <circle cx="19.4" cy="12.3" r="2.5" fill="#E39B3B" />
      <circle cx="22.4" cy="13.6" r="2.1" fill="#E39B3B" />
      {/* head */}
      <circle cx="19.5" cy="21" r="7" fill="#FBF7EC" />
      {/* beak */}
      <path d="M25.6 19.4 L30 21.2 L25.6 23 Z" fill="#E39B3B" />
      {/* wattle */}
      <ellipse cx="24.6" cy="25.6" rx="1.3" ry="1.9" fill="#D2603A" />
      {/* eye */}
      <circle cx="21.9" cy="19.6" r="1.25" fill="#163828" />
      <defs>
        <linearGradient id="cc-sheen" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#000" stopOpacity="0.12" />
        </linearGradient>
      </defs>
    </svg>
  );
}
