import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, ThumbsUp, ThumbsDown, Volume2, VolumeX } from 'lucide-react';
import { mediaBus } from '../core/media/mediaBus';
import type { MediaState } from '../core/media/mediaBus';
import '../styles/media-control.css';

interface CompactPlayerProps {
  onExpand: () => void;
  onVisibilityChange?: (visible: boolean) => void;
}

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Average color of the cover for a matching glow. Uses a separate sampling image;
// if CORS blocks pixel access it silently falls back to the theme accent.
function useCoverColor(url?: string): string | null {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { setColor(null); return; }
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 8; c.height = 8;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
        if (active && n) setColor(`rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`);
      } catch { if (active) setColor(null); }
    };
    img.onerror = () => { if (active) setColor(null); };
    img.src = url;
    return () => { active = false; };
  }, [url]);
  return color;
}

export function CompactPlayer({ onExpand, onVisibilityChange }: CompactPlayerProps) {
  const [state, setState] = useState<MediaState>(() => mediaBus.get());
  useEffect(() => mediaBus.subscribe(setState), []);

  const hasTrack = !!(state.track && state.track.title);
  useEffect(() => { onVisibilityChange?.(hasTrack); }, [hasTrack, onVisibilityChange]);

  const glow = useCoverColor(state.track?.artwork);

  if (!hasTrack || !state.track) return null;

  const pct = state.duration > 0 ? Math.min(100, (state.currentTime / state.duration) * 100) : 0;
  const ctrl = (action: string, e?: React.MouseEvent) => { e?.stopPropagation(); mediaBus.control(action); };
  const onVolume = (e: React.ChangeEvent<HTMLInputElement>) => { e.stopPropagation(); mediaBus.control('volume', Number(e.target.value)); };
  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!state.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    mediaBus.control('seek', frac * state.duration);
  };

  const glowShadow = glow ? `${glow}88` : 'rgba(var(--accent-rgb), 0.35)';
  const artShadow = glow ? `${glow}aa` : 'rgba(var(--accent-rgb), 0.5)';

  return (
    <div
      className="ytm-bar"
      onClick={onExpand}
      title="Player öffnen"
      style={{ boxShadow: `0 10px 32px -12px ${glowShadow}`, ...(glow ? { borderColor: `${glow}55` } : {}) }}
    >
      {glow && <div className="ytm-bar-glow" style={{ background: `radial-gradient(120px 80px at 0% 50%, ${glow}33, transparent 70%)` }} />}

      <div className="ytm-bar-art" style={{ boxShadow: `0 4px 16px -3px ${artShadow}` }}>
        {state.track.artwork ? <img src={state.track.artwork} alt="" /> : <Music size={18} />}
      </div>

      <div className="ytm-bar-info">
        <span className="ytm-bar-title">{state.track.title}</span>
        <span className="ytm-bar-artist">{state.track.artist}</span>
      </div>

      <div className="ytm-bar-controls">
        <button className={`ytm-icon-btn ${state.likeStatus === 'LIKE' ? 'ytm-like-active' : ''}`} onClick={(e) => ctrl('like', e)} title="Mag ich"><ThumbsUp size={15} /></button>
        <button className={`ytm-icon-btn ${state.likeStatus === 'DISLIKE' ? 'ytm-dislike-active' : ''}`} onClick={(e) => ctrl('dislike', e)} title="Mag ich nicht"><ThumbsDown size={15} /></button>

        <span className="ytm-bar-divider" />

        <button className="ytm-icon-btn" onClick={(e) => ctrl('prev', e)} title="Zurück"><SkipBack size={16} /></button>
        <button className="ytm-play-circle" onClick={(e) => ctrl('playpause', e)} title={state.isPlaying ? 'Pause' : 'Play'}>
          {state.isPlaying ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: 1 }} />}
        </button>
        <button className="ytm-icon-btn" onClick={(e) => ctrl('next', e)} title="Weiter"><SkipForward size={16} /></button>

        <div className="ytm-bar-volume" onClick={(e) => e.stopPropagation()}>
          <button className="ytm-icon-btn" onClick={(e) => { e.stopPropagation(); mediaBus.control('volume', state.volume === 0 ? 80 : 0); }} title="Stummschalten">
            {state.volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
          <input type="range" className="ytm-bar-vol-slider" min={0} max={100} value={state.volume} onChange={onVolume} />
        </div>

        <span className="ytm-bar-time">{fmt(state.currentTime)} / {fmt(state.duration)}</span>
      </div>

      <div className="ytm-bar-seek" onClick={onSeek} title="Spulen">
        <div className="ytm-bar-seek-fill" style={{ width: `${pct}%` }}><span className="ytm-bar-seek-thumb" /></div>
      </div>
    </div>
  );
}
