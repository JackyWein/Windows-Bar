import type { Command } from '../../../types';

const CLIPBOARD_HISTORY_KEY = 'windowsbar_clipboard_history';

function loadClipboardHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLIPBOARD_HISTORY_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function saveClipboardHistory(history: string[]): void {
  localStorage.setItem(CLIPBOARD_HISTORY_KEY, JSON.stringify(history.slice(0, 15)));
}

const clipboardCommands: readonly Command[] = [
  {
    id: 'cp',
    trigger: '/cp ',
    description: 'Text in Zwischenablage kopieren',
    usage: 'z.B. /cp Hallo Welt',
    category: 'clipboard',
    requiresSetting: 'features.clipboardHistory',
    async handler(args: string) {
      const text = args.trim();
      if (!text) {
        // Read from clipboard
        try {
          const content = await navigator.clipboard.readText();
          const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
          return {
            results: [{ id: 'cmd-cp-get', title: preview || '(Leer)', subtitle: 'Zwischenablage-Inhalt', type: 'system', path: content }],
          };
        } catch {
          return { results: [{ id: 'cmd-err', title: 'Zugriff verweigert', subtitle: 'Clipboard-Berechtigung erforderlich', type: 'system' }] };
        }
      }
      // Write to clipboard
      try {
        await navigator.clipboard.writeText(text);
        // Also save to history
        const history = loadClipboardHistory();
        const filtered = history.filter(item => item !== text);
        saveClipboardHistory([text, ...filtered]);
        const preview = text.length > 30 ? text.substring(0, 30) + '...' : text;
        return {
          results: [{ id: 'cmd-cp-set', title: 'Kopiert!', subtitle: `"${preview}"`, type: 'system' }],
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Fehler beim Kopieren', subtitle: 'Zwischenablage nicht verfügbar', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'history',
    trigger: '/history',
    description: 'Zwischenablage-Verlauf anzeigen',
    category: 'clipboard',
    requiresSetting: 'features.clipboardHistory',
    handler() {
      const history = loadClipboardHistory();

      if (history.length === 0) {
        return { results: [{ id: 'cmd-hist', title: 'Verlauf leer', subtitle: 'Kopiere Text mit /cp Text', type: 'system' }] };
      }

      const results = history.map((text, i) => ({
        id: `hist-${i}`,
        title: text.length > 50 ? text.substring(0, 50) + '...' : text,
        subtitle: 'Klicken zum Kopieren',
        type: 'system' as const,
        path: text,
        copyToClipboard: text,
      }));
      return { results };
    },
    enabled: true,
  },
  {
    id: 'clear-history',
    trigger: '/clear-history',
    description: 'Zwischenablage-Verlauf löschen',
    category: 'clipboard',
    requiresSetting: 'features.clipboardHistory',
    handler() {
      localStorage.removeItem(CLIPBOARD_HISTORY_KEY);
      return {
        results: [{ id: 'cmd-clear-hist', title: 'Verlauf gelöscht', subtitle: 'Zwischenablage-Verlauf wurde geleert', type: 'system' }],
      };
    },
    enabled: true,
  },
];

export default clipboardCommands;