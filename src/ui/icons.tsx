import type { SVGProps } from 'react';

// docs/UI_DESIGN.md → Icons: inline SVG, 1.5 px stroke, --ink, 16 px. No icon library.

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const PlayIcon = (p: P) => <Svg {...p}><path d="M5 3.5v9l7-4.5z" fill="currentColor" /></Svg>;
export const StopIcon = (p: P) => <Svg {...p}><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" /></Svg>;
export const ReturnIcon = (p: P) => <Svg {...p}><path d="M4 3.5v9" /><path d="M12 3.5 6.5 8l5.5 4.5z" fill="currentColor" /></Svg>;
export const LoopIcon = (p: P) => <Svg {...p}><path d="M3 7a3 3 0 0 1 3-3h6l-2-2M13 9a3 3 0 0 1-3 3H4l2 2" /></Svg>;
export const RecordIcon = (p: P) => <Svg {...p}><circle cx="8" cy="8" r="4" fill="currentColor" /></Svg>;
export const UndoIcon = (p: P) => <Svg {...p}><path d="M5.5 3 2.5 6l3 3" /><path d="M2.5 6h7a4 4 0 0 1 0 8h-2" /></Svg>;
export const RedoIcon = (p: P) => <Svg {...p}><path d="M10.5 3l3 3-3 3" /><path d="M13.5 6h-7a4 4 0 0 0 0 8h2" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p}><path d="M8 3v10M3 8h10" /></Svg>;
export const TrashIcon = (p: P) => <Svg {...p}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" /></Svg>;
export const UploadIcon = (p: P) => <Svg {...p}><path d="M8 10.5V3M5 6l3-3 3 3M3 10.5v2.5h10v-2.5" /></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p}><path d="M8 3v7.5M5 7.5l3 3 3-3M3 10.5v2.5h10v-2.5" /></Svg>;
export const SparkleIcon = (p: P) => <Svg {...p}><path d="M8 2.5 9.3 6.7 13.5 8 9.3 9.3 8 13.5 6.7 9.3 2.5 8l4.2-1.3z" /></Svg>;
export const MoreIcon = (p: P) => <Svg {...p}><circle cx="3.5" cy="8" r=".8" fill="currentColor" /><circle cx="8" cy="8" r=".8" fill="currentColor" /><circle cx="12.5" cy="8" r=".8" fill="currentColor" /></Svg>;
export const BackIcon = (p: P) => <Svg {...p}><path d="M9.5 3.5 5 8l4.5 4.5" /></Svg>;
export const CloseIcon = (p: P) => <Svg {...p}><path d="M4 4l8 8M12 4l-8 8" /></Svg>;
export const WarningIcon = (p: P) => <Svg {...p}><path d="M8 2.5 14 13H2z" /><path d="M8 6.5v3M8 11.2v.1" /></Svg>;
export const BeatIcon = (p: P) => <Svg {...p}><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" fill="currentColor" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" fill="currentColor" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></Svg>;
export const WaveIcon = (p: P) => <Svg {...p}><path d="M2 8h1.5M4.5 5v6M7 3v10M9.5 5.5v5M12 7v2M13.5 8H14" /></Svg>;
export const MixerIcon = (p: P) => <Svg {...p}><path d="M4 2.5v11M8 2.5v11M12 2.5v11" /><rect x="2.5" y="8.5" width="3" height="2" rx=".5" fill="currentColor" /><rect x="6.5" y="4.5" width="3" height="2" rx=".5" fill="currentColor" /><rect x="10.5" y="10" width="3" height="2" rx=".5" fill="currentColor" /></Svg>;
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="7" cy="7" r="4" /><path d="m10 10 3.5 3.5" /></Svg>;
export const KeyboardIcon = (p: P) => <Svg {...p}><rect x="1.5" y="4" width="13" height="8" rx="1.5" /><path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 9.5h6" /></Svg>;
