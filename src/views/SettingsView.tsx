import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Palette, Lock, Zap, Info, Check,
  Monitor, Globe, Keyboard, SlidersHorizontal,
  Search, Terminal, RotateCcw, Download, Puzzle,
  FolderOpen, Trash2, RefreshCw, History,
} from 'lucide-react';
import type { AppSettings } from '../types';
import { builtinThemes } from '../core/settings/themes';
import { commandRegistry } from '../core/commands/registry';
import { defaultShortcuts } from '../core/shortcuts/defaults';
import { useConfirm } from '../components/ConfirmDialog';

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
  { id: 'shortcuts', label: 'Tastenkürzel', icon: Keyboard },
  { id: 'features', label: 'Funktionen', icon: Zap },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'privacy', label: 'Datenschutz', icon: Lock },
  { id: 'changelog', label: 'Changelog', icon: History },
  { id: 'about', label: 'Über', icon: Info },
];

// Rebind state for shortcuts
interface RebindState {
  shortcutId: string;
  isListening: boolean;
}

export function SettingsView({ settings, onBack, onUpdateSetting, onReset, onClearData }: SettingsViewProps) {
  const [activeCategory, setActiveCategory] = useState('themes');
  const [rebind, setRebind] = useState<RebindState | null>(null);
  const [plugins, setPlugins] = useState<Array<{ id: string; name: string; version: string; description: string; author: string; enabled: boolean }>>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [confirmDialog, confirm] = useConfirm();
  
  // Update check state
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<{
    available: boolean;
    currentVersion?: string;
    latestVersion?: string;
    error?: string;
  } | null>(null);

  // Update setting helper for nested objects
  const updateAppearance = (key: string, value: unknown) => onUpdateSetting('appearance', key, value);
  const updateSearch = (key: string, value: unknown) => onUpdateSetting('search', key, value);
  const updateFeatures = (key: string, value: unknown) => onUpdateSetting('features', key, value);
  const updatePrivacy = (key: string, value: unknown) => onUpdateSetting('privacy', key, value);

  // Current shortcuts (user overrides + defaults)
  const currentShortcuts = useMemo(() => {
    const result: Record<string, string> = {};
    for (const def of defaultShortcuts) {
      result[def.id] = settings.shortcuts[def.id] ?? def.defaultBinding;
    }
    return result;
  }, [settings.shortcuts]);

  // Rebind keyboard listener
  useEffect(() => {
    if (!rebind?.isListening) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey) parts.push('Meta');

      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      }

      if (parts.length >= 2) {
        const binding = parts.join('+');
        const newShortcuts = { ...settings.shortcuts, [rebind.shortcutId]: binding };
        onUpdateSetting('shortcuts', '', newShortcuts);
      }

      setRebind(null);
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [rebind, settings.shortcuts, onUpdateSetting]);

  // Commands list for the commands settings
  const commands = useMemo(() => commandRegistry.getAll(), []);

  // Load plugins when switching to plugins category
  useEffect(() => {
    if (activeCategory !== 'plugins') return;
    setPluginsLoading(true);
    window.pluginAPI.list()
      .then((list) => {
        setPlugins(list.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: String(p.name),
          version: String(p.version),
          description: String(p.description ?? ''),
          author: String(p.author ?? ''),
          enabled: Boolean(p.enabled),
        })));
      })
      .catch(() => setPlugins([]))
      .finally(() => setPluginsLoading(false));
  }, [activeCategory]);

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
            {activeCategory === 'shortcuts' && renderShortcuts()}
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
  // SHORTCUTS
  // ========================
  function renderShortcuts() {
    const categories: { id: string; label: string }[] = [
      { id: 'global', label: 'Global' },
      { id: 'search', label: 'Suche' },
      { id: 'results', label: 'Ergebnisse' },
      { id: 'navigation', label: 'Navigation' },
    ];

    const formatBinding = (binding: string) => {
      return binding.split('+').join(' + ');
    };

    return (
      <div className="settings-section">
        <h2 className="settings-title">Tastenkürzel</h2>
        <div className="settings-group">
          {categories.map(cat => {
            const catShortcuts = defaultShortcuts.filter(s => s.category === cat.id);
            if (catShortcuts.length === 0) return null;
            return (
              <div key={cat.id} className="shortcut-category">
                <div className="command-category-label">{cat.label}</div>
                {catShortcuts.map(shortcut => {
                  const binding = currentShortcuts[shortcut.id] || shortcut.defaultBinding;
                  const isRebinding = rebind?.shortcutId === shortcut.id && rebind.isListening;
                  return (
                    <div key={shortcut.id} className="settings-item shortcut-item">
                      <div className="settings-item-info">
                        <span className="settings-item-title">{shortcut.name}</span>
                        <span className="settings-item-desc">{shortcut.description}</span>
                      </div>
                      <button
                        className={`shortcut-binding ${isRebinding ? 'listening' : ''}`}
                        onClick={() => setRebind({ shortcutId: shortcut.id, isListening: true })}
                      >
                        {isRebinding ? (
                          <span className="shortcut-listening">Drücke eine Taste...</span>
                        ) : (
                          <span className="shortcut-key">{formatBinding(binding)}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Alle zurücksetzen</span>
              <span className="settings-item-desc">Tastenkürzel auf Standardwerte</span>
            </div>
            <button className="settings-btn" onClick={() => onUpdateSetting('shortcuts', '', {})}>
              <RotateCcw size={14} style={{ marginRight: 6 }} />Zurücksetzen
            </button>
          </div>
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
  // PLUGINS
  // ========================
  function renderPlugins() {
    const handleInstall = async () => {
      setPluginsLoading(true);
      try {
        // Use Electron dialog to pick a folder
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.onchange = async () => {
          const folder = input.files?.[0]?.path;
          if (!folder) return;
          try {
            await window.pluginAPI.install(folder);
            // Reload list
            const list = await window.pluginAPI.list();
            setPlugins(list.map((p: Record<string, unknown>) => ({
              id: String(p.id),
              name: String(p.name),
              version: String(p.version),
              description: String(p.description ?? ''),
              author: String(p.author ?? ''),
              enabled: Boolean(p.enabled),
            })));
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
        message: `Plugin "${pluginId}" deinstallieren?`,
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
        <h2 className="settings-title">Plugins</h2>
        <div className="settings-group">
          {pluginsLoading && <div className="settings-item"><span className="settings-item-desc">Laden...</span></div>}

          {plugins.length === 0 && !pluginsLoading && (
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-title">Keine Plugins installiert</span>
                <span className="settings-item-desc">Installiere Plugins um Windows Bar zu erweitern</span>
              </div>
            </div>
          )}

          {plugins.map(plugin => (
            <div key={plugin.id} className="settings-item command-item">
              <div className="settings-item-info">
                <span className="settings-item-title">{plugin.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>v{plugin.version}</span></span>
                <span className="settings-item-desc">{plugin.description || 'Keine Beschreibung'}</span>
                {plugin.author && <span className="settings-item-desc" style={{ fontSize: '0.8em' }}>von {plugin.author}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={plugin.enabled}
                    onChange={e => handleToggle(plugin.id, e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
                <button
                  className="settings-btn danger"
                  style={{ padding: '4px 8px' }}
                  onClick={() => handleUninstall(plugin.id)}
                  title="Deinstallieren"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-title">Plugin installieren</span>
              <span className="settings-item-desc">Wähle einen Ordner mit manifest.json</span>
            </div>
            <button className="settings-btn" onClick={handleInstall}>
              <FolderOpen size={14} style={{ marginRight: 6 }} />Installieren
            </button>
          </div>
        </div>
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
    const changelogs = [
      {
        version: '1.0.3',
        date: 'April 2026',
        changes: [
          'Schriftgröße jetzt als Slider mit Live-Vorschau',
          'Changelog-Sektion in den Einstellungen hinzugefügt',
          'Theme-Farben werden jetzt konsistent angewendet (inkl. Wetter-Karte)',
          'Hintergrundunschärfe und Unschärfe-Stärke funktionieren jetzt korrekt',
          'Kompaktmodus blendet jetzt auch Shortcuts aus',
          'Plugin-System Infrastruktur verbessert',
        ],
      },
      {
        version: '1.0.2',
        date: 'März 2026',
        changes: [
          'Neue Themes: Nord, Dracula, Catppuccin Mocha',
          'Wetter-Karte mit 7-Tage-Vorhersage',
          'Verbesserte Suchergebnisse mit Icons',
          'Tastenkürzel können jetzt angepasst werden',
          'Performance-Verbesserungen bei der Indizierung',
        ],
      },
      {
        version: '1.0.1',
        date: 'Februar 2026',
        changes: [
          'KI-Chat Integration (Gemini)',
          'Zwischenablage-Verlauf',
          'Notizen-Funktion',
          'Web-Suche Integration',
          'Automatischer Update-Check',
        ],
      },
      {
        version: '1.0.0',
        date: 'Januar 2026',
        changes: [
          'Erste Version von Windows Bar',
          'Schnelle App- und Dateisuche',
          'Befehlssystem mit /calc, /wetter, etc.',
          'Theme-Unterstützung',
          'System-Tray Integration',
        ],
      },
    ];

    return (
      <div className="settings-section">
        <h2 className="settings-title">Changelog</h2>
        <div className="settings-group changelog-container">
          {changelogs.map((entry, idx) => (
            <div key={entry.version} className={`changelog-entry ${idx === 0 ? 'latest' : ''}`}>
              <div className="changelog-header">
                <span className="changelog-version">v{entry.version}</span>
                <span className="changelog-date">{entry.date}</span>
                {idx === 0 && <span className="changelog-badge">Neueste</span>}
              </div>
              <ul className="changelog-list">
                {entry.changes.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
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
      try {
        const result = await window.electronAPI.checkForUpdates();
        setUpdateResult(result);
      } catch (e) {
        setUpdateResult({ available: false, error: 'Fehler beim Prüfen auf Updates' });
      } finally {
        setUpdateChecking(false);
      }
    };

    const handleInstallUpdate = () => {
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
            <p className="about-version">Version 1.0.3</p>
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
                  <button className="update-install-btn" onClick={handleInstallUpdate}>
                    <Download size={14} />
                    Jetzt installieren
                  </button>
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
