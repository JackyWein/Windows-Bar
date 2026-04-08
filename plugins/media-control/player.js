// Media Control Plugin - Player Module
// Controls system-wide media playback on Windows

let currentTrack = null;
let isPlaying = false;
let volume = 75;

const { exec } = require('child_process');

function runPowerShell(script) {
  return new Promise((resolve) => {
    exec('powershell -Command "' + script.replace(/"/g, '\\"') + '"', 
      { windowsHide: true, encoding: 'utf8' }, (err, stdout) => {
        if (err) resolve(null);
        else resolve(stdout || null);
      });
  });
}

async function init() {
  console.log('[MediaControl] Initializing...');
  console.log('[MediaControl] Player module loaded successfully');
  return true;
}

async function getCurrentMedia() {
  console.log('[MediaControl] getCurrentMedia called');
  
  const players = ['Spotify', 'vlc', 'wmplayer', 'Music.UI'];
  
  for (const player of players) {
    const result = await runPowerShell('Get-Process -Name *' + player + '* -ErrorAction SilentlyContinue | Select-Object -First 1 Name | ConvertTo-Json');
    if (result && result !== 'null' && result.trim()) {
      console.log('[MediaControl] Found player:', player);
      currentTrack = { title: player + ' Media', artist: 'Playing' };
      isPlaying = true;
      return currentTrack;
    }
  }
  
  console.log('[MediaControl] No media player found');
  return null;
}

function sendMediaKey(key) {
  console.log('[MediaControl] sendMediaKey:', key);
  
  const keyMap = {
    'pause': '{MEDIA_PAUSE}',
    'play': '{MEDIA_PLAY}',
    'next': '{MEDIA_NEXT}',
    'prev': '{MEDIA_PREV}'
  };
  
  const keyCode = keyMap[key];
  if (!keyCode) return;
  
  const script = '(New-Object -ComObject WScript.Shell).SendKeys(\'' + keyCode + '\')';
  runPowerShell(script).then(result => {
    console.log('[MediaControl] SendKeys result:', result);
  });
}

function pause() {
  console.log('[MediaControl] pause called');
  sendMediaKey('pause');
  isPlaying = false;
  return { isPlaying: false, track: currentTrack, volume };
}

function resume() {
  console.log('[MediaControl] resume called');
  sendMediaKey('play');
  isPlaying = true;
  return { isPlaying: true, track: currentTrack, volume };
}

function next() {
  console.log('[MediaControl] next called');
  sendMediaKey('next');
  return { track: currentTrack };
}

function prev() {
  console.log('[MediaControl] prev called');
  sendMediaKey('prev');
  return { track: currentTrack };
}

function setVolume({ level }) {
  volume = Math.max(0, Math.min(100, level));
  return { volume };
}

async function getState() {
  await getCurrentMedia();
  console.log('[MediaControl] getState returning:', { isPlaying, currentTrack });
  
  return {
    isPlaying,
    currentTrack,
    volume,
    message: currentTrack ? currentTrack.title : 'Keine Wiedergabe',
  };
}

async function signIn() {
  return { success: true };
}

async function search({ query }) {
  return [];
}

async function play() {
  return await getState();
}

module.exports = { init, search, play, pause, resume, next, prev, setVolume, getState, signIn };