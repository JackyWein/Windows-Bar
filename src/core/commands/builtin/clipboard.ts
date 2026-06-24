import type { Command, SearchResult } from '../../../types';

const api = () => (window as { electronAPI: typeof window.electronAPI }).electronAPI;

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`;
  return `vor ${Math.floor(diff / 86400)} Tagen`;
}

const clipboardCommands: readonly Command[] = [
  {
    id: 'cp',
    trigger: '/cp ',
    description: 'Text kopieren / Zwischenablage lesen',
    usage: 'z.B. /cp Hallo Welt  •  /cp (leer = aktuellen Inhalt zeigen)',
    category: 'clipboard',
    requiresSetting: 'features.clipboardHistory',
    async handler(args: string) {
      const text = args.trim();
      if (!text) {
        try {
          const content = await api().readClipboard();
          const preview = content.length > 60 ? content.substring(0, 60) + '…' : content;
          return { results: [{ id: 'cmd-cp-get', title: preview || '(Leer)', subtitle: 'Aktueller Zwischenablage-Inhalt', type: 'system', path: content, copyToClipboard: content }] };
        } catch {
          return { results: [{ id: 'cmd-err', title: 'Zwischenablage nicht lesbar', subtitle: 'Fehler', type: 'system' }] };
        }
      }
      const preview = text.length > 30 ? text.substring(0, 30) + '…' : text;
      return {
        results: [{
          id: 'cmd-cp-set', title: 'Kopieren', subtitle: `"${preview}" in die Zwischenablage`, type: 'system',
          action: () => { api().writeClipboard(text); api().hideWindow(); },
        }],
      };
    },
    enabled: true,
  },
  {
    id: 'history',
    trigger: '/history',
    description: 'Zwischenablage-Verlauf anzeigen',
    aliases: ['/clip'],
    category: 'clipboard',
    requiresSetting: 'features.clipboardHistory',
    async handler() {
      let history: { type: string; value: string; ts: number }[] = [];
      try { history = await api().getClipboardHistory(); } catch { /* ignore */ }

      if (!history || history.length === 0) {
        return { results: [{ id: 'cmd-hist', title: 'Verlauf leer', subtitle: 'Kopiere etwas — es erscheint hier automatisch', type: 'system' }] };
      }

      const results: SearchResult[] = history.slice(0, 30).map((entry, i) => {
        if (entry.type === 'image') {
          return { id: `hist-${i}`, title: '🖼️ Bild', subtitle: timeAgo(entry.ts), type: 'system', iconBase64: entry.value };
        }
        const oneLine = entry.value.replace(/\s+/g, ' ').trim();
        const preview = oneLine.length > 60 ? oneLine.substring(0, 60) + '…' : oneLine;
        return { id: `hist-${i}`, title: preview || '(Leer)', subtitle: `${timeAgo(entry.ts)} • Enter zum Kopieren`, type: 'system', path: entry.value, copyToClipboard: entry.value };
      });
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
      return {
        results: [{
          id: 'cmd-clear-hist', title: 'Verlauf löschen', subtitle: 'Enter zum Leeren des Zwischenablage-Verlaufs', type: 'system',
          action: () => { api().clearClipboardHistory(); api().hideWindow(); },
        }],
      };
    },
    enabled: true,
  },
];

export default clipboardCommands;
