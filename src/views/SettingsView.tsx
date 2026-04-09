// NOTE: This file has been cleaned up - shortcuts section removed (was unused)
import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Palette, Lock, Zap, Info, Check,
  Monitor, Globe, SlidersHorizontal,
  Search, Terminal, Download, Puzzle,
  FolderOpen, Trash2, RefreshCw, History,
  Power, Settings as SettingsIcon,
} from 'lucide-react';
import type { AppSettings } from '../types';
import { builtinThemes } from '../core/settings/themes';
import { commandRegistry } from '../core/commands/registry';
import { useConfirm } from '../components/ConfirmDialog';

// Wir importieren die Markdown-Datei direkt als rohen Text via Vite (?raw)
import changelogRaw from '../../CHANGELOG.md?raw';

interface SettingsViewProps {
  settings: AppSettings;
  onBack: () => void;
  onUpdateSetting: (category: keyof AppSettings, key: string, value: unknown) => void;
  onReset: () => void;
  onClearData: () => void;
}

const accentColors = [
  { name: 'Lila', value: '#7c5cfc' },
  { name: 'Blau', value: '#3b82f6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Grün', value: '#10b981' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Rot', value: '#ef4444' },
  { name: 'Pink', value: '#ec4899' },
];

const settingsCategories = [
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'appearance', label: 'Aussehen', icon: SlidersHorizontal },
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'search', label: 'Suche', icon: Search },
  { id: 'commands', label: 'Befehle', icon: Terminal },
  { id: 'features', label: 'Funktionen', icon: Zap },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'privacy', label: 'Datenschutz', icon: Lock },
  { id: 'changelog', label: 'Changelog', icon: History },
  { id: 'about', label: 'Über', icon: Info },
];

export function SettingsView({ settings, onBack, onUpdateSetting, onReset, onClearData }: SettingsViewProps) {
  const [activeCategory, setActiveCategory] = useState('themes');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [plugins, setPlugins] = useState<Array<{ id: string; name: string; version: string; description: string; author: string; enabled: boolean }>>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [selectedPluginForSettings, setSelectedPluginForSettings] = useState<string | null>(null);
  const [pluginSettings, setPluginSettings] = useState<Record<string, unknown>>({});
  const [pluginSettingsSchema, setPluginSettingsSchema] = useState<any[]>([]);
  const [confirmDialog, confirm] = useConfirm();

  // Update check state
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [installRequested, setInstallRequested] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    available: boolean;
    currentVersion?: string;
    latestVersion?: string;
    error?: string;
    downloaded?: boolean;
    downloadProgress?: number | null;
  } | null>(null);

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(v => setAppVersion(v)).catch(() => {});
    // Listen for auto-updater events
    if (window.electronAPI?.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((percent: number) => {
        setUpdateProgress(percent);
      });
    }
    if (window.electronAPI?.onUpdateDownloaded) {
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateDownloaded(true);
      });
    }
  }, []);

  // Update setting helper for nested objects
  const updateAppearance = (key: string, value: unknown) => onUpdateSetting('appearance', key, value);
  const updateSearch = (key: string, value: unknown) => onUpdateSetting('search', key, value);
  const updateFeatures = (key: string, value: unknown) => onUpdateSetting('features', key, value);
  const updatePrivacy = (key: string, value: unknown) => onUpdateSetting('privacy', key, value);

  // Commands list for the commands settings
  const commands = useMemo(() => commandRegistry.getAll(), []);

  // WICHTIG: useMemo muss auf der Top-Ebene der Komponente aufgerufen werden, nicht in Unterfunktionen!
  const parsedChangelogs = useMemo(() => {
    try {
      const logs: Array<{ version: string; date: string; changes: string[] }> = [];
      let currentLog: { version: string; date: string; changes: string[] } | null = null;

      // Sicherheitsabfrage, falls Vite den Raw-Import unerwartet lädt
      const rawContent = typeof changelogRaw === 'string' ? changelogRaw : '';
      const lines = rawContent.split('\n');

      for (const line of lines) {
        const tLine = line.trim();
        if (!tLine) continue; // Leere Zeilen überspringen

        // Sucht nach Überschriften wie "## [1.0.6] - 2026-04-07"
        const versionMatch = tLine.match(/^##\s*\[?v?([\d\.]+)\]?(?:\s*-\s*(.*))?/i);

        if (versionMatch) {
          // Speichere die vorherige Sektion, bevor wir eine neue beginnen
          if (currentLog && currentLog.changes.length > 0) {
            logs.push(currentLog);
          }

          // Versuche, das Datum hübsch zu formatieren (z.B. "2026-04-07" -> "April 2026")
          let dateStr = versionMatch[2] || '';
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              dateStr = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
            }
          } catch { }

          currentLog = {
            version: versionMatch[1],
            date: dateStr,
            changes: []
          };
        }
        // Wenn wir in einer Sektion sind
        else if (currentLog) {
          // 1. Aufzählungspunkte (* oder -)
          if (tLine.startsWith('* ') || tLine.startsWith('- ')) {
            let changeText = tLine.substring(2).trim();
            // Markdown "**" Fettdruck sauber entfernen
            changeText = changeText.replace(/\*\*/g, '');
            currentLog.changes.push(changeText);
          }
          // 2. Unter-Überschriften (z.B. **🐛 Bugfixes** oder ### 🔄 Auto-Update)
          else if (tLine.startsWith('**') || tLine.startsWith('###')) {
            let headerText = tLine.replace(/\*/g, '').replace(/#/g, '').trim();
            if (headerText) {
              currentLog.changes.push(`[HEADER]${headerText}`);
            }
          }
          // 3. Normaler Text (z.B. der Einleitungstext eines Updates)
          else if (!tLine.startsWith('#')) {
            currentLog.changes.push(`[TEXT]${tLine}`);
          }
        }
      }

      // Letzte Sektion am Ende hinzufügen
      if (currentLog && currentLog.changes.length > 0) {
        logs.push(currentLog);
      }

      return logs;
    } catch (e) {
      console.error("Fehler beim automatischen Parsen des Changelogs:", e);
      return [];
    }
  }, []);

  // Load plugins when switching to plugins category
  useEffect(() => {
    if (activeCategory !== 'plugins') return;
    setPluginsLoading(true);
    window.pluginAPI.list()
      .then((list: unknown[]) => {
        setPlugins((list as Record<string, unknown>[]).map((p) => {
          const pid = String(p.id);
          const enabledMap = settings.plugins?.enabled || {};
          return {
            id: pid,
            name: String(p.name),
            version: String(p.version),
            description: String(p.description ?? ''),
            author: String(p.author ?? ''),
            enabled: enabledMap[pid] !== false,
          };
        }));
      })
      .catch(() => setPlugins([]))
      .finally(() => setPluginsLoading(false));
  }, [activeCategory, settings.plugins?.enabled]);

  // Handle theme selection
  const handleThemeSelect = (themeId: string) => {
    updateAppearance('theme', themeId);
    // Also update accent color from theme
    const theme = builtinThemes.find(t => t.id === themeId);
    if (theme) {
      updateAppearance('accentColor', theme.colors.accent);
    }
  };

  return (
    <div className="app-container">
      <div className="search-glass settings-view">
        <div className="webview-header">
          <button className="webview-back" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Zurück</span>
          </button>
          <span className="webview-title">Einstellungen</span>
          <div style={{ width: 100 }} />
        </div>

        <div className="settings-container">
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

          <div className="settings-content">
            {activeCategory === 'themes' && renderThemes()}
            {activeCategory === 'appearance' && renderAppearance()}
            {activeCategory === 'system' && renderSystem()}
            {activeCategory === 'search' && renderSearch()}
            {activeCategory === 'commands' && renderCommands()}
            {activeCategory === 'features' && renderFeatures()}
            {activeCategory === 'plugins' && renderPlugins()}
            {activeCategory === 'privacy' && renderPrivacy()}
            {activeCategory === 'changelog' && renderChangelog()}
            {activeCategory === 'about' && renderAbout()}
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );

  // ========================
  // THEMES
  // ========================
  function renderThemes() {
    return (
      <div className="settings-section">
        <h2 className="settings-title">Themes</h2>
        <div className="settings-group">
          <div className="theme-grid">
            {builtinThemes.map(theme => (
              <button
                key={theme.id}
                className={`theme-card ${settings.appearance.theme === theme.id ? 'selected' : ''}`}
                onClick={() => handleThemeSelect(theme.id)}
              >
                <div className="theme-preview" style={{
                  background: theme.colors.bg,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: `${theme.radius}px`,
                }}>
                  <div className="theme-preview-accent" style={{ background: theme.colors.accent }} />
                  <div className="theme-preview-text" style={{ color: theme.colors.text }}>Aa</div>
                  <div className="theme-preview-muted" style={{ color: theme.colors.textMuted }}>···</div>
                </div>
                <span className="theme-name">{theme.name}</span>
                {settings.appearance.theme === theme.id && <Check size={12} className="theme-check" />}
              </button>
            ))}
          </div>

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
                  onClick={() => updateAppearance('accentColor', color.value)}
                  title={color.name}
                >
                  {settings.appearance.accentColor === color.value && <Check size={12} />}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Theme exportieren</span>
              <span className="settings-item-desc">Aktuelle Farben als JSON kopieren</span>
            </div>
            <button className="settings-btn" onClick={() => {
              const theme = builtinThemes.find(t => t.id === settings.appearance.theme);
              if (theme) {
                navigator.clipboard.writeText(JSON.stringify(theme.colors, null, 2));
              }
            }}>
              <Download size={14} style={{ marginRight: 6 }} />Exportieren
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // APPEARANCE
  // ========================
  function renderAppearance() {
    return (
      <div className="settings-section">
        <h2 className="settings-title">Aussehen</h2>
        <div className="settings-group">
          <div className="settings-item slider-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Schriftgröße</span>
              <span className="settings-item-desc">Textgröße: {settings.appearance.fontSize}px</span>
            </div>
            <input
              type="range" className="settings-slider"
              value={settings.appearance.fontSize}
              onChange={e => updateAppearance('fontSize', parseInt(e.target.value))}
              min={10} max={24}
            />
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
                onChange={e => updateAppearance('animations', e.target.checked)}
              />
              <span className="toggle-slider" />
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
                checked={settings.appearance.blur.enabled}
                onChange={e => updateAppearance('blur', { ...settings.appearance.blur, enabled: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item slider-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Transparenz</span>
              <span className="settings-item-desc">Hintergrunddurchsichtigkeit: {settings.appearance.transparency}%</span>
            </div>
            <input
              type="range" className="settings-slider"
              value={settings.appearance.transparency}
              onChange={e => updateAppearance('transparency', parseInt(e.target.value))}
              min={20} max={100}
            />
          </div>

          <div className="settings-item slider-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Unschärfe-Stärke</span>
              <span className="settings-item-desc">Blur-Effekt: {settings.appearance.blur.amount}px</span>
            </div>
            <input
              type="range" className="settings-slider"
              value={settings.appearance.blur.amount}
              onChange={e => updateAppearance('blur', { ...settings.appearance.blur, amount: parseInt(e.target.value) })}
              min={0} max={80}
            />
          </div>

          <div className="settings-item slider-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Abrundungen</span>
              <span className="settings-item-desc">Fenster-Ecken: {settings.appearance.borderRadius}px</span>
            </div>
            <input
              type="range" className="settings-slider"
              value={settings.appearance.borderRadius}
              onChange={e => updateAppearance('borderRadius', parseInt(e.target.value))}
              min={0} max={30}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Scrollbar anzeigen</span>
              <span className="settings-item-desc">Scrollbar in Ergebnisliste</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.appearance.showScrollbar}
                onChange={e => updateAppearance('showScrollbar', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Kompakter Modus</span>
              <span className="settings-item-desc">Reduzierte Abstände</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.appearance.compactMode}
                onChange={e => updateAppearance('compactMode', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Auf Standard zurücksetzen</span>
              <span className="settings-item-desc">Alle Einstellungen zurücksetzen</span>
            </div>
            <button className="settings-btn" onClick={onReset}>Zurücksetzen</button>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // SYSTEM
  // ========================
  function renderSystem() {
    const updateSystem = (key: string, value: unknown) => {
      onUpdateSetting('system', key, value);
      // Also notify main process about the change
      if (window.electronAPI?.updateSystemSettings) {
        window.electronAPI.updateSystemSettings({ [key]: value });
      }
    };

    return (
      <div className="settings-section">
        <h2 className="settings-title">System</h2>
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Automatisch starten</span>
              <span className="settings-item-desc">Windows Bar beim Login starten</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.system.autoStart}
                onChange={e => updateSystem('autoStart', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Immer im Vordergrund</span>
              <span className="settings-item-desc">Bar bleibt über anderen Fenstern</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.system.alwaysOnTop}
                onChange={e => updateSystem('alwaysOnTop', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Über Vollbild-Apps</span>
              <span className="settings-item-desc">Bar erscheint über Spielen und Vollbild-Apps (wie Windows Startmenü)</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.system.overlayFullscreen}
                onChange={e => updateSystem('overlayFullscreen', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // SEARCH
  // ========================
  function renderSearch() {
    return (
      <div className="settings-section">
        <h2 className="settings-title">Suche</h2>
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Maximale Ergebnisse</span>
              <span className="settings-item-desc">Anzahl der angezeigten Suchergebnisse</span>
            </div>
            <input
              type="number" className="settings-input"
              value={settings.search.maxResults}
              onChange={e => updateSearch('maxResults', parseInt(e.target.value) || 20)}
              min={5} max={50}
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
                onChange={e => updateSearch('showWebSuggestions', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Letzte Suchen anzeigen</span>
              <span className="settings-item-desc">Zuletzt geöffnete Dateien zeigen</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.search.showRecents}
                onChange={e => updateSearch('showRecents', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item slider-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Anzahl letzte Suchen</span>
              <span className="settings-item-desc">Zuletzt geöffnete Dateien: {settings.search.recentCount}</span>
            </div>
            <input
              type="range" className="settings-slider"
              value={settings.search.recentCount}
              onChange={e => updateSearch('recentCount', parseInt(e.target.value))}
              min={1} max={10}
            />
          </div>

          <div className="settings-item slider-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Suchverzögerung</span>
              <span className="settings-item-desc">Debounce: {settings.search.searchDelay}ms</span>
            </div>
            <input
              type="range" className="settings-slider"
              value={settings.search.searchDelay}
              onChange={e => updateSearch('searchDelay', parseInt(e.target.value))}
              min={50} max={500} step={50}
            />
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Standardstadt für Wetter</span>
              <span className="settings-item-desc">Stadt für /wetter Befehl</span>
            </div>
            <input
              type="text" className="settings-input"
              value={settings.search.defaultCity}
              onChange={e => updateSearch('defaultCity', e.target.value)}
              placeholder="Berlin"
            />
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // COMMANDS
  // ========================
  function renderCommands() {
    const categories = [
      { id: 'calc', label: 'Rechner & Generatoren' },
      { id: 'text', label: 'Text & Hash' },
      { id: 'web', label: 'Web & Netzwerk' },
      { id: 'notes', label: 'Notizen' },
      { id: 'clipboard', label: 'Zwischenablage' },
      { id: 'system', label: 'System' },
      { id: 'power', label: 'Power-User' },
    ];

    return (
      <div className="settings-section">
        <h2 className="settings-title">Befehle</h2>
        <div className="settings-group">
          {categories.map(cat => {
            const catCommands = commands.filter(c => c.category === cat.id);
            if (catCommands.length === 0) return null;
            return (
              <div key={cat.id} className="command-category">
                <div className="command-category-label">{cat.label}</div>
                {catCommands.map(cmd => {
                  const trigger = typeof cmd.trigger === 'string' ? cmd.trigger : cmd.id;
                  const isEnabled = settings.commands.enabled[cmd.id] !== false;
                  return (
                    <div key={cmd.id} className="settings-item command-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">
                          <code className="command-trigger">{trigger}</code>
                          {cmd.aliases && cmd.aliases.length > 0 && (
                            <span className="command-alias">({cmd.aliases.join(', ')})</span>
                          )}
                        </span>
                        <span className="settings-item-desc">{cmd.description}</span>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={e => {
                            const newEnabled = { ...settings.commands.enabled, [cmd.id]: e.target.checked };
                            onUpdateSetting('commands', 'enabled', newEnabled);
                            commandRegistry.setEnabled(cmd.id, e.target.checked);
                          }}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ========================
  // FEATURES
  // ========================
  function renderFeatures() {
    return (
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
                onChange={e => updateFeatures('weatherEnabled', e.target.checked)}
              />
              <span className="toggle-slider" />
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
                onChange={e => updateFeatures('aiEnabled', e.target.checked)}
              />
              <span className="toggle-slider" />
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
                onChange={e => updateFeatures('clipboardHistory', e.target.checked)}
              />
              <span className="toggle-slider" />
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
                onChange={e => updateFeatures('notesEnabled', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // PLUGINS (Improved UI)
  // ========================
  function renderPlugins() {
    const handleInstall = async () => {
      setPluginsLoading(true);
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.onchange = async () => {
          const files = input.files;
          const folder = files?.[0]?.webkitRelativePath?.split('/')[0];
          if (!folder) return;
          try {
            await window.pluginAPI.install(folder);
            const list = await window.pluginAPI.list();
            setPlugins((list as Record<string, unknown>[]).map((p) => {
              const pid = String(p.id);
              const enabledMap = settings.plugins?.enabled || {};
              return {
                id: pid,
                name: String(p.name),
                version: String(p.version),
                description: String(p.description ?? ''),
                author: String(p.author ?? ''),
                enabled: enabledMap[pid] !== false,
              };
            }));
          } catch (e) {
            console.error('Plugin install error:', e);
          }
          setPluginsLoading(false);
        };
        input.click();
      } catch {
        setPluginsLoading(false);
      }
    };

    const handleUninstall = async (pluginId: string) => {
      const ok = await confirm({
        title: 'Plugin deinstallieren',
        message: `Plugin "${pluginId}" wirklich deinstallieren?`,
        confirmLabel: 'Deinstallieren',
        destructive: true,
      });
      if (!ok) return;
      try {
        await window.pluginAPI.uninstall(pluginId);
        setPlugins(prev => prev.filter(p => p.id !== pluginId));
      } catch (e) {
        console.error('Plugin uninstall error:', e);
      }
    };

    const handleToggle = async (pluginId: string, enabled: boolean) => {
      await window.pluginAPI.toggle(pluginId, enabled);
      setPlugins(prev => prev.map(p => p.id === pluginId ? { ...p, enabled } : p));
      const newEnabled = { ...settings.plugins.enabled, [pluginId]: enabled };
      onUpdateSetting('plugins', 'enabled', newEnabled);
    };

    return (
      <div className="settings-section">
        {/* Header with info */}
        <div className="plugin-section-header">
          <h2 className="settings-title">Plugins</h2>
          <div className="plugin-count-badge">
            {plugins.length} installiert
          </div>
        </div>

        <div className="settings-group">
          {pluginsLoading && (
            <div className="plugin-loading">
              <RefreshCw size={20} className="spin" />
              <span>Lade Plugins...</span>
            </div>
          )}

          {plugins.length === 0 && !pluginsLoading && (
            <div className="plugin-empty-state">
              <div className="plugin-empty-icon"><Puzzle size={48} /></div>
              <h3>Keine Plugins installiert</h3>
              <p>Erweitere Windows Bar mit mächtigen Plugins</p>
              <div className="plugin-empty-hint">
                <p>Erstelle einen Ordner mit einer <code>manifest.json</code> und <code>main.js</code></p>
                <p>Plugins liegen in: <code>%APPDATA%/windowsbar/plugins/</code></p>
              </div>
            </div>
          )}

          {/* Plugin Cards */}
          <div className="plugin-grid">
            {plugins.map(plugin => (
              <div
                key={plugin.id}
                className={`plugin-card ${plugin.enabled ? 'enabled' : 'disabled'}`}
              >
                {/* Plugin Card Header */}
                <div className="plugin-card-header">
                  <div className="plugin-icon-wrapper">
                    <div className="plugin-icon">
                      {plugin.name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="plugin-info">
                    <div className="plugin-name-row">
                      <h4 className="plugin-name">{plugin.name}</h4>
                      <span className="plugin-version">v{plugin.version}</span>
                    </div>
                    <p className="plugin-author">von {plugin.author || 'Unbekannt'}</p>
                  </div>
                </div>

                {/* Plugin Description */}
                <p className="plugin-description">
                  {plugin.description || 'Keine Beschreibung verfügbar'}
                </p>

                {/* Plugin Actions */}
                <div className="plugin-card-actions">
                  <div className="plugin-toggle-row">
                    <Power size={14} className={plugin.enabled ? 'power-on' : 'power-off'} />
                    <span className="plugin-toggle-label">
                      {plugin.enabled ? 'Aktiviert' : 'Deaktiviert'}
                    </span>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={plugin.enabled}
                        onChange={e => handleToggle(plugin.id, e.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <button
                    className="plugin-settings-btn"
                    onClick={async () => {
                      try {
                        const manifest = await window.pluginAPI.getManifest(plugin.id) as any;
                        const schema = manifest?.settingsSchema || [];
                        const currentSettings = await window.pluginAPI.getSettings(plugin.id);
                        setPluginSettingsSchema(schema);
                        setPluginSettings(currentSettings || {});
                        setSelectedPluginForSettings(plugin.id);
                      } catch { /* ignore */ }
                    }}
                    title="Plugin-Einstellungen"
                  >
                    <SettingsIcon size={14} />
                  </button>
                  <button
                    className="plugin-reload-btn"
                    onClick={async () => {
                      await window.pluginAPI.reload(plugin.id);
                      const list = await window.pluginAPI.list();
                      setPlugins((list as Record<string, unknown>[]).map((p) => {
                        const pid = String(p.id);
                        const enabledMap = settings.plugins?.enabled || {};
                        return {
                          id: pid,
                          name: String(p.name),
                          version: String(p.version),
                          description: String(p.description ?? ''),
                          author: String(p.author ?? ''),
                          enabled: enabledMap[pid] !== false,
                        };
                      }));
                    }}
                    title="Plugin neu laden"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="plugin-uninstall-btn"
                    onClick={() => handleUninstall(plugin.id)}
                    title="Plugin deinstallieren"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Install Plugin Button */}
          <div className="plugin-install-section">
            <button className="plugin-install-btn" onClick={handleInstall}>
              <FolderOpen size={18} />
              <span>Plugin installieren</span>
            </button>
            <p className="plugin-install-hint">
              Wähle einen Ordner mit einer manifest.json Datei
            </p>
          </div>
        </div>

        {/* Plugin Settings Modal */}
        {selectedPluginForSettings && (
          <div className="plugin-settings-modal-backdrop" onClick={() => setSelectedPluginForSettings(null)}>
            <div className="plugin-settings-modal" onClick={e => e.stopPropagation()}>
              <div className="plugin-settings-header">
                <h3>Einstellungen: {plugins.find(p => p.id === selectedPluginForSettings)?.name}</h3>
                <button className="plugin-settings-close" onClick={() => setSelectedPluginForSettings(null)}>✕</button>
              </div>
              <div className="plugin-settings-body">
                {pluginSettingsSchema.length === 0 ? (
                  <p className="plugin-no-settings">Dieses Plugin hat keine konfigurierbaren Einstellungen.</p>
                ) : (
                  <div className="plugin-settings-fields">
                    {pluginSettingsSchema.map((field: any) => {
                      const key = field.key;
                      const value = pluginSettings[key] !== undefined ? pluginSettings[key] : field.default;

                      const updateField = async (val: unknown) => {
                        const updated = { ...pluginSettings, [key]: val };
                        setPluginSettings(updated);
                        await window.pluginAPI.updateSettings(selectedPluginForSettings, updated);
                      };

                      return (
                        <div key={key} className="plugin-setting-field">
                          <label className="plugin-field-label">
                            <span className="plugin-field-label-text">{field.label}</span>
                            {field.description && <span className="plugin-field-desc">{field.description}</span>}
                          </label>
                          {field.type === 'boolean' && (
                            <label className="toggle-switch">
                              <input type="checkbox" checked={!!value} onChange={e => updateField(e.target.checked)} />
                              <span className="toggle-slider" />
                            </label>
                          )}
                          {field.type === 'select' && (
                            <select
                              className="plugin-field-select"
                              value={String(value)}
                              onChange={e => updateField(e.target.value)}
                            >
                              {field.options?.map((opt: any) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          )}
                          {field.type === 'text' && (
                            <input
                              className="plugin-field-input"
                              type="text"
                              value={String(value || '')}
                              placeholder={field.placeholder}
                              onChange={e => updateField(e.target.value)}
                            />
                          )}
                          {field.type === 'number' && (
                            <input
                              className="plugin-field-input"
                              type="number"
                              value={Number(value || 0)}
                              min={field.min}
                              max={field.max}
                              onChange={e => updateField(Number(e.target.value))}
                            />
                          )}
                          {field.type === 'color' && (
                            <input
                              className="plugin-field-color"
                              type="color"
                              value={String(value || '#7c5cfc')}
                              onChange={e => updateField(e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <style>{`
          .plugin-section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }
          
          .plugin-count-badge {
            background: var(--accent);
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
          }
          
          .plugin-loading {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 24px;
            color: var(--text-muted);
          }
          
          .plugin-loading .spin {
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .plugin-empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-muted);
          }
          
          .plugin-empty-icon {
            opacity: 0.3;
            margin-bottom: 16px;
          }
          
          .plugin-empty-state h3 {
            color: var(--text);
            margin: 0 0 8px 0;
          }
          
          .plugin-empty-state p {
            margin: 0 0 16px 0;
          }
          
          .plugin-empty-hint {
            font-size: 13px;
            opacity: 0.7;
          }
          
          .plugin-empty-hint p {
            margin: 4px 0;
          }
          
          .plugin-empty-hint code {
            background: var(--surface);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
          }
          
          .plugin-grid {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 20px;
          }
          
          .plugin-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius, 12px);
            padding: 16px;
            transition: all 0.2s ease;
          }
          
          .plugin-card.enabled {
            border-color: var(--accent);
            box-shadow: 0 0 0 1px var(--accent)20;
          }
          
          .plugin-card.disabled {
            opacity: 0.7;
          }
          
          .plugin-card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }
          
          .plugin-icon-wrapper {
            flex-shrink: 0;
          }
          
          .plugin-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--accent), var(--accent-hover, var(--accent)));
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 18px;
          }
          
          .plugin-info {
            flex: 1;
            min-width: 0;
          }
          
          .plugin-name-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .plugin-name {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--text);
          }
          
          .plugin-version {
            font-size: 11px;
            color: var(--text-muted);
            background: var(--bg);
            padding: 2px 6px;
            border-radius: 4px;
          }
          
          .plugin-author {
            margin: 4px 0 0 0;
            font-size: 12px;
            color: var(--text-muted);
          }
          
          .plugin-description {
            margin: 0 0 12px 0;
            font-size: 13px;
            color: var(--text-muted);
            line-height: 1.4;
          }
          
          .plugin-card-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-top: 12px;
            border-top: 1px solid var(--border);
          }
          
          .plugin-toggle-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .plugin-toggle-row .power-on {
            color: var(--accent);
          }
          
          .plugin-toggle-row .power-off {
            color: var(--text-muted);
          }
          
          .plugin-toggle-label {
            font-size: 13px;
            color: var(--text-muted);
          }
          
          .plugin-reload-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.2s;
          }
          
          .plugin-reload-btn:hover {
            background: var(--item-hover);
            color: var(--accent);
          }
          
          .plugin-settings-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.2s;
          }
          
          .plugin-settings-btn:hover {
            background: var(--item-hover);
            color: var(--accent);
          }
          
          .plugin-uninstall-btn {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.2s;
          }
          
          .plugin-uninstall-btn:hover {
            background: rgba(255, 0, 0, 0.1);
            color: #ff4444;
          }
          
          .plugin-install-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            border: 2px dashed var(--border);
            border-radius: var(--radius, 12px);
            margin-top: 8px;
          }
          
          .plugin-install-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--accent);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .plugin-install-btn:hover {
            background: var(--accent-hover, var(--accent));
            transform: translateY(-1px);
          }
          
          .plugin-install-hint {
            margin: 8px 0 0 0;
            font-size: 12px;
            color: var(--text-muted);
          }

          /* Plugin Settings Modal */
          .plugin-settings-modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .plugin-settings-modal {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            width: 420px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          }

          .plugin-settings-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 20px;
            border-bottom: 1px solid var(--border);
          }

          .plugin-settings-header h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 600;
            color: var(--text);
          }

          .plugin-settings-close {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 18px;
            padding: 4px 8px;
            border-radius: 6px;
            transition: all 0.2s;
          }

          .plugin-settings-close:hover {
            background: var(--item-hover);
            color: var(--text);
          }

          .plugin-settings-body {
            padding: 20px;
          }

          .plugin-no-settings {
            text-align: center;
            color: var(--text-muted);
            font-size: 13px;
            padding: 24px 0;
          }

          .plugin-settings-fields {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .plugin-setting-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .plugin-field-label {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .plugin-field-label-text {
            font-size: 13px;
            font-weight: 500;
            color: var(--text);
          }

          .plugin-field-desc {
            font-size: 11px;
            color: var(--text-muted);
          }

          .plugin-field-select,
          .plugin-field-input {
            width: 100%;
            padding: 8px 10px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: var(--text);
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: all 0.2s;
          }

          .plugin-field-select:focus,
          .plugin-field-input:focus {
            border-color: var(--accent);
          }

          .plugin-field-color {
            width: 48px;
            height: 32px;
            border: 1px solid var(--border);
            border-radius: 6px;
            cursor: pointer;
            background: transparent;
          }
        `}</style>
      </div>
    );
  }

  // ========================
  // PRIVACY
  // ========================
  function renderPrivacy() {
    return (
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
                onChange={e => updatePrivacy('saveRecents', e.target.checked)}
              />
              <span className="toggle-slider" />
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
                onChange={e => updatePrivacy('saveClipboardHistory', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="settings-item danger">
            <div className="settings-item-info">
              <span className="settings-item-title">Alle Daten löschen</span>
              <span className="settings-item-desc">Entferne alle gespeicherten Daten</span>
            </div>
            <button className="settings-btn danger" onClick={onClearData}>Löschen</button>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // CHANGELOG
  // ========================
  function renderChangelog() {
    return (
      <div className="settings-section" style={{ paddingBottom: '80px' }}>
        <h2 className="settings-title">Changelog</h2>
        <div className="settings-group changelog-container">
          {parsedChangelogs.length > 0 ? parsedChangelogs.map((entry, idx) => (
            <div key={entry.version} className={`changelog-entry ${idx === 0 ? 'latest' : ''}`} style={{ marginBottom: '24px' }}>
              <div className="changelog-header" style={{ marginBottom: '12px' }}>
                <span className="changelog-version">v{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
                {idx === 0 && <span className="changelog-badge">Neueste</span>}
              </div>
              <div className="changelog-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {entry.changes.map((change, i) => {
                  if (change.startsWith('[HEADER]')) {
                    return <div key={i} className="changelog-subheading">{change.replace('[HEADER]', '')}</div>;
                  }
                  if (change.startsWith('[TEXT]')) {
                    return <div key={i} className="changelog-text">{change.replace('[TEXT]', '')}</div>;
                  }
                  return (
                    <div key={i} className="changelog-item">
                      <span className="changelog-bullet">•</span>
                      <span className="changelog-item-text">{change}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : (
            <p style={{ padding: 20, color: 'var(--text-muted)' }}>Keine Changelogs gefunden.</p>
          )}
        </div>

        {/* Spezifisches CSS für das bereinigte Changelog Layout */}
        <style>{`
          .changelog-subheading {
            font-weight: 600;
            color: var(--text);
            margin-top: 16px;
            margin-bottom: 4px;
            font-size: 14px;
          }
          .changelog-text {
            color: var(--text-muted);
            margin-top: 8px;
            margin-bottom: 12px;
            font-size: 13px;
            line-height: 1.5;
          }
          .changelog-item {
            display: flex;
            align-items: flex-start;
            margin-bottom: 6px;
            line-height: 1.4;
            color: var(--text-muted);
            font-size: 13px;
          }
          .changelog-bullet {
            color: var(--accent);
            margin-right: 8px;
            font-size: 16px;
            line-height: 1;
          }
          .changelog-item-text {
            flex: 1;
          }
        `}</style>
      </div>
    );
  }

  // ========================
  // ABOUT
  // ========================
  function renderAbout() {
    const handleCheckUpdate = async () => {
      setUpdateChecking(true);
      setUpdateResult(null);
      setUpdateProgress(null);
      setInstallRequested(false);
      try {
        const result = await window.electronAPI.checkForUpdates();
        setUpdateResult(result);
        if (result?.downloaded) {
          setUpdateDownloaded(true);
        }
        if (result?.downloadProgress != null) {
          setUpdateProgress(result.downloadProgress);
        }
      } catch {
        setUpdateResult({ available: false, error: 'Fehler beim Prüfen auf Updates' });
      } finally {
        setUpdateChecking(false);
      }
    };

    const handleInstallUpdate = () => {
      setInstallRequested(true);
      if (window.electronAPI?.installUpdate) {
        window.electronAPI.installUpdate();
      }
    };

    return (
      <div className="settings-section">
        <h2 className="settings-title">Über Windows Bar</h2>
        <div className="settings-group">
          <div className="about-card">
            <div className="about-icon"><Monitor size={48} /></div>
            <h3>Windows Bar</h3>
            <p className="about-version">Version {appVersion}</p>
            <p className="about-desc">
              Ein schneller und eleganter App-Launcher für Windows mit
              integrierter KI, Wetter-Anzeige und vielen nützlichen Befehlen.
            </p>
            <div className="about-links">
              <a href="https://github.com/JackyWein/Windows-Bar" target="_blank" rel="noopener noreferrer" className="about-link">
                <Globe size={14} />
                GitHub
              </a>
            </div>
          </div>

          {/* Update Check Section */}
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Nach Updates suchen</span>
              <span className="settings-item-desc">Prüfe auf neue Versionen</span>
            </div>
            <button
              className={`update-check-btn ${updateChecking ? 'checking' : ''}`}
              onClick={handleCheckUpdate}
              disabled={updateChecking}
            >
              <RefreshCw size={16} />
              {updateChecking ? 'Prüfe...' : 'Jetzt prüfen'}
            </button>
          </div>

          {updateResult && (
            <div className={`update-status ${updateResult.available ? 'available' : updateResult.error ? 'error' : 'not-available'}`}>
              {updateResult.available ? (
                <>
                  <span className="update-status-text">✨ Update verfügbar!</span>
                  <span className="update-status-version">
                    Version {updateResult.latestVersion} (aktuell: {updateResult.currentVersion})
                  </span>
                  
                  {updateDownloaded || updateResult.downloaded ? (
                    <button className="update-install-btn" onClick={handleInstallUpdate}>
                      <Download size={14} />
                      Jetzt neustarten & installieren
                    </button>
                  ) : (
                    <>
                      {updateProgress !== null ? (
                        <div className="update-progress-container" style={{ width: '100%', marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span>Herunterladen...</span>
                            <span>{Math.round(updateProgress)}%</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${updateProgress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }}></div>
                          </div>
                          {installRequested && <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-muted)' }}>App startet neu, sobald der Download abgeschlossen ist.</div>}
                        </div>
                      ) : (
                        <button className="update-install-btn" onClick={handleInstallUpdate} disabled={installRequested}>
                          <Download size={14} />
                          {installRequested ? 'Wird vorbereitet...' : 'Jetzt installieren'}
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : updateResult.error ? (
                <span className="update-status-text">⚠️ {updateResult.error}</span>
              ) : (
                <>
                  <span className="update-status-text">✅ Kein Update verfügbar</span>
                  <span className="update-status-version">Du nutzt Version {updateResult.currentVersion}</span>
                </>
              )}
            </div>
          )}

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

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Themes & Plugins</span>
              <span className="settings-item-desc">Passe das Aussehen in den Themes-Einstellungen an</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
}