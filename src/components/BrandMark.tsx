import { Link } from 'react-router-dom';

/** Logo + wordmark used in page headers. */
export function BrandMark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5">
      <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-lg shadow-primary/25 transition-transform duration-300 group-hover:scale-105">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="2" y="3" width="10" height="3" rx="1.5" fill="white" />
          <rect x="5" y="7.5" width="11" height="3" rx="1.5" fill="white" opacity="0.85" />
          <rect x="3" y="12" width="8" height="3" rx="1.5" fill="white" opacity="0.7" />
        </svg>
      </span>
      <span className="text-base font-semibold tracking-tight text-text">
        Timeline
      </span>
    </Link>
  );
}
