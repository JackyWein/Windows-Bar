import type { ShortcutDefinition } from '../../types';

export const defaultShortcuts: readonly ShortcutDefinition[] = [
  {
    id: 'toggle-window',
    name: 'Fenster öffnen/schließen',
    description: 'Windows Bar ein-/ausblenden',
    defaultBinding: 'Alt+Space',
    category: 'global',
  },
  {
    id: 'navigate-up',
    name: 'Nach oben',
    description: 'Ein Ergebnis nach oben',
    defaultBinding: 'ArrowUp',
    category: 'results',
  },
  {
    id: 'navigate-down',
    name: 'Nach unten',
    description: 'Ein Ergebnis nach unten',
    defaultBinding: 'ArrowDown',
    category: 'results',
  },
  {
    id: 'execute',
    name: 'Ausführen',
    description: 'Ausgewähltes Element öffnen',
    defaultBinding: 'Enter',
    category: 'results',
  },
  {
    id: 'next-focus',
    name: 'Nächste Zone',
    description: 'Zum nächsten Fokusbereich wechseln',
    defaultBinding: 'Tab',
    category: 'navigation',
  },
  {
    id: 'prev-focus',
    name: 'Vorherige Zone',
    description: 'Zum vorherigen Fokusbereich wechseln',
    defaultBinding: 'Shift+Tab',
    category: 'navigation',
  },
  {
    id: 'escape',
    name: 'Schließen/Zurück',
    description: 'Fenster schließen oder zurückgehen',
    defaultBinding: 'Escape',
    category: 'global',
  },
  {
    id: 'ai-chat',
    name: 'KI-Chat öffnen',
    description: 'Gemini CLI starten',
    defaultBinding: 'Ctrl+I',
    category: 'global',
  },
  {
    id: 'settings',
    name: 'Einstellungen',
    description: 'Einstellungen öffnen',
    defaultBinding: 'Ctrl+,',
    category: 'global',
  },
  {
    id: 'web-toggle',
    name: 'Web-Ergebnisse',
    description: 'Web-Vorschläge ein-/ausblenden',
    defaultBinding: 'Ctrl+Tab',
    category: 'search',
  },
] as const;
