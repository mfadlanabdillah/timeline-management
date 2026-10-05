/**
 * A planner presenting a Gantt board. Flat vector, theme-aware via CSS
 * variables, with the bars drawing themselves in on mount.
 */
export function PlanningIllustration({ className = '' }: { className?: string }) {
  const bars = [
    { y: 96, x: 62, w: 118, c: 'var(--grad-a)', d: '0.35s' },
    { y: 124, x: 92, w: 92, c: 'var(--grad-b)', d: '0.5s' },
    { y: 152, x: 74, w: 142, c: 'var(--grad-c)', d: '0.65s' },
    { y: 180, x: 118, w: 76, c: 'var(--grad-a)', d: '0.8s' },
  ];

  return (
    <svg
      viewBox="0 0 420 330"
      className={className}
      role="img"
      aria-label="A person presenting a project timeline"
      fill="none"
    >
      {/* soft backdrop */}
      <ellipse cx="210" cy="300" rx="168" ry="18" fill="var(--grad-a)" opacity="0.12" />
      <circle cx="120" cy="70" r="58" fill="var(--grad-b)" opacity="0.1" />

      {/* board */}
      <g className="animate-scale-in">
        <rect x="34" y="52" width="216" height="176" rx="16" fill="var(--ill-surface)" />
        <rect
          x="34"
          y="52"
          width="216"
          height="176"
          rx="16"
          stroke="var(--ill-line)"
          strokeWidth="2"
        />
        <rect x="34" y="52" width="216" height="30" rx="16" fill="var(--ill-surface-2)" />
        <rect x="34" y="70" width="216" height="12" fill="var(--ill-surface-2)" />
        <circle cx="52" cy="67" r="4" fill="var(--grad-a)" opacity="0.6" />
        <circle cx="66" cy="67" r="4" fill="var(--grad-b)" opacity="0.5" />
        <circle cx="80" cy="67" r="4" fill="var(--grad-c)" opacity="0.5" />

        {/* row labels */}
        {bars.map((b, i) => (
          <rect
            key={`label-${i}`}
            x="48"
            y={b.y + 3}
            width="28"
            height="6"
            rx="3"
            fill="var(--ill-line)"
          />
        ))}

        {/* gantt bars */}
        {bars.map((b, i) => (
          <rect
            key={`bar-${i}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height="12"
            rx="6"
            fill={b.c}
            className="animate-grow-x"
            style={{ animationDelay: b.d, transformBox: 'fill-box' }}
          />
        ))}

        {/* today line */}
        <line
          x1="166"
          y1="88"
          x2="166"
          y2="210"
          stroke="var(--color-today)"
          strokeWidth="2"
          strokeDasharray="4 4"
          opacity="0.8"
        />
        <circle cx="166" cy="88" r="4" fill="var(--color-today)" />
      </g>

      {/* floating chips */}
      <g className="animate-float" style={{ animationDelay: '0.4s' }}>
        <rect x="248" y="72" width="74" height="26" rx="13" fill="var(--ill-surface)" />
        <rect
          x="248"
          y="72"
          width="74"
          height="26"
          rx="13"
          stroke="var(--ill-line)"
          strokeWidth="1.5"
        />
        <circle cx="263" cy="85" r="5" fill="var(--grad-c)" />
        <rect x="274" y="82" width="34" height="6" rx="3" fill="var(--ill-line)" />
      </g>
      <g className="animate-float-slow" style={{ animationDelay: '1s' }}>
        <rect x="16" y="196" width="66" height="24" rx="12" fill="var(--ill-surface)" />
        <rect
          x="16"
          y="196"
          width="66"
          height="24"
          rx="12"
          stroke="var(--ill-line)"
          strokeWidth="1.5"
        />
        <circle cx="30" cy="208" r="5" fill="var(--grad-b)" />
        <rect x="41" y="205" width="28" height="6" rx="3" fill="var(--ill-line)" />
      </g>

      {/* character */}
      <g className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
        {/* legs */}
        <path
          d="M300 236 L296 292 Q296 297 301 297 L308 297 Q312 297 311 292 L314 244 Z"
          fill="#3f3a5c"
        />
        <path
          d="M330 236 L336 292 Q337 297 332 297 L325 297 Q321 297 322 292 L318 244 Z"
          fill="#4a4470"
        />
        {/* shoes */}
        <rect x="292" y="290" width="22" height="9" rx="4.5" fill="var(--ill-hair)" />
        <rect x="320" y="290" width="22" height="9" rx="4.5" fill="var(--ill-hair)" />

        {/* torso */}
        <path
          d="M296 176 Q296 164 310 164 L324 164 Q338 164 338 176 L342 238 Q342 244 335 244 L299 244 Q292 244 292 238 Z"
          fill="url(#shirt)"
        />
        {/* raised arm pointing at the board */}
        <path
          d="M300 180 Q282 176 268 160 Q262 153 268 148 Q274 143 280 150 Q291 162 304 166 Z"
          fill="url(#shirt)"
        />
        <circle cx="266" cy="150" r="8" fill="var(--ill-skin)" />
        {/* resting arm */}
        <path
          d="M334 180 Q346 196 344 220 Q343 228 336 227 Q329 226 330 218 Q331 200 324 188 Z"
          fill="url(#shirt)"
        />
        <circle cx="339" cy="230" r="8" fill="var(--ill-skin)" />

        {/* neck + head */}
        <rect x="311" y="150" width="14" height="20" rx="7" fill="var(--ill-skin-dark)" />
        <circle cx="318" cy="136" r="23" fill="var(--ill-skin)" />
        {/* hair */}
        <path
          d="M295 134 Q294 112 318 112 Q342 112 341 134 Q338 124 330 121 Q320 128 302 125 Q297 127 295 134 Z"
          fill="var(--ill-hair)"
        />
        {/* face */}
        <circle cx="310" cy="137" r="2.2" fill="var(--ill-hair)" />
        <circle cx="326" cy="137" r="2.2" fill="var(--ill-hair)" />
        <path
          d="M312 145 Q318 150 324 145"
          stroke="var(--ill-hair)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* sparkles */}
      <g className="animate-pulse-soft">
        <path d="M368 108 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="var(--grad-c)" />
      </g>
      <g className="animate-pulse-soft" style={{ animationDelay: '1.2s' }}>
        <path d="M52 30 l2.5 6.5 6.5 2.5 -6.5 2.5 -2.5 6.5 -2.5 -6.5 -6.5 -2.5 6.5 -2.5 z" fill="var(--grad-b)" />
      </g>

      <defs>
        <linearGradient id="shirt" x1="290" y1="160" x2="345" y2="245" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--grad-a)" />
          <stop offset="1" stopColor="var(--grad-b)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
