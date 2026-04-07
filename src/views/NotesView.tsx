import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Search, FileText, Save, Trash2, Copy, Check, Clock } from 'lucide-react';
import type { AppSettings } from '../types';
import { loadNotes, saveNotes, type StoredNote } from '../core/notes';
import '../styles/notes.css';

interface NotesViewProps {
  settings: AppSettings;
  onBack: () => void;
  initialNoteId?: number | null;
}

export function NotesView({ onBack, initialNoteId }: NotesViewProps) {
  const api = (window as any).electronAPI;
  const [notes, setNotes] = useState<StoredNote[]>(() => loadNotes(api));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [currentText, setCurrentText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => n.text.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  const selectedNote = useMemo(() => {
    return notes.find(n => n.id === selectedId) || null;
  }, [notes, selectedId]);

  const handleSelectNote = useCallback((id: number) => {
    const found = notes.find(n => n.id === id);
    if (found) {
      setSelectedId(found.id);
      setCurrentText(found.text);
      setIsSaved(true);
      setIsEditing(false);
    }
  }, [notes]);

  const handleNewNote = useCallback(() => {
    setSelectedId(null);
    setCurrentText('');
    setIsSaved(false);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    if (initialNoteId) {
      const found = notes.find(n => n.id === initialNoteId);
      if (found) {
        setSelectedId(found.id);
        setCurrentText(found.text);
        setIsSaved(true);
        setIsEditing(false);
      }
    } else if (notes.length > 0) {
      setSelectedId(notes[0].id);
      setCurrentText(notes[0].text);
      setIsSaved(true);
    } else {
      setSelectedId(null);
      setCurrentText('');
    }
  }, [initialNoteId, notes]);

  const handleSave = useCallback(() => {
    if (!currentText.trim()) return;

    const now = Date.now();
    setNotes(prev => {
      let updated: StoredNote[];

      if (selectedId) {
        updated = prev.map(n =>
          n.id === selectedId ? { ...n, text: currentText, updated: now } : n
        );
        const idx = updated.findIndex(n => n.id === selectedId);
        if (idx > 0) {
          const item = updated.splice(idx, 1)[0];
          updated.unshift(item);
        }
      } else {
        const newNote: StoredNote = { id: now, text: currentText, created: now, updated: now };
        updated = [newNote, ...prev];
        setSelectedId(now);
      }

      saveNotes(updated, api);
      return updated;
    });

    setIsSaved(true);
    setIsEditing(false);
    setTimeout(() => setIsSaved(false), 2000);
  }, [currentText, selectedId, api]);

  const handleDelete = useCallback((id: number) => {
    setNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      saveNotes(updated, api);
      if (id === selectedId) {
        if (updated.length > 0) {
          setSelectedId(updated[0].id);
          setCurrentText(updated[0].text);
          setIsSaved(true);
        } else {
          setSelectedId(null);
          setCurrentText('');
          setIsSaved(false);
        }
      }
      return updated;
    });
  }, [selectedId, api]);

  const handleCopy = useCallback(() => {
    if (currentText) {
      api?.writeClipboard(currentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [currentText, api]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentText(e.target.value);
    setIsSaved(false);
    setIsEditing(true);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleSave, onBack]);

  const getNotePreview = (text: string): string => {
    const firstLine = text.split('\n')[0] || '';
    return firstLine.length > 45 ? firstLine.substring(0, 45) + '...' : firstLine;
  };

  const getNoteDate = (note: StoredNote): string => {
    const date = new Date(note.updated || note.created);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `Vor ${diffMins} Min.`;
    if (diffHours < 24) return `Vor ${diffHours} Std.`;
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE');
  };

  return (
    <div className="app-container">
      <div className="search-glass notes-view">
        <div className="notes-header">
          <button className="notes-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Zurück</span>
          </button>
          <div className="notes-header-center">
            <span className="notes-title">Notizen</span>
            <span className="notes-count">{notes.length} gespeichert</span>
          </div>
          <button className="notes-new-btn" onClick={handleNewNote}>
            <Plus size={14} />
            <span>Neue Notiz</span>
          </button>
        </div>

        <div className="notes-container">
          <div className="notes-sidebar">
            <div className="notes-search-wrapper">
              <Search size={14} className="notes-search-icon" />
              <input
                ref={searchRef}
                type="text"
                className="notes-search-input"
                placeholder="Notizen durchsuchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="notes-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  ×
                </button>
              )}
            </div>

            <div className="notes-list">
              {filteredNotes.length === 0 ? (
                <div className="notes-empty-sidebar">
                  <FileText size={32} />
                  <span>{searchQuery ? 'Keine Treffer' : 'Keine Notizen'}</span>
                  {!searchQuery && (
                    <button className="notes-empty-new-btn" onClick={handleNewNote}>
                      <Plus size={14} />
                      Erste Notiz erstellen
                    </button>
                  )}
                </div>
              ) : (
                filteredNotes.map((note, index) => (
                  <div
                    key={note.id}
                    className={`notes-list-item ${selectedId === note.id ? 'active' : ''}`}
                    onClick={() => handleSelectNote(note.id)}
                    style={{
                      animationDelay: `${index * 30}ms`,
                    }}
                  >
                    <div className="notes-list-item-accent" />
                    <div className="notes-list-item-content">
                      <div className="notes-list-item-title">
                        {getNotePreview(note.text) || 'Neue Notiz'}
                      </div>
                      <div className="notes-list-item-meta">
                        <Clock size={10} />
                        <span>{getNoteDate(note)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="notes-editor">
            {isEditing || selectedNote ? (
              <>
                <div className="notes-editor-header">
                  <div className="notes-editor-status">
                    {isSaved ? (
                      <span className="notes-status-saved">
                        <Check size={12} />
                        Gespeichert
                      </span>
                    ) : (
                      <span className="notes-status-unsaved">
                        Ungespeicherte Änderungen
                      </span>
                    )}
                  </div>
                  <div className="notes-editor-actions">
                    <button
                      className="notes-action-btn"
                      onClick={handleCopy}
                      title="In Zwischenablage kopieren"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
                    </button>
                    {selectedId && (
                      <button
                        className="notes-action-btn notes-action-danger"
                        onClick={() => handleDelete(selectedId)}
                        title="Notiz löschen"
                      >
                        <Trash2 size={14} />
                        <span>Löschen</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="notes-editor-body">
                  <textarea
                    ref={textareaRef}
                    value={currentText}
                    onChange={handleTextChange}
                    placeholder="Schreibe deine Notiz hier..."
                    className="notes-textarea"
                  />
                </div>

                <div className="notes-editor-footer">
                  <div className="notes-editor-info">
                    <span className="notes-char-count">
                      {currentText.length} Zeichen
                    </span>
                    <span className="notes-line-count">
                      {currentText.split('\n').length} Zeilen
                    </span>
                  </div>
                  <button
                    className="notes-save-btn"
                    onClick={handleSave}
                    disabled={isSaved && !isEditing}
                  >
                    <Save size={14} />
                    Speichern
                  </button>
                </div>
              </>
            ) : (
              <div className="notes-empty-editor">
                <FileText size={48} />
                <h3>Wähle eine Notiz aus</h3>
                <p>Oder erstelle eine neue Notiz</p>
                <button className="notes-empty-editor-btn" onClick={handleNewNote}>
                  <Plus size={16} />
                  Neue Notiz erstellen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
