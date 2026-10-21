import type { TeaserColors } from "./schema";

// كأس ذهبي مرسوم SVG
export const Trophy: React.FC<{ colors: TeaserColors; shine: number }> = ({ colors, shine }) => (
  <svg width={620} height={760} viewBox="0 0 620 760">
    <defs>
      <linearGradient id="cup" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#7a5a0c" />
        <stop offset="0.3" stopColor={colors.gold} />
        <stop offset="0.5" stopColor={colors.goldLight} />
        <stop offset="0.7" stopColor={colors.gold} />
        <stop offset="1" stopColor="#6b4e08" />
      </linearGradient>
      <linearGradient id="shine" x1="0" x2="1" y1="0" y2="1">
        <stop offset={Math.max(0, shine - 0.12)} stopColor="#fff" stopOpacity="0" />
        <stop offset={shine} stopColor="#fff" stopOpacity="0.85" />
        <stop offset={Math.min(1, shine + 0.12)} stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <clipPath id="trophyClip">
        <path d="M130 60 H490 V180 C490 330 410 430 310 450 C210 430 130 330 130 180 Z" />
        <rect x="280" y="440" width="60" height="120" />
        <path d="M200 560 H420 L450 640 H170 Z" />
        <rect x="130" y="640" width="360" height="70" rx="12" />
      </clipPath>
    </defs>
    {/* المقابض */}
    <path d="M140 110 C40 100 30 250 170 300" fill="none" stroke="url(#cup)" strokeWidth="30" strokeLinecap="round" />
    <path d="M480 110 C580 100 590 250 450 300" fill="none" stroke="url(#cup)" strokeWidth="30" strokeLinecap="round" />
    {/* الجسم */}
    <path d="M130 60 H490 V180 C490 330 410 430 310 450 C210 430 130 330 130 180 Z" fill="url(#cup)" />
    <ellipse cx="310" cy="62" rx="180" ry="22" fill="#5c4307" />
    <ellipse cx="310" cy="60" rx="180" ry="18" fill={colors.goldLight} opacity="0.5" />
    {/* نجمة */}
    <path
      d="M310 150 L330 205 L388 207 L342 242 L358 298 L310 265 L262 298 L278 242 L232 207 L290 205 Z"
      fill="#fff6d0"
      opacity="0.9"
    />
    {/* الساق والقاعدة */}
    <rect x="280" y="440" width="60" height="120" fill="url(#cup)" />
    <path d="M200 560 H420 L450 640 H170 Z" fill="url(#cup)" />
    <rect x="130" y="640" width="360" height="70" rx="12" fill="url(#cup)" />
    <rect x="200" y="660" width="220" height="30" rx="6" fill="#0A1F5C" opacity="0.55" />
    {/* لمعة تمر */}
    <rect width="620" height="760" fill="url(#shine)" clipPath="url(#trophyClip)" />
  </svg>
);
