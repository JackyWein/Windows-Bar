import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, SkipForward, Music } from 'lucide-react';
import '../styles/media-control.css';

interface CompactPlayerProps {
  onExpand: () => void;
  onVisibilityChange: (visible: boolean) => void;
}

interface TrackInfo {
  title: string;
  artist: string;
  artwork?: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentTrack: TrackInfo | null;
  volume: number;
}

export function CompactPlayer({ onExpand, onVisibilityChange }: CompactPlayerProps) {
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTrack: null,
    volume: 75,
  });

  const fetchState = useCallback(async () => {
    try {
      const result = await window.pluginAPI.invokeMainAction?.('media-control', 'getState');
      if (result) {
        setState({
          isPlaying: result.isPlaying,
          currentTrack: result.currentTrack,
          volume: result.volume,
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    onVisibilityChange(!!state.currentTrack);
  }, [state.currentTrack, onVisibilityChange]);

  const handleTogglePlay = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (state.isPlaying) {
        await window.pluginAPI.invokeMainAction?.('media-control', 'pause');
      } else {
        await window.pluginAPI.invokeMainAction?.('media-control', 'resume');
      }
      setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    } catch { /* ignore */ }
  }, [state.isPlaying]);

  const handleNext = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const result = await window.pluginAPI.invokeMainAction?.('media-control', 'next');
      if (result?.track) {
        setState(prev => ({
          ...prev,
          currentTrack: result.track,
          isPlaying: true,
        }));
      }
    } catch { /* ignore */ }
  }, []);

  if (!state.currentTrack) return null;

  return (
    <div className="compact-plugin-badge" onClick={onExpand} title="Media öffnen">
      <div className="compact-plugin-icon">
        {state.currentTrack.artwork ? (
          <img src={state.currentTrack.artwork} alt="" />
        ) : (
          <Music size={14} />
        )}
      </div>
      <div className="compact-plugin-info">
        <span className="compact-plugin-title">{state.currentTrack.title}</span>
        <span className="compact-plugin-subtitle">{state.currentTrack.artist}</span>
      </div>
      <div className="compact-plugin-controls">
        <button className="compact-ctrl-btn" onClick={handleTogglePlay} title={state.isPlaying ? 'Pause' : 'Play'}>
          {state.isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="compact-ctrl-btn" onClick={handleNext} title="Nächster Titel">
          <SkipForward size={14} />
        </button>
      </div>
    </div>
  );
}
