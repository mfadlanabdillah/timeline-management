/**
 * A visitor unlocking a shared timeline with a project code.
 * Flat vector, theme-aware, with a gently floating key card.
 */
export function AccessIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 330"
      className={className}
      role="img"
      aria-label="A person opening a shared project timeline with an access code"
      fill="none"
    >
      <ellipse cx="210" cy="300" rx="160" ry="18" fill="var(--grad-b)" opacity="0.12" />
      <circle cx="300" cy="80" r="62" fill="var(--grad-c)" opacity="0.1" />

      {/* the door / gateway the code opens */}
      <g className="animate-scale-in">
        <rect x="196" y="46" width="176" height="200" rx="18" fill="var(--ill-surface)" />
        <rect
          x="196"
          y="46"
          width="176"
          height="200"
          rx="18"
          stroke="var(--ill-line)"
          strokeWidth="2"
        />
        {/* mini timeline preview inside */}
        <rect x="216" y="74" width="62" height="8" rx="4" fill="var(--ill-line)" />
        <rect x="216" y="102" width="104" height="11" rx="5.5" fill="var(--grad-a)" className="animate-grow-x" style={{ animationDelay: '0.5s', transformBox: 'fill-box' }} />
        <rect x="240" y="126" width="82" height="11" rx="5.5" fill="var(--grad-b)" className="animate-grow-x" style={{ animationDelay: '0.62s', transformBox: 'fill-box' }} />
        <rect x="226" y="150" width="122" height="11" rx="5.5" fill="var(--grad-c)" className="animate-grow-x" style={{ animationDelay: '0.74s', transformBox: 'fill-box' }} />
        <rect x="258" y="174" width="66" height="11" rx="5.5" fill="var(--grad-a)" className="animate-grow-x" style={{ animationDelay: '0.86s', transformBox: 'fill-box' }} />
        <rect x="216" y="206" width="46" height="7" rx="3.5" fill="var(--ill-line)" />
        <rect x="272" y="206" width="70" height="7" rx="3.5" fill="var(--ill-line)" />
      </g>

      {/* floating access card with the code */}
      <g className="animate-float" style={{ animationDelay: '0.5s' }}>
        <rect x="132" y="66" width="104" height="64" rx="12" fill="url(#card)" />
        <rect x="146" y="84" width="42" height="7" rx="3.5" fill="#ffffff" opacity="0.85" />
        <rect x="146" y="99" width="66" height="11" rx="5.5" fill="#ffffff" opacity="0.55" />
        <circle cx="214" cy="86" r="8" fill="#ffffff" opacity="0.3" />
      </g>

      {/* lock badge */}
      <g className="animate-pulse-soft">
        <circle cx="196" cy="212" r="22" fill="var(--ill-surface)" stroke="var(--ill-line)" strokeWidth="2" />
        <path
          d="M188 210 v-6 a8 8 0 0 1 16 0 v6"
          stroke="var(--grad-a)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="185" y="210" width="22" height="16" rx="4" fill="var(--grad-a)" />
      </g>

      {/* character */}
      <g className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
        {/* legs */}
        <path d="M78 232 L72 292 Q71 297 76 297 L84 297 Q88 297 88 292 L92 240 Z" fill="#3f3a5c" />
        <path d="M110 232 L116 292 Q117 297 112 297 L104 297 Q100 297 100 292 L96 240 Z" fill="#4a4470" />
        <rect x="68" y="290" width="22" height="9" rx="4.5" fill="var(--ill-hair)" />
        <rect x="98" y="290" width="22" height="9" rx="4.5" fill="var(--ill-hair)" />

        {/* torso */}
        <path
          d="M74 172 Q74 160 88 160 L102 160 Q116 160 116 172 L120 234 Q120 240 113 240 L77 240 Q70 240 70 234 Z"
          fill="url(#coat)"
        />
        {/* arm reaching toward the card */}
        <path
          d="M114 176 Q134 176 146 164 Q152 158 146 152 Q140 147 134 153 Q124 162 110 162 Z"
          fill="url(#coat)"
        />
        <circle cx="146" cy="154" r="8" fill="var(--ill-skin)" />
        {/* resting arm */}
        <path
          d="M76 176 Q64 192 66 216 Q67 224 74 223 Q81 222 80 214 Q79 196 86 184 Z"
          fill="url(#coat)"
        />
        <circle cx="71" cy="226" r="8" fill="var(--ill-skin)" />

        {/* head */}
        <rect x="88" y="146" width="14" height="20" rx="7" fill="var(--ill-skin-dark)" />
        <circle cx="95" cy="132" r="23" fill="var(--ill-skin)" />
        {/* hair — bun style for variety */}
        <path
          d="M72 130 Q71 108 95 108 Q119 108 118 130 Q114 118 104 116 Q92 122 78 120 Q74 122 72 130 Z"
          fill="var(--ill-hair)"
        />
        <circle cx="118" cy="112" r="9" fill="var(--ill-hair)" />
        <circle cx="87" cy="133" r="2.2" fill="var(--ill-hair)" />
        <circle cx="103" cy="133" r="2.2" fill="var(--ill-hair)" />
        <path d="M89 141 Q95 146 101 141" stroke="var(--ill-hair)" strokeWidth="2" strokeLinecap="round" />
      </g>

      <g className="animate-pulse-soft" style={{ animationDelay: '0.8s' }}>
        <path d="M356 262 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="var(--grad-b)" />
      </g>

      <defs>
        <linearGradient id="coat" x1="68" y1="158" x2="122" y2="242" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--grad-c)" />
          <stop offset="1" stopColor="var(--grad-a)" />
        </linearGradient>
        <linearGradient id="card" x1="132" y1="66" x2="236" y2="130" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--grad-a)" />
          <stop offset="1" stopColor="var(--grad-b)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
