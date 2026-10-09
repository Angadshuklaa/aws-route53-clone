// Small inline icons for the public landing page (Cloudscape icons are sized
// for the console, so the marketing-style page draws its own).
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = (props: IconProps): IconProps => ({
  width: 16,
  height: 16,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
  ...props,
});

export const ChevronDown = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base(props)}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export const ChevronRight = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base(props)}>
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export const ArrowRight = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base(props)}>
    <path d="M2 8h12M9 3l5 5-5 5" />
  </svg>
);

export const ArrowUp = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base(props)}>
    <path d="M8 14V2M3 7l5-5 5 5" />
  </svg>
);

export const Globe = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base({ strokeWidth: 1.5, ...props })}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M1.5 8h13M8 1.5c1.8 1.8 2.7 4 2.7 6.5S9.8 12.7 8 14.5C6.2 12.7 5.3 10.5 5.3 8S6.2 3.3 8 1.5z" />
  </svg>
);

export const Search = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base(props)}>
    <circle cx="7" cy="7" r="5" />
    <path d="M14 14l-3.5-3.5" />
  </svg>
);

export const UserCircle = (props: IconProps) => (
  <svg viewBox="0 0 32 32" {...base({ width: 32, height: 32, strokeWidth: 1.75, ...props })}>
    <circle cx="16" cy="16" r="14" />
    <circle cx="16" cy="12.5" r="4.5" />
    <path d="M7.5 25.5c1.8-3.7 4.9-5.5 8.5-5.5s6.7 1.8 8.5 5.5" />
  </svg>
);

export const Menu = (props: IconProps) => (
  <svg viewBox="0 0 20 20" {...base({ width: 20, height: 20, ...props })}>
    <path d="M3 5h14M3 10h14M3 15h14" />
  </svg>
);

export const Close = (props: IconProps) => (
  <svg viewBox="0 0 20 20" {...base({ width: 20, height: 20, ...props })}>
    <path d="M5 5l10 10M15 5L5 15" />
  </svg>
);

export const Plus = (props: IconProps) => (
  <svg viewBox="0 0 20 20" {...base({ width: 20, height: 20, ...props })}>
    <path d="M10 4v12M4 10h12" />
  </svg>
);

export const Minus = (props: IconProps) => (
  <svg viewBox="0 0 20 20" {...base({ width: 20, height: 20, ...props })}>
    <path d="M4 10h12" />
  </svg>
);

export const ThumbsUp = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base({ strokeWidth: 1.5, ...props })}>
    <path d="M5 7l3-5c1 0 1.6.8 1.4 1.8L9 6h4a1.5 1.5 0 011.5 1.7l-.8 5A1.5 1.5 0 0112.2 14H5V7zM5 7H2v7h3" />
  </svg>
);

export const ThumbsDown = (props: IconProps) => (
  <svg viewBox="0 0 16 16" {...base({ strokeWidth: 1.5, ...props })}>
    <path d="M11 9l-3 5c-1 0-1.6-.8-1.4-1.8L7 10H3a1.5 1.5 0 01-1.5-1.7l.8-5A1.5 1.5 0 013.8 2H11v7zM11 9h3V2h-3" />
  </svg>
);
