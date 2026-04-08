// Media Control Plugin
// Controls system-wide media playback

module.exports = {
  init: (ctx, api) => {
    // Command: Pause
    api.registerCommand({
      id: 'media-pause',
      trigger: '/pause',
      description: 'Medienwiedergabe pausieren',
      category: 'system',
      handler: async () => {
        try {
          await api.invokeMainAction('pause');
          return {
            results: [{
              id: 'paused',
              title: '⏸ Pausiert',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'pause-err',
              title: 'Fehler',
              subtitle: err.message || 'Nichts zum Pausieren',
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Resume
    api.registerCommand({
      id: 'media-play',
      trigger: '/play',
      description: 'Medienwiedergabe fortsetzen',
      category: 'system',
      handler: async () => {
        try {
          await api.invokeMainAction('resume');
          return {
            results: [{
              id: 'playing',
              title: '▶ Playing',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'play-err',
              title: 'Fehler',
              subtitle: err.message || 'Nichts zum Abspielen',
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Next
    api.registerCommand({
      id: 'media-next',
      trigger: '/next',
      description: 'Nächster Titel',
      category: 'system',
      handler: async () => {
        try {
          await api.invokeMainAction('next');
          return {
            results: [{
              id: 'next',
              title: '⏭ Nächster',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'next-err',
              title: 'Fehler',
              subtitle: 'Nächster Titel fehlgeschlagen',
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Previous
    api.registerCommand({
      id: 'media-prev',
      trigger: '/prev',
      description: 'Vorheriger Titel',
      category: 'system',
      handler: async () => {
        try {
          await api.invokeMainAction('prev');
          return {
            results: [{
              id: 'prev',
              title: '⏮ Zurück',
              type: 'system',
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'prev-err',
              title: 'Fehler',
              subtitle: 'Vorheriger Titel fehlgeschlagen',
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Command: Status
    api.registerCommand({
      id: 'media-state',
      trigger: '/now',
      description: 'Aktuellen Medien-Status anzeigen',
      category: 'system',
      handler: async () => {
        try {
          const state = await api.invokeMainAction('getState');
          return {
            results: [{
              id: 'now-playing',
              title: state.currentTrack ? `▶ ${state.currentTrack.title}` : 'Keine Wiedergabe',
              subtitle: state.currentTrack?.artist || state.message || 'Keine Medienwiedergabe aktiv',
              type: 'system',
              action: () => ctx.navigate('media-control'),
            }],
          };
        } catch (err) {
          return {
            results: [{
              id: 'now-err',
              title: 'Keine Wiedergabe',
              subtitle: 'Keine Medienwiedergabe aktiv',
              type: 'system',
            }],
          };
        }
      },
      enabled: true,
    });

    // Hook: onLoad
    api.registerHook('onLoad', () => {
      ctx.logger.log('Media Control geladen');
    });

    ctx.logger.log('Media Control Plugin initialisiert');
  },
};