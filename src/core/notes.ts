export interface StoredNote {
  id: number;
  text: string;
  created: number;
  updated?: number;
}

export function loadNotes(api?: typeof window.electronAPI): StoredNote[] {
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

export function saveNotes(notes: StoredNote[], api?: typeof window.electronAPI) {
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
