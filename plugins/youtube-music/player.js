// YouTube Music Player - Main Process (has access to youtubei.js)
// Handles search, playback, and player state management

let yt = null;
let currentTrack = null;
let isPlaying = false;
let volume = 75;
let queue = [];
let queueIndex = -1;
let isInitialized = false;
let initPromise = null;
let isAuthenticated = false;

async function init() {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const { Innertube } = require('youtubei.js');
      yt = await Innertube.create({
        location: 'DE',
        retrieve_player: true,
      });
      isInitialized = true;
      console.log('[YouTubeMusic] Player initialized');
    } catch (err) {
      console.error('[YouTubeMusic] Failed to initialize:', err.message);
      throw err;
    }
  })();

  return initPromise;
}

async function search({ query }) {
  await init();
  if (!query || !query.trim()) return [];

  try {
    const search = await yt.music.search(query.trim(), { type: 'song' });
    const songs = search.songs?.results || [];

    return songs.map(s => ({
      videoId: s.id || '',
      title: s.title?.text || s.name?.text || 'Unbekannt',
      artist: s.artists?.[0]?.name || s.author?.name || 'Unbekannt',
      thumbnail: s.thumbnail?.[0]?.url || s.thumbnails?.[0]?.url || '',
      duration: s.duration?.seconds || 0,
    }));
  } catch (err) {
    console.error('[YouTubeMusic] Search error:', err.message);
    return [];
  }
}

async function play({ videoId, query }) {
  await init();

  let id = videoId;
  if (!id && query) {
    const results = await search({ query });
    if (results.length === 0) throw new Error('Kein Song gefunden');
    id = results[0].videoId;
  }

  if (!id) throw new Error('Keine Video-ID angegeben');

  try {
    // Get track info
    const info = await yt.music.getBasicInfo(id);
    const basicDetails = info.basic_details || {};

    // Get streaming data for audio URL
    const streamInfo = await yt.music.getStreamingData(id);
    const formats = streamInfo?.adaptive_formats?.filter(f => f.has_audio && f.mime_type?.includes('audio')) || [];
    const bestFormat = formats[0];

    let audioUrl = '';
    if (bestFormat) {
      try {
        audioUrl = await bestFormat.decipher(yt.session.player);
      } catch {
        audioUrl = bestFormat.url || '';
      }
    }

    currentTrack = {
      videoId: id,
      title: basicDetails.title || 'Unbekannt',
      artist: basicDetails.author || 'Unbekannt',
      thumbnail: basicDetails.thumbnail?.[0]?.url || '',
      duration: basicDetails.duration_ms ? Math.floor(basicDetails.duration_ms / 1000) : 0,
      audioUrl: audioUrl,
    };

    isPlaying = true;

    return {
      track: currentTrack,
      isPlaying: true,
      volume,
    };
  } catch (err) {
    console.error('[YouTubeMusic] Play error:', err.message);
    throw new Error(`Konnte Song nicht abspielen: ${err.message}`);
  }
}

function pause() {
  isPlaying = false;
  return {
    isPlaying: false,
    track: currentTrack,
    volume,
  };
}

function resume() {
  isPlaying = true;
  return {
    isPlaying: true,
    track: currentTrack,
    volume,
  };
}

async function next() {
  if (queue.length > 0 && queueIndex < queue.length - 1) {
    queueIndex++;
    return play({ videoId: queue[queueIndex] });
  }

  if (currentTrack?.videoId) {
    try {
      const related = await yt.music.getTrackRelated(currentTrack.videoId);
      const nextTrack = related?.tracks?.results?.[0];
      if (nextTrack?.id) {
        return play({ videoId: nextTrack.id });
      }
    } catch { /* ignore */ }
  }

  throw new Error('Kein nächster Titel verfügbar');
}

async function prev() {
  if (queueIndex > 0) {
    queueIndex--;
    return play({ videoId: queue[queueIndex] });
  }
  throw new Error('Kein vorheriger Titel');
}

function setVolume({ level }) {
  volume = Math.max(0, Math.min(100, level));
  return { volume };
}

function getState() {
  return {
    isPlaying,
    currentTrack,
    volume,
    queue,
    queueIndex,
    isAuthenticated,
  };
}

async function signIn() {
  // For YouTube Music, we can use the existing session
  // youtubei.js should automatically use cookies from Electron's session
  // if we're logged into YouTube in the Electron app
  try {
    await init();
    
    // Test if we're authenticated by trying to get a user's library
    // This will throw if not authenticated
    const library = await yt.music.getLibrary();
    
    // If we get here without error, we're authenticated
    isAuthenticated = true;
    console.log('[YouTubeMusic] User authenticated successfully');
    
    return {
      success: true,
      message: 'Erfolgreich bei YouTube Music angemeldet',
    };
  } catch (err) {
    console.error('[YouTubeMusic] Authentication failed:', err.message);
    isAuthenticated = false;
    
    // Check if it's an auth-related error
    if (err.message.includes('authentication') || 
        err.message.includes('sign-in') ||
        err.message.includes('login')) {
      return {
        success: false,
        message: 'YouTube Music Anmeldung erforderlich. Bitte öffnen Sie youtube.com in diesem Fenster und melden Sie sich an.',
      };
    }
    
    return {
      success: false,
      message: `Authentifizierung fehlgeschlagen: ${err.message}`,
    };
  }
}

// Export all functions as named exports for the plugin system
module.exports = {
  init,
  search,
  play,
  pause,
  resume,
  next,
  prev,
  setVolume,
  getState,
  signIn,
};
