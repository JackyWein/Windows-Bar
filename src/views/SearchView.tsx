import type { SearchResult, AppSettings, CommandResult } from '../types';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, File, AppWindow, Gamepad2, Bot, Globe, Calculator,
  Folder, FileText, HardDrive, Music, Video, Image, Archive,
  Code, FileSpreadsheet, Presentation, CloudRain, CloudSun,
  Wind, Droplets, Eye, Cloud, Gauge, Sunrise, Sunset, Sun,
  Snowflake, CloudDrizzle, CloudHail, CloudFog, Settings,
} from 'lucide-react';

import { commandRegistry } from '../core/commands/registry';
import { CompactPlayer } from '../components/CompactPlayer';
import { searchWithPlugins } from '../core/plugins/loader';

interface SearchViewProps {
  settings: AppSettings;
  onOpenAI: () => void;
  onOpenSettings: () => void;
  onOpenNote: (id?: number) => void;
  onOpenMediaControl: () => void;
  hasMedia?: boolean;
  showMediaBar?: boolean;
}

// Focus zones for Tab navigation
const FOCUS_ZONE_INPUT = 0;
const FOCUS_ZONE_QUICK_ACTIONS = 1;
const FOCUS_ZONE_RESULTS = 2;
const FOCUS_ZONE_FOOTER = 3;
const TOTAL_ZONES = 4;

// Icon helpers
function getFileTypeIcon(path: string | undefined): React.ReactNode {
  if (!path) return <File size={16} />;
  const ext = path.split('.').pop()?.toLowerCase() || '';

  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) return <Music size={16} />;
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return <Video size={16} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) return <Image size={16} />;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return <Archive size={16} />;
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml'].includes(ext)) return <Code size={16} />;
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return <FileText size={16} />;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return <FileSpreadsheet size={16} />;
  if (['ppt', 'pptx', 'odp'].includes(ext)) return <Presentation size={16} />;
  if (path.match(/^[A-Z]:\\$/i)) return <HardDrive size={16} />;
  return <File size={16} />;
}

function getIcon(type: string, path?: string) {
  switch (type) {
    case 'app': return <AppWindow size={16} />;
    case 'game': return <Gamepad2 size={16} />;
    case 'file': return getFileTypeIcon(path);
    case 'system': return <CloudRain size={16} />;
    case 'weather': return <CloudRain size={16} />;
    case 'calc': return <Calculator size={16} />;
    case 'ai': return <Bot size={16} />;
    case 'web': return <Globe size={16} />;
    case 'folder': return <Folder size={16} />;
    default: return <FileText size={16} />;
  }
}

function getBadge(type: string) {
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
}

// 🧠 SCORING ENGINE (Fuzzy Search & Historie)
function calculateScore(itemTitle: string, itemType: string, itemIdOrPath: string, query: string, history: Record<string, number>): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = itemTitle.toLowerCase();

  let baseScore = 0;

  // 1. Exakte & Teil-Treffer (Höchste Prio)
  if (t === q) baseScore = 100;
  else if (t.startsWith(q)) baseScore = 80;
  else if (t.includes(q)) baseScore = 60;
  else {
    // 2. Fuzzy Matching (Subsequence)
    // Erlaubt z.B. "vsc" um "Visual Studio Code" zu finden
    let qIdx = 0;
    let consec = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === q[qIdx]) {
        baseScore += 5 + (consec * 2); // Bonus für aufeinanderfolgende Buchstaben
        consec++;
        qIdx++;
        if (qIdx === q.length) break;
      } else {
        consec = 0;
      }
    }
    // Wenn nicht alle Buchstaben aus der Suche vorkommen, ist es kein Fuzzy-Treffer
    if (qIdx < q.length) baseScore = 0;
    baseScore = Math.min(baseScore, 50); // Fuzzy-Score maximal 50, damit echte Treffer immer drüber liegen
  }

  // 3. Typ-Multiplikatoren (Apps sind wichtiger als normale Textdateien)
  const typeMult: Record<string, number> = { app: 2.0, game: 2.0, system: 1.5, folder: 1.2, file: 1.0 };
  const mult = typeMult[itemType] || 1.0;

  // 4. Klick-Historien-Bonus (Die App lernt!)
  const clicks = history[itemIdOrPath] || 0;
  // +5 Punkte pro Klick, maximal +50 Punkte Bonus
  const historyBonus = Math.min(clicks * 5, 50);

  if (baseScore === 0) return 0;

  return (baseScore * mult) + historyBonus;
}


export function SearchView({ settings, onOpenAI, onOpenSettings, onOpenNote, onOpenMediaControl, hasMedia, showMediaBar }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expandWeb, setExpandWeb] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [folderItemsMap, setFolderItemsMap] = useState<Map<string, SearchResult[]>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);

  // 🧠 Zustand für die Klick-Historie
  const [clickHistory, setClickHistory] = useState<Record<string, number>>({});
  const [updateDownloaded, setUpdateDownloaded] = useState(false);

  // Focus zone state for Tab navigation
  const [focusedZone, setFocusedZone] = useState(FOCUS_ZONE_INPUT);
  const [focusedQuickAction, setFocusedQuickAction] = useState(0);

  const interactionMode = useRef<'mouse' | 'keyboard'>('mouse');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const loadingFoldersRef = useRef<Set<string>>(new Set());

  // Sync command enabled states from settings
  useEffect(() => {
    const allCommands = commandRegistry.getAll();
    for (const cmd of allCommands) {
      const userEnabled = settings.commands.enabled[cmd.id];
      if (userEnabled !== undefined) {
        commandRegistry.setEnabled(cmd.id, userEnabled);
      }
    }
  }, [settings.commands.enabled]);

  // Load recents & Click History on mount & check for updates
  useEffect(() => {
    const savedRecents = localStorage.getItem('recent_searches_v2');
    if (savedRecents) {
      try { setRecentItems(JSON.parse(savedRecents)); } catch { /* ignore */ }
    }

    // Lade das "Gehirn" der Such-Engine
    const savedHistory = localStorage.getItem('search_click_history');
    if (savedHistory) {
      try { setClickHistory(JSON.parse(savedHistory)); } catch { /* ignore */ }
    }

    // Check if update is already downloaded
    window.electronAPI?.checkForUpdates?.().then(result => {
      if (result?.downloaded) {
        setUpdateDownloaded(true);
      }
    }).catch(() => {});

    // Listen for update downloaded event
    if (window.electronAPI?.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateDownloaded(true);
      });
    }
  }, []);

  // Save recents
  useEffect(() => {
    localStorage.setItem('recent_searches', JSON.stringify(recentItems));
  }, [recentItems]);

  // Focus input on window focus
  useEffect(() => {
    inputRef.current?.focus();
    const focusFn = () => {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
      setFocusedZone(FOCUS_ZONE_INPUT);
    };
    window.addEventListener('focus', focusFn);
    return () => window.removeEventListener('focus', focusFn);
  }, []);

  // Reset expansion on query change
  useEffect(() => {
    setExpandedFolders([]);
    setFolderItemsMap(new Map());
    setSelectedIndex(0);
    setFocusedZone(FOCUS_ZONE_INPUT);
  }, [query]);

  // Build command context
  const buildCommandContext = useCallback(() => ({
    settings,
    query,
    showResults: (newResults: SearchResult[]) => setResults(newResults),
    navigate: () => { },
    openNote: onOpenNote,
    api: (window as any).electronAPI,
  }), [settings, query, onOpenNote]);

  // Check if a command's required setting is enabled
  const isCommandAvailable = useCallback((requiresSetting: string | undefined): boolean => {
    if (!requiresSetting) return true;
    const keys = requiresSetting.split('.');
    if (keys.length === 2) {
      const category = settings[keys[0] as keyof AppSettings] as Record<string, unknown>;
      return category?.[keys[1]] === true;
    }
    return true;
  }, [settings]);

  // Helper for Weather
  const getDayName = useCallback((dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Heute';
    if (date.toDateString() === tomorrow.toDateString()) return 'Morgen';

    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[date.getDay()];
  }, []);

  // Safe Weather Fetcher
  const fetchWeather = useCallback(async (city: string, isActive: { current: boolean }) => {
    setLoading(true);
    try {
      const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=de`);
      const data = await r.json();
      if (!isActive.current) return;

      const current = data.current_condition?.[0];
      const today = data.weather?.[0];
      const hourly = today?.hourly || [];

      if (!current) {
        setResults([{ id: 'cmd-err', title: 'Wetter nicht verfügbar', subtitle: 'Keine Daten erhalten', type: 'system' }]);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hourlyData = hourly.map((h: any) => ({
        time: h.time, temp: parseInt(h.tempC), feelsLike: parseInt(h.FeelsLikeC),
        chanceOfRain: h.chanceofrain, weatherIcon: h.weatherCode,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const forecast = (data.weather || []).slice(0, 7).map((day: any) => ({
        date: day.date, dayName: getDayName(day.date), minTemp: day.mintempC, maxTemp: day.maxtempC,
        weatherIcon: day.hourly?.[4]?.weatherCode || '116',
        weatherDesc: day.lang_de?.[0]?.value || day.weatherDesc?.[0]?.value || '',
        sunrise: day.astronomy?.[0]?.sunrise, sunset: day.astronomy?.[0]?.sunset,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hourly: (day.hourly || []).map((h: any) => ({
          time: h.time, temp: parseInt(h.tempC), feelsLike: parseInt(h.FeelsLikeC),
          chanceOfRain: h.chanceofrain, weatherIcon: h.weatherCode,
        })),
      }));

      const weatherData = {
        temp: current.temp_C, feelsLike: current.FeelsLikeC, humidity: current.humidity,
        windSpeed: current.windspeedKmph, windDir: current.winddir16Point, uvIndex: current.uvIndex,
        visibility: current.visibility, pressure: current.pressure, cloudCover: current.cloudcover,
        weatherDesc: current.lang_de?.[0]?.value || current.weatherDesc?.[0]?.value || 'Unbekannt',
        precip: current.precipMM, city, minTemp: today?.mintempC, maxTemp: today?.maxtempC,
        sunrise: today?.astronomy?.[0]?.sunrise, sunset: today?.astronomy?.[0]?.sunset,
        hourly: hourlyData, forecast,
      };

      setResults([
        { id: 'weather-card', title: `${current.temp_C}°C in ${city}`, subtitle: weatherData.weatherDesc, type: 'weather', path: JSON.stringify(weatherData) },
        { id: 'weather-more', title: 'Vollständige Wettervorschau öffnen', subtitle: `wttr.in/${encodeURIComponent(city)}`, type: 'web', path: `https://wttr.in/${encodeURIComponent(city)}?lang=de`, isWeb: true },
      ]);
    } catch {
      if (isActive.current) {
        setResults([{ id: 'cmd-err', title: 'Wetter nicht abrufbar', subtitle: 'Service nicht verfügbar', type: 'system' }]);
      }
    } finally {
      if (isActive.current) setLoading(false);
    }
  }, [getDayName]);

  // Recents Rendering
  useEffect(() => {
    if (!query.trim()) {
      if (recentItems.length > 0 && settings.search.showRecents) {
        setResults(recentItems.map(item => ({ ...item, id: `recent-${item.id}`, isRecent: true })));
      } else {
        setResults([]);
      }
    }
  }, [query, recentItems, settings.search.showRecents]);

  // Main Search Logic with Scoring
  useEffect(() => {
    if (!query.trim()) return;

    const isActive = { current: true };
    setSelectedIndex(0);
    setExpandWeb(false);

    const queryLower = query.trim().toLowerCase();
    const weatherPatterns = ['wetter', 'weather', 'temperatur', 'wie wird das wetter', 'wie ist das wetter'];
    const isWeatherQuery = weatherPatterns.some(p => queryLower.startsWith(p) || queryLower.includes(' wetter ') || queryLower.includes(' weather '));

    if (isWeatherQuery && !query.trim().startsWith('/') && settings.features.weatherEnabled) {
      const cityMatch = queryLower.match(/(?:wetter|weather|temperatur)\s+(.+)/);
      const city = cityMatch ? cityMatch[1].trim() : settings.search.defaultCity;
      fetchWeather(city, isActive);
      return () => { isActive.current = false };
    }

    // Drive filter command: #d suchbegriff or #c suchbegriff etc.
    if (query.trim().startsWith('#')) {
      const driveStr = query.trim().substring(1).trim();
      const driveMatch = driveStr.match(/^([a-zA-Z])\s*(.*)/);
      if (driveMatch) {
        const driveLetter = driveMatch[1].toUpperCase();
        const searchTerm = driveMatch[2].trim();
        (window as any).electronAPI.searchEverything(searchTerm).then((raw: any) => {
          if (!isActive.current) return;
          const mappedLocal: SearchResult[] = ((raw as any[]) || []).map((item: any, idx: number) => ({
            id: `r-${idx}`, title: String((item.title || '')).replace(/\.(lnk|url)$/i, ''), subtitle: item.path ? String(item.path) : undefined,
            type: (['game', 'app', 'system', 'folder'].includes(String(item.type || '')) ? String(item.type) : 'file') as SearchResult['type'],
            path: item.path ? String(item.path) : undefined, iconBase64: item.iconBase64 ? String(item.iconBase64) : undefined, iconPath: item.iconPath ? String(item.iconPath) : undefined,
          }));
          const driveFiltered = mappedLocal.filter(item => {
            if (!item.path) return false;
            return item.path.toUpperCase().startsWith(`${driveLetter}:\\`);
          });
          driveFiltered.forEach((item: any) => {
            const identifier = item.path || item.id;
            item._score = calculateScore(item.title, item.type, identifier, searchTerm || '', clickHistory);
          });
          
          const filteredDrive = searchTerm ? driveFiltered.filter((item: any) => item._score > 0) : driveFiltered;
          filteredDrive.sort((a: any, b: any) => b._score - a._score);

          if (filteredDrive.length === 0) {
            setResults([{ id: 'drive-empty', title: `Keine Ergebnisse auf Drive ${driveLetter}:`, subtitle: searchTerm ? `"${searchTerm}" nicht gefunden` : 'Keine Dateien auf diesem Laufwerk', type: 'system' }]);
          } else {
            setResults(filteredDrive);
            const iconCandidates = filteredDrive.filter((r: any) => (r.type === 'app' || r.type === 'game' || r.type === 'folder') && r.iconPath);
            for (const item of iconCandidates) {
              (window as any).electronAPI.getFileIcon(item.iconPath!).then((icon: string | null) => {
                if (icon && isActive.current) {
                  setResults(prev => prev.map(r => r.id === item.id ? { ...r, iconBase64: icon } : r));
                }
              }).catch(() => { /* ignore */ });
            }
          }
          if (isActive.current) setLoading(false);
        }).catch(() => {
          if (isActive.current) { setLoading(false); setResults([{ id: 'drive-error', title: `Fehler beim Durchsuchen von Drive ${driveLetter}:`, subtitle: 'Laufwerk nicht verfügbar', type: 'system' }]); }
        });
        return () => { isActive.current = false };
      }
    }

    // Slash Commands
    if (query.trim().startsWith('/') && !query.trim().startsWith('/ai') && !query.trim().startsWith('/g ')) {
      let trimmed = query.trim();
      const cmdStr = trimmed.substring(1).trim();

      if (cmdStr === 'settings' || cmdStr === 'config' || cmdStr === 'prefs') {
        onOpenSettings();
        return;
      }

      if (cmdStr === 'help' || cmdStr === '?') trimmed = '/';

      const cmd = commandRegistry.match(trimmed);
      console.log('[SearchView] match result:', cmd?.id, 'input:', trimmed);
      if (cmd) {
        const triggerStr = typeof cmd.trigger === 'string' ? cmd.trigger : '';
        const args = trimmed.substring(triggerStr.length);

        if (cmd.usage && !args.trim()) {
          setResults([{ id: 'cmd-usage', title: cmd.description, subtitle: cmd.usage, type: 'calc' }]);
          return;
        }

        const ctx = buildCommandContext();
        const result = cmd.handler(args, ctx);

        const attachCopy = (cmdResult: CommandResult): SearchResult[] => {
          const copyVal = cmdResult.copyToClipboard;
          const launchable = new Set(['app', 'web', 'file']);
          return cmdResult.results.map(r => ({
            ...r,
            ...(copyVal ? { copyToClipboard: copyVal } : {}),
            ...(r.copyToClipboard ? {} : !launchable.has(r.type) && (r.type as any) !== 'cmd' ? { copyToClipboard: r.title } : {}),
          }));
        };

        if (result instanceof Promise) {
          setLoading(true);
          result.then(r => { if (isActive.current) setResults(attachCopy(r)); })
            .catch(() => { if (isActive.current) setResults([{ id: 'cmd-err', title: 'Fehler', subtitle: 'Befehl konnte nicht ausgeführt werden', type: 'system' }]); })
            .finally(() => { if (isActive.current) setLoading(false); });
        } else {
          setResults(attachCopy(result));
        }
        return () => { isActive.current = false; };
      }

      // Command Browser
      const filter = trimmed.substring(1).trim().toLowerCase();
      const allCmds = commandRegistry.getAll().filter(c => c.enabled);

      const partialMatch = allCmds.find(c => (typeof c.trigger === 'string' ? c.trigger.replace(/ $/, '') : null) === trimmed);
      if (partialMatch && partialMatch.usage && isCommandAvailable(partialMatch.requiresSetting)) {
        setResults([{ id: 'cmd-usage', title: partialMatch.description, subtitle: partialMatch.usage, type: 'calc' }]);
        return;
      }

      const categoryInfo: Record<string, { label: string; type: SearchResult['type'] }> = {
        calc: { label: 'Rechner & Generatoren', type: 'calc' }, text: { label: 'Text & Hash-Tools', type: 'calc' },
        web: { label: 'Web & Netzwerk', type: 'web' }, weather: { label: 'Wetter', type: 'web' },
        notes: { label: 'Notizen', type: 'system' }, clipboard: { label: 'Zwischenablage', type: 'system' },
        system: { label: 'System', type: 'system' }, power: { label: 'Power-User', type: 'system' },
      };

      const filtered = (filter ? allCmds.filter(c => {
        const trigger = typeof c.trigger === 'string' ? c.trigger : '';
        return (trigger.toLowerCase().includes(filter) || c.id.toLowerCase().includes(filter) || c.description.toLowerCase().includes(filter) || c.category.toLowerCase().includes(filter) || (c.aliases && c.aliases.some(a => a.toLowerCase().includes(filter))));
      }) : allCmds).filter(c => isCommandAvailable(c.requiresSetting));

      const grouped = [];
      for (const cat of ['calc', 'text', 'web', 'weather', 'notes', 'clipboard', 'system', 'power']) {
        const catCmds = filtered.filter(c => c.category === cat);
        if (catCmds.length > 0 && categoryInfo[cat]) grouped.push({ cat, info: categoryInfo[cat], commands: catCmds });
      }

      if (grouped.length === 0) {
        setResults([{ id: 'cmd-no-match', title: 'Keine Befehle gefunden', subtitle: `/help oder /${filter} — versuche einen anderen Begriff`, type: 'system' }]);
        return;
      }

      const cmdResults: SearchResult[] = [];
      let idx = 0;
      for (const group of grouped) {
        cmdResults.push({ id: `cat-${group.cat}`, title: group.info.label, subtitle: `${group.commands.length} Befehl${group.commands.length > 1 ? 'e' : ''}`, type: group.info.type, isHelpCategory: true });
        for (const c of group.commands) {
          const trigger = typeof c.trigger === 'string' ? c.trigger.replace(/ $/, '') : c.id;
          idx++;
          cmdResults.push({ id: `help-cmd-${idx}`, title: trigger, subtitle: c.description + (c.aliases?.length ? ` (${c.aliases.join(', ')})` : ''), type: group.info.type, path: trigger });
        }
      }
      setResults(cmdResults);
      return () => { isActive.current = false; };
    }

    if (query.trim() === '/ai' || query.startsWith('/ai ')) {
      setResults([{ id: 'ai', title: 'Google Gemini öffnen', subtitle: 'KI-Chat direkt hier starten', type: 'ai' }]);
      return;
    }

    // Google Web Search Inline
    if (query.startsWith('/g ')) {
      setLoading(true);
      const term = query.substring(3);
      const t = setTimeout(async () => {
        try {
          const raw = await (window as any).electronAPI.fetchInstantAnswer(term);
          if (isActive.current && raw) {
            setResults((raw as any[]).map((item: any, idx: number) => ({
              id: `w-${idx}`, title: String(item.title ?? ''), subtitle: item.subtitle ? String(item.subtitle) : undefined,
              type: (item.type as SearchResult['type']) ?? 'web', path: item.path ? String(item.path) : undefined, isWeb: Boolean(item.isWeb),
            })));
          }
        } catch { /* ignore */ }
        if (isActive.current) setLoading(false);
      }, 300);
      return () => { isActive.current = false; clearTimeout(t); };
    }

    // Standard Search
    setLoading(true);

    // Run plugin search providers
    searchWithPlugins(query).then(pluginResults => {
      if (isActive.current && pluginResults.length > 0) {
        setResults(prev => [...pluginResults, ...prev]);
      }
    }).catch(() => {});

    // URL Detection: Check if query looks like a direct URL
    const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/i;
    const isUrl = urlPattern.test(query.trim()) && !query.trim().includes(' ');

    const timer = setTimeout(async () => {
      try {
        const raw = await (window as any).electronAPI.searchEverything(query);
        if (!isActive.current) return;

        const mappedLocal: SearchResult[] = ((raw as any[]) || []).map((item: any, idx: number) => ({
          id: `r-${idx}`, title: String((item.title || '')).replace(/\.(lnk|url)$/i, ''), subtitle: item.path ? String(item.path) : undefined,
          type: (['game', 'app', 'system', 'folder'].includes(String(item.type || '')) ? String(item.type) : 'file') as SearchResult['type'],
          path: item.path ? String(item.path) : undefined, iconBase64: item.iconBase64 ? String(item.iconBase64) : undefined, iconPath: item.iconPath ? String(item.iconPath) : undefined,
        }));

        // Inject direct URL result if query looks like a URL
        if (isUrl) {
          const normalizedUrl = query.trim().startsWith('http') ? query.trim() : `https://${query.trim()}`;
          mappedLocal.unshift({
            id: 'direct-url',
            title: normalizedUrl.replace(/^https?:\/\//, ''),
            subtitle: 'Im Browser öffnen',
            type: 'web',
            path: normalizedUrl,
            isWeb: true,
          });
        }

        // 🧠 HIER WIRD SORTIERT (Neue KI/Fuzzy/History Logik)
        mappedLocal.forEach((item: any) => {
          const identifier = item.path || item.id;
          item._score = calculateScore(item.title, item.type, identifier, query, clickHistory);
        });

        // Filter out items that have no match at all (score 0), except the direct URL fallback
        const filteredLocal = mappedLocal.filter((item: any) => item._score > 0 || item.id === 'direct-url');

        // Absteigend nach Score sortieren (Höchster Score = Platz 1)
        filteredLocal.sort((a: any, b: any) => b._score - a._score);

        if (isActive.current) setResults(filteredLocal);
        if (isActive.current) setLoading(false);

        // Fetch Icons Lazy
        const iconCandidates = filteredLocal.filter((r: any) => (r.type === 'app' || r.type === 'game' || r.type === 'folder') && r.iconPath);
        for (const item of iconCandidates) {
          (window as any).electronAPI.getFileIcon(item.iconPath!).then((icon: string | null) => {
            if (icon && isActive.current) {
              setResults(prev => prev.map(r => r.id === item.id ? { ...r, iconBase64: icon } : r));
            }
          }).catch(() => { /* ignore */ });
        }

        // Fetch Web Suggestions
        if (query.trim().length >= 2 && !query.startsWith('/ai') && settings.search.showWebSuggestions) {
          (window as any).electronAPI.fetchInstantAnswer(query).then((webRaw: any) => {
            if (isActive.current && webRaw && webRaw.length > 0) {
              setResults(prev => {
                const newWeb: SearchResult[] = (webRaw as any[]).map((w: any, idx: number) => ({
                  id: `w-impl-${idx}`, title: String(w.title ?? ''), subtitle: w.subtitle ? String(w.subtitle) : undefined,
                  type: (w.type as SearchResult['type']) ?? 'web', path: w.path ? String(w.path) : undefined, isWeb: Boolean(w.isWeb),
                }));
                return [...prev.filter(r => !r.id.startsWith('w-impl')), ...newWeb];
              });
            }
          }).catch(() => { /* ignore */ });
        }
      } catch {
        if (isActive.current) setLoading(false);
      }
    }, settings.search.searchDelay);

    return () => {
      isActive.current = false;
      clearTimeout(timer);
    };
  }, [query, settings, buildCommandContext, isCommandAvailable, onOpenSettings, fetchWeather, clickHistory]);

  // Auto-scroll to selected
  useEffect(() => {
    if (interactionMode.current === 'keyboard') {
      const el = resultsRef.current?.querySelector('.result-item.selected');
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedIndex]);

  // Focus management
  useEffect(() => {
    switch (focusedZone) {
      case FOCUS_ZONE_INPUT:
        inputRef.current?.focus();
        break;
      case FOCUS_ZONE_FOOTER:
        settingsBtnRef.current?.focus();
        break;
    }
  }, [focusedZone]);

  // 🧠 Hilfsfunktion: Klick-Historie speichern
  const trackActionClick = (result: SearchResult) => {
    if (!result || result.isExpandBtn || result.type === 'ai' || result.isHelpCategory) return;

    // Wir nutzen den Pfad (z.B. C:\Program Files\...) oder die Command-ID als eindeutigen Schlüssel
    const key = result.path || result.id;
    if (!key) return;

    setClickHistory(prev => {
      const next = { ...prev, [key]: (prev[key] || 0) + 1 };
      localStorage.setItem('search_click_history', JSON.stringify(next));
      return next;
    });
  };

  // Action execution
  function executeAction(result: SearchResult) {
    if (!result) return;

    // Tracke den Klick für unser "Usage-Based Scoring"
    trackActionClick(result);

    if (result.action) {
      result.action();
      return;
    }

    // Folder Expansion
    if (result.type === 'folder' && result.path) {
      const isExpanded = expandedFolders.includes(result.path);

      if (isExpanded) {
        setExpandedFolders(prev => prev.filter(p => !p.startsWith(result.path!)));
        setFolderItemsMap(prev => {
          const newMap = new Map(prev);
          for (const key of newMap.keys()) {
            if (key.startsWith(result.path!)) newMap.delete(key);
          }
          return newMap;
        });
      } else {
        setExpandedFolders(prev => [...prev, result.path!]);
        loadingFoldersRef.current.add(result.path!);

        const currentPath = result.path;
        const depth = result.folderDepth || 0;

        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
        Promise.race([(window as any).electronAPI.listDirectory(result.path), timeoutPromise])
          .then((raw: any) => {
            const items = ((raw as any[]) || []).map((item: any, idx: number) => ({
              id: `sub-${depth}-${idx}-${item.path}`,
              title: String(item.title ?? ''), subtitle: item.path ? String(item.path) : undefined,
              type: (item.type as SearchResult['type']) ?? 'file', path: item.path ? String(item.path) : undefined,
              iconBase64: item.iconBase64 ? String(item.iconBase64) : undefined, iconPath: item.iconPath ? String(item.iconPath) : undefined,
              isSubItem: true, folderDepth: depth + 1,
            }));

            loadingFoldersRef.current.delete(currentPath);
            setFolderItemsMap(prev => {
              const newMap = new Map(prev);
              newMap.set(currentPath, items);
              return newMap;
            });

            const iconCandidates = items.filter(r => (r.type === 'app' || r.type === 'folder') && r.iconPath);
            for (const item of iconCandidates) {
              (window as any).electronAPI.getFileIcon(item.iconPath!).then((icon: string | null) => {
                if (icon) {
                  setFolderItemsMap(prev => {
                    const newMap = new Map(prev);
                    const folderItems = newMap.get(currentPath);
                    if (folderItems) {
                      newMap.set(currentPath, folderItems.map(r => r.id === item.id ? { ...r, iconBase64: icon } : r));
                    }
                    return newMap;
                  });
                }
              }).catch(() => { /* ignore */ });
            }
          })
          .catch(() => {
            loadingFoldersRef.current.delete(currentPath);
            setFolderItemsMap(prev => {
              const newMap = new Map(prev);
              newMap.set(currentPath, []);
              return newMap;
            });
          });
      }
      return;
    }

    if (result.path && result.path.startsWith('/') && result.id.startsWith('help-cmd-')) {
      setQuery(result.path + ' ');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    if (result.copyToClipboard) {
      try {
        (window as any).electronAPI.writeClipboard(result.copyToClipboard);
        setResults(prev => prev.map(r => r.id === result.id ? { ...r, title: 'Kopiert!', subtitle: result.copyToClipboard } : r));
        setTimeout(() => {
          setResults(prev => prev.map(r => r.id === result.id ? { ...r, title: result.title, subtitle: result.subtitle } : r));
        }, 800);
      } catch { /* ignore */ }
      return;
    }

    // Add to recents
    if (result.path && !result.isSubItem && result.type !== 'ai') {
      setRecentItems(prev => {
        const filtered = prev.filter(item => item.path !== result.path);
        return [result, ...filtered].slice(0, settings.search.recentCount);
      });
    }

    try {
      if (result.isExpandBtn) {
        setExpandWeb(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (result.type === 'ai') {
        onOpenAI();
      } else if (result.isWeb || result.type === 'web') {
        if (result.path) (window as any).electronAPI.openUrl(result.path);
      } else if (result.path) {
        (window as any).electronAPI.openFile(result.path);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Keyboard
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Tab' && e.ctrlKey) {
      e.preventDefault();
      setExpandWeb(prev => !prev);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextZone = e.shiftKey
        ? (focusedZone - 1 + TOTAL_ZONES) % TOTAL_ZONES
        : (focusedZone + 1) % TOTAL_ZONES;
      setFocusedZone(nextZone);

      if (nextZone === FOCUS_ZONE_RESULTS && displayResults.length > 0) {
        setSelectedIndex(0);
        interactionMode.current = 'keyboard';
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      interactionMode.current = 'keyboard';
      setFocusedZone(FOCUS_ZONE_RESULTS);
      setSelectedIndex(prev => Math.min(prev + 1, displayResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      interactionMode.current = 'keyboard';
      if (selectedIndex === 0 && focusedZone === FOCUS_ZONE_RESULTS) {
        setFocusedZone(FOCUS_ZONE_INPUT);
        inputRef.current?.focus();
      } else {
        setFocusedZone(FOCUS_ZONE_RESULTS);
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedZone === FOCUS_ZONE_QUICK_ACTIONS && !query.trim()) {
        const quickActions = getQuickActions();
        if (focusedQuickAction >= 0 && focusedQuickAction < quickActions.length) {
          quickActions[focusedQuickAction].action();
          return;
        }
      }
      executeAction(displayResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      (window as any).electronAPI.hideWindow();
    }
  }

  function getQuickActions() {
    const actions = [
      { title: 'KI Chat', sub: 'Google Gemini', iconClass: 'ai', icon: <Bot size={15} />, action: onOpenAI },
      { title: 'Web Suche', sub: 'Inline Ergebnisse', iconClass: 'web', icon: <Globe size={15} />, action: () => setQuery('/g ') },
      { title: 'Dateien', sub: 'Schnellzugriff', iconClass: 'files', icon: <File size={15} />, action: () => setQuery('Downloads') },
      {
        title: 'Wetter', sub: 'Direkt anzeigen', iconClass: 'calc', icon: <CloudSun size={15} />, action: () => {
          setQuery('wetter');
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(6, 6);
          }, 50);
        }
      },
    ];
    if (hasMedia) {
      actions.push({ title: 'Musik', sub: 'YouTube Music', iconClass: 'ai', icon: <Music size={15} />, action: onOpenMediaControl });
    }
    return actions;
  }

  // Display computation (Web results merging + Folders)
  const displayResults = useMemo(() => {
    if (query.startsWith('/g ')) return results;

    const isHelpView = results.some(r => r.isHelpCategory || r.id.startsWith('help-cmd-'));
    const localAndPriority = results.filter(r => r.type !== 'web' || !r.isWeb || r.id === 'web-inline' || r.id.startsWith('cmd-'));
    const webClutter = results.filter(r => r.type === 'web' && r.isWeb && r.id !== 'web-inline' && !r.id.startsWith('cmd-'));

    let out: SearchResult[] = [...localAndPriority];

    function injectFolderItems(outArray: SearchResult[], folderPath: string, depth: number): void {
      const parentIdx = outArray.findIndex(r => r.path === folderPath);
      if (parentIdx !== -1) {
        const folderContents = folderItemsMap.get(folderPath);
        const isLoading = loadingFoldersRef.current.has(folderPath);
        const subItems: SearchResult[] = [];

        if (folderContents && folderContents.length > 0) {
          for (const item of folderContents) subItems.push({ ...item, isSubItem: true, folderDepth: depth + 1 });
        } else if (isLoading) {
          subItems.push({ id: `loading-${folderPath}`, title: 'Lade Ordnerinhalt...', subtitle: 'Bitte warten...', type: 'file', isSubItem: true, folderDepth: depth + 1 });
        } else {
          subItems.push({ id: `empty-${folderPath}`, title: '(Leerer Ordner oder Zugriff verweigert)', subtitle: 'Keine Dateien gefunden', type: 'file', isSubItem: true, folderDepth: depth + 1 });
        }

        outArray.splice(parentIdx + 1, 0, ...subItems);

        for (const subItem of subItems) {
          if (subItem.type === 'folder' && expandedFolders.includes(subItem.path!)) {
            injectFolderItems(outArray, subItem.path!, (depth + 1));
          }
        }
      }
    }

    for (const folderPath of expandedFolders) {
      injectFolderItems(out, folderPath, 0);
    }

    if (expandWeb) {
      out = [...out, ...webClutter];
    } else {
      const fallback = webClutter.find(r => r.title.startsWith('Nach "'));
      if (fallback) out.push(fallback);
      if (webClutter.length > 1) {
        out.push({ id: 'expand-btn', title: 'Web-Vorschläge einblenden', subtitle: `${webClutter.length - 1} weitere Ergebnisse (Strg+Tab)`, type: 'web', isExpandBtn: true });
      }
    }

    if (isHelpView) return out;

    // Apply maxResults limit only to top-level items (not sub-items from expanded folders)
    const topLevelItems = out.filter(r => !r.isSubItem);
    const limitedTopLevel = topLevelItems.slice(0, settings.search.maxResults);
    const subItems = out.filter(r => r.isSubItem);

    // Re-inject sub-items after their parent items in the limited list
    const finalOut: SearchResult[] = [...limitedTopLevel];
    for (const subItem of subItems) {
      // Find parent index in limited list
      const parentPath = subItem.path?.substring(0, subItem.path.lastIndexOf('\\'));
      const parentIdx = finalOut.findIndex(r => r.path === parentPath);
      if (parentIdx !== -1) {
        finalOut.splice(parentIdx + 1, 0, subItem);
      } else {
        // Parent not in limited list, add sub-item at end
        finalOut.push(subItem);
      }
    }

    return finalOut;
  }, [results, expandWeb, query, expandedFolders, folderItemsMap, settings.search.maxResults]);

  const quickActions = getQuickActions();

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
            onChange={e => { setQuery(e.target.value); setFocusedZone(FOCUS_ZONE_INPUT); }}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoFocus
          />
          <button
            ref={settingsBtnRef}
            className="settings-button"
            onClick={onOpenSettings}
            tabIndex={focusedZone === FOCUS_ZONE_FOOTER ? 0 : -1}
            title="Einstellungen"
          >
            <Settings size={16} />
            {updateDownloaded && <span className="update-badge-indicator" title="Update bereit zur Installation"></span>}
          </button>
          <div className="shortcut-hint"><kbd>ESC</kbd></div>
        </div>

        {loading && <div className="loading-bar" />}

        {/* Quick Actions */}
        {!query.trim() && !settings.appearance.compactMode && (
          <div className="quick-actions" ref={quickActionsRef}>
            {quickActions.map((qa, idx) => (
              <button
                key={qa.title}
                className={`quick-action ${focusedZone === FOCUS_ZONE_QUICK_ACTIONS && focusedQuickAction === idx ? 'focused' : ''}`}
                onClick={qa.action}
                tabIndex={focusedZone === FOCUS_ZONE_QUICK_ACTIONS ? 0 : -1}
                onFocus={() => { setFocusedQuickAction(idx); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = (idx + 1) % quickActions.length;
                    setFocusedQuickAction(next);
                    const el = e.currentTarget.parentElement?.children[next] as HTMLElement | undefined;
                    el?.focus();
                  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = (idx - 1 + quickActions.length) % quickActions.length;
                    setFocusedQuickAction(prev);
                    const el = e.currentTarget.parentElement?.children[prev] as HTMLElement | undefined;
                    el?.focus();
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    qa.action();
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    setFocusedZone(FOCUS_ZONE_RESULTS);
                    inputRef.current?.focus();
                  }
                }}
              >
                <div className={`quick-action-icon ${qa.iconClass}`}>{qa.icon}</div>
                <div className="quick-action-text">
                  <span className="quick-action-title">{qa.title}</span>
                  <span className="quick-action-sub">{qa.sub}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {displayResults.length > 0 && (
          <div className="results-container" ref={resultsRef} onMouseMove={() => interactionMode.current = 'mouse'}>
            {!query.trim() && recentItems.length > 0 && (
              <div className="section-header-row">
                <div className="section-label">Zuletzt gesucht</div>
                <button className="clear-history-btn" tabIndex={focusedZone === FOCUS_ZONE_RESULTS ? 0 : -1} onClick={e => { e.stopPropagation(); setRecentItems([]); }}>Verlauf löschen</button>
              </div>
            )}
            {displayResults.map((res, idx) => {
              if (res.id === 'weather-card' && res.path) {
                try {
                  const data = JSON.parse(res.path);
                  return <WeatherCard key={res.id} data={data} selected={idx === selectedIndex} onClick={() => executeAction(res)} onMouseEnter={() => { if (interactionMode.current === 'mouse') setSelectedIndex(idx); }} />;
                } catch { return null; }
              }

              if (res.id === 'cmd-qr' && res.path) {
                return (
                  <div key={res.id} className={`result-item ${idx === selectedIndex ? 'selected' : ''}`} onClick={() => executeAction(res)} onMouseEnter={() => { if (interactionMode.current === 'mouse') setSelectedIndex(idx); }} tabIndex={focusedZone === FOCUS_ZONE_RESULTS ? 0 : -1} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '12px' }}>
                    <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                      <img src={res.path} alt="QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="result-title" style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{res.title}</div>
                      <div className="result-subtitle" style={{ fontSize: '12px' }}>{res.subtitle}</div>
                    </div>
                    <span className="result-enter" style={{ position: 'absolute', right: '16px', bottom: '16px' }}>↵</span>
                  </div>
                );
              }

              if (res.isHelpCategory) {
                return (
                  <div key={res.id} className="cmd-category-header">
                    <span className="cmd-category-label">{res.title}</span>
                    {res.subtitle && <span className="cmd-category-count">{res.subtitle}</span>}
                  </div>
                );
              }

              if (res.id.startsWith('help-cmd-')) {
                return (
                  <div key={res.id} className={`result-item cmd-item ${idx === selectedIndex ? 'selected' : ''}`} onClick={() => executeAction(res)} onMouseEnter={() => { if (interactionMode.current === 'mouse') setSelectedIndex(idx); }} tabIndex={focusedZone === FOCUS_ZONE_RESULTS ? 0 : -1}>
                    <div className="cmd-trigger">{res.title}</div>
                    <div className="result-content"><span className="result-subtitle">{res.subtitle}</span></div>
                    <span className="result-enter">↵</span>
                  </div>
                );
              }

              return (
                <div key={res.id} className={`result-item ${idx === selectedIndex ? 'selected' : ''} ${res.isSubItem ? 'sub-item' : ''}`} onClick={() => executeAction(res)} onMouseEnter={() => { if (interactionMode.current === 'mouse') setSelectedIndex(idx); }} tabIndex={focusedZone === FOCUS_ZONE_RESULTS ? 0 : -1}>
                  <div className={`result-icon ${res.swatch ? 'swatch' : res.type}`} style={res.swatch ? { background: res.swatch } : undefined}>
                    {res.swatch ? null : res.iconBase64 && res.iconBase64.length > 100 ? (
                      <img src={res.iconBase64} alt="" className="result-icon-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : getIcon(res.type, res.path)}
                  </div>
                  <div className="result-content">
                    <span className="result-title" style={res.isExpandBtn ? { color: 'var(--accent)' } : {}}>{res.title}</span>
                    {res.subtitle && <span className="result-subtitle">{res.subtitle}</span>}
                  </div>
                  {!res.isExpandBtn && <span className="result-badge">{getBadge(res.type)}</span>}
                  <span className="result-enter">{res.isExpandBtn ? 'Ctrl+Tab' : '↵'}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="search-footer">
          <div className="footer-commands">
            <span><kbd>↑↓</kbd> navigieren</span>
            <span><kbd>↵</kbd> öffnen</span>
            <span><kbd>Tab</kbd> navigieren</span>
            <span><kbd>/ai</kbd> Chat</span>
          </div>
          <span>Windows Bar</span>
        </div>

        {/* Now-playing bar — only when a media plugin is active and the user kept it on */}
        {hasMedia && showMediaBar !== false && <CompactPlayer onExpand={onOpenMediaControl} />}
      </div>
    </div>
  );
}

// Weather helpers
function formatTime(timeStr: string): string {
  const t = timeStr.padStart(4, '0');
  const hours = t.substring(0, 2);
  return `${hours}:00`;
}

function getWeatherIcon(code: number): React.ReactNode {
  if (code === 113) return <Sun size={20} />;
  if (code === 116) return <CloudSun size={20} />;
  if (code === 119 || code === 122) return <Cloud size={20} />;
  if (code >= 176 && code <= 200) return <CloudDrizzle size={20} />;
  if (code >= 263 && code <= 266) return <CloudDrizzle size={20} />;
  if (code >= 293 && code <= 302) return <CloudRain size={20} />;
  if (code >= 308 && code <= 314) return <CloudHail size={20} />;
  if (code >= 317 && code <= 338) return <Snowflake size={20} />;
  if (code >= 350 && code <= 377) return <CloudHail size={20} />;
  if (code >= 386 && code <= 395) return <CloudRain size={20} />;
  return <CloudSun size={20} />;
}

// Weather Card Sub-Component
function WeatherCard({ data, selected, onClick, onMouseEnter }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any; selected: boolean; onClick: () => void; onMouseEnter: () => void;
}) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const forecast = data.forecast || [];
  const selectedDay = forecast[selectedDayIndex];
  const isToday = selectedDayIndex === 0;

  const hourlyData = selectedDay?.hourly || data.hourly || [];
  const displayMinTemp = selectedDay?.minTemp || data.minTemp;
  const displayMaxTemp = selectedDay?.maxTemp || data.maxTemp;
  const displayWeatherDesc = selectedDay?.weatherDesc || data.weatherDesc;

  const graphHours = hourlyData.slice(0, 8);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const temps = graphHours.map((h: any) => h.temp);
  const minTemp = Math.min(...temps) - 2;
  const maxTemp = Math.max(...temps) + 2;
  const tempRange = maxTemp - minTemp || 1;
  const graphWidth = 600;
  const graphHeight = 80;
  const padding = 15;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const points = graphHours.map((h: any, i: number) => ({
    x: padding + (i / (graphHours.length - 1 || 1)) * (graphWidth - padding * 2),
    y: graphHeight - padding - ((h.temp - minTemp) / tempRange) * (graphHeight - padding * 2),
    temp: h.temp, time: h.time,
  }));

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c5cfc';
  const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '124, 92, 252';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pathD = points.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${graphHeight - padding} L ${padding} ${graphHeight - padding} Z`;

  const isPrecip = (h: { chanceOfRain: string; weatherIcon: string }) => {
    const chance = parseInt(h.chanceOfRain) || 0;
    const code = parseInt(h.weatherIcon) || 0;
    const isRain = code >= 61 && code <= 67;
    const isSnow = code >= 71 && code <= 86;
    const isHail = code === 87 || code === 88;
    const isSleet = code >= 68 && code <= 70;
    const isFreezing = code >= 49 && code <= 57;
    return { hasPrecip: chance > 20 && (isRain || isSnow || isHail || isSleet || isFreezing), isRain, isSnow, isHail, isSleet, isFreezing, chance, code };
  };

  return (
    <div className={`weather-card ${selected ? 'selected' : ''}`} onClick={onClick} onMouseEnter={onMouseEnter}>
      {forecast.length > 1 && (
        <div className="weather-day-tabs">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {forecast.map((day: any, idx: number) => (
            <button key={day.date} className={`weather-day-tab ${idx === selectedDayIndex ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setSelectedDayIndex(idx); }}>
              <span className="weather-day-tab-icon">{getWeatherIcon(parseInt(day.weatherIcon))}</span>
              <span className="weather-day-tab-name">{day.dayName}</span>
              <span className="weather-day-tab-temp">{day.minTemp}°/{day.maxTemp}°</span>
            </button>
          ))}
        </div>
      )}

      <div className="weather-header">
        <div className="weather-icon-main">
          {isToday ? <CloudSun size={32} /> : getWeatherIcon(parseInt(selectedDay?.weatherIcon || '116'))}
        </div>
        <div className="weather-temp">
          <span className="temp-value">{isToday ? data.temp : selectedDay?.maxTemp || data.temp}°C</span>
          <span className="temp-city">{data.city}</span>
        </div>
      </div>
      <div className="weather-desc">{isToday ? data.weatherDesc : displayWeatherDesc}</div>
      <div className="weather-range">
        {isToday ? `Gefühlt ${data.feelsLike}°C | ` : ''}
        {displayMinTemp}° bis {displayMaxTemp}°C
      </div>

      {graphHours.length > 1 && (
        <div className="weather-graph-container">
          <svg className="weather-graph" viewBox={`0 0 ${graphWidth} ${graphHeight}`}>
            <defs>
              <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={`rgba(${accentRgb}, 0.4)`} />
                <stop offset="100%" stopColor={`rgba(${accentRgb}, 0.05)`} />
              </linearGradient>
            </defs>
            {[0, 1, 2].map(i => <line key={i} x1={padding} y1={padding + i * (graphHeight - padding * 2) / 2} x2={graphWidth - padding} y2={graphHeight - padding} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />)}
            <path d={areaD} fill="url(#tempGradient)" />
            <path d={pathD} fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {points.map((p: any, i: number) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3" fill={accentColor} />
                <circle cx={p.x} cy={p.y} r="5" fill={`rgba(${accentRgb}, 0.3)`} />
              </g>
            ))}
          </svg>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <div className="weather-graph-labels">{points.map((p: any, i: number) => <span key={i} className="weather-graph-label">{formatTime(p.time)}</span>)}</div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <div className="weather-graph-temps">{points.map((p: any, i: number) => <span key={i} className="weather-graph-temp">{p.temp}°</span>)}</div>
        </div>
      )}

      {hourlyData.length > 0 && (
        <div className="weather-precip-zone">
          <div className="weather-precip-label">
            Niederschlag (24h)
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {hourlyData.some((h: any) => isPrecip(h).hasPrecip) && <span className="weather-precip-warning"><CloudDrizzle size={12} /> Niederschlag erwartet</span>}
          </div>
          <div className="weather-precip-bar">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {hourlyData.slice(0, 8).map((h: any, i: number) => {
              const p = isPrecip(h);
              const barHeight = p.hasPrecip ? Math.max(p.chance, 15) : Math.max(p.chance, 5);
              const precipType = p.isSnow ? 'snow' : p.isHail ? 'hail' : (p.isSleet || p.isFreezing) ? 'sleet' : 'rain';
              const PrecipIcon = p.isSnow ? Snowflake : p.isHail ? CloudHail : (p.isSleet || p.isFreezing) ? CloudFog : CloudDrizzle;
              return (
                <div key={i} className={`weather-precip-segment ${p.hasPrecip ? 'has-precip' : ''}`}>
                  {p.hasPrecip && <div className="weather-precip-icon"><PrecipIcon size={10} /></div>}
                  <div className={`weather-precip-fill ${precipType}`} style={{ height: `${barHeight}%` }}>
                    <span className="weather-precip-chance">{h.chanceOfRain}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="weather-precip-time-labels">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {hourlyData.slice(0, 8).map((h: any, i: number) => <span key={i} className={`weather-precip-time ${isPrecip(h).hasPrecip ? 'highlight' : ''}`}>{formatTime(h.time)}</span>)}
          </div>
        </div>
      )}

      <div className="weather-grid">
        <div className="weather-stat"><Wind size={14} /><span>{data.windSpeed} km/h {data.windDir}</span></div>
        <div className="weather-stat"><Droplets size={14} /><span>{data.humidity}%</span></div>
        <div className="weather-stat"><Sun size={14} /><span>UV {data.uvIndex}</span></div>
        <div className="weather-stat"><Eye size={14} /><span>{data.visibility}km</span></div>
        <div className="weather-stat"><Cloud size={14} /><span>{data.cloudCover}%</span></div>
        <div className="weather-stat"><Gauge size={14} /><span>{data.pressure} hPa</span></div>
      </div>
      {data.sunrise && data.sunset && (
        <div className="weather-sun">
          <span><Sunrise size={14} /> {data.sunrise}</span>
          <span><Sunset size={14} /> {data.sunset}</span>
        </div>
      )}
    </div>
  );
}