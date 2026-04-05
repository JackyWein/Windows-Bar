import type { Command } from '../../../types';

const clipboardCommands: readonly Command[] = [
  {
    id: 'cp',
    trigger: '/cp',
    description: 'Zwischenablage lesen/schreiben',
    category: 'clipboard',
    requiresSetting: 'features.clipboardHistory',
    async handler(args: string) {
      const text = args.trim();
      if (!text) {
        try {
          const content = await navigator.clipboard.readText();
          return {
            results: [{ id: 'cmd-cp', title: content.substring(0, 50) || '(Leer)', subtitle: 'Zwischenablage-Inhalt', type: 'system', path: content }],
          };
        } catch {
          return { results: [{ id: 'cmd-err', title: 'Zugriff verweigert', subtitle: 'Clipboard-Berechtigung erforderlich', type: 'system' }] };
        }
      }
      await navigator.clipboard.writeText(text);
      const preview = text.length > 30 ? text.substring(0, 30) : text;
      return {
        results: [{ id: 'cmd-cp-set', title: 'Kopiert!', subtitle: `"${preview}"`, type: 'system' }],
      };
    },
    enabled: true,
  },
  {
    id: 'history',
    trigger: '/history',
    description: 'Zwischenablage-Verlauf',
    category: 'clipboard',
    requiresSetting: 'features.clipboardHistory',
    handler() {
      let history: string[];
      try {
        history = JSON.parse(localStorage.getItem('windowsbar_clipboard_history') || '[]') as string[];
      } catch {
        history = [];
      }

      if (history.length === 0) {
        return { results: [{ id: 'cmd-hist', title: 'Verlauf leer', subtitle: 'Kopiere Text um ihn hier zu sehen', type: 'system' }] };
      }

      const results = history.slice(0, 10).map((text, i) => ({
        id: `hist-${i}`,
        title: text.substring(0, 50),
        subtitle: 'Klicken zum Kopieren',
        type: 'file' as const,
        path: text,
      }));
      return { results };
    },
    enabled: true,
  },
];

export default clipboardCommands;
