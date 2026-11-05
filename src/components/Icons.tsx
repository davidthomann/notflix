import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = (children: ReactNode) => (props: P) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.700" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);
const solid = (children: ReactNode) => (props: P) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const IconPlay = solid(<path d="M6 3.5v17a.5.5 0 0 0 .76.43l14-8.5a.5.5 0 0 0 0-.86l-14-8.5A.5.5 0 0 0 6 3.5z" />);
export const IconPause = solid(<><rect x="5" y="3" width="5" height="18" rx="1" /><rect x="14" y="3" width="5" height="18" rx="1" /></>);
export const IconInfo = base(<><circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7.2v.1" /></>);
export const IconPlus = base(<path d="M12 4v16M4 12h16" />);
export const IconCheck = base(<path d="M4 12.5l5.5 5.5L20 6.5" />);
export const IconClose = base(<path d="M5 5l14 14M19 5L5 19" />);
export const IconChevronDown = base(<path d="M5 9l7 7 7-7" />);
export const IconChevronLeft = base(<path d="M15 4l-8 8 8 8" />);
export const IconChevronRight = base(<path d="M9 4l8 8-8 8" />);
export const IconSearch = base(<><circle cx="10.5" cy="10.5" r="7" /><path d="M16 16l5 5" /></>);
export const IconBell = base(<><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6.5 2 7.5H4c0-1 2-2.5 2-7.5z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>);
export const IconHome = solid(<path d="M12 3l9 8v10h-6v-6H9v6H3V11z" />);
export const IconFlame = solid(<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-2.5 1-4 2-5 .3 1.6 1 2.4 2 3 0-4 .5-7 2-10z" />);
export const IconUser = solid(<><circle cx="12" cy="8" r="4.5" /><path d="M3.5 21c.8-4.8 4.2-7 8.5-7s7.700 2.200 8.500 7z" /></>);
export const IconThumbUp = base(<path d="M7 11l4-8a2.500 2.500 0 0 1 2.500 2.500V9h5.300a2 2 0 0 1 2 2.300l-1.200 7.500a2 2 0 0 1-2 1.700H7zM7 11H3.500v9.500H7" />);
export const IconThumbDown = base(<path d="M17 13l-4 8a2.500 2.500 0 0 1-2.500-2.500V15H5.200a2 2 0 0 1-2-2.300l1.200-7.500a2 2 0 0 1 2-1.700H17zM17 13h3.500V3.500H17" />);
export const IconVolume = base(<><path d="M4 9.500v5h3.500L12 19V5L7.500 9.500z" fill="currentColor" /><path d="M15.500 9a4.500 4.500 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11" /></>);
export const IconVolumeLow = base(<><path d="M4 9.500v5h3.500L12 19V5L7.500 9.500z" fill="currentColor" /><path d="M15.500 9a4.500 4.500 0 0 1 0 6" /></>);
export const IconMuted = base(<><path d="M4 9.500v5h3.500L12 19V5L7.500 9.500z" fill="currentColor" /><path d="M16 9.500l5 5M21 9.500l-5 5" /></>);
export const IconReplay = base(<><path d="M4 12a8 8 0 1 0 2.600-5.900" /><path d="M6.500 2.500v4h4" /></>);
export const IconFullscreen = base(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const IconFullscreenExit = base(<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />);
export const IconSubtitles = base(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 11h4M13 11h4M7 15h7M16 15h1" /></>);
export const IconEpisodes = base(<><rect x="8" y="4" width="13" height="11" rx="1.500" /><path d="M5 8v10a1.500 1.500 0 0 0 1.500 1.500H17" /></>);
export const IconNext = solid(<><path d="M4 4.500v15a.5.5 0 0 0 .77.42L16 12.800V19a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v6.200L4.770 4.080A.5.5 0 0 0 4 4.500z" /></>);
export const IconSpeed = base(<><path d="M4.500 18a9.500 9.500 0 1 1 15 0" /><path d="M12 14l4-5" /><circle cx="12" cy="14" r="1.200" fill="currentColor" /></>);
export const IconBack = base(<path d="M20 12H4M11 5l-7 7 7 7" />);
export const IconLock = base(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7.500a4 4 0 0 1 8 0V11" /></>);
export const IconShare = base(<><path d="M12 15V3M7.500 7.500L12 3l4.500 4.500" /><path d="M5 13v6.500a1.500 1.500 0 0 0 1.500 1.500h11a1.500 1.500 0 0 0 1.500-1.500V13" /></>);
export const IconSettings = base(<><circle cx="12" cy="12" r="3" /><path d="M12 2.500v3M12 18.500v3M2.500 12h3M18.500 12h3M5.300 5.300l2.100 2.100M16.600 16.600l2.100 2.100M5.300 18.700l2.100-2.100M16.600 7.400l2.100-2.100" /></>);
export const IconSwitch = base(<path d="M4 8h14l-3.500-3.500M20 16H6l3.500 3.500" />);
export const IconLogout = base(<path d="M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5M10 8l-4 4 4 4M6 12h10" />);
export const IconWarning = base(<><path d="M12 3L2 21h20z" /><path d="M12 10v5M12 18v.1" /></>);

export const IconCaret = solid(<path d="M6.500 9.500h11a.5.5 0 0 1 .39.81l-5.500 6.500a.5.5 0 0 1-.78 0l-5.500-6.500a.5.5 0 0 1 .39-.81z" />);
export const IconPencil = base(<path d="M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 3L8 18.500zM14.500 6l3 3" />);
export const IconAccount = base(<><circle cx="12" cy="8" r="4" /><path d="M4.500 20.500c.8-4 3.800-6 7.500-6s6.700 2 7.500 6" /></>);
export const IconHelp = base(<><circle cx="12" cy="12" r="9.500" /><path d="M9.500 9.500a2.600 2.600 0 1 1 3.800 2.300c-.9.500-1.300 1-1.300 2M12 17v.1" /></>);
export const IconMenu = base(<path d="M4 7h16M4 12h16M4 17h16" />);

export function IconSkip({ direction, ...props }: P & { direction: 'back' | 'forward' }) {
  const back = direction === 'back';
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <g transform={back ? undefined : 'matrix(-1 0 0 1 24 0)'}>
        <path d="M4.500 8.500a9 9 0 1 1-1.500 5" />
        <path d="M4 3.500v5h5" />
      </g>
      <text x="12" y="16.800" textAnchor="middle" fontSize="7.500" fontWeight="700" fill="currentColor" stroke="none">10</text>
    </svg>
  );
}
