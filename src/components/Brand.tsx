import { useId, type ReactNode } from 'react';
import { userImage } from '../api/images';
import { useSession } from '../state/session';

export const APP_NAME: string = import.meta.env.VITE_APP_NAME || 'Jellyfin';

export function Logo({ className }: { className?: string }) {
  return <span className={`logo ${className ?? ''}`}>{APP_NAME}</span>;
}

const GRADIENTS: [string, string][] = [
  ['#2f80ed', '#123a8c'],
  ['#11b39a', '#0a4f63'],
  ['#f2994a', '#b5340f'],
  ['#9b51e0', '#2f1a80'],
  ['#eb5793', '#7d1a6b'],
  ['#3fbf6b', '#0f5c44'],
  ['#e0483e', '#7a0f2f'],
  ['#5d7a99', '#1c2b3f'],
];

/** Simple abstract motifs, drawn on a 64 × 64 tile. Large shapes stay readable at 24 px. */
const MOTIFS: ReactNode[] = [
  // Sun over water
  <>
    <circle cx="32" cy="29" r="15" fill="#fff" fillOpacity=".92" />
    <path d="M0 42c8-5 13-5 21 0s13 5 21 0 14-5 22 0v22H0z" fill="#000" fillOpacity=".28" />
  </>,
  // Mountains
  <>
    <circle cx="47" cy="17" r="6" fill="#fff" fillOpacity=".9" />
    <path d="M0 64 22 25l14 23 9-13 19 29z" fill="#fff" fillOpacity=".88" />
  </>,
  // Orbit
  <>
    <circle cx="30" cy="34" r="16" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="7" />
    <circle cx="48" cy="16" r="6.500" fill="#fff" fillOpacity=".9" />
  </>,
  // Stacked bars
  <g fill="#fff" fillOpacity=".9">
    <rect x="13" y="15" width="38" height="9" rx="4.500" />
    <rect x="13" y="28" width="26" height="9" rx="4.500" fillOpacity=".7" />
    <rect x="13" y="41" width="33" height="9" rx="4.500" fillOpacity=".5" />
  </g>,
  // Overlapping circles
  <g fill="#fff">
    <circle cx="25" cy="32" r="15" fillOpacity=".92" />
    <circle cx="40" cy="32" r="15" fillOpacity=".5" />
  </g>,
  // Diamond
  <>
    <path d="M32 10 54 32 32 54 10 32z" fill="#fff" fillOpacity=".9" />
    <path d="M32 22 42 32 32 42 22 32z" fill="#000" fillOpacity=".25" />
  </>,
];

function hashOf(text: string): number {
  let hash = 7;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** Profile picture for users without an uploaded image; the same user always gets the same tile. */
function GeneratedAvatar({ userId, size }: { userId: string; size: number }) {
  const id = useId();
  const hash = hashOf(userId);
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return (
    <svg className="avatar" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      {MOTIFS[(hash >>> 4) % MOTIFS.length]}
    </svg>
  );
}

export function Avatar({ userId, tag, size = 32 }: { userId: string; name?: string; tag?: string | null; size?: number }) {
  const { serverUrl } = useSession();
  const src = serverUrl ? userImage(serverUrl, userId, tag, size * 3) : null;
  return src ? <img className="avatar" src={src} alt="" style={{ width: size, height: size }} /> : <GeneratedAvatar userId={userId} size={size} />;
}
