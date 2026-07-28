export default function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "brand-mark small" : "brand-mark"} aria-hidden="true">
      <svg viewBox="0 0 128 128" role="img" focusable="false">
        <defs>
          <clipPath id="task-logo-shape">
            <rect x="8" y="8" width="112" height="112" rx="28" />
          </clipPath>
        </defs>
        <g clipPath="url(#task-logo-shape)">
          <rect width="128" height="128" fill="#f7f8f5" />
          <path d="M8 8H64V64H8Z" fill="#147b70" />
          <path d="M64 8H120V64H64Z" fill="#e6f4f0" />
          <path d="M64 64H120V120H64Z" fill="#203235" />
        </g>
        <path d="M35 65L54 83L93 43" fill="none" stroke="#f7f8f5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="18" />
        <path d="M35 65L54 83L93 43" fill="none" stroke="#147b70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="11" />
      </svg>
    </span>
  );
}
