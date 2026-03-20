export function AuthLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 28 28" fill="none" className="w-5 h-5" aria-hidden="true">
          <defs>
            <linearGradient id="authLogoGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a5b4fc" />
            </linearGradient>
          </defs>
          <rect x="3" y="14" width="5" height="11" rx="1" fill="url(#authLogoGrad)" />
          <rect x="11" y="9" width="5" height="16" rx="1" fill="url(#authLogoGrad)" opacity="0.78" />
          <rect x="19" y="4" width="5" height="21" rx="1" fill="url(#authLogoGrad)" opacity="0.5" />
          <path
            d="M3 18 L8.5 12 L14 15 L19.5 8 L25 5"
            stroke="url(#authLogoGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-sm font-semibold text-white/90 tracking-tight">Portfolio</span>
    </div>
  );
}
