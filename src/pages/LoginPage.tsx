import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuroraBackground } from '../components/AuroraBackground';
import { BrandMark } from '../components/BrandMark';
import { ThemeToggle } from '../components/ThemeToggle';
import { PlanningIllustration } from '../components/illustrations/PlanningIllustration';

export function LoginPage() {
  const { login, setup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (isSetup) {
        await setup(username, password);
      } else {
        await login(username, password);
      }
      navigate('/admin');
    } catch {
      setError(
        isSetup
          ? 'Setup failed (an admin may already exist, or password < 8 chars)'
          : 'Invalid username or password',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg">
      <AuroraBackground />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <BrandMark />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-4 lg:grid-cols-2 lg:gap-16 lg:pt-10">
        {/* Story panel */}
        <section className="order-2 hidden lg:order-1 lg:block">
          <div className="stagger">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
              Project timelines
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-text">
              Every deadline,
              <br />
              <span className="text-gradient">in one clear picture.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-muted">
              Track daily progress, flag issues before they slip, and share a read-only
              view with your stakeholders — no account needed on their side.
            </p>
            <PlanningIllustration className="mt-6 w-full max-w-lg" />
          </div>
        </section>

        {/* Form card */}
        <section className="order-1 lg:order-2">
          <form
            onSubmit={handleSubmit}
            className="glass animate-scale-in mx-auto w-full max-w-md rounded-3xl p-8 sm:p-9"
          >
            <div className="stagger">
              <div>
                <h2 className="text-2xl font-semibold text-text">
                  {isSetup ? 'Create admin account' : 'Welcome back'}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {isSetup
                    ? 'First run on this device — this can only be done once.'
                    : 'Sign in to manage projects & timelines.'}
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="animate-fade-in mt-5 rounded-xl border border-issue/30 bg-issue-bg px-4 py-2.5 text-sm text-issue"
                >
                  {error}
                </p>
              )}

              <label className="mt-6 block text-sm">
                <span className="mb-1.5 block font-medium text-text-muted">Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  className="w-full rounded-xl border border-border bg-surface/70 px-4 py-3 text-text outline-none transition-shadow placeholder:text-text-muted/60 focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]"
                  placeholder="admin"
                />
              </label>

              <label className="mt-4 block text-sm">
                <span className="mb-1.5 block font-medium text-text-muted">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-border bg-surface/70 px-4 py-3 text-text outline-none transition-shadow placeholder:text-text-muted/60 focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]"
                  placeholder="••••••••"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="lift bg-brand-gradient mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    {isSetup ? 'Creating...' : 'Signing in...'}
                  </>
                ) : isSetup ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSetup((v) => !v);
                  setError(null);
                }}
                className="mt-3 w-full text-center text-xs font-medium text-text-muted hover:text-primary"
              >
                {isSetup ? 'Already have an account? Sign in' : 'First run? Create admin account'}
              </button>

              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-text-muted">or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Link
                to="/"
                className="lift mt-4 block rounded-xl border border-border py-3 text-center text-sm font-medium text-text-muted hover:border-primary hover:text-primary"
              >
                View a timeline with a project code
              </Link>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
