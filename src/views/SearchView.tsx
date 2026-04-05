import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, File, AppWindow, Gamepad2, Bot, Globe, Calculator,
  Folder, FileText, HardDrive, Music, Video, Image, Archive,
  Code, FileSpreadsheet, Presentation, CloudRain, CloudSun,
  Wind, Droplets, Eye, Cloud, Gauge, Sunrise, Sunset, Sun,
  Snowflake, CloudDrizzle, CloudHail, CloudFog, Settings,
} from 'lucide-react';
import type { SearchResult, AppSettings, CommandResult } from '../types';
import { commandRegistry } from '../core/commands/registry';

interface SearchViewProps {
  settings: AppSettings;
  onOpenAI: () => void;
  onOpenSettings: () => void;
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

export function SearchView({ settings, onOpenAI, onOpenSettings }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [expandWeb, setExpandWeb] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [folderItems, setFolderItems] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const folderLoadingRef = useRef(false);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);

  // Focus zone state for Tab navigation
  const [focusedZone, setFocusedZone] = useState(FOCUS_ZONE_INPUT);
  const [focusedQuickAction, setFocusedQuickAction] = useState(0);

  const interactionMode = useRef<'mouse' | 'keyboard'>('mouse');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

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

  // Load/save recents
  useEffect(() => {
    const saved = localStorage.getItem('recent_searches');
    if (saved) {
      try { setRecentItems(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('recent_searches', JSON.stringify(recentItems));
  }, [recentItems]);

  // Focus input on window focus
  useEffect(() => {
    inputRef.current?.focus();
    const focusFn = () => {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setFocusedZone(FOCUS_ZONE_INPUT);
    };
    window.addEventListener('focus', focusFn);
    return () => window.removeEventListener('focus', focusFn);
  }, []);

  // Reset expansion on query change
  useEffect(() => {
    setExpandedFolder(null);
    setFolderItems([]);
    setSelectedIndex(0);
    setFocusedZone(FOCUS_ZONE_INPUT);
  }, [query]);

  // Build command context
  const buildCommandContext = useCallback(() => ({
    settings,
    query,
    showResults: (newResults: SearchResult[]) => setResults(newResults),
    navigate: () => { }, // placeholder, can be extended
    api: window.electronAPI,
  }), [settings, query]);

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

  // Search effect with debounce
  useEffect(() => {
    setSelectedIndex(0);
    setExpandWeb(false);

    if (!query.trim()) {
      if (recentItems.length > 0 && settings.search.showRecents) {
        setResults(recentItems.map(item => ({ ...item, id: `recent-${item.id}`, isRecent: true })));
      } else {
        setResults([]);
      }
      return;
    }

    const queryLower = query.trim().toLowerCase();
    const weatherPatterns = ['wetter', 'weather', 'temperatur', 'wie wird das wetter', 'wie ist das wetter'];
    const isWeatherQuery = weatherPatterns.some(p => queryLower.startsWith(p) || queryLower.includes(' wetter ') || queryLower.includes(' weather '));

    if (isWeatherQuery && !query.trim().startsWith('/') && settings.features.weatherEnabled) {
      const cityMatch = queryLower.match(/(?:wetter|weather|temperatur)\s+(.+)/);
      const city = cityMatch ? cityMatch[1].trim() : settings.search.defaultCity;
      fetchWeather(city);
      return;
    }

    // Slash commands via registry
    if (query.trim().startsWith('/') && !query.trim().startsWith('/ai') && !query.trim().startsWith('/g ')) {
      let trimmed = query.trim();

      // Special: /settings, /config, /prefs
      const cmdStr = trimmed.substring(1).trim();
      if (cmdStr === 'settings' || cmdStr === 'config' || cmdStr === 'prefs') {
        onOpenSettings();
        return;
      }

      // Special: /help, /? → show all commands (empty filter)
      if (cmdStr === 'help' || cmdStr === '?') {
        trimmed = '/';
      }

      // Try to match a command
      const cmd = commandRegistry.match(trimmed);
      if (cmd) {
        if (!isCommandAvailable(cmd.requiresSetting)) {
          setResults([{ id: 'cmd-disabled', title: 'Befehl deaktiviert', subtitle: 'Aktiviere ihn in den Einstellungen', type: 'system' }]);
          return;
        }
        const triggerStr = typeof cmd.trigger === 'string' ? cmd.trigger : '';
        const args = trimmed.substring(triggerStr.length);

        // Show usage hint if command takes args but none provided
        if (cmd.usage && !args.trim()) {
          setResults([{ id: 'cmd-usage', title: cmd.description, subtitle: cmd.usage, type: 'calc' }]);
          return;
        }

        const ctx = buildCommandContext();
        const result: CommandResult | Promise<CommandResult> = cmd.handler(args, ctx);

        // Helper: attach copyToClipboard to command results
        const attachCopy = (cmdResult: CommandResult): SearchResult[] => {
          const copyVal = cmdResult.copyToClipboard;
          const launchable = new Set(['app', 'web', 'file']);
          return cmdResult.results.map(r => ({
            ...r,
            // Forward explicit copyToClipboard from CommandResult
            ...(copyVal ? { copyToClipboard: copyVal } : {}),
            // For value-type results without explicit copy, use title
            ...(r.copyToClipboard ? {} : !launchable.has(r.type) && r.type !== 'cmd' ? { copyToClipboard: r.title } : {}),
          }));
        };

        if (result instanceof Promise) {
          result.then(r => setResults(attachCopy(r))).catch(() => {
            setResults([{ id: 'cmd-err', title: 'Fehler', subtitle: 'Befehl konnte nicht ausgeführt werden', type: 'system' }]);
          });
        } else {
          setResults(attachCopy(result));
        }
        return;
      }

      // No exact match — check for usage hint or show command browser
      // Extract filter: everything after "/" (e.g. "/ca" → "ca")
      const filter = trimmed.substring(1).trim().toLowerCase();

      // Check if input exactly matches a command trigger (minus trailing space)
      // e.g. "/age" matches trigger "/age " → show usage hint
      const allCmds = commandRegistry.getAll().filter(c => c.enabled);
      const partialMatch = allCmds.find(c => {
        const t = typeof c.trigger === 'string' ? c.trigger.replace(/ $/, '') : null;
        return t === trimmed;
      });
      if (partialMatch && partialMatch.usage && !partialMatch.requiresSetting || partialMatch && partialMatch.usage && isCommandAvailable(partialMatch.requiresSetting)) {
        setResults([{ id: 'cmd-usage', title: partialMatch.description, subtitle: partialMatch.usage, type: 'calc' }]);
        return;
      }

      // Category metadata for display
      const categoryInfo: Record<string, { label: string; type: SearchResult['type'] }> = {
        calc: { label: 'Rechner & Generatoren', type: 'calc' },
        text: { label: 'Text & Hash-Tools', type: 'calc' },
        web: { label: 'Web & Netzwerk', type: 'web' },
        weather: { label: 'Wetter', type: 'web' },
        notes: { label: 'Notizen', type: 'system' },
        clipboard: { label: 'Zwischenablage', type: 'system' },
        system: { label: 'System', type: 'system' },
        power: { label: 'Power-User', type: 'system' },
      };

      // Filter commands: by search term AND by setting availability
      const filtered = (filter
        ? allCmds.filter(c => {
          const trigger = typeof c.trigger === 'string' ? c.trigger : '';
          return (
            trigger.toLowerCase().includes(filter) ||
            c.id.toLowerCase().includes(filter) ||
            c.description.toLowerCase().includes(filter) ||
            c.category.toLowerCase().includes(filter) ||
            (c.aliases && c.aliases.some(a => a.toLowerCase().includes(filter)))
          );
        })
        : allCmds
      ).filter(c => isCommandAvailable(c.requiresSetting));

      // Group by category, preserving order
      const categoryOrder = ['calc', 'text', 'web', 'weather', 'notes', 'clipboard', 'system', 'power'];
      const grouped: { cat: string; info: typeof categoryInfo[string]; commands: typeof allCmds }[] = [];

      for (const cat of categoryOrder) {
        const catCmds = filtered.filter(c => c.category === cat);
        if (catCmds.length > 0 && categoryInfo[cat]) {
          grouped.push({ cat, info: categoryInfo[cat], commands: catCmds });
        }
      }

      if (grouped.length === 0) {
        setResults([{ id: 'cmd-no-match', title: 'Keine Befehle gefunden', subtitle: `/help oder /${filter} — versuche einen anderen Begriff`, type: 'system' }]);
        return;
      }

      // Build results: category headers + command items
      const cmdResults: SearchResult[] = [];
      let idx = 0;
      for (const group of grouped) {
        cmdResults.push({
          id: `cat-${group.cat}`,
          title: group.info.label,
          subtitle: `${group.commands.length} Befehl${group.commands.length > 1 ? 'e' : ''}`,
          type: group.info.type,
          isHelpCategory: true,
        });
        for (const c of group.commands) {
          const trigger = typeof c.trigger === 'string' ? c.trigger.replace(/ $/, '') : c.id;
          idx++;
          cmdResults.push({
            id: `help-cmd-${idx}`,
            title: trigger,
            subtitle: c.description + (c.aliases?.length ? ` (${c.aliases.join(', ')})` : ''),
            type: group.info.type,
            path: trigger,
          });
        }
      }

      setResults(cmdResults);
      return;
    }

    // /ai command
    if (query.trim() === '/ai' || query.startsWith('/ai ')) {
      setResults([{ id: 'ai', title: 'Google Gemini öffnen', subtitle: 'KI-Chat direkt hier starten', type: 'ai' }]);
      return;
    }

    // /g command (web search)
    if (query.startsWith('/g ')) {
      setLoading(true);
      const term = query.substring(3);
      const t = setTimeout(async () => {
        try {
          const raw = await window.electronAPI.fetchInstantAnswer(term);
          if (raw) {
            setResults(raw.map((item: Record<string, unknown>, idx: number) => ({
              id: `w-${idx}`,
              title: String(item.title ?? ''),
              subtitle: item.subtitle ? String(item.subtitle) : undefined,
              type: (item.type as SearchResult['type']) ?? 'web',
              path: item.path ? String(item.path) : undefined,
              isWeb: Boolean(item.isWeb),
            })));
          }
        } catch { /* ignore */ }
        setLoading(false);
      }, 300);
      return () => clearTimeout(t);
    }

    // Normal search with debounce
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const raw = await window.electronAPI.searchEverything(query);
        const mappedLocal: SearchResult[] = (raw || []).map((item: Record<string, unknown>, idx: number) => ({
          id: `r-${idx}`,
          title: String((item.title || '')).replace(/\.(lnk|url)$/i, ''),
          subtitle: item.path ? String(item.path) : undefined,
          type: (['game', 'app', 'system', 'folder'].includes(String(item.type || '')) ? String(item.type) : 'file') as SearchResult['type'],
          path: item.path ? String(item.path) : undefined,
          iconBase64: item.iconBase64 ? String(item.iconBase64) : undefined,
          iconPath: item.iconPath ? String(item.iconPath) : undefined,
        }));

        // Sort: apps/games/system first (closest match), then folders, then files last
        const q = query.toLowerCase();
        const typeRank: Record<string, number> = { app: 0, game: 0, system: 1, folder: 2, file: 3 };
        mappedLocal.sort((a, b) => {
          const ra = typeRank[a.type] ?? 3;
          const rb = typeRank[b.type] ?? 3;
          if (ra !== rb) return ra - rb;
          // Within same type: exact match first, then starts-with, then alphabetical
          const at = a.title.toLowerCase();
          const bt = b.title.toLowerCase();
          const aExact = at === q ? 0 : at.startsWith(q) ? 1 : 2;
          const bExact = bt === q ? 0 : bt.startsWith(q) ? 1 : 2;
          if (aExact !== bExact) return aExact - bExact;
          return at.localeCompare(bt);
        });

        setResults(mappedLocal);
        setLoading(false);

        // Lazy-load icons for app/game/folder results
        const iconCandidates = mappedLocal.filter(r => (r.type === 'app' || r.type === 'game' || r.type === 'folder') && r.iconPath);
        for (const item of iconCandidates) {
          window.electronAPI.getFileIcon(item.iconPath!).then((icon: string | null) => {
            if (icon) {
              setResults(prev => prev.map(r =>
                r.id === item.id ? { ...r, iconBase64: icon } : r
              ));
            }
          }).catch(() => { /* ignore */ });
        }

        // Fetch web suggestions if enabled
        if (query.trim().length >= 2 && !query.startsWith('/ai') && settings.search.showWebSuggestions) {
          window.electronAPI.fetchInstantAnswer(query).then((webRaw: Record<string, unknown>[]) => {
            if (webRaw && webRaw.length > 0) {
              setResults(prev => {
                const newWeb: SearchResult[] = webRaw.map((w, idx) => ({
                  id: `w-impl-${idx}`,
                  title: String(w.title ?? ''),
                  subtitle: w.subtitle ? String(w.subtitle) : undefined,
                  type: (w.type as SearchResult['type']) ?? 'web',
                  path: w.path ? String(w.path) : undefined,
                  isWeb: Boolean(w.isWeb),
                }));
                return [...prev.filter(r => !r.id.startsWith('w-impl')), ...newWeb];
              });
            }
          }).catch(() => { /* ignore */ });
        }
      } catch {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, recentItems, settings, buildCommandContext, isCommandAvailable, onOpenSettings]);

  // Auto-scroll to selected
  useEffect(() => {
    const el = resultsRef.current?.querySelector('.result-item.selected');
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [selectedIndex]);

  // Focus the correct element when zone changes
  useEffect(() => {
    switch (focusedZone) {
      case FOCUS_ZONE_INPUT:
        inputRef.current?.focus();
        break;
      case FOCUS_ZONE_QUICK_ACTIONS:
        // Focus is managed via tabIndex/keyboard, no explicit focus needed
        break;
      case FOCUS_ZONE_RESULTS:
        // Arrow keys handle result navigation
        break;
      case FOCUS_ZONE_FOOTER:
        settingsBtnRef.current?.focus();
        break;
    }
  }, [focusedZone]);

  // Helper to get day name from date string
  function getDayName(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Heute';
    if (date.toDateString() === tomorrow.toDateString()) return 'Morgen';

    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return days[date.getDay()];
  }

  // Weather fetcher (still used for natural language weather queries)
  async function fetchWeather(city: string) {
    try {
      const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=de`);
      const data = await r.json();
      const current = data.current_condition?.[0];
      const today = data.weather?.[0];
      const hourly = today?.hourly || [];

      if (!current) {
        setResults([{ id: 'cmd-err', title: 'Wetter nicht verfügbar', subtitle: 'Keine Daten erhalten', type: 'system' }]);
        return;
      }

      const hourlyData = hourly.map((h: { time: string; tempC: string; FeelsLikeC: string; chanceofrain: string; weatherCode: string }) => ({
        time: h.time,
        temp: parseInt(h.tempC),
        feelsLike: parseInt(h.FeelsLikeC),
        chanceOfRain: h.chanceofrain,
        weatherIcon: h.weatherCode,
      }));

      // Build 3-day forecast
      const forecast = (data.weather || []).slice(0, 3).map((day: { date: string; mintempC: string; maxtempC: string; astronomy: { sunrise: string; sunset: string }[]; hourly: { time: string; tempC: string; FeelsLikeC: string; chanceofrain: string; weatherCode: string }[]; lang_de?: { value: string }[]; weatherDesc?: { value: string }[] }) => ({
        date: day.date,
        dayName: getDayName(day.date),
        minTemp: day.mintempC,
        maxTemp: day.maxtempC,
        weatherIcon: day.hourly?.[4]?.weatherCode || '116',
        weatherDesc: day.lang_de?.[0]?.value || day.weatherDesc?.[0]?.value || '',
        sunrise: day.astronomy?.[0]?.sunrise,
        sunset: day.astronomy?.[0]?.sunset,
        hourly: (day.hourly || []).map((h: { time: string; tempC: string; FeelsLikeC: string; chanceofrain: string; weatherCode: string }) => ({
          time: h.time,
          temp: parseInt(h.tempC),
          feelsLike: parseInt(h.FeelsLikeC),
          chanceOfRain: h.chanceofrain,
          weatherIcon: h.weatherCode,
        })),
      }));

      const weatherData = {
        temp: current.temp_C, feelsLike: current.FeelsLikeC,
        humidity: current.humidity, windSpeed: current.windspeedKmph,
        windDir: current.winddir16Point, uvIndex: current.uvIndex,
        visibility: current.visibility, pressure: current.pressure,
        cloudCover: current.cloudcover,
        weatherDesc: current.lang_de?.[0]?.value || current.weatherDesc?.[0]?.value || 'Unbekannt',
        precip: current.precipMM, city,
        minTemp: today?.mintempC, maxTemp: today?.maxtempC,
        sunrise: today?.astronomy?.[0]?.sunrise,
        sunset: today?.astronomy?.[0]?.sunset,
        hourly: hourlyData,
        forecast,
      };

      setResults([
        { id: 'weather-card', title: `${current.temp_C}°C in ${city}`, subtitle: weatherData.weatherDesc, type: 'weather', path: JSON.stringify(weatherData) },
        { id: 'weather-more', title: 'Vollständige Wettervorschau öffnen', subtitle: `wttr.in/${encodeURIComponent(city)}`, type: 'web', path: `https://wttr.in/${encodeURIComponent(city)}?lang=de`, isWeb: true },
      ]);
    } catch {
      setResults([{ id: 'cmd-err', title: 'Wetter nicht abrufbar', subtitle: 'Service nicht verfügbar', type: 'system' }]);
    }
  }

  // Execute action on a result
  function executeAction(result: SearchResult) {
    if (!result) return;

    // Folder expansion on Enter
    if (result.type === 'folder' && result.path && !result.isSubItem) {
      if (expandedFolder === result.path) {
        setExpandedFolder(null);
        setFolderItems([]);
      } else {
        setExpandedFolder(result.path);
        setFolderItems([]);
        folderLoadingRef.current = true;

        const currentPath = result.path;
        const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
        Promise.race([window.electronAPI.listDirectory(result.path), timeoutPromise])
          .then((raw: Record<string, unknown>[]) => {
            const items = (raw || []).map((item: Record<string, unknown>, idx: number) => ({
              id: `sub-${idx}-${item.path}`,
              title: String(item.title ?? ''),
              subtitle: item.path ? String(item.path) : undefined,
              type: (item.type as SearchResult['type']) ?? 'file',
              path: item.path ? String(item.path) : undefined,
              iconBase64: item.iconBase64 ? String(item.iconBase64) : undefined,
              iconPath: item.iconPath ? String(item.iconPath) : undefined,
              isSubItem: true,
            }));

            setExpandedFolder(prev => {
              if (prev === currentPath) {
                setFolderItems(items);
                folderLoadingRef.current = false;
              }
              return prev;
            });

            // Lazy-load icons for folder sub-items (apps and folders)
            const iconCandidates = items.filter(r => (r.type === 'app' || r.type === 'folder') && r.iconPath);
            for (const item of iconCandidates) {
              window.electronAPI.getFileIcon(item.iconPath!).then((icon: string | null) => {
                if (icon) {
                  setFolderItems(prev => prev.map(r =>
                    r.id === item.id ? { ...r, iconBase64: icon } : r
                  ));
                }
              }).catch(() => { /* ignore */ });
            }
          })
          .catch(() => { folderLoadingRef.current = false; setFolderItems([]); });
      }
      return;
    }

    // Help command -> insert into input
    if (result.path && result.path.startsWith('/') && result.id.startsWith('help-cmd-')) {
      setQuery(result.path + ' ');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    // Copy to clipboard for command results
    if (result.copyToClipboard) {
      try {
        window.electronAPI.writeClipboard(result.copyToClipboard);
        // Brief visual feedback: flash the result title
        setResults(prev => prev.map(r =>
          r.id === result.id ? { ...r, title: 'Kopiert!', subtitle: result.copyToClipboard } : r
        ));
        setTimeout(() => {
          setResults(prev => prev.map(r =>
            r.id === result.id ? { ...r, title: result.title, subtitle: result.subtitle } : r
          ));
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
        if (result.path) window.electronAPI.openUrl(result.path);
      } else if (result.path) {
        window.electronAPI.openFile(result.path);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Keyboard handling
  function handleKeyDown(e: React.KeyboardEvent) {
    // Ctrl+Tab: toggle web expansion (must check BEFORE plain Tab)
    if (e.key === 'Tab' && e.ctrlKey) {
      e.preventDefault();
      setExpandWeb(prev => !prev);
      return;
    }

    // Tab: cycle focus zones
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextZone = e.shiftKey
        ? (focusedZone - 1 + TOTAL_ZONES) % TOTAL_ZONES
        : (focusedZone + 1) % TOTAL_ZONES;
      setFocusedZone(nextZone);

      // If entering results zone, select first result
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
      // If in quick actions zone and no query, execute the focused quick action
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
      window.electronAPI.hideWindow();
    }
  }

  // Quick actions data
  function getQuickActions() {
    return [
      {
        title: 'KI Chat',
        sub: 'Google Gemini',
        iconClass: 'ai',
        icon: <Bot size={15} />,
        action: onOpenAI,
      },
      {
        title: 'Web Suche',
        sub: 'Inline Ergebnisse',
        iconClass: 'web',
        icon: <Globe size={15} />,
        action: () => setQuery('/g '),
      },
      {
        title: 'Dateien',
        sub: 'Schnellzugriff',
        iconClass: 'files',
        icon: <File size={15} />,
        action: () => setQuery('Downloads'),
      },
      {
        title: 'Wetter',
        sub: 'Direkt anzeigen',
        iconClass: 'calc',
        icon: <CloudSun size={15} />,
        action: () => {
          setQuery('wetter');
          setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(6, 6);
          }, 50);
        },
      },
    ];
  }

  // Derived display results (web expansion + folder items)
  const displayResults = useMemo(() => {
    if (query.startsWith('/g ')) return results;

    // Check if this is a help/command browser view (don't limit results)
    const isHelpView = results.some(r => r.isHelpCategory || r.id.startsWith('help-cmd-'));

    const localAndPriority = results.filter(r => r.type !== 'web' || !r.isWeb || r.id === 'web-inline');
    const webClutter = results.filter(r => r.type === 'web' && r.isWeb && r.id !== 'web-inline');

    let out: SearchResult[] = [...localAndPriority];

    // Inject folder items
    if (expandedFolder) {
      const parentIdx = out.findIndex(r => r.path === expandedFolder);
      if (parentIdx !== -1) {
        if (folderItems.length > 0) {
          out.splice(parentIdx + 1, 0, ...folderItems);
        } else if (folderLoadingRef.current) {
          out.splice(parentIdx + 1, 0, { id: 'loading-folder', title: 'Lade Ordnerinhalt...', subtitle: 'Bitte warten...', type: 'file', isSubItem: true });
        } else {
          out.splice(parentIdx + 1, 0, { id: 'empty-folder', title: '(Leerer Ordner oder Zugriff verweigert)', subtitle: 'Keine anzeigbaren Dateien gefunden', type: 'file', isSubItem: true });
        }
      }
    }

    if (expandWeb) {
      out = [...out, ...webClutter];
    } else {
      const fallback = webClutter.find(r => r.title.startsWith('Nach "'));
      if (fallback) out.push(fallback);
      if (webClutter.length > 1) {
        out.push({
          id: 'expand-btn',
          title: 'Web-Vorschläge einblenden',
          subtitle: `${webClutter.length - 1} weitere Ergebnisse (Strg+Tab)`,
          type: 'web',
          isExpandBtn: true,
        });
      }
    }

    // Don't limit results for help view - show all commands
    if (isHelpView) {
      return out;
    }

    return out.slice(0, settings.search.maxResults);
  }, [results, expandWeb, query, expandedFolder, folderItems, settings.search.maxResults]);

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
          </button>
          <div className="shortcut-hint"><kbd>ESC</kbd></div>
        </div>

        {loading && <div className="loading-bar" />}

        {/* Quick Actions */}
        {!query.trim() && (
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
                  tabIndex={focusedZone === FOCUS_ZONE_RESULTS ? 0 : -1}
                  onClick={e => { e.stopPropagation(); setRecentItems([]); }}
                >
                  Verlauf löschen
                </button>
              </div>
            )}
            {displayResults.map((res, idx) => {
              // Weather card
              if (res.id === 'weather-card' && res.path) {
                try {
                  const data = JSON.parse(res.path);
                  return <WeatherCard key={res.id} data={data} selected={idx === selectedIndex} onClick={() => executeAction(res)} onMouseEnter={() => { if (interactionMode.current === 'mouse') setSelectedIndex(idx); }} />;
                } catch {
                  return null;
                }
              }

              // Command browser category header
              if (res.isHelpCategory) {
                return (
                  <div key={res.id} className="cmd-category-header">
                    <span className="cmd-category-label">{res.title}</span>
                    {res.subtitle && <span className="cmd-category-count">{res.subtitle}</span>}
                  </div>
                );
              }

              // Command item (from help-cmd-*)
              if (res.id.startsWith('help-cmd-')) {
                return (
                  <div
                    key={res.id}
                    className={`result-item cmd-item ${idx === selectedIndex ? 'selected' : ''}`}
                    onClick={() => executeAction(res)}
                    onMouseEnter={() => { if (interactionMode.current === 'mouse') setSelectedIndex(idx); }}
                    tabIndex={focusedZone === FOCUS_ZONE_RESULTS ? 0 : -1}
                  >
                    <div className="cmd-trigger">{res.title}</div>
                    <div className="result-content">
                      <span className="result-subtitle">{res.subtitle}</span>
                    </div>
                    <span className="result-enter">↵</span>
                  </div>
                );
              }

              // Normal result
              return (
                <div
                  key={res.id}
                  className={`result-item ${idx === selectedIndex ? 'selected' : ''} ${res.isSubItem ? 'sub-item' : ''}`}
                  onClick={() => executeAction(res)}
                  onMouseEnter={() => { if (interactionMode.current === 'mouse') setSelectedIndex(idx); }}
                  tabIndex={focusedZone === FOCUS_ZONE_RESULTS ? 0 : -1}
                >
                  <div className={`result-icon ${res.type}`}>
                    {res.iconBase64
                      ? <img src={res.iconBase64} alt="" className="result-icon-img" />
                      : getIcon(res.type, res.path)}
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
      </div>
    </div>
  );
}

// Helper function to format time from wttr.in format (e.g., "0", "100", "200" -> "00:00", "01:00", "02:00")
function formatTime(timeStr: string): string {
  const t = timeStr.padStart(4, '0'); // "0" -> "0000", "100" -> "0100"
  const hours = t.substring(0, 2);
  return `${hours}:00`;
}

// Weather icon mapping based on wttr.in weather codes
function getWeatherIcon(code: number): React.ReactNode {
  if (code === 113) return <Sun size={20} />; // Sunny
  if (code === 116) return <CloudSun size={20} />; // Partly cloudy
  if (code === 119 || code === 122) return <Cloud size={20} />; // Cloudy
  if (code >= 176 && code <= 200) return <CloudDrizzle size={20} />; // Light rain
  if (code >= 263 && code <= 266) return <CloudDrizzle size={20} />; // Drizzle
  if (code >= 293 && code <= 302) return <CloudRain size={20} />; // Rain
  if (code >= 308 && code <= 314) return <CloudHail size={20} />; // Heavy rain
  if (code >= 317 && code <= 338) return <Snowflake size={20} />; // Snow
  if (code >= 350 && code <= 377) return <CloudHail size={20} />; // Ice/Hail
  if (code >= 386 && code <= 395) return <CloudRain size={20} />; // Thunderstorm
  return <CloudSun size={20} />;
}

// Weather card sub-component
function WeatherCard({ data, selected, onClick, onMouseEnter }: {
  data: {
    hourly?: { time: string; temp: number; chanceOfRain: string; weatherIcon: string }[];
    temp: string;
    feelsLike: string;
    humidity: string;
    windSpeed: string;
    windDir: string;
    uvIndex: string;
    visibility: string;
    pressure: string;
    cloudCover: string;
    weatherDesc: string;
    city: string;
    minTemp: string;
    maxTemp: string;
    sunrise?: string;
    sunset?: string;
    forecast?: {
      date: string;
      dayName: string;
      minTemp: string;
      maxTemp: string;
      weatherIcon: string;
      weatherDesc: string;
      sunrise?: string;
      sunset?: string;
      hourly: { time: string; temp: number; chanceOfRain: string; weatherIcon: string }[];
    }[];
  };
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const forecast = data.forecast || [];

  // Get data for selected day
  const selectedDay = forecast[selectedDayIndex];
  const isToday = selectedDayIndex === 0;

  // Use hourly data from selected day, or fallback to today's data
  const hourlyData = selectedDay?.hourly || data.hourly || [];
  const displayMinTemp = selectedDay?.minTemp || data.minTemp;
  const displayMaxTemp = selectedDay?.maxTemp || data.maxTemp;
  const displayWeatherDesc = selectedDay?.weatherDesc || data.weatherDesc;
  const displaySunrise = selectedDay?.sunrise || data.sunrise;
  const displaySunset = selectedDay?.sunset || data.sunset;
  // wttr.in returns 3-hour intervals by default (0, 3, 6, 9, 12, 15, 18, 21)
  // Use all available hourly data points for better resolution
  const graphHours = hourlyData.slice(0, 8);
  const temps = graphHours.map((h) => h.temp);
  const minTemp = Math.min(...temps) - 2;
  const maxTemp = Math.max(...temps) + 2;
  const tempRange = maxTemp - minTemp || 1;
  const graphWidth = 600;
  const graphHeight = 80;
  const padding = 15;

  const points = graphHours.map((h, i) => ({
    x: padding + (i / (graphHours.length - 1 || 1)) * (graphWidth - padding * 2),
    y: graphHeight - padding - ((h.temp - minTemp) / tempRange) * (graphHeight - padding * 2),
    temp: h.temp,
    time: h.time,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
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
      {/* Day selector tabs */}
      {forecast.length > 1 && (
        <div className="weather-day-tabs">
          {forecast.map((day, idx) => (
            <button
              key={day.date}
              className={`weather-day-tab ${idx === selectedDayIndex ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDayIndex(idx);
              }}
            >
              <span className="weather-day-tab-icon">{getWeatherIcon(parseInt(day.weatherIcon))}</span>
              <span className="weather-day-tab-name">{day.dayName}</span>
              <span className="weather-day-tab-temp">{day.maxTemp}°</span>
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
                <stop offset="0%" stopColor="rgba(56, 189, 248, 0.4)" />
                <stop offset="100%" stopColor="rgba(56, 189, 248, 0.05)" />
              </linearGradient>
            </defs>
            {[0, 1, 2].map(i => (
              <line key={i} x1={padding} y1={padding + i * (graphHeight - padding * 2) / 2} x2={graphWidth - padding} y2={padding + i * (graphHeight - padding * 2) / 2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            <path d={areaD} fill="url(#tempGradient)" />
            <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3" fill="#38bdf8" />
                <circle cx={p.x} cy={p.y} r="5" fill="rgba(56, 189, 248, 0.3)" />
              </g>
            ))}
          </svg>
          <div className="weather-graph-labels">
            {points.map((p, i) => (
              <span key={i} className="weather-graph-label">
                {formatTime(p.time)}
              </span>
            ))}
          </div>
          <div className="weather-graph-temps">
            {points.map((p, i) => (
              <span key={i} className="weather-graph-temp">{p.temp}°</span>
            ))}
          </div>
        </div>
      )}

      {hourlyData.length > 0 && (
        <div className="weather-precip-zone">
          <div className="weather-precip-label">
            Niederschlag (24h)
            {hourlyData.some(h => isPrecip(h).hasPrecip) && (
              <span className="weather-precip-warning"><CloudDrizzle size={12} /> Niederschlag erwartet</span>
            )}
          </div>
          <div className="weather-precip-bar">
            {/* Use all 3-hour interval data from wttr.in */}
            {hourlyData.slice(0, 8).map((h, i) => {
              const p = isPrecip(h);
              const barHeight = p.hasPrecip ? Math.max(p.chance, 15) : Math.max(p.chance, 5);
              const precipType = p.isSnow ? 'snow' : p.isHail ? 'hail' : (p.isSleet || p.isFreezing) ? 'sleet' : 'rain';
              const segmentType = p.isSnow ? 'snow-type' : p.isHail ? 'hail-type' : (p.isSleet || p.isFreezing) ? 'hail-type' : '';
              const iconClass = p.isSnow ? 'snow-icon' : p.isHail ? 'hail-icon' : (p.isSleet || p.isFreezing) ? 'sleet-icon' : 'rain-icon';
              const PrecipIcon = p.isSnow ? Snowflake : p.isHail ? CloudHail : (p.isSleet || p.isFreezing) ? CloudFog : CloudDrizzle;

              return (
                <div key={i} className={`weather-precip-segment ${p.hasPrecip ? 'has-precip' : ''} ${p.hasPrecip ? segmentType : ''}`}>
                  {p.hasPrecip && (
                    <div className={`weather-precip-icon ${iconClass}`}><PrecipIcon size={10} /></div>
                  )}
                  <div className={`weather-precip-fill ${precipType}`} style={{ height: `${barHeight}%` }}>
                    <span className="weather-precip-chance">{h.chanceOfRain}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="weather-precip-time-labels">
            {/* Time labels for 3-hour intervals from wttr.in */}
            {hourlyData.slice(0, 8).map((h, i) => {
              const p = isPrecip(h);
              const time = h.time || '';
              return <span key={i} className={`weather-precip-time ${p.hasPrecip ? 'highlight' : ''}`}>{formatTime(time)}</span>;
            })}
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
