// YouTube Music Plugin - Main (runs in sandbox)
// Registers commands and hooks for YouTube Music integration

module.exports = {
  init: (ctx, api) => {
    // Command: Open YouTube Music View OR play song directly
    api.registerCommand({
      id: 'ytm',
      trigger: '/ytm ',
      description: 'YouTube Music Player öffnen oder Song abspielen',
      usage: '/ytm [Song Name]',
      category: 'system',
      handler: async (args, ctx) => {
        const query = args.trim();

        // No argument → open view
        if (!query) {
          ctx.navigate('youtube-music');
          return { results: [] };
        }

        // Has argument → search and play
        try {
          const result = await api.invokeMainAction('play', { query });
          const track = result.track;
          return {
            results: [{
              id: 'ytm-playing',
              title: `▶ ${track?.title || query}`,
              subtitle: `${track?.artist || 'Wird abgespielt...'}${track?.duration ? ' • ' + Math.floor(track.duration / 60) + ':' + String(track.duration % 60).padStart(2, '0') : ''}`,
              type: 'system',
              iconBase64: track?.thumbnail,
              action: () => ctx.navigate('youtube-music'),
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-play-err',
              title: `Fehler: ${err.message || 'Unbekannt'}`,
              subtitle: 'Song konnte nicht abgespielt werden',
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Open YouTube Music View (no args)
    api.registerCommand({
      id: 'ytm-view',
      trigger: '/ytm',
      description: 'YouTube Music Player öffnen',
      category: 'system',
      handler: (args, ctx) => {
        ctx.navigate('youtube-music');
        return { results: [] };
      },
      enabled: true,
    });

    // Command: Play a song
    api.registerCommand({
      id: 'ytm-play',
      trigger: '/ytm-play ',
      description: 'Song auf YouTube Music suchen und abspielen',
      usage: '/ytm-play <Song Name>',
      category: 'system',
      handler: async (args, ctx) => {
        const query = args.trim();
        if (!query) {
          return {
            results: [{
              id: 'ytm-play-err',
              title: 'Kein Suchbegriff',
              subtitle: '/ytm-play <Song Name>',
              type: 'system',
            }],
          };
        }

        try {
          const result = await api.invokeMainAction('play', { query });
          return {
            results: [{
              id: 'ytm-playing',
              title: `▶ ${result.track?.title || query}`,
              subtitle: result.track?.artist || 'Wird abgespielt...',
              type: 'system',
              action: () => ctx.navigate('youtube-music'),
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-play-err',
              title: `Fehler: ${err.message || 'Unbekannt'}`,
              subtitle: 'Song konnte nicht abgespielt werden',
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Pause
    api.registerCommand({
      id: 'ytm-pause',
      trigger: '/ytm-pause',
      description: 'Playback pausieren',
      category: 'system',
      handler: async () => {
        try {
          await api.invokeMainAction('pause');
          return {
            results: [{
              id: 'ytm-paused',
              title: '⏸ Pausiert',
              subtitle: 'Drücke /ytm-resume zum Fortsetzen',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-pause-err',
              title: `Fehler: ${err.message || 'Nichts zum Pausieren'}`,
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Resume
    api.registerCommand({
      id: 'ytm-resume',
      trigger: '/ytm-resume',
      description: 'Playback fortsetzen',
      category: 'system',
      handler: async () => {
        try {
          await api.invokeMainAction('resume');
          return {
            results: [{
              id: 'ytm-resumed',
              title: '▶ Fortgesetzt',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-resume-err',
              title: `Fehler: ${err.message || 'Nichts zum Fortsetzen'}`,
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Next track
    api.registerCommand({
      id: 'ytm-next',
      trigger: '/ytm-next',
      description: 'Nächster Titel',
      category: 'system',
      handler: async () => {
        try {
          const result = await api.invokeMainAction('next');
          return {
            results: [{
              id: 'ytm-next',
              title: `⏭ ${result.track?.title || 'Nächster Titel'}`,
              subtitle: result.track?.artist || '',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-next-err',
              title: `Fehler: ${err.message || 'Kein nächster Titel'}`,
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Previous track
    api.registerCommand({
      id: 'ytm-prev',
      trigger: '/ytm-prev',
      description: 'Vorheriger Titel',
      category: 'system',
      handler: async () => {
        try {
          const result = await api.invokeMainAction('prev');
          return {
            results: [{
              id: 'ytm-prev',
              title: `⏮ ${result.track?.title || 'Vorheriger Titel'}`,
              subtitle: result.track?.artist || '',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-prev-err',
              title: `Fehler: ${err.message || 'Kein vorheriger Titel'}`,
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Set volume
    api.registerCommand({
      id: 'ytm-volume',
      trigger: '/ytm-volume ',
      description: 'Lautstärke setzen (0-100)',
      usage: '/ytm-volume <0-100>',
      category: 'system',
      handler: async (args) => {
        const vol = parseInt(args.trim());
        if (isNaN(vol) || vol < 0 || vol > 100) {
          return {
            results: [{
              id: 'ytm-vol-err',
              title: 'Ungültige Lautstärke',
              subtitle: 'Wert zwischen 0 und 100 eingeben',
              type: 'system',
            }],
          };
        }

        try {
          await api.invokeMainAction('setVolume', { level: vol });
          return {
            results: [{
              id: 'ytm-vol',
              title: `🔊 Lautstärke: ${vol}%`,
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-vol-err',
              title: `Fehler: ${err.message || 'Konnte Lautstärke nicht setzen'}`,
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Get current state
    api.registerCommand({
      id: 'ytm-state',
      trigger: '/ytm-state',
      description: 'Aktuellen Playback-Status anzeigen',
      category: 'system',
      handler: async () => {
        try {
          const state = await api.invokeMainAction('getState');
          const track = state.currentTrack;
          return {
            results: [{
              id: 'ytm-state',
              title: track ? `${state.isPlaying ? '▶' : '⏸'} ${track.title}` : 'Kein Track',
              subtitle: track ? `${track.artist} | 🔊 ${state.volume}%` : 'Spiele zuerst einen Song ab',
              type: 'system',
              action: () => ctx.navigate('youtube-music'),
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'ytm-state-err',
              title: `Fehler: ${err.message || 'Status nicht verfügbar'}`,
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Search Provider: !ytm <query>
    api.registerSearchProvider({
      id: 'youtube-music',
      name: 'YouTube Music',
      priority: 50,
      triggers: ['!ytm'],
      search: async (query, ctx) => {
        if (!query.startsWith('!ytm')) return [];
        const searchTerm = query.substring(4).trim();
        if (!searchTerm) return [];

        try {
          const results = await api.invokeMainAction('search', { query: searchTerm });
          return (results || []).slice(0, 8).map((song, i) => ({
            id: `ytm-song-${i}`,
            title: song.title || 'Unbekannt',
            subtitle: `${song.artist || 'Unbekannt'} • ${song.duration ? Math.floor(song.duration / 60) + ':' + String(song.duration % 60).padStart(2, '0') : ''}`,
            type: 'system',
            iconBase64: song.thumbnail,
            action: () => api.invokeMainAction('play', { videoId: song.videoId }),
          }));
        } catch (err) {
          return [{
            id: 'ytm-search-err',
            title: `YT Music Fehler: ${err.message || 'Suche fehlgeschlagen'}`,
            type: 'system',
          }];
        }
      },
    });

    // Hook: onLoad
    api.registerHook('onLoad', () => {
      ctx.logger.log('YouTube Music Plugin geladen 🎵');
    });

    ctx.logger.log('YouTube Music Plugin initialisiert');
  },
};
