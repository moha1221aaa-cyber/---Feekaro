import React from "react";
import { COLORS } from "../theme";

const Svg: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <svg viewBox="0 0 200 200" width="100%" height="100%">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={COLORS.goldLight} />
        <stop offset="0.55" stopColor={COLORS.gold} />
        <stop offset="1" stopColor={COLORS.goldDeep} />
      </linearGradient>
    </defs>
    <g fill="none" stroke={`url(#${id})`} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </g>
  </svg>
);

export const Bell = () => (
  <Svg id="gBell">
    <path d="M100 30 C68 30 56 56 56 84 L56 118 L40 142 L160 142 L144 118 L144 84 C144 56 132 30 100 30 Z" fill={`url(#gBell)`} fillOpacity={0.18} />
    <path d="M86 152 C88 166 112 166 114 152" />
    <circle cx="100" cy="22" r="7" />
    <path d="M28 70 C24 84 26 98 32 108 M172 70 C176 84 174 98 168 108" />
  </Svg>
);

export const Stopwatch: React.FC<{ progress: number }> = ({ progress }) => {
  const a = progress * Math.PI * 2 - Math.PI / 2;
  return (
    <Svg id="gWatch">
      <circle cx="100" cy="112" r="66" fill={`url(#gWatch)`} fillOpacity={0.12} />
      <path d="M86 28 L114 28 M100 28 L100 46 M150 56 L162 44" />
      {new Array(12).fill(0).map((_, i) => {
        const t = (i / 12) * Math.PI * 2;
        return (
          <line key={i} x1={100 + Math.cos(t) * 54} y1={112 + Math.sin(t) * 54} x2={100 + Math.cos(t) * 60} y2={112 + Math.sin(t) * 60} strokeWidth={4} />
        );
      })}
      <line x1="100" y1="112" x2={100 + Math.cos(a) * 44} y2={112 + Math.sin(a) * 44} />
      <circle cx="100" cy="112" r="6" fill={COLORS.gold} />
    </Svg>
  );
};

export const Books = () => (
  <Svg id="gBooks">
    <path d="M100 58 C80 44 52 42 30 48 L30 152 C52 146 80 148 100 162 Z" fill={`url(#gBooks)`} fillOpacity={0.15} />
    <path d="M100 58 C120 44 148 42 170 48 L170 152 C148 146 120 148 100 162 Z" fill={`url(#gBooks)`} fillOpacity={0.15} />
    <path d="M100 58 L100 162" />
    <path d="M46 76 C62 72 76 74 86 80 M46 98 C62 94 76 96 86 102 M114 80 C124 74 138 72 154 76 M114 102 C124 96 138 94 154 98" strokeWidth={4} />
  </Svg>
);

export const Question = () => (
  <Svg id="gQ">
    <circle cx="100" cy="100" r="82" fill={`url(#gQ)`} fillOpacity={0.12} />
    <path d="M70 76 C70 52 86 40 102 40 C120 40 134 54 134 72 C134 98 104 100 104 124 L104 132" strokeWidth={14} />
    <circle cx="104" cy="158" r="9" fill={`url(#gQ)`} stroke="none" />
  </Svg>
);
