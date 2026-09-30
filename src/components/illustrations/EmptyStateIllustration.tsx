/**
 * Small spot illustration for "nothing here yet" states — a person setting up
 * their first board. Kept lighter than the auth artwork so it never competes
 * with the surrounding UI.
 */
export function EmptyStateIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 190"
      className={className}
      role="img"
      aria-label="A person setting up an empty board"
      fill="none"
    >
      <ellipse cx="130" cy="170" rx="94" ry="12" fill="var(--grad-a)" opacity="0.12" />

      {/* empty board */}
      <g className="animate-scale-in">
        <rect x="26" y="30" width="146" height="118" rx="14" fill="var(--ill-surface)" />
        <rect
          x="26"
          y="30"
          width="146"
          height="118"
          rx="14"
          stroke="var(--ill-line)"
          strokeWidth="2"
          strokeDasharray="7 6"
        />
        <rect x="46" y="58" width="58" height="8" rx="4" fill="var(--ill-line)" />
        <rect x="46" y="80" width="90" height="8" rx="4" fill="var(--ill-line)" opacity="0.7" />
        <rect x="46" y="102" width="70" height="8" rx="4" fill="var(--ill-line)" opacity="0.45" />
      </g>

      {/* plus badge */}
      <g className="animate-pulse-soft">
        <circle cx="172" cy="52" r="19" fill="url(#plusGrad)" />
        <path
          d="M172 44 v16 M164 52 h16"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>

      {/* character */}
      <g className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <path d="M196 118 L192 158 Q191 162 195 162 L201 162 Q204 162 204 158 L207 124 Z" fill="#3f3a5c" />
        <path d="M218 118 L222 158 Q223 162 219 162 L213 162 Q210 162 210 158 L208 124 Z" fill="#4a4470" />
        <rect x="188" y="157" width="18" height="7" rx="3.5" fill="var(--ill-hair)" />
        <rect x="210" y="157" width="18" height="7" rx="3.5" fill="var(--ill-hair)" />

        <path
          d="M194 78 Q194 69 205 69 L213 69 Q224 69 224 78 L227 120 Q227 124 221 124 L197 124 Q191 124 191 120 Z"
          fill="url(#tee)"
        />
        <path
          d="M196 82 Q182 80 174 70 Q170 65 175 61 Q180 57 184 62 Q191 71 200 73 Z"
          fill="url(#tee)"
        />
        <circle cx="173" cy="63" r="6.5" fill="var(--ill-skin)" />
        <path d="M223 82 Q231 94 230 110 Q229 116 224 115 Q219 114 220 108 Q221 96 216 88 Z" fill="url(#tee)" />
        <circle cx="226" cy="117" r="6.5" fill="var(--ill-skin)" />

        <rect x="204" y="58" width="11" height="15" rx="5.5" fill="var(--ill-skin-dark)" />
        <circle cx="209" cy="47" r="17" fill="var(--ill-skin)" />
        <path
          d="M192 46 Q191 30 209 30 Q227 30 226 46 Q223 38 216 36 Q208 41 197 39 Q194 40 192 46 Z"
          fill="var(--ill-hair)"
        />
        <circle cx="203" cy="48" r="1.7" fill="var(--ill-hair)" />
        <circle cx="215" cy="48" r="1.7" fill="var(--ill-hair)" />
        <path d="M204 54 Q209 58 214 54" stroke="var(--ill-hair)" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      <defs>
        <linearGradient id="tee" x1="190" y1="68" x2="228" y2="126" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--grad-a)" />
          <stop offset="1" stopColor="var(--grad-c)" />
        </linearGradient>
        <linearGradient id="plusGrad" x1="153" y1="33" x2="191" y2="71" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--grad-a)" />
          <stop offset="1" stopColor="var(--grad-b)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
