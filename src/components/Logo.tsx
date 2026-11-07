import { useId } from "react";

export function Logo({ size = 22 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const top = `top-${id}`;
  const left = `left-${id}`;
  const right = `right-${id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={top} x1="4" y1="3" x2="18" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d8fff0" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
        <linearGradient id={left} x1="3" y1="8" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#118a80" />
          <stop offset="1" stopColor="#032925" />
        </linearGradient>
        <linearGradient id={right} x1="12" y1="9" x2="21" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#33d6c0" />
          <stop offset="1" stopColor="#0b8b80" />
        </linearGradient>
      </defs>
      <path d="M12 2.4 20.8 7.2v9.6L12 21.6 3.2 16.8V7.2z" fill="#07120f" />
      <path d="M12 2.4 20.8 7.2 12 12 3.2 7.2z" fill={`url(#${top})`} />
      <path d="M3.2 7.2 12 12v9.6l-8.8-4.8z" fill={`url(#${left})`} />
      <path d="M20.8 7.2 12 12v9.6l8.8-4.8z" fill={`url(#${right})`} />
    </svg>
  );
}
