import { useMemo, useRef, useState } from 'react';
import type { TrickplayInfo } from '../api/types';
import { formatClock } from '../lib/format';

interface TrickplaySheets {
  info: TrickplayInfo;
  /** URL of tile sheet number `index`. */
  sheetUrl: (index: number) => string;
}

interface ScrubberProps {
  time: number;
  duration: number;
  buffered: number;
  trickplay: TrickplaySheets | null;
  onSeek: (seconds: number) => void;
  onScrubChange?: (scrubbing: boolean) => void;
}

const PREVIEW_WIDTH = 240;

function thumbStyle(trickplay: TrickplaySheets, seconds: number): React.CSSProperties {
  const { info, sheetUrl } = trickplay;
  const index = Math.min(info.ThumbnailCount - 1, Math.floor((seconds * 1000) / info.Interval));
  const perSheet = info.TileWidth * info.TileHeight;
  const sheet = Math.floor(index / perSheet);
  const within = index % perSheet;
  const col = within % info.TileWidth;
  const row = Math.floor(within / info.TileWidth);
  return {
    width: PREVIEW_WIDTH,
    height: (PREVIEW_WIDTH * info.Height) / info.Width,
    backgroundImage: `url("${sheetUrl(sheet)}")`,
    backgroundSize: `${info.TileWidth * 100}% ${info.TileHeight * 100}%`,
    backgroundPosition: `${info.TileWidth > 1 ? (col / (info.TileWidth - 1)) * 100 : 0}% ${info.TileHeight > 1 ? (row / (info.TileHeight - 1)) * 100 : 0}%`,
  };
}

export function Scrubber({ time, duration, buffered, trickplay, onSeek, onScrubChange }: ScrubberProps) {
  const bar = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const fromEvent = (clientX: number) => {
    const rect = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * duration;
  };

  const shown = drag ?? time;
  const pct = duration > 0 ? (shown / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const preview = drag ?? hover;
  const previewPct = useMemo(() => (preview !== null && duration > 0 ? (preview / duration) * 100 : 0), [preview, duration]);

  return (
    <div className="scrubber">
      <div
        ref={bar}
        className={`scrubber__bar${drag !== null ? ' is-dragging' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Wiedergabeposition"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={formatClock(shown)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(fromEvent(e.clientX));
          onScrubChange?.(true);
        }}
        onPointerMove={(e) => {
          if (drag !== null) setDrag(fromEvent(e.clientX));
          else if (e.pointerType === 'mouse') setHover(fromEvent(e.clientX));
        }}
        onPointerUp={(e) => {
          if (drag === null) return;
          onSeek(fromEvent(e.clientX));
          setDrag(null);
          onScrubChange?.(false);
        }}
        onPointerCancel={() => {
          setDrag(null);
          onScrubChange?.(false);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="scrubber__track">
          <div className="scrubber__buffered" style={{ width: `${bufferedPct}%` }} />
          <div className="scrubber__played" style={{ width: `${pct}%` }} />
        </div>
        <div className="scrubber__knob" style={{ left: `${pct}%` }} />
        {preview !== null && (
          <div className="scrubber__preview" style={{ left: `clamp(${PREVIEW_WIDTH / 2}px, ${previewPct}%, calc(100% - ${PREVIEW_WIDTH / 2}px))` }}>
            {trickplay && <div className="scrubber__thumb" style={thumbStyle(trickplay, preview)} />}
            <span>{formatClock(preview)}</span>
          </div>
        )}
      </div>
      <span className="scrubber__remaining">{formatClock(Math.max(0, duration - shown))}</span>
    </div>
  );
}
