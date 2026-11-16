interface LogoProps {
  size?: number;
  /** Shows the "Raia" wordmark next to the mark. */
  withWordmark?: boolean;
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M7 12.5c2.25 0 2.25-1.5 4.5-1.5s2.25 1.5 4.5 1.5 2.25-1.5 4.5-1.5 2.25 1.5 4.5 1.5"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M7 20.5c2.25 0 2.25-1.5 4.5-1.5s2.25 1.5 4.5 1.5 2.25-1.5 4.5-1.5 2.25 1.5 4.5 1.5"
        stroke="#fff"
        strokeOpacity=".55"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ size = 28, withWordmark = true }: LogoProps) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {withWordmark && <span className="logo-wordmark">Raia</span>}
    </span>
  );
}
