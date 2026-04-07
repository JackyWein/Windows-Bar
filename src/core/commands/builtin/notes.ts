import type { Command, CommandContext } from '../../../types';

interface StoredNote {
  id: number;
  text: string;
  created: number;
}

function loadNotes(api?: typeof window.electronAPI): StoredNote[] {
  let saved: string | null = null;
  try {
    if (api?.readDataSync) {
      saved = api.readDataSync("windowsbar_notes");
    }
  } catch {
    /* ignore */
  }

  if (!saved) {
    saved = localStorage.getItem('windowsbar_notes');
  }

  if (saved) {
    try {
      return JSON.parse(saved) as StoredNote[];
    } catch {
      return [];
    }
  }
  return [];
}

function saveNotes(notes: StoredNote[], api?: typeof window.electronAPI) {
  const json = JSON.stringify(notes.slice(0, 50));
  localStorage.setItem('windowsbar_notes', json);
  try {
    if (api?.writeData) {
      api.writeData("windowsbar_notes", json);
    }
  } catch {
    /* ignore */
  }
}

const notesCommands: readonly Command[] = [
  {
    id: 'note',
    trigger: '/note ',
    description: 'Schnellnotiz speichern',
    usage: 'z.B. /note Einkaufen: Milch, Brot',
    category: 'notes',
    requiresSetting: 'features.notesEnabled',
    handler(args: string, ctx: CommandContext) {
      const text = args.trim();
      if (!text) {
        return { results: [{ id: 'cmd-err', title: 'Leere Notiz', subtitle: '/note Text um eine zu erstellen', type: 'system' }] };
      }
      return {
        results: [{
          id: 'cmd-note-preview',
          title: `Notiz speichern: ${text.substring(0, 50)}`,
          subtitle: 'Enter drücken zum Speichern',
          type: 'system',
          action: () => {
            const notes = loadNotes(ctx.api);
            notes.unshift({ id: Date.now(), text, created: Date.now() });
            saveNotes(notes, ctx.api);
            // Optionally clear the query so the search is reset
            ctx.showResults([{ id: 'cmd-note-saved', title: 'Notiz gespeichert!', subtitle: text.substring(0, 50), type: 'system' }]);
            setTimeout(() => {
              ctx.api.hideWindow();
            }, 800);
          }
        }],
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
    handler(_args: string, ctx: CommandContext) {
      const notes = loadNotes(ctx.api);
      if (notes.length === 0) {
        return { results: [{ id: 'cmd-notes', title: 'Keine Notizen', subtitle: '/note Text um eine zu erstellen', type: 'system' }] };
      }
      const results = notes.slice(0, 10).map((note, i) => ({
        id: `note-${i}`,
        title: note.text.length > 50 ? note.text.substring(0, 50) + '...' : note.text,
        subtitle: new Date(note.created).toLocaleString('de-DE'),
        type: 'system' as const,
        path: note.text, // Path is used to copy to clipboard in SearchView if we set copyToClipboard
        copyToClipboard: note.text,
        action: () => {
          if (ctx.openNote) {
            ctx.openNote(note.id);
          } else {
            ctx.api.writeClipboard(note.text);
            ctx.api.hideWindow();
          }
        }
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
    handler(_args: string, ctx: CommandContext) {
      return {
        results: [{
          id: 'cmd-clear',
          title: 'Notizen löschen',
          subtitle: 'Enter drücken um alle Notizen zu entfernen',
          type: 'system',
          action: () => {
            localStorage.removeItem('windowsbar_notes');
            try {
              if (ctx.api?.writeData) {
                ctx.api.writeData("windowsbar_notes", "[]");
              }
            } catch { /* ignore */ }
            ctx.showResults([{ id: 'cmd-clear-done', title: 'Notizen gelöscht', subtitle: 'Alle Notizen wurden entfernt', type: 'system' }]);
            setTimeout(() => {
              ctx.api.hideWindow();
            }, 800);
          }
        }],
      };
    },
    enabled: true,
  },
];

export default notesCommands;