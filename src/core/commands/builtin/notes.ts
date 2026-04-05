import type { Command } from '../../../types';

interface StoredNote {
  id: number;
  text: string;
  created: number;
}

function loadNotes(): StoredNote[] {
  try {
    return JSON.parse(localStorage.getItem('windowsbar_notes') || '[]') as StoredNote[];
  } catch {
    return [];
  }
}

const notesCommands: readonly Command[] = [
  {
    id: 'note',
    trigger: '/note ',
    description: 'Notiz speichern',
    usage: 'z.B. /note Milch kaufen  •  /note TODO: Projekt abschließen',
    category: 'notes',
    requiresSetting: 'features.notesEnabled',
    handler(args: string) {
      const text = args.trim();
      if (!text) {
        return { results: [{ id: 'cmd-err', title: 'Leere Notiz', subtitle: '/note Text um eine zu erstellen', type: 'system' }] };
      }
      const notes = loadNotes();
      notes.unshift({ id: Date.now(), text, created: Date.now() });
      localStorage.setItem('windowsbar_notes', JSON.stringify(notes.slice(0, 50)));
      return {
        results: [{ id: 'cmd-note', title: 'Notiz gespeichert', subtitle: text.substring(0, 50), type: 'system' }],
      };
    },
    enabled: true,
  },
  {
    id: 'notes',
    trigger: '/notes',
    description: 'Gespeicherte Notizen anzeigen',
    category: 'notes',
    requiresSetting: 'features.notesEnabled',
    handler() {
      const notes = loadNotes();
      if (notes.length === 0) {
        return { results: [{ id: 'cmd-notes', title: 'Keine Notizen', subtitle: '/note Text um eine zu erstellen', type: 'system' }] };
      }
      const results = notes.slice(0, 10).map((n, i) => ({
        id: `note-${i}`,
        title: n.text.substring(0, 50),
        subtitle: new Date(n.created).toLocaleString('de-DE'),
        type: 'file' as const,
        path: n.text,
      }));
      return { results };
    },
    enabled: true,
  },
  {
    id: 'clear-notes',
    trigger: '/clear-notes',
    description: 'Alle Notizen löschen',
    category: 'notes',
    requiresSetting: 'features.notesEnabled',
    handler() {
      localStorage.removeItem('windowsbar_notes');
      return {
        results: [{ id: 'cmd-clear', title: 'Notizen gelöscht', subtitle: 'Alle Notizen entfernt', type: 'system' }],
      };
    },
    enabled: true,
  },
];

export default notesCommands;
