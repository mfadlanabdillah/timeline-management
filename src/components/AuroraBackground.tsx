/**
 * Slowly drifting gradient blobs behind the page content. Purely decorative —
 * it sits under everything and never intercepts pointer events.
 */
export function AuroraBackground({ dense = false }: { dense?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ opacity: 'var(--aurora-opacity)' }}
    >
      <div
        className="animate-float absolute -left-[15%] -top-[18%] h-[46vw] w-[46vw] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, var(--grad-a), transparent 68%)',
          animation: 'drift-a 26s ease-in-out infinite',
        }}
      />
      <div
        className="absolute -right-[12%] top-[6%] h-[40vw] w-[40vw] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 60% 40%, var(--grad-b), transparent 66%)',
          animation: 'drift-b 32s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-20%] left-[22%] h-[42vw] w-[42vw] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(circle at 40% 60%, var(--grad-c), transparent 68%)',
          animation: 'drift-a 38s ease-in-out infinite reverse',
        }}
      />
      {dense && (
        <div
          className="absolute bottom-[10%] right-[10%] h-[30vw] w-[30vw] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, var(--grad-a), transparent 70%)',
            animation: 'drift-b 24s ease-in-out infinite',
          }}
        />
      )}

      {/* Very light grid to give the glass something to sit on. */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, var(--color-border) 60%, transparent) 1px, transparent 1px),' +
            'linear-gradient(to bottom, color-mix(in srgb, var(--color-border) 60%, transparent) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />
    </div>
  );
}
