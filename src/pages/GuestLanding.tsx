import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuroraBackground } from '../components/AuroraBackground';
import { BrandMark } from '../components/BrandMark';
import { ThemeToggle } from '../components/ThemeToggle';
import { AccessIllustration } from '../components/illustrations/AccessIllustration';

export function GuestLanding() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    navigate(`/p/${code.trim().toUpperCase()}`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <AuroraBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <BrandMark />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-4 lg:grid-cols-2 lg:gap-16 lg:pt-10">
        <section className="order-2 hidden lg:order-1 lg:block">
          <div className="stagger">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Guest access
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-text">
              Got a code?
              <br />
              <span className="text-gradient">You&apos;re already in.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
              No sign-up, no password. Enter the code your project admin shared and see
              the live timeline — you can leave notes and raise issues too.
            </p>
            <AccessIllustration className="mt-6 w-full max-w-lg" />
          </div>
        </section>

        <section className="order-1 lg:order-2">
          <div className="glass animate-scale-in mx-auto w-full max-w-md rounded-3xl p-8 text-center sm:p-9">
            <div className="stagger">
              <div>
                <h2 className="text-2xl font-semibold text-text">Open a project</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Enter the project code to view its timeline.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-7">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="WEB2026"
                  autoFocus
                  aria-label="Project code"
                  className="w-full rounded-xl border border-border bg-surface/70 px-4 py-4 text-center text-lg font-semibold uppercase tracking-[0.3em] text-text outline-none transition-shadow placeholder:font-normal placeholder:tracking-[0.2em] placeholder:text-text-muted/50 focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]"
                />
                <button
                  type="submit"
                  disabled={!code.trim()}
                  className="lift bg-brand-gradient mt-5 w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 disabled:opacity-50"
                >
                  View timeline
                </button>
              </form>

              <div className="mt-7 grid grid-cols-3 gap-2 text-[11px] text-text-muted">
                <Perk label="Live progress" />
                <Perk label="Add notes" />
                <Perk label="Raise issues" />
              </div>

              <p className="mt-7 text-xs text-text-muted">
                Managing this project?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Admin sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Perk({ label }: { label: string }) {
  return (
    <span className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-surface/40 px-2 py-3">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M2 7.5 L5.5 11 L12 3.5"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </span>
  );
}
