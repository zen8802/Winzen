type Props = {
  size?: number;
  className?: string;
};

/**
 * Winzen coin icon — layered sci-fi gem aesthetic.
 * Outer rings use the logo gradient (pink → violet).
 * Center gem is gold with an upward-trend market symbol.
 */
export function CoinIcon({ size = 16, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <defs>
        {/* Gem glow */}
        <filter id="wz-gem-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Outer logo gradient: pink → violet */}
        <linearGradient id="wz-metal" x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="40%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>

        {/* Dark depth ring */}
        <linearGradient id="wz-metal-deep" x1="15%" y1="5%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#831843" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>

        {/* Gold gem — warm radial */}
        <radialGradient id="wz-gem" cx="38%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fefce8" />
          <stop offset="18%" stopColor="#fde68a" />
          <stop offset="52%" stopColor="#f59e0b" />
          <stop offset="82%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>

        {/* Outer halo */}
        <radialGradient id="wz-halo" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="transparent" />
          <stop offset="100%" stopColor="#d946ef" stopOpacity="0.4" />
        </radialGradient>
      </defs>

      {/* Outer halo glow */}
      <circle cx="32" cy="32" r="32" fill="url(#wz-halo)" />

      {/* Ring 1 — outer metallic */}
      <circle cx="32" cy="32" r="30" fill="url(#wz-metal)" />
      {/* Ring 1 top-left shimmer arc */}
      <path
        d="M 9 21 A 24 24 0 0 1 21 9"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Ring 2 — dark separator groove */}
      <circle cx="32" cy="32" r="24" fill="url(#wz-metal-deep)" />

      {/* Ring 3 — inner metallic band */}
      <circle cx="32" cy="32" r="20" fill="url(#wz-metal)" />
      {/* Ring 3 shimmer arc */}
      <path
        d="M 14.5 24 A 18 18 0 0 1 24 14.5"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Ring 4 — dark inner groove */}
      <circle cx="32" cy="32" r="15.5" fill="url(#wz-metal-deep)" />

      {/* Center gem */}
      <circle cx="32" cy="32" r="13.5" fill="url(#wz-gem)" filter="url(#wz-gem-glow)" />

      {/* Gem specular highlight */}
      <ellipse
        cx="28"
        cy="27"
        rx="4"
        ry="2.2"
        fill="rgba(255,255,255,0.52)"
        transform="rotate(-30 28 27)"
      />

      {/* Market trend line — upward curve (white) */}
      <polyline
        points="22,38 27,33 31,30 36,27 42,23"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Trend endpoint dot */}
      <circle cx="42" cy="23" r="2" fill="white" opacity="0.9" />
    </svg>
  );
}
