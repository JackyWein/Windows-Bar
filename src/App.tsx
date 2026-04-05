import React, { useState, useEffect, useRef } from 'react';
import { Search, File, AppWindow, Gamepad2, Bot, Globe, Calculator, ArrowLeft, ExternalLink, Settings, TerminalSquare, Send, CloudRain, Folder, FileText, Monitor, Power, RotateCcw, Lock, Moon, Sun, HardDrive, Music, Video, Image, Archive, Code, FileSpreadsheet, Presentation, Trash2, Clock, Clipboard, Cpu, Hash, Key, QrCode, Smile, Globe2, Calendar, Binary, FileCode, Link2, StickyNote, Wind, Droplets, Eye, Cloud, Thermometer, Sunrise, Sunset, Gauge, CloudSun, Snowflake, CloudDrizzle, CloudHail, CloudFog, Palette, Bell, Database, Zap, Info, Check, X, Sliders, Volume2, Languages } from 'lucide-react';
import { detectCommand, executeCommand, saveToClipboardHistory } from './commands';
import type { CommandResult } from './commands';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import './index.css';

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: 'app' | 'file' | 'game' | 'ai' | 'web' | 'system' | 'weather' | 'calc' | 'folder';
  path?: string;
  isWeb?: boolean;
  iconBase64?: string;
  isExpandBtn?: boolean;
  isSubItem?: boolean;
  isRecent?: boolean;
  isHelpCategory?: boolean;
  helpCommands?: string;
}

type ViewMode = 'search' | 'ai' | 'settings';

const api = () => (window as any).electronAPI;

// Default settings
const defaultSettings = {
  appearance: {
    accentColor: '#7c5cfc',
    fontSize: 'medium' as 'small' | 'medium' | 'large',
    animations: true,
    blur: true,
    blurAmount: 40,
    transparency: 85,
    borderRadius: 14,
    windowWidth: 680,
    windowHeight: 600
  },
  search: {
    maxResults: 20,
    showWebSuggestions: true,
    defaultCity: 'Berlin',
    searchDelay: 100
  },
  features: {
    weatherEnabled: true,
    aiEnabled: true,
    clipboardHistory: true,
    notesEnabled: true
  },
  privacy: {
    saveRecents: true,
    saveClipboardHistory: true
  }
};

function App() {
  // Load settings from localStorage FIRST
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('windowsbar_settings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  // Apply settings to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', settings.appearance.accentColor);
    root.style.setProperty('--radius', `${settings.appearance.borderRadius}px`);

    // Font size
    const fontSizes = { small: '14px', medium: '16px', large: '18px' };
    root.style.setProperty('--font-size-base', fontSizes[settings.appearance.fontSize]);

    // Transparency (0-100 -> 0.0-1.0)
    const alpha = settings.appearance.transparency / 100;
    root.style.setProperty('--bg-alpha', alpha.toString());

    // Blur amount
    root.style.setProperty('--blur-amount', `${settings.appearance.blurAmount}px`);

    // Animations
    if (!settings.appearance.animations) {
      root.style.setProperty('--transition-speed', '0s');
    } else {
      root.style.setProperty('--transition-speed', '0.15s');
    }
  }, [settings]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('windowsbar_settings', JSON.stringify(settings));
  }, [settings]);

  // Update a specific setting
  const updateSetting = (category: keyof typeof defaultSettings, key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  // Reset settings to defaults
  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.setItem('windowsbar_settings', JSON.stringify(defaultSettings));
  };

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expandWeb, setExpandWeb] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [folderItems, setFolderItems] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [folderLoading, setFolderLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);
  const [terminalInput, setTerminalInput] = useState('');

  const interactionMode = useRef<'mouse' | 'keyboard'>('mouse');
  const inputRef = useRef<HTMLInputElement>(null);
  const termRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const hydratingPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    inputRef.current?.focus();
    const focusFn = () => {
      if (viewMode !== 'search') return;
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    };
    window.addEventListener('focus', focusFn);
    return () => window.removeEventListener('focus', focusFn);
  }, [viewMode]);

  // Load Recents
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      try { setRecentItems(JSON.parse(saved)); } catch (e) { }
    }
  }, []);

  // Save Recents
  useEffect(() => {
    localStorage.setItem('recent_searches', JSON.stringify(recentItems));
  }, [recentItems]);

  // Switch to AI mode (Native CLI)
  const openAI = () => {
    setViewMode('ai');
    try { api()?.resizeWindow(850, 700); } catch (e) { }
    try { api()?.startTerminal(); } catch (e) { }

    // Focus terminal input shortly after
    setTimeout(() => {
      terminalInputRef.current?.focus();
    }, 300);
  };

  // Back to search mode
  const backToSearch = () => {
    if (viewMode === 'ai') {
      try { api()?.stopTerminal(); } catch (e) { }
    }
    setViewMode('search');
    try { api()?.resizeWindow(750, 600); } catch (e) { }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    setSelectedIndex(0);
    setExpandWeb(false);

    if (!query.trim()) {
      if (recentItems.length > 0) {
        setResults(recentItems.map(item => ({ ...item, id: `recent-${item.id}`, isRecent: true } as any)));
      } else {
        setResults([]);
      }
      return;
    }

    // Natural language weather detection (without /)
    const queryLower = query.trim().toLowerCase();
    const weatherPatterns = ['wetter', 'weather', 'temperatur', 'wie wird das wetter', 'wie ist das wetter'];
    const isWeatherQuery = weatherPatterns.some(p => queryLower.startsWith(p) || queryLower.includes(' wetter ') || queryLower.includes(' weather '));

    if (isWeatherQuery && !query.trim().startsWith('/') && settings.features.weatherEnabled) {
      const cityMatch = queryLower.match(/(?:wetter|weather|temperatur)\s+(.+)/);
      const city = cityMatch ? cityMatch[1].trim() : settings.search.defaultCity;

      fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=de`)
        .then(r => r.json())
        .then(data => {
          const current = data.current_condition?.[0];
          const today = data.weather?.[0];
          const hourly = today?.hourly || [];

          if (!current) {
            setResults([{ id: 'cmd-err', title: 'Wetter nicht verfügbar', subtitle: 'Keine Daten erhalten', type: 'system' }]);
            return;
          }

          const temp = current.temp_C;
          const feelsLike = current.FeelsLikeC;
          const humidity = current.humidity;
          const windSpeed = current.windspeedKmph;
          const windDir = current.winddir16Point;
          const uvIndex = current.uvIndex;
          const visibility = current.visibility;
          const pressure = current.pressure;
          const cloudCover = current.cloudcover;
          const weatherDesc = current.lang_de?.[0]?.value || current.weatherDesc?.[0]?.value || 'Unbekannt';
          const precip = current.precipMM;

          // Extract hourly temperatures for graph
          const hourlyData = hourly.map((h: any) => ({
            time: h.time,
            temp: parseInt(h.tempC),
            feelsLike: parseInt(h.FeelsLikeC),
            chanceOfRain: h.chanceofrain,
            weatherIcon: h.weatherCode
          }));

          const weatherData = {
            temp,
            feelsLike,
            humidity,
            windSpeed,
            windDir,
            uvIndex,
            visibility,
            pressure,
            cloudCover,
            weatherDesc,
            precip,
            city,
            minTemp: today?.mintempC,
            maxTemp: today?.maxtempC,
            sunrise: today?.astronomy?.[0]?.sunrise,
            sunset: today?.astronomy?.[0]?.sunset,
            hourly: hourlyData
          };

          setResults([{
            id: 'weather-card',
            title: `${temp}°C in ${city}`,
            subtitle: `${weatherDesc}`,
            type: 'weather',
            path: JSON.stringify(weatherData),
            isExpandBtn: false
          }, {
            id: 'weather-more',
            title: `Vollständige Wettervorschau öffnen`,
            subtitle: `wttr.in/${encodeURIComponent(city)}`,
            type: 'web',
            path: `https://wttr.in/${encodeURIComponent(city)}?lang=de`,
            isWeb: true
          }]);
        })
        .catch(() => {
          setResults([{ id: 'cmd-err', title: 'Wetter nicht abrufbar', subtitle: 'Service nicht verfügbar', type: 'system' }]);
        });
      return;
    }

    // Quick Commands (/) - Simple inline commands
    // Note: /ai and /g are handled separately below
    if (query.trim().startsWith('/') && !query.trim().startsWith('/ai') && !query.trim().startsWith('/g ')) {
      const cmd = query.trim().substring(1).trim();

      // Simple instant commands
      if (cmd.startsWith('calc ')) {
        try {
          const expr = cmd.substring(5);
          const result = new Function(`return (${expr})`)();
          if (!isNaN(result)) {
            setResults([{
              id: 'cmd-calc',
              title: String(result),
              subtitle: `Ergebnis von ${expr}`,
              type: 'calc'
            }]);
            return;
          }
        } catch (e) { }
      }

      // UUID
      if (cmd === 'uuid') {
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        setResults([{
          id: 'cmd-uuid',
          title: uuid,
          subtitle: 'UUID v4 • Enter zum Kopieren',
          type: 'calc',
          path: uuid
        }]);
        return;
      }

      // Timestamp
      if (cmd === 'now' || cmd === 'ts') {
        const now = new Date();
        setResults([{
          id: 'cmd-now',
          title: now.toLocaleString('de-DE'),
          subtitle: `Unix: ${Math.floor(now.getTime() / 1000)}`,
          type: 'calc'
        }]);
        return;
      }

      // Random
      if (cmd.startsWith('random')) {
        const match = cmd.match(/random\s*(\d+)?(-(\d+))?/);
        if (match) {
          const min = match[3] ? parseInt(match[1]) : 1;
          const max = match[3] ? parseInt(match[3]) : (match[1] ? parseInt(match[1]) : 100);
          const result = Math.floor(Math.random() * (max - min + 1)) + min;
          setResults([{
            id: 'cmd-random',
            title: String(result),
            subtitle: `Zufallszahl zwischen ${min} und ${max}`,
            type: 'calc'
          }]);
          return;
        }
      }

      // Password
      if (cmd.startsWith('pass')) {
        const match = cmd.match(/pass\s*(\d*)/);
        const len = match && match[1] ? parseInt(match[1]) : 16;
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        const password = Array.from(arr, x => chars[x % chars.length]).join('');
        setResults([{
          id: 'cmd-pass',
          title: password,
          subtitle: `Passwort (${len} Zeichen) • Enter zum Kopieren`,
          type: 'calc',
          path: password
        }]);
        return;
      }

      // Hash
      if (cmd.startsWith('hash ')) {
        const text = cmd.substring(5);
        const encoder = new TextEncoder();
        crypto.subtle.digest('SHA-256', encoder.encode(text)).then(hashBuffer => {
          const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          setResults([{
            id: 'cmd-hash',
            title: hash.substring(0, 32) + '...',
            subtitle: `SHA-256 von "${text}" • Enter zum Kopieren`,
            type: 'calc',
            path: hash
          }]);
        });
        return;
      }

      // Base64 encode
      if (cmd.startsWith('enc ')) {
        const text = cmd.substring(4);
        const encoded = btoa(unescape(encodeURIComponent(text)));
        setResults([{
          id: 'cmd-enc',
          title: encoded,
          subtitle: 'Base64 kodiert • Enter zum Kopieren',
          type: 'calc',
          path: encoded
        }]);
        return;
      }

      // Base64 decode
      if (cmd.startsWith('dec ')) {
        try {
          const text = cmd.substring(4);
          const decoded = decodeURIComponent(escape(atob(text)));
          setResults([{
            id: 'cmd-dec',
            title: decoded,
            subtitle: 'Base64 dekodiert • Enter zum Kopieren',
            type: 'calc',
            path: decoded
          }]);
        } catch (e) {
          setResults([{ id: 'cmd-err', title: 'Ungültiger Base64-String', subtitle: 'Prüfe die Eingabe', type: 'system' }]);
        }
        return;
      }

      // JSON format
      if (cmd.startsWith('json ')) {
        try {
          const obj = JSON.parse(cmd.substring(5));
          const formatted = JSON.stringify(obj, null, 2);
          setResults([{
            id: 'cmd-json',
            title: formatted.substring(0, 50) + (formatted.length > 50 ? '...' : ''),
            subtitle: 'JSON formatiert • Enter zum Kopieren',
            type: 'calc',
            path: formatted
          }]);
        } catch (e) {
          setResults([{ id: 'cmd-err', title: 'Ungültiges JSON', subtitle: 'Prüfe die Syntax', type: 'system' }]);
        }
        return;
      }

      // Text length
      if (cmd.startsWith('len ')) {
        const text = cmd.substring(4);
        setResults([{
          id: 'cmd-len',
          title: `${text.length} Zeichen`,
          subtitle: `${text.split(/\s+/).filter(w => w).length} Wörter`,
          type: 'calc'
        }]);
        return;
      }

      // Reverse
      if (cmd.startsWith('rev ')) {
        const text = cmd.substring(4);
        setResults([{
          id: 'cmd-rev',
          title: text.split('').reverse().join(''),
          subtitle: 'Umgekehrt • Enter zum Kopieren',
          type: 'calc',
          path: text.split('').reverse().join('')
        }]);
        return;
      }

      // Upper/Lower
      if (cmd.startsWith('upper ')) {
        const text = cmd.substring(6);
        setResults([{ id: 'cmd-upper', title: text.toUpperCase(), subtitle: 'GROSSBUCHSTABEN', type: 'calc', path: text.toUpperCase() }]);
        return;
      }
      if (cmd.startsWith('lower ')) {
        const text = cmd.substring(6);
        setResults([{ id: 'cmd-lower', title: text.toLowerCase(), subtitle: 'kleinbuchstaben', type: 'calc', path: text.toLowerCase() }]);
        return;
      }

      // URL encode/decode
      if (cmd.startsWith('url ')) {
        const text = cmd.substring(4);
        setResults([{ id: 'cmd-url', title: encodeURIComponent(text), subtitle: 'URL-kodiert', type: 'calc', path: encodeURIComponent(text) }]);
        return;
      }
      if (cmd.startsWith('unurl ')) {
        const text = cmd.substring(6);
        setResults([{ id: 'cmd-unurl', title: decodeURIComponent(text), subtitle: 'URL-dekodiert', type: 'calc', path: decodeURIComponent(text) }]);
        return;
      }

      // QR Code
      if (cmd.startsWith('qr ')) {
        const text = cmd.substring(3);
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
        setResults([{ id: 'cmd-qr', title: `QR-Code: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`, subtitle: 'Enter um zu öffnen', type: 'web', path: qrUrl, isWeb: true }]);
        return;
      }

      // IP Address
      if (cmd === 'ip') {
        fetch('https://api.ipify.org?format=json').then(r => r.json()).then(data => {
          setResults([{ id: 'cmd-ip', title: data.ip, subtitle: 'Öffentliche IP • Enter zum Kopieren', type: 'system', path: data.ip }]);
        }).catch(() => {
          setResults([{ id: 'cmd-err', title: 'IP nicht abrufbar', subtitle: 'Netzwerkfehler', type: 'system' }]);
        });
        return;
      }

      // Wetter - Detaillierte Einzelkarte (Deutsch)
      if ((cmd.startsWith('wetter') || cmd.startsWith('weather')) && settings.features.weatherEnabled) {
        const city = cmd.startsWith('wetter')
          ? cmd.substring(6).trim() || settings.search.defaultCity
          : cmd.substring(7).trim() || settings.search.defaultCity;

        fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=de`)
          .then(r => r.json())
          .then(data => {
            const current = data.current_condition?.[0];
            const today = data.weather?.[0];

            if (!current) {
              setResults([{ id: 'cmd-err', title: 'Wetter nicht verfügbar', subtitle: 'Keine Daten erhalten', type: 'system' }]);
              return;
            }

            const temp = current.temp_C;
            const feelsLike = current.FeelsLikeC;
            const humidity = current.humidity;
            const windSpeed = current.windspeedKmph;
            const windDir = current.winddir16Point;
            const uvIndex = current.uvIndex;
            const visibility = current.visibility;
            const pressure = current.pressure;
            const cloudCover = current.cloudcover;
            const weatherDesc = current.lang_de?.[0]?.value || current.weatherDesc?.[0]?.value || 'Unbekannt';
            const precip = current.precipMM;

            // Eine einzelne, große Weather-Card mit allen Infos
            const weatherData = {
              temp,
              feelsLike,
              humidity,
              windSpeed,
              windDir,
              uvIndex,
              visibility,
              pressure,
              cloudCover,
              weatherDesc,
              precip,
              city,
              minTemp: today?.mintempC,
              maxTemp: today?.maxtempC,
              sunrise: today?.astronomy?.[0]?.sunrise,
              sunset: today?.astronomy?.[0]?.sunset
            };

            setResults([{
              id: 'weather-card',
              title: `${temp}°C in ${city}`,
              subtitle: `${weatherDesc}`,
              type: 'weather',
              path: JSON.stringify(weatherData),
              isExpandBtn: false
            }, {
              id: 'weather-more',
              title: `Vollständige Wettervorschau öffnen`,
              subtitle: `wttr.in/${encodeURIComponent(city)}`,
              type: 'web',
              path: `https://wttr.in/${encodeURIComponent(city)}?lang=de`,
              isWeb: true
            }]);
          })
          .catch(() => {
            setResults([{ id: 'cmd-err', title: 'Wetter nicht abrufbar', subtitle: 'Service nicht verfügbar', type: 'system' }]);
          });
        return;
      }

      // Wikipedia
      if (cmd.startsWith('wiki ')) {
        const term = cmd.substring(5);
        fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`).then(r => r.json()).then(data => {
          setResults([{ id: 'cmd-wiki', title: data.title || term, subtitle: data.extract?.substring(0, 80) || 'Artikel öffnen', type: 'web', path: data.content_url || `https://de.wikipedia.org/wiki/${term}`, isWeb: true }]);
        }).catch(() => {
          setResults([{ id: 'cmd-wiki', title: `${term} auf Wikipedia`, subtitle: 'Enter zum Öffnen', type: 'web', path: `https://de.wikipedia.org/wiki/${term}`, isWeb: true }]);
        });
        return;
      }

      // Translate
      if (cmd.startsWith('tr ')) {
        const match = cmd.match(/^tr\s+([a-z]{2}):([a-z]{2})\s+(.+)$/i);
        if (match) {
          const [, from, to, text] = match;
          const url = `https://www.deepl.com/translator#${from}/${to}/${encodeURIComponent(text)}`;
          setResults([{ id: 'cmd-tr', title: `"${text.substring(0, 25)}..." übersetzen`, subtitle: `${from.toUpperCase()} → ${to.toUpperCase()} via DeepL`, type: 'web', path: url, isWeb: true }]);
          return;
        }
      }

      // Color
      if (cmd.startsWith('color ')) {
        const color = cmd.substring(6);
        setResults([{ id: 'cmd-color', title: color.toUpperCase(), subtitle: 'Farbe • Enter zum Kopieren', type: 'calc', path: color.toUpperCase() }]);
        return;
      }

      // Lorem
      if (cmd.startsWith('lorem')) {
        const words = parseInt(cmd.substring(5).trim()) || 50;
        const lorem = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
        const text = Array.from({ length: Math.min(words, 100) }, () => lorem[Math.floor(Math.random() * lorem.length)]).join(' ');
        setResults([{ id: 'cmd-lorem', title: text.substring(0, 50) + '...', subtitle: `${words} Wörter Lorem Ipsum`, type: 'calc', path: text }]);
        return;
      }

      // Binary/Hex
      if (cmd.startsWith('bin ')) {
        const text = cmd.substring(4);
        const binary = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
        setResults([{ id: 'cmd-bin', title: binary.substring(0, 40) + '...', subtitle: 'Binär • Enter zum Kopieren', type: 'calc', path: binary }]);
        return;
      }
      if (cmd.startsWith('hex ')) {
        const text = cmd.substring(4);
        const hex = text.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        setResults([{ id: 'cmd-hex', title: hex, subtitle: 'Hexadezimal • Enter zum Kopieren', type: 'calc', path: hex }]);
        return;
      }

      // Age calculator
      if (cmd.startsWith('age ')) {
        const date = new Date(cmd.substring(4));
        if (!isNaN(date.getTime())) {
          const now = new Date();
          const age = Math.floor((now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          setResults([{ id: 'cmd-age', title: `${age} Jahre`, subtitle: `Geboren am ${date.toLocaleDateString('de-DE')}`, type: 'calc' }]);
          return;
        }
      }

      // Days until
      if (cmd.startsWith('days ')) {
        const date = new Date(cmd.substring(5));
        if (!isNaN(date.getTime())) {
          const now = new Date();
          const days = Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          setResults([{ id: 'cmd-days', title: `${days} Tage`, subtitle: `Bis zum ${date.toLocaleDateString('de-DE')}`, type: 'calc' }]);
          return;
        }
      }

      // Week number
      if (cmd === 'week') {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
        setResults([{ id: 'cmd-week', title: `KW ${week}`, subtitle: now.getFullYear().toString(), type: 'calc' }]);
        return;
      }

      // Note
      if (cmd.startsWith('note ')) {
        const note = cmd.substring(5);
        const notes = JSON.parse(localStorage.getItem('windowsbar_notes') || '[]');
        notes.unshift({ id: Date.now(), text: note, created: Date.now() });
        localStorage.setItem('windowsbar_notes', JSON.stringify(notes.slice(0, 50)));
        setResults([{ id: 'cmd-note', title: 'Notiz gespeichert', subtitle: note.substring(0, 50), type: 'system' }]);
        return;
      }
      if (cmd === 'notes') {
        const notes = JSON.parse(localStorage.getItem('windowsbar_notes') || '[]');
        if (notes.length === 0) {
          setResults([{ id: 'cmd-notes', title: 'Keine Notizen', subtitle: '/note Text um eine zu erstellen', type: 'system' }]);
        } else {
          setResults(notes.slice(0, 10).map((n: any, i: number) => ({
            id: `note-${i}`,
            title: n.text.substring(0, 50),
            subtitle: new Date(n.created).toLocaleString('de-DE'),
            type: 'file' as const,
            path: n.text
          })));
        }
        return;
      }
      if (cmd === 'clear-notes') {
        localStorage.removeItem('windowsbar_notes');
        setResults([{ id: 'cmd-clear', title: 'Notizen gelöscht', subtitle: 'Alle Notizen entfernt', type: 'system' }]);
        return;
      }

      // Clipboard
      if (cmd === 'cp') {
        navigator.clipboard.readText().then(text => {
          setResults([{ id: 'cmd-cp', title: text.substring(0, 50) || '(Leer)', subtitle: 'Zwischenablage-Inhalt', type: 'system', path: text }]);
        }).catch(() => {
          setResults([{ id: 'cmd-err', title: 'Zugriff verweigert', subtitle: 'Clipboard-Berechtigung erforderlich', type: 'system' }]);
        });
        return;
      }
      if (cmd.startsWith('cp ')) {
        const text = cmd.substring(3);
        navigator.clipboard.writeText(text);
        setResults([{ id: 'cmd-cp-set', title: 'Kopiert!', subtitle: `"${text.substring(0, 30)}"`, type: 'system' }]);
        return;
      }

      // History
      if (cmd === 'history') {
        const history = JSON.parse(localStorage.getItem('windowsbar_clipboard_history') || '[]');
        if (history.length === 0) {
          setResults([{ id: 'cmd-hist', title: 'Verlauf leer', subtitle: 'Kopiere Text um ihn hier zu sehen', type: 'system' }]);
        } else {
          setResults(history.slice(0, 10).map((text: string, i: number) => ({
            id: `hist-${i}`,
            title: text.substring(0, 50),
            subtitle: 'Klicken zum Kopieren',
            type: 'file' as const,
            path: text
          })));
        }
        return;
      }

      // Run command
      if (cmd.startsWith('run ')) {
        const program = cmd.substring(4);
        setResults([{ id: 'cmd-run', title: `${program} starten`, subtitle: 'Enter zum Ausführen', type: 'app', path: program }]);
        return;
      }

      // System commands
      if (cmd === 'sys') {
        api()?.getSystemInfo().then((info: any) => {
          if (info) {
            setResults([
              { id: 'sys-cpu', title: `CPU: ${info.cpu?.cores} Kerne`, subtitle: info.cpu?.model?.substring(0, 40), type: 'system' },
              { id: 'sys-ram', title: `RAM: ${info.memory?.used}/${info.memory?.total} GB (${info.memory?.usedPercent}%)`, subtitle: 'Arbeitsspeicher', type: 'system' },
              { id: 'sys-disk', title: `Disk: ${info.disk?.free}/${info.disk?.total} GB frei`, subtitle: `${info.disk?.usedPercent}% verwendet`, type: 'system' }
            ]);
          }
        });
        return;
      }

      if (cmd === 'proc') {
        api()?.listProcesses().then((procs: any[]) => {
          setResults(procs.slice(0, 15).map((p, i) => ({
            id: `proc-${i}`,
            title: p.name,
            subtitle: `PID: ${p.pid} • ${p.memory}`,
            type: 'app' as const
          })));
        });
        return;
      }

      if (cmd.startsWith('kill ')) {
        const name = cmd.substring(5);
        api()?.killProcess(name);
        setResults([{ id: 'cmd-kill', title: `${name}.exe beenden`, subtitle: 'Prozess wird beendet...', type: 'system' }]);
        return;
      }

      if (cmd === 'sleep') { api()?.sleepDisplay(); setResults([{ id: 'cmd-sleep', title: 'Bildschirm ausschalten', subtitle: 'Wird ausgeführt...', type: 'system' }]); return; }
      if (cmd === 'mute') { api()?.toggleMute(); setResults([{ id: 'cmd-mute', title: 'Stummschalten', subtitle: 'Wird ausgeführt...', type: 'system' }]); return; }
      if (cmd === 'trash') { api()?.emptyTrash(); setResults([{ id: 'cmd-trash', title: 'Papierkorb leeren', subtitle: 'Wird ausgeführt...', type: 'system' }]); return; }
      if (cmd === 'ss') { api()?.takeScreenshot(); setResults([{ id: 'cmd-ss', title: 'Screenshot erstellt', subtitle: 'Gespeichert in Bilder', type: 'system' }]); return; }
      if (cmd === 'lock') { api()?.openUrl('cmd://lock'); setResults([{ id: 'cmd-lock', title: 'PC sperren', subtitle: 'Wird ausgeführt...', type: 'system' }]); return; }
      if (cmd === 'shutdown') { api()?.openUrl('cmd://shutdown'); setResults([{ id: 'cmd-shut', title: 'Herunterfahren', subtitle: 'PC wird heruntergefahren...', type: 'system' }]); return; }
      if (cmd === 'restart') { api()?.openUrl('cmd://restart'); setResults([{ id: 'cmd-rest', title: 'Neustart', subtitle: 'PC wird neu gestartet...', type: 'system' }]); return; }

      // Settings command
      if (cmd === 'settings' || cmd === 'config' || cmd === 'prefs') {
        setViewMode('settings');
        try { api()?.resizeWindow(750, 650); } catch (e) { }
        return;
      }

      // Help - Interactive categories
      if (cmd === 'help' || cmd === '?') {
        setResults([
          { id: 'h1', title: 'Rechner & Generatoren', subtitle: 'calc, uuid, now, random, pass • Tab zum Erweitern', type: 'calc', isHelpCategory: true, helpCommands: 'calc,uuid,now,random,pass' },
          { id: 'h2', title: 'Text & Hash-Tools', subtitle: 'hash, enc, dec, json, len, rev • Tab zum Erweitern', type: 'calc', isHelpCategory: true, helpCommands: 'hash,enc,dec,json,len,rev' },
          { id: 'h3', title: 'Text-Transformation', subtitle: 'upper, lower, url, unurl • Tab zum Erweitern', type: 'calc', isHelpCategory: true, helpCommands: 'upper,lower,url,unurl' },
          { id: 'h4', title: 'Web & Netzwerk', subtitle: 'qr, ip, wetter, wiki, tr • Tab zum Erweitern', type: 'web', isHelpCategory: true, helpCommands: 'qr,ip,wetter,wiki,tr' },
          { id: 'h5', title: 'Notizen & Zwischenablage', subtitle: 'note, notes, cp, history • Tab zum Erweitern', type: 'system', isHelpCategory: true, helpCommands: 'note,notes,cp,history' },
          { id: 'h6', title: 'System-Befehle', subtitle: 'sys, proc, kill, run • Tab zum Erweitern', type: 'system', isHelpCategory: true, helpCommands: 'sys,proc,kill,run' },
          { id: 'h7', title: 'Power-User', subtitle: 'sleep, mute, trash, ss, lock • Tab zum Erweitern', type: 'system', isHelpCategory: true, helpCommands: 'sleep,mute,trash,ss,lock' }
        ]);
        return;
      }

      // Unknown command
      setResults([{
        id: 'cmd-help',
        title: 'Befehl nicht erkannt',
        subtitle: '/help für alle Befehle',
        type: 'system'
      }]);
      return;
    }

    // /ai command
    if (query.trim() === '/ai' || query.startsWith('/ai ')) {
      setResults([{
        id: 'ai',
        title: 'Google Gemini öffnen',
        subtitle: 'KI-Chat direkt hier starten',
        type: 'ai'
      }]);
      return;
    }

    // /g command (Instant Answers & Web Search)
    if (query.startsWith('/g ')) {
      setLoading(true);
      const term = query.substring(3);
      const fetchWeb = async () => {
        try {
          const raw = await api()?.fetchInstantAnswer(term);
          if (raw) {
            setResults(raw.map((item: any, idx: number) => ({
              id: `w-${idx}`, ...item
            })));
          }
        } catch (e) { }
        setLoading(false);
      };
      const t = setTimeout(fetchWeb, 300);
      return () => clearTimeout(t);
    }

    setLoading(true);
    const fetchLocal = async () => {
      try {
        const raw = await api()?.searchEverything(query);
        const mappedLocal: SearchResult[] = (raw || []).map((item: any, idx: number) => ({
          id: `r-${idx}`,
          title: item.title.replace(/\.(lnk|url)$/i, ''),
          subtitle: item.path,
          type: (['game', 'app', 'system', 'folder'].includes(item.type) ? item.type : 'file') as SearchResult['type'],
          path: item.path,
          iconBase64: item.iconBase64
        }));

        setResults(mappedLocal);
        setLoading(false);

        // Implicitly try to fetch Instant Answers if not /ai and web suggestions enabled
        if (query.trim().length >= 2 && !query.startsWith('/ai') && settings.search.showWebSuggestions) {
          api()?.fetchInstantAnswer(query).then((webRaw: any) => {
            if (webRaw && webRaw.length > 0) {
              setResults(prev => {
                // Prevent duplicates
                const newWeb = webRaw.map((w: any, idx: number) => ({ id: `w-impl-${idx}`, ...w }));
                const combined = [...prev.filter(r => !r.id.startsWith('w-impl')), ...newWeb];
                return combined;
              });
            }
          }).catch(() => { });
        }
      } catch (e) {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchLocal, 100);
    return () => clearTimeout(timer);
  }, [query, recentItems]);

  // Icon hydration disabled - using type-specific fallback icons instead
  // This ensures consistent icon display without relying on Windows icon extraction

  // Icon hydration for folder items also disabled - using type-specific fallback icons

  const resultsRef = useRef<HTMLDivElement>(null);

  // Derived results list (handle Expand/Collapse of web clutter)
  const displayResults = React.useMemo(() => {
    if (query.startsWith('/g ')) return results;

    const localAndPriority = results.filter(r => r.type !== 'web' || !r.isWeb || r.id === 'web-inline');
    const webClutter = results.filter(r => r.type === 'web' && r.isWeb && r.id !== 'web-inline');

    let out: SearchResult[] = [...localAndPriority];

    // Inject folder items if one is expanded
    if (expandedFolder) {
      const parentIdx = out.findIndex(r => r.path === expandedFolder);
      if (parentIdx !== -1) {
        if (folderItems.length > 0) {
          out.splice(parentIdx + 1, 0, ...folderItems);
        } else if (folderLoading) {
          out.splice(parentIdx + 1, 0, {
            id: 'loading-folder',
            title: 'Lade Ordnerinhalt...',
            subtitle: 'Bitte warten...',
            type: 'file',
            isSubItem: true
          });
        } else {
          out.splice(parentIdx + 1, 0, {
            id: 'empty-folder',
            title: '(Leerer Ordner oder Zugriff verweigert)',
            subtitle: 'Keine anzeigbaren Dateien gefunden',
            type: 'file',
            isSubItem: true
          });
        }
      }
    }

    if (expandWeb) {
      out = [...out, ...webClutter];
    } else {
      // Keep ONE default web search (the fallback one)
      const fallback = webClutter.find(r => r.title.startsWith('Nach "'));
      if (fallback) out.push(fallback);

      // Add expand button if there are more
      if (webClutter.length > 1) {
        out.push({
          id: 'expand-btn',
          title: 'Web-Vorschläge einblenden',
          subtitle: `${webClutter.length - 1} weitere Ergebnisse (Tab drücken)`,
          type: 'web',
          isExpandBtn: true
        });
      }
    }
    return out.slice(0, 20);
  }, [results, expandWeb, query, expandedFolder, folderItems]);

  // Auto-scroll to selected element
  useEffect(() => {
    const selectedEl = resultsRef.current?.querySelector(`.result-item.selected`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedIndex, displayResults]);



  // Clear expanded state when query changes
  useEffect(() => {
    setExpandedFolder(null);
    setFolderItems([]);
    setSelectedIndex(0);
  }, [query]);

  const [expandedHelpCategory, setExpandedHelpCategory] = useState<string | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      interactionMode.current = 'keyboard';
      setSelectedIndex(prev => Math.min(prev + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      interactionMode.current = 'keyboard';
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeAction(displayResults[selectedIndex]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const selected = displayResults[selectedIndex];

      // Help category expansion/collapse
      if (selected && selected.isHelpCategory && selected.helpCommands) {
        // Expand category with descriptions
        const commandDescriptions: Record<string, string> = {
          'calc': 'Mathematische Ausdrücke berechnen',
          'uuid': 'Zufällige UUID v4 generieren',
          'now': 'Aktuelles Datum & Uhrzeit anzeigen',
          'random': 'Zufallszahl generieren',
          'pass': 'Sicheres Passwort generieren',
          'hash': 'SHA-256 Hash erstellen',
          'enc': 'Text zu Base64 kodieren',
          'dec': 'Base64 zu Text dekodieren',
          'json': 'JSON formatieren',
          'len': 'Zeichen & Wörter zählen',
          'rev': 'Text umkehren',
          'upper': 'Text in GROSSBUCHSTABEN',
          'lower': 'Text in kleinbuchstaben',
          'url': 'URL-kodieren',
          'unurl': 'URL-dekodieren',
          'qr': 'QR-Code generieren',
          'ip': 'Öffentliche IP-Adresse anzeigen',
          'weather': 'Wetter abrufen',
          'wetter': 'Wetter abrufen',
          'wiki': 'Wikipedia-Artikel suchen',
          'tr': 'Text übersetzen (DeepL)',
          'note': 'Notiz speichern',
          'notes': 'Gespeicherte Notizen anzeigen',
          'cp': 'Zwischenablage lesen/schreiben',
          'history': 'Zwischenablage-Verlauf',
          'sys': 'System-Info anzeigen',
          'proc': 'Laufende Prozesse auflisten',
          'kill': 'Prozess beenden',
          'run': 'Programm starten',
          'sleep': 'Bildschirm ausschalten',
          'mute': 'Stummschalten umschalten',
          'trash': 'Papierkorb leeren',
          'ss': 'Screenshot erstellen',
          'lock': 'PC sperren'
        };

        const commands = selected.helpCommands.split(',');
        const helpItems: SearchResult[] = commands.map((cmd: string, idx: number) => {
          const cmdTrimmed = cmd.trim();
          return {
            id: `help-cmd-${selected.id}-${idx}`,
            title: `/${cmdTrimmed}`,
            subtitle: commandDescriptions[cmdTrimmed] || 'Befehl ausführen',
            type: selected.type,
            path: `/${cmdTrimmed}`
          };
        });
        // Add "back to main" hint as first item
        helpItems.unshift({
          id: 'help-back',
          title: '← Zurück zum Hauptmenü',
          subtitle: 'Tab drücken um zurückzukehren',
          type: selected.type,
          path: '/help',
          isHelpCategory: false
        });
        setResults(helpItems);
        setExpandedHelpCategory(selected.id);
        setSelectedIndex(0);
        return;
      }

      // Collapse help category back to main help when inside a category
      if (expandedHelpCategory && query.trim() !== '/help' && query.trim() !== '/?') {
        // Tab back to return to main help categories
        setQuery('/help');
        setExpandedHelpCategory(null);
        setSelectedIndex(0);
        return;
      }

      // Robust Folder Expansion Check: Prioritize folder expansion over web toggling
      if (selected && selected.type === 'folder' && selected.path) {
        if (expandedFolder === selected.path) {
          setExpandedFolder(null);
          setFolderItems([]);
        } else {
          setExpandedFolder(selected.path);
          setFolderItems([]);
          setFolderLoading(true);

          const currentPath = selected.path;
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000)
          );

          try {
            // @ts-ignore
            Promise.race([
              api().listDirectory(selected.path),
              timeoutPromise
            ]).then((raw: any) => {
              // Only update if we are still targeting this folder
              setExpandedFolder(prev => {
                if (prev === currentPath) {
                  const subItems: SearchResult[] = (raw || []).map((item: any, idx: number) => ({
                    id: `sub-${idx}-${item.path}`,
                    title: item.title,
                    subtitle: item.path,
                    type: item.type,
                    path: item.path,
                    iconBase64: item.iconBase64,
                    isSubItem: true
                  }));
                  setFolderItems(subItems);
                  setFolderLoading(false);
                }
                return prev;
              });
            }).catch(() => {
              setFolderLoading(false);
              setFolderItems([]);
            });
          } catch (e) {
            setFolderLoading(false);
          }
        }
      } else {
        // Only toggle web suggest if NOT on a folder
        setExpandWeb(prev => !prev);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (viewMode !== 'search') {
        backToSearch();
      } else {
        try { api()?.hideWindow(); } catch (e) { }
      }
    }
  };

  const executeAction = (result: SearchResult) => {
    if (!result) return;

    // Check if this is a help command that should be inserted into input
    if (result.path && result.path.startsWith('/') && result.id.startsWith('help-cmd-')) {
      setQuery(result.path + ' ');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // Add to Recent Items (if it has a path and is not a sub-item)
    if (result.path && !result.isSubItem && result.type !== 'ai') {
      setRecentItems(prev => {
        const filtered = prev.filter(item => item.path !== result.path);
        return [result, ...filtered].slice(0, 5); // Keep last 5
      });
    }

    try {
      if (result.isExpandBtn) {
        setExpandWeb(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (result.type === 'ai') {
        openAI();
      } else if (result.isWeb || result.type === 'web') {
        api()?.openUrl(result.path);
      } else if (result.path) {
        api()?.openFile(result.path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Get icon based on file extension for more specific icons
  const getFileTypeIcon = (path: string | undefined): React.ReactNode => {
    if (!path) return <File size={16} />;
    const ext = path.split('.').pop()?.toLowerCase() || '';

    // Audio files
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      return <Music size={16} />;
    }
    // Video files
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return <Video size={16} />;
    }
    // Image files
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) {
      return <Image size={16} />;
    }
    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return <Archive size={16} />;
    }
    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml'].includes(ext)) {
      return <Code size={16} />;
    }
    // Document files
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
      return <FileText size={16} />;
    }
    // Spreadsheet files
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
      return <FileSpreadsheet size={16} />;
    }
    // Presentation files
    if (['ppt', 'pptx', 'odp'].includes(ext)) {
      return <Presentation size={16} />;
    }
    // Drive/Volume
    if (path.match(/^[A-Z]:\\$/i)) {
      return <HardDrive size={16} />;
    }

    return <File size={16} />;
  };

  const getIcon = (type: string, path?: string) => {
    switch (type) {
      case 'app': return <AppWindow size={16} />;
      case 'game': return <Gamepad2 size={16} />;
      case 'file': return getFileTypeIcon(path);
      case 'system': return <Settings size={16} />;
      case 'weather': return <CloudRain size={16} />;
      case 'calc': return <Calculator size={16} />;
      case 'ai': return <Bot size={16} />;
      case 'web': return <Globe size={16} />;
      case 'folder': return <Folder size={16} />;
      default: return <FileText size={16} />;
    }
  };

  // Track failed icons to show fallback
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());

  const handleIconError = (path: string) => {
    setFailedIcons(prev => new Set(prev).add(path));
  };

  const getBadge = (type: string) => {
    switch (type) {
      case 'app': return 'App';
      case 'game': return 'Spiel';
      case 'system': return 'System';
      case 'weather': return 'Wetter';
      case 'calc': return 'Mathe';
      case 'file': return 'Datei';
      case 'ai': return 'KI';
      case 'web': return 'Web';
      default: return '';
    }
  };

  // Initialize Native Terminal if AI mode
  useEffect(() => {
    if (viewMode === 'ai' && termRef.current && !termInstance.current) {
      const term = new Terminal({
        theme: {
          background: '#0f0f14',
          foreground: '#f0f0f5',
          cursor: '#7c5cfc',
          selectionBackground: 'rgba(124, 92, 252, 0.3)',
        },
        fontFamily: "'Inter', 'Consolas', monospace",
        fontSize: 14,
        disableStdin: true, // We handle input externally via Chat UI to fix Windows cmd bugs
        convertEol: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termRef.current);
      fitAddon.fit();
      termInstance.current = term;

      // Listen for output from main process
      api()?.onTerminalOutput((data: string) => {
        term.write(data);
      });

      // Handle window resize
      const rs = () => fitAddon.fit();
      window.addEventListener('resize', rs);
      return () => {
        window.removeEventListener('resize', rs);
        term.dispose();
        termInstance.current = null;
      };
    }
  }, [viewMode]);

  const sendToTerminal = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!terminalInput.trim()) return;

    // Send input to our backend cmd.exe process
    api()?.sendTerminalInput(terminalInput + '\r\n');

    // Echo it in the terminal so user sees what they typed
    if (termInstance.current) {
      termInstance.current.writeln(`\x1b[35m> ${terminalInput}\x1b[0m`);
    }

    setTerminalInput('');
  };

  // ========================
  // RENDER
  // ========================

  // AI mode – Native API Chat
  if (viewMode === 'ai') {
    return (
      <div className="app-container">
        <div className="search-glass expanded">
          {/* Header bar */}
          <div className="webview-header">
            <button className="webview-back" onClick={backToSearch}>
              <ArrowLeft size={16} />
              <span>Zurück</span>
            </button>
            <span className="webview-title">Gemini CLI (Lokal)</span>
            <button className="webview-external" onClick={backToSearch}>
              <ExternalLink size={14} />
              <span>Abbrechen</span>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="terminal-container">
            <div ref={termRef} className="xterm-wrapper" />
            <form className="terminal-input-bar" onSubmit={sendToTerminal}>
              <TerminalSquare size={16} className="terminal-icon" />
              <input
                ref={terminalInputRef}
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                placeholder="Befehl an Gemini ('exit' zum Schließen)..."
                className="terminal-text-input"
                autoFocus
              />
              <button type="submit" className="terminal-send-btn">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Settings categories for sidebar
  const settingsCategories = [
    { id: 'appearance', label: 'Aussehen', icon: Palette },
    { id: 'search', label: 'Suche', icon: Search },
    { id: 'features', label: 'Funktionen', icon: Zap },
    { id: 'privacy', label: 'Datenschutz', icon: Lock },
    { id: 'about', label: 'Über', icon: Info }
  ];

  const [activeCategory, setActiveCategory] = useState('appearance');

  // Settings mode
  if (viewMode === 'settings') {
    const accentColors = [
      { name: 'Lila', value: '#7c5cfc' },
      { name: 'Blau', value: '#3b82f6' },
      { name: 'Cyan', value: '#06b6d4' },
      { name: 'Grün', value: '#10b981' },
      { name: 'Orange', value: '#f97316' },
      { name: 'Rot', value: '#ef4444' },
      { name: 'Pink', value: '#ec4899' }
    ];

    return (
      <div className="app-container">
        <div className="search-glass settings-view">
          {/* Header */}
          <div className="webview-header">
            <button className="webview-back" onClick={backToSearch}>
              <ArrowLeft size={16} />
              <span>Zurück</span>
            </button>
            <span className="webview-title">Einstellungen</span>
            <div style={{ width: 100 }} />
          </div>

          {/* Settings Content */}
          <div className="settings-container">
            {/* Sidebar */}
            <div className="settings-sidebar">
              {settingsCategories.map(cat => (
                <button
                  key={cat.id}
                  className={`settings-nav-item ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <cat.icon size={16} />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Main Content */}
            <div className="settings-content">
              {/* Appearance */}
              {activeCategory === 'appearance' && (
                <div className="settings-section">
                  <h2 className="settings-title">Aussehen</h2>

                  <div className="settings-group">
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Akzentfarbe</span>
                        <span className="settings-item-desc">Wähle die Hauptfarbe der App</span>
                      </div>
                      <div className="color-picker">
                        {accentColors.map(color => (
                          <button
                            key={color.value}
                            className={`color-option ${settings.appearance.accentColor === color.value ? 'selected' : ''}`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => updateSetting('appearance', 'accentColor', color.value)}
                            title={color.name}
                          >
                            {settings.appearance.accentColor === color.value && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Schriftgröße</span>
                        <span className="settings-item-desc">Passe die Textgröße an</span>
                      </div>
                      <select
                        className="settings-select"
                        value={settings.appearance.fontSize}
                        onChange={(e) => updateSetting('appearance', 'fontSize', e.target.value)}
                      >
                        <option value="small">Klein</option>
                        <option value="medium">Mittel</option>
                        <option value="large">Groß</option>
                      </select>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Animationen</span>
                        <span className="settings-item-desc">Aktiviere sanfte Übergänge</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.appearance.animations}
                          onChange={(e) => updateSetting('appearance', 'animations', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Hintergrundunschärfe</span>
                        <span className="settings-item-desc">Glasmorphismus-Effekt</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.appearance.blur}
                          onChange={(e) => updateSetting('appearance', 'blur', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item slider-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Transparenz</span>
                        <span className="settings-item-desc">Hintergrunddurchsichtigkeit: {settings.appearance.transparency}%</span>
                      </div>
                      <input
                        type="range"
                        className="settings-slider"
                        value={settings.appearance.transparency}
                        onChange={(e) => updateSetting('appearance', 'transparency', parseInt(e.target.value))}
                        min={20}
                        max={100}
                      />
                    </div>

                    <div className="settings-item slider-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Unschärfe-Stärke</span>
                        <span className="settings-item-desc">Blur-Effekt: {settings.appearance.blurAmount}px</span>
                      </div>
                      <input
                        type="range"
                        className="settings-slider"
                        value={settings.appearance.blurAmount}
                        onChange={(e) => updateSetting('appearance', 'blurAmount', parseInt(e.target.value))}
                        min={0}
                        max={80}
                      />
                    </div>

                    <div className="settings-item slider-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Ab rundungen</span>
                        <span className="settings-item-desc">Fenster-Ecken: {settings.appearance.borderRadius}px</span>
                      </div>
                      <input
                        type="range"
                        className="settings-slider"
                        value={settings.appearance.borderRadius}
                        onChange={(e) => updateSetting('appearance', 'borderRadius', parseInt(e.target.value))}
                        min={0}
                        max={30}
                      />
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Auf Standard zurücksetzen</span>
                        <span className="settings-item-desc">Alle Einstellungen zurücksetzen</span>
                      </div>
                      <button className="settings-btn" onClick={resetSettings}>
                        Zurücksetzen
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Search */}
              {activeCategory === 'search' && (
                <div className="settings-section">
                  <h2 className="settings-title">Suche</h2>

                  <div className="settings-group">
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Maximale Ergebnisse</span>
                        <span className="settings-item-desc">Anzahl der angezeigten Suchergebnisse</span>
                      </div>
                      <input
                        type="number"
                        className="settings-input"
                        value={settings.search.maxResults}
                        onChange={(e) => updateSetting('search', 'maxResults', parseInt(e.target.value) || 20)}
                        min={5}
                        max={50}
                      />
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Web-Vorschläge</span>
                        <span className="settings-item-desc">Zeige Online-Suchergebnisse</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.search.showWebSuggestions}
                          onChange={(e) => updateSetting('search', 'showWebSuggestions', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Standardstadt für Wetter</span>
                        <span className="settings-item-desc">Stadt für /wetter Befehl</span>
                      </div>
                      <input
                        type="text"
                        className="settings-input"
                        value={settings.search.defaultCity}
                        onChange={(e) => updateSetting('search', 'defaultCity', e.target.value)}
                        placeholder="Berlin"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Features */}
              {activeCategory === 'features' && (
                <div className="settings-section">
                  <h2 className="settings-title">Funktionen</h2>

                  <div className="settings-group">
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Wetter-Befehl</span>
                        <span className="settings-item-desc">Aktiviere /wetter und Wetter-Quick-Action</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.features.weatherEnabled}
                          onChange={(e) => updateSetting('features', 'weatherEnabled', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">KI-Chat</span>
                        <span className="settings-item-desc">Aktiviere /ai für Gemini-Integration</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.features.aiEnabled}
                          onChange={(e) => updateSetting('features', 'aiEnabled', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Zwischenablage-Verlauf</span>
                        <span className="settings-item-desc">Speichere kopierte Texte</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.features.clipboardHistory}
                          onChange={(e) => updateSetting('features', 'clipboardHistory', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Notizen</span>
                        <span className="settings-item-desc">Aktiviere /note zum Speichern von Notizen</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.features.notesEnabled}
                          onChange={(e) => updateSetting('features', 'notesEnabled', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy */}
              {activeCategory === 'privacy' && (
                <div className="settings-section">
                  <h2 className="settings-title">Datenschutz</h2>

                  <div className="settings-group">
                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Letzte Suchen speichern</span>
                        <span className="settings-item-desc">Zeige zuletzt gesuchte Dateien an</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.privacy.saveRecents}
                          onChange={(e) => updateSetting('privacy', 'saveRecents', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Zwischenablage-Verlauf speichern</span>
                        <span className="settings-item-desc">Speichere kopierte Texte lokal</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.privacy.saveClipboardHistory}
                          onChange={(e) => updateSetting('privacy', 'saveClipboardHistory', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="settings-item danger">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Alle Daten löschen</span>
                        <span className="settings-item-desc">Entferne alle gespeicherten Daten</span>
                      </div>
                      <button
                        className="settings-btn danger"
                        onClick={() => {
                          if (confirm('Möchtest du wirklich alle Daten löschen?')) {
                            localStorage.clear();
                            setRecentItems([]);
                            setSettings(defaultSettings);
                          }
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* About */}
              {activeCategory === 'about' && (
                <div className="settings-section">
                  <h2 className="settings-title">Über Windows Bar</h2>

                  <div className="settings-group">
                    <div className="about-card">
                      <div className="about-icon">
                        <Monitor size={48} />
                      </div>
                      <h3>Windows Bar</h3>
                      <p className="about-version">Version 1.0.0</p>
                      <p className="about-desc">
                        Ein schneller und eleganter App-Launcher für Windows mit
                        integrierter KI, Wetter-Anzeige und vielen nützlichen Befehlen.
                      </p>
                      <div className="about-links">
                        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="about-link">
                          <Globe size={14} />
                          GitHub
                        </a>
                      </div>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Tastenkürzel</span>
                        <span className="settings-item-desc">Drücke Alt+Space zum Öffnen</span>
                      </div>
                    </div>

                    <div className="settings-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">Befehle</span>
                        <span className="settings-item-desc">Tippe /help für alle Befehle</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Search mode
  return (
    <div className="app-container">
      <div className="search-glass">
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Suchen..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoFocus
          />
          <div className="shortcut-hint">
            <kbd>ESC</kbd>
          </div>
        </div>

        {loading && <div className="loading-bar" />}

        {/* Quick Actions */}
        {!query.trim() && (
          <div className="quick-actions">
            <div className="quick-action" onClick={openAI}>
              <div className="quick-action-icon ai"><Bot size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">KI Chat</span>
                <span className="quick-action-sub">Google Gemini</span>
              </div>
            </div>
            <div className="quick-action" onClick={() => setQuery('/g ')}>
              <div className="quick-action-icon web"><Globe size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">Web Suche</span>
                <span className="quick-action-sub">Inline Ergebnisse</span>
              </div>
            </div>
            <div className="quick-action" onClick={() => setQuery('Downloads')}>
              <div className="quick-action-icon files"><File size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">Dateien</span>
                <span className="quick-action-sub">Schnellzugriff</span>
              </div>
            </div>
            <div className="quick-action" onClick={() => {
              setQuery('wetter');
              setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.setSelectionRange(6, 6);
              }, 50);
            }}>
              <div className="quick-action-icon calc"><CloudSun size={15} /></div>
              <div className="quick-action-text">
                <span className="quick-action-title">Wetter</span>
                <span className="quick-action-sub">Direkt anzeigen</span>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {displayResults.length > 0 && (
          <div
            className="results-container"
            ref={resultsRef}
            onMouseMove={() => interactionMode.current = 'mouse'}
          >
            {!query.trim() && recentItems.length > 0 && (
              <div className="section-header-row">
                <div className="section-label">Zuletzt gesucht</div>
                <button
                  className="clear-history-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRecentItems([]);
                  }}
                >
                  Verlauf löschen
                </button>
              </div>
            )}
            {displayResults.map((res, idx) => {
              // Special rendering for weather card
              if (res.id === 'weather-card' && res.path) {
                try {
                  const data = JSON.parse(res.path);

                  // Temperature graph rendering - show all 24 hours
                  const hourlyData = data.hourly || [];
                  const graphHours = hourlyData.slice(0, 24); // All 24 hours
                  const temps = graphHours.map((h: { temp: number }) => h.temp);
                  const minTemp = Math.min(...temps) - 2;
                  const maxTemp = Math.max(...temps) + 2;
                  const tempRange = maxTemp - minTemp || 1;

                  // SVG graph dimensions - wider for 24 hours
                  const graphWidth = 600;
                  const graphHeight = 80;
                  const padding = 15;

                  // Generate path points
                  const points = graphHours.map((h: { temp: number; time: string }, i: number) => {
                    const x = padding + (i / (graphHours.length - 1 || 1)) * (graphWidth - padding * 2);
                    const y = graphHeight - padding - ((h.temp - minTemp) / tempRange) * (graphHeight - padding * 2);
                    return { x, y, temp: h.temp, time: h.time };
                  });

                  // Create smooth curve path
                  const pathD = points.map((p: { x: number; y: number; temp: number; time: string }, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                  // Create gradient area under curve
                  const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${graphHeight - padding} L ${padding} ${graphHeight - padding} Z`;

                  return (
                    <div
                      key={res.id}
                      className={`weather-card ${idx === selectedIndex ? 'selected' : ''}`}
                      onClick={() => executeAction(res)}
                      onMouseEnter={() => {
                        if (interactionMode.current === 'mouse') {
                          setSelectedIndex(idx);
                        }
                      }}
                    >
                      <div className="weather-header">
                        <div className="weather-icon-main"><CloudSun size={32} /></div>
                        <div className="weather-temp">
                          <span className="temp-value">{data.temp}°C</span>
                          <span className="temp-city">{data.city}</span>
                        </div>
                      </div>
                      <div className="weather-desc">{data.weatherDesc}</div>
                      <div className="weather-range">Gefühlt {data.feelsLike}°C | {data.minTemp}° bis {data.maxTemp}°C</div>

                      {/* Temperature Graph */}
                      {graphHours.length > 1 && (
                        <div className="weather-graph-container">
                          <svg className="weather-graph" viewBox={`0 0 ${graphWidth} ${graphHeight}`}>
                            <defs>
                              <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
                                <stop offset="100%" stopColor="rgba(56, 189, 248, 0.05)" />
                              </linearGradient>
                            </defs>
                            {/* Grid lines */}
                            {[0, 1, 2].map(i => (
                              <line
                                key={i}
                                x1={padding}
                                y1={padding + i * (graphHeight - padding * 2) / 2}
                                x2={graphWidth - padding}
                                y2={padding + i * (graphHeight - padding * 2) / 2}
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="1"
                              />
                            ))}
                            {/* Area under curve */}
                            <path d={areaD} fill="url(#tempGradient)" />
                            {/* Temperature line */}
                            <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            {/* Data points */}
                            {points.map((p: { x: number; y: number; temp: number; time: string }, i: number) => (
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r="3" fill="#38bdf8" />
                                <circle cx={p.x} cy={p.y} r="5" fill="rgba(56, 189, 248, 0.3)" />
                              </g>
                            ))}
                          </svg>
                          {/* Time labels */}
                          <div className="weather-graph-labels">
                            {points.map((p: { x: number; y: number; temp: number; time: string }, i: number) => (
                              <span key={i} className="weather-graph-label">
                                {parseInt(p.time) ? `${parseInt(p.time)}:00` : p.time}
                              </span>
                            ))}
                          </div>
                          {/* Temperature labels */}
                          <div className="weather-graph-temps">
                            {points.map((p: { x: number; y: number; temp: number; time: string }, i: number) => (
                              <span key={i} className="weather-graph-temp">{p.temp}°</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Precipitation Zone Bar - 24 hours with icons - time synchronized with temperature graph */}
                      {hourlyData.length > 0 && (
                        <div className="weather-precip-zone">
                          <div className="weather-precip-label">
                            Niederschlag (24h)
                            {hourlyData.some((h: any) => {
                              const chance = parseInt(h.chanceOfRain) || 0;
                              const weatherCode = parseInt(h.weatherIcon) || 0;
                              // Check for any precipitation type
                              const isRain = weatherCode >= 61 && weatherCode <= 67;
                              const isSnow = weatherCode >= 71 && weatherCode <= 86;
                              const isHail = weatherCode === 87 || weatherCode === 88;
                              const isSleet = weatherCode >= 68 && weatherCode <= 70;
                              const isFreezing = weatherCode >= 49 && weatherCode <= 57;
                              return chance > 20 && (isRain || isSnow || isHail || isSleet || isFreezing);
                            }) && (
                                <span className="weather-precip-warning">
                                  <CloudDrizzle size={12} /> Niederschlag erwartet
                                </span>
                              )}
                          </div>

                          {/* Precipitation bar - bars grow from bottom */}
                          <div className="weather-precip-bar">
                            {hourlyData.slice(0, 24).map((h: any, i: number) => {
                              const chance = parseInt(h.chanceOfRain) || 0;
                              const weatherCode = parseInt(h.weatherIcon) || 0;

                              // Determine precipitation type based on weather code
                              // Weather codes: https://openweathermap.org/weather-conditions
                              // 61-67: Rain, 71-86: Snow, 87-88: Hail, 68-70: Sleet, 49-57: Freezing
                              const isSnow = weatherCode >= 71 && weatherCode <= 86;
                              const isHail = weatherCode === 87 || weatherCode === 88;
                              const isSleet = weatherCode >= 68 && weatherCode <= 70;
                              const isFreezing = weatherCode >= 49 && weatherCode <= 57;
                              const isRain = weatherCode >= 61 && weatherCode <= 67;

                              // Show precipitation if chance > 20% and has precipitation type
                              const hasPrecip = chance > 20 && (isRain || isSnow || isHail || isSleet || isFreezing);

                              // Determine the precipitation type class
                              const getPrecipType = () => {
                                if (isSnow) return 'snow';
                                if (isHail) return 'hail';
                                if (isSleet) return 'sleet';
                                if (isFreezing) return 'sleet';
                                if (isRain) return 'rain';
                                return '';
                              };

                              // Determine the segment type class for background
                              const getSegmentType = () => {
                                if (isSnow) return 'snow-type';
                                if (isHail) return 'hail-type';
                                if (isSleet) return 'hail-type';
                                return '';
                              };

                              // Get the appropriate icon
                              const getPrecipIcon = () => {
                                if (isSnow) return <Snowflake size={10} />;
                                if (isHail) return <CloudHail size={10} />;
                                if (isSleet || isFreezing) return <CloudFog size={10} />;
                                if (isRain) return <CloudDrizzle size={10} />;
                                return <CloudDrizzle size={10} />;
                              };

                              // Get icon class
                              const getIconClass = () => {
                                if (isSnow) return 'snow-icon';
                                if (isHail) return 'hail-icon';
                                if (isSleet || isFreezing) return 'sleet-icon';
                                if (isRain) return 'rain-icon';
                                return 'rain-icon';
                              };

                              // Calculate bar height - grows from bottom
                              const barHeight = hasPrecip ? Math.max(chance, 15) : Math.max(chance, 5);

                              return (
                                <div
                                  key={i}
                                  className={`weather-precip-segment ${hasPrecip ? 'has-precip' : ''} ${hasPrecip ? getSegmentType() : ''}`}
                                >
                                  {/* Icon above bar when precipitation is expected */}
                                  {hasPrecip && (
                                    <div className={`weather-precip-icon ${getIconClass()}`}>
                                      {getPrecipIcon()}
                                    </div>
                                  )}
                                  {/* Bar that grows from bottom */}
                                  <div
                                    className={`weather-precip-fill ${getPrecipType()}`}
                                    style={{ height: `${barHeight}%` }}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Time labels - synchronized with temperature graph */}
                          <div className="weather-precip-time-labels">
                            {hourlyData.slice(0, 24).map((h: any, i: number) => {
                              const chance = parseInt(h.chanceOfRain) || 0;
                              const weatherCode = parseInt(h.weatherIcon) || 0;
                              const isRain = weatherCode >= 61 && weatherCode <= 67;
                              const isSnow = weatherCode >= 71 && weatherCode <= 86;
                              const isHail = weatherCode === 87 || weatherCode === 88;
                              const isSleet = weatherCode >= 68 && weatherCode <= 70;
                              const hasPrecip = chance > 20 && (isRain || isSnow || isHail || isSleet);
                              const time = h.time || '';

                              // Show time label every 3 hours (0, 3, 6, 9, 12, 15, 18, 21)
                              if (i % 3 === 0) {
                                return (
                                  <span
                                    key={i}
                                    className={`weather-precip-time ${hasPrecip ? 'highlight' : ''}`}
                                    style={{ flex: 3 }}
                                  >
                                    {parseInt(time) ? `${parseInt(time)}:00` : time}
                                  </span>
                                );
                              }
                              return <span key={i} className="weather-precip-time" style={{ flex: 1 }} />;
                            })}
                          </div>
                        </div>
                      )}

                      <div className="weather-grid">
                        <div className="weather-stat">
                          <Wind size={14} />
                          <span>{data.windSpeed} km/h {data.windDir}</span>
                        </div>
                        <div className="weather-stat">
                          <Droplets size={14} />
                          <span>{data.humidity}%</span>
                        </div>
                        <div className="weather-stat">
                          <Sun size={14} />
                          <span>UV {data.uvIndex}</span>
                        </div>
                        <div className="weather-stat">
                          <Eye size={14} />
                          <span>{data.visibility}km</span>
                        </div>
                        <div className="weather-stat">
                          <Cloud size={14} />
                          <span>{data.cloudCover}%</span>
                        </div>
                        <div className="weather-stat">
                          <Gauge size={14} />
                          <span>{data.pressure} hPa</span>
                        </div>
                      </div>
                      {data.sunrise && data.sunset && (
                        <div className="weather-sun">
                          <span><Sunrise size={14} /> {data.sunrise}</span>
                          <span><Sunset size={14} /> {data.sunset}</span>
                        </div>
                      )}
                    </div>
                  );
                } catch (e) {
                  return null;
                }
              }

              // Normal result items
              return (
                <div
                  key={res.id}
                  className={`result-item ${idx === selectedIndex ? 'selected' : ''} ${res.isSubItem ? 'sub-item' : ''}`}
                  onClick={() => executeAction(res)}
                  onMouseEnter={() => {
                    if (interactionMode.current === 'mouse') {
                      setSelectedIndex(idx);
                    }
                  }}
                >
                  <div className={`result-icon ${res.type}`}>
                    {getIcon(res.type, res.path)}
                  </div>
                  <div className="result-content">
                    <span className="result-title" style={res.isExpandBtn ? { color: 'var(--accent)' } : {}}>{res.title}</span>
                    {res.subtitle && <span className="result-subtitle">{res.subtitle}</span>}
                  </div>
                  {!res.isExpandBtn && <span className="result-badge">{getBadge(res.type)}</span>}
                  <span className="result-enter">{res.isExpandBtn ? 'Tab' : '↵'}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="search-footer">
          <div className="footer-commands">
            <span><kbd>↑↓</kbd> navigieren</span>
            <span><kbd>↵</kbd> öffnen</span>
            <span><kbd>Tab</kbd> Web ansicht</span>
            <span><kbd>/ai</kbd> Chat</span>
          </div>
          <span>Windows Bar</span>
        </div>
      </div>
    </div>
  );
}

export default App;
