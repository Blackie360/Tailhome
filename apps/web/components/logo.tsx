export function Logo() {
  return (
    <a className="group flex items-center gap-3" href="#top" aria-label="TailHome home">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M7 19.5 20 8l13 11.5V32a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V19.5Z" stroke="currentColor" strokeWidth="2" />
          <path d="M14 34V23h12v11M11 16.5h18" stroke="currentColor" strokeWidth="2" />
          <circle cx="20" cy="18" r="2.5" fill="currentColor" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-white" translate="no">
        Tail<span className="text-emerald-300">Home</span>
      </span>
    </a>
  );
}
