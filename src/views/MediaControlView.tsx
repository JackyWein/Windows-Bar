import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, Volume2, Music } from 'lucide-react';
import '../styles/youtube-music.css';

interface MediaControlViewProps {
  onBack: () => void;
}

interface Track {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  volume: number;
  message?: string;
}

export function MediaControlView({ onBack }: MediaControlViewProps) {
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTrack: null,
    volume: 75,
    message: '',
  });

  const fetchState = useCallback(async () => {
    try {
      const result = await window.pluginAPI.invokeMainAction?.('media-control', 'getState');
      if (result) {
        setState({
          isPlaying: result.isPlaying,
          currentTrack: result.currentTrack,
          volume: result.volume,
          message: result.message || '',
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleTogglePlay = useCallback(async () => {
    try {
      if (state.isPlaying) {
        await window.pluginAPI.invokeMainAction?.('media-control', 'pause');
      } else {
        await window.pluginAPI.invokeMainAction?.('media-control', 'resume');
      }
      setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    } catch { /* ignore */ }
  }, [state.isPlaying]);

  const handleNext = useCallback(async () => {
    try {
      await window.pluginAPI.invokeMainAction?.('media-control', 'next');
    } catch { /* ignore */ }
  }, []);

  const handlePrev = useCallback(async () => {
    try {
      await window.pluginAPI.invokeMainAction?.('media-control', 'prev');
    } catch { /* ignore */ }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value);
    setState(prev => ({ ...prev, volume: vol }));
    window.pluginAPI.invokeMainAction?.('media-control', 'setVolume', { level: vol });
  }, []);

  return (
    <div className="app-container">
      <div className="search-glass ytm-view">
        <div className="ytm-header">
          <button className="ytm-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Zurück</span>
          </button>
          <div className="ytm-header-center">
            <span className="ytm-title">Media Control</span>
          </div>
        </div>

        <div className="ytm-container">
          <div className="ytm-player">
            <div className="ytm-album-art">
              {state.currentTrack?.artwork ? (
                <img src={state.currentTrack.artwork} alt="" className="ytm-album-img" />
              ) : (
                <div className="ytm-album-placeholder">
                  <Music size={48} />
                </div>
              )}
            </div>

            <div className="ytm-track-info">
              <h3 className="ytm-track-title">
                {state.currentTrack?.title || 'Keine Wiedergabe'}
              </h3>
              <p className="ytm-track-artist">
                {state.currentTrack?.artist || state.message || 'Nutze /media um Apps zu öffnen'}
              </p>
            </div>

            <div className="ytm-controls">
              <button className="ytm-ctrl-btn" onClick={handlePrev} title="Vorheriger">
                <SkipBack size={20} />
              </button>
              <button className="ytm-ctrl-btn ytm-play-btn" onClick={handleTogglePlay}>
                {state.isPlaying ? <Pause size={28} /> : <Play size={28} />}
              </button>
              <button className="ytm-ctrl-btn" onClick={handleNext} title="Nächster">
                <SkipForward size={20} />
              </button>
            </div>

            <div className="ytm-volume">
              <Volume2 size={16} />
              <input
                type="range"
                className="ytm-volume-slider"
                min={0}
                max={100}
                value={state.volume}
                onChange={handleVolumeChange}
              />
              <span className="ytm-volume-value">{state.volume}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}