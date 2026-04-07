import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Pause, SkipForward, SkipBack, Volume2, Search, Loader2, LogIn } from 'lucide-react';
import '../styles/youtube-music.css';

interface YouTubeMusicViewProps {
  onBack: () => void;
}

interface Track {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  audioUrl?: string;
}

interface PlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  volume: number;
}

export function YouTubeMusicView({ onBack }: YouTubeMusicViewProps) {
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTrack: null,
    volume: 75,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const state = await window.pluginAPI.invokeMainAction?.('youtube-music', 'getState');
      if (state) {
        setPlayerState({
          isPlaying: state.isPlaying,
          currentTrack: state.currentTrack,
          volume: state.volume,
        });
        if (state.currentTrack?.duration) {
          setDuration(state.currentTrack.duration);
        }
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playerState.volume / 100;
    }
  }, [playerState.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setProgress(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
    };
  }, [playerState.currentTrack?.audioUrl]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await window.pluginAPI.invokeMainAction?.('youtube-music', 'search', { query });
        setSearchResults(results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const handlePlayTrack = useCallback(async (track: Track) => {
    try {
      const result = await window.pluginAPI.invokeMainAction?.('youtube-music', 'play', { videoId: track.videoId });
      if (result?.track) {
        setPlayerState(prev => ({
          ...prev,
          isPlaying: true,
          currentTrack: result.track,
        }));
      }
    } catch (err: any) {
      console.error('Failed to play:', err);
    }
  }, []);

  const handleTogglePlay = useCallback(async () => {
    try {
      if (playerState.isPlaying) {
        await window.pluginAPI.invokeMainAction?.('youtube-music', 'pause');
        audioRef.current?.pause();
        setPlayerState(prev => ({ ...prev, isPlaying: false }));
      } else {
        await window.pluginAPI.invokeMainAction?.('youtube-music', 'resume');
        audioRef.current?.play();
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
      }
    } catch { /* ignore */ }
  }, [playerState.isPlaying]);

  const handleNext = useCallback(async () => {
    try {
      const result = await window.pluginAPI.invokeMainAction?.('youtube-music', 'next');
      if (result?.track) {
        setPlayerState(prev => ({
          ...prev,
          currentTrack: result.track,
          isPlaying: true,
        }));
      }
    } catch { /* ignore */ }
  }, []);

  const handlePrev = useCallback(async () => {
    try {
      const result = await window.pluginAPI.invokeMainAction?.('youtube-music', 'prev');
      if (result?.track) {
        setPlayerState(prev => ({
          ...prev,
          currentTrack: result.track,
          isPlaying: true,
        }));
      }
    } catch { /* ignore */ }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseInt(e.target.value);
    setPlayerState(prev => ({ ...prev, volume: vol }));
    window.pluginAPI.invokeMainAction?.('youtube-music', 'setVolume', { level: vol });
  }, []);

   const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
     const time = parseFloat(e.target.value);
     setProgress(time);
     if (audioRef.current) {
       audioRef.current.currentTime = time;
     }
   }, []);

   const handleSignIn = useCallback(async () => {
     try {
       const result = await window.pluginAPI.signIn?.('youtube-music');
       if (result?.success) {
         alert(result.message || 'Erfolgreich angemeldet!');
       } else {
         alert(result?.message || 'Anmeldung fehlgeschlagen');
       }
     } catch (err) {
       console.error('Sign in error:', err);
       alert('Anmeldung fehlgeschlagen: ' + (err as Error).message);
     }
   }, []);

   const formatTime = (seconds: number): string => {
     if (!seconds || isNaN(seconds)) return '0:00';
     const mins = Math.floor(seconds / 60);
     const secs = Math.floor(seconds % 60);
     return `${mins}:${secs.toString().padStart(2, '0')}`;
   };

  return (
    <div className="app-container">
      <div className="search-glass ytm-view">
         {/* Header */}
         <div className="ytm-header">
           <button className="ytm-back-btn" onClick={onBack}>
             <ArrowLeft size={16} />
             <span>Zurück</span>
           </button>
           <div className="ytm-header-center">
             <span className="ytm-title">YouTube Music</span>
           </div>
           <div className="ytm-header-spacer">
             <button
               className="ytm-signin-btn"
               onClick={handleSignIn}
               title="Bei YouTube Music anmelden"
             >
               <LogIn size={16} />
             </button>
           </div>
         </div>

        {/* Hidden audio element for playback */}
        {playerState.currentTrack?.audioUrl && (
          <audio
            ref={audioRef}
            src={playerState.currentTrack.audioUrl}
            autoPlay={playerState.isPlaying}
            preload="auto"
          />
        )}

        <div className="ytm-container">
          {/* Player Section */}
          <div className="ytm-player">
            <div className="ytm-album-art">
              {playerState.currentTrack?.thumbnail ? (
                <img src={playerState.currentTrack.thumbnail} alt="" className="ytm-album-img" />
              ) : (
                <div className="ytm-album-placeholder">
                  <span>🎵</span>
                </div>
              )}
            </div>

            <div className="ytm-track-info">
              <h3 className="ytm-track-title">
                {playerState.currentTrack?.title || 'Kein Track ausgewählt'}
              </h3>
              <p className="ytm-track-artist">
                {playerState.currentTrack?.artist || 'Wähle einen Song aus'}
              </p>
            </div>

            {/* Progress Bar */}
            {duration > 0 && (
              <div className="ytm-progress">
                <span className="ytm-progress-time">{formatTime(progress)}</span>
                <input
                  type="range"
                  className="ytm-progress-slider"
                  min={0}
                  max={duration}
                  value={progress}
                  onChange={handleSeek}
                  step={0.1}
                />
                <span className="ytm-progress-time">{formatTime(duration)}</span>
              </div>
            )}

            {/* Controls */}
            <div className="ytm-controls">
              <button className="ytm-ctrl-btn" onClick={handlePrev} title="Vorheriger Titel">
                <SkipBack size={20} />
              </button>
              <button className="ytm-ctrl-btn ytm-play-btn" onClick={handleTogglePlay} title="Play/Pause">
                {playerState.isPlaying ? <Pause size={28} /> : <Play size={28} />}
              </button>
              <button className="ytm-ctrl-btn" onClick={handleNext} title="Nächster Titel">
                <SkipForward size={20} />
              </button>
            </div>

            {/* Volume */}
            <div className="ytm-volume">
              <Volume2 size={16} />
              <input
                type="range"
                className="ytm-volume-slider"
                min={0}
                max={100}
                value={playerState.volume}
                onChange={handleVolumeChange}
              />
              <span className="ytm-volume-value">{playerState.volume}%</span>
            </div>
          </div>

          {/* Search Section */}
          <div className="ytm-search">
            <div className="ytm-search-wrapper">
              <Search size={14} className="ytm-search-icon" />
              <input
                type="text"
                className="ytm-search-input"
                placeholder="Songs suchen..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
              />
              {isSearching && <Loader2 size={14} className="ytm-search-spinner" />}
            </div>

            {/* Search Results */}
            <div className="ytm-results">
              {searchResults.length === 0 && !isSearching && searchQuery.trim() && (
                <div className="ytm-no-results">Keine Ergebnisse gefunden</div>
              )}
              {searchResults.map((track, idx) => (
                <div
                  key={`${track.videoId}-${idx}`}
                  className={`ytm-result-item ${playerState.currentTrack?.videoId === track.videoId ? 'active' : ''}`}
                  onClick={() => handlePlayTrack(track)}
                >
                  <div className="ytm-result-thumb">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt="" />
                    ) : (
                      <span>🎵</span>
                    )}
                  </div>
                  <div className="ytm-result-info">
                    <span className="ytm-result-title">{track.title}</span>
                    <span className="ytm-result-artist">{track.artist}</span>
                  </div>
                  <span className="ytm-result-duration">
                    {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
