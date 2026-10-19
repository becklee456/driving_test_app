import clsx from 'clsx';

/**
 * Driving-themed inline SVG illustrations. Kept dependency-free so they work
 * offline (PWA) and inherit no external image requests. Colors follow the
 * brand palette plus the Rwanda flag accents from tailwind.config.js.
 */

/* Main hero scene: a car on an open road with signs under a sunny sky. */
export function HeroScene({ className }) {
  return (
    <svg viewBox="0 0 560 380" role="img" aria-label="Car driving on an open road" className={clsx('h-auto w-full', className)}>
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#f0f9ff" />
        </linearGradient>
        <linearGradient id="hs-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="hs-car" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b8bff" />
          <stop offset="100%" stopColor="#1657e1" />
        </linearGradient>
        <radialGradient id="hs-sun" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#fad201" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width="560" height="380" rx="28" fill="url(#hs-sky)" />
      {/* sun */}
      <circle cx="452" cy="92" r="46" fill="url(#hs-sun)" />
      <circle cx="452" cy="92" r="62" fill="#fad201" opacity="0.18" />
      {/* clouds */}
      <g fill="#ffffff" opacity="0.9">
        <ellipse cx="120" cy="78" rx="34" ry="16" />
        <ellipse cx="150" cy="70" rx="26" ry="20" />
        <ellipse cx="300" cy="60" rx="30" ry="14" />
      </g>
      {/* distant hills */}
      <path d="M0 210 Q 90 150 190 200 T 380 190 T 560 205 V380 H0 Z" fill="#86efac" opacity="0.7" />
      <path d="M0 235 Q 140 185 300 225 T 560 230 V380 H0 Z" fill="#4ade80" opacity="0.85" />

      {/* road */}
      <path d="M232 200 L328 200 L560 380 L0 380 Z" fill="url(#hs-road)" />
      {/* road shoulder lines */}
      <path d="M232 200 L0 380" stroke="#f8fafc" strokeWidth="5" opacity="0.85" />
      <path d="M328 200 L560 380" stroke="#f8fafc" strokeWidth="5" opacity="0.85" />
      {/* animated centre dashes */}
      <g className="animate-dash" fill="#fad201">
        <rect x="276" y="214" width="8" height="20" rx="3" />
        <rect x="272" y="250" width="10" height="26" rx="3" />
        <rect x="266" y="292" width="12" height="32" rx="3" />
        <rect x="258" y="338" width="14" height="40" rx="3" />
      </g>

      {/* left road sign: speed limit */}
      <g className="animate-bob">
        <rect x="150" y="238" width="6" height="70" fill="#94a3b8" />
        <circle cx="153" cy="226" r="24" fill="#ffffff" stroke="#e11d48" strokeWidth="6" />
        <text x="153" y="234" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="20" fill="#1e293b">
          60
        </text>
      </g>

      {/* right warning sign */}
      <g>
        <rect x="404" y="250" width="6" height="66" fill="#94a3b8" />
        <path d="M407 210 L434 254 L380 254 Z" fill="#fad201" stroke="#1e293b" strokeWidth="4" strokeLinejoin="round" />
        <text x="407" y="248" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="18" fill="#1e293b">
          !
        </text>
      </g>

      {/* car */}
      <g className="animate-bob">
        <ellipse cx="280" cy="352" rx="86" ry="12" fill="#0f172a" opacity="0.25" />
        {/* body */}
        <path d="M212 330 q4 -30 30 -34 l16 -22 q6 -8 18 -8 h48 q12 0 18 8 l16 22 q26 4 30 34 z" fill="url(#hs-car)" />
        {/* windows */}
        <path d="M262 276 l-12 20 h40 v-20 z" fill="#dbeafe" />
        <path d="M300 276 v20 h40 l-12 -20 z" fill="#bfdbfe" />
        {/* wheels */}
        <circle cx="244" cy="330" r="18" fill="#0f172a" />
        <circle cx="244" cy="330" r="7" fill="#94a3b8" />
        <circle cx="318" cy="330" r="18" fill="#0f172a" />
        <circle cx="318" cy="330" r="7" fill="#94a3b8" />
        {/* headlight + bumper */}
        <rect x="336" y="308" width="14" height="8" rx="3" fill="#fef08a" />
        <rect x="210" y="318" width="12" height="8" rx="3" fill="#fecaca" />
      </g>

      {/* foreground grass */}
      <path d="M0 360 Q 140 344 280 360 T 560 358 V380 H0 Z" fill="#16a34a" />
    </svg>
  );
}

/* Compact steering-wheel mark for section headers / decorative bullets. */
export function SteeringWheel({ className }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={clsx('h-6 w-6', className)}>
      <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="24" cy="24" r="6" fill="currentColor" />
      <path d="M24 4v14M24 30v14M4 24h14M30 24h14" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/* Small traffic-cone / sign cluster used as a section flourish. */
export function SignCluster({ className }) {
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true" className={clsx('h-16 w-24', className)}>
      <ellipse cx="60" cy="72" rx="52" ry="6" fill="#0f172a" opacity="0.12" />
      {/* cone */}
      <path d="M30 68 L42 26 L54 68 Z" fill="#fb923c" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round" />
      <rect x="34" y="48" width="16" height="6" fill="#fff7ed" />
      <rect x="24" y="66" width="36" height="6" rx="2" fill="#ea580c" />
      {/* sign post */}
      <rect x="80" y="30" width="5" height="38" fill="#94a3b8" />
      <rect x="66" y="10" width="33" height="24" rx="4" fill="#2063a7" />
      <path d="M74 22h17M74 16h17" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
