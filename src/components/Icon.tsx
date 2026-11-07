const PATHS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  day: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  stats: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  character: 'M12 2l8 5v10l-8 5-8-5V7z M12 8l3 4-3 4-3-4z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  flame: 'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.6 2 3 0-3-1-5.5.5-8z',
  book: 'M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z M4 19V5',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  steps: 'M7 20c-2 0-3-2-3-4s1-4 3-4 2 2 2 4-1 4-2 4z M16 12c-2 0-3-2-3-4s1-4 3-4 2 2 2 4-1 4-2 4z',
  play: 'M7 4l12 8-12 8z',
  heart: 'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z',
  check: 'M9 11l3 3 8-8 M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  close: 'M6 6l12 12 M18 6L6 18'
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, color = 'currentColor', stroke = 2 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
