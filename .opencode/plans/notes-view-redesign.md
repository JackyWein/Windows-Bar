# NotesView Redesign Plan

## Overview
Complete rebuild of `src/views/NotesView.tsx` with modern card-based design, proper accent color usage, and dedicated CSS file.

## Files to Change

### 1. `src/views/NotesView.tsx` - Complete Rewrite

**New Structure:**
- Uses `.search-glass.notes-view` container (consistent with SettingsView/AiView)
- Two-panel layout: sidebar (note list) + editor area
- Search bar in sidebar for filtering notes
- Status indicators (saved/unsaved) with visual feedback
- Copy to clipboard button
- Character/line count in footer
- Relative timestamps ("Vor 5 Min.", "Vor 2 Std.", etc.)

**Key Features:**
- Note search/filter functionality
- Visual accent color bar on selected note items
- Save status indicator with checkmark animation
- Copy note content to clipboard
- Delete confirmation via existing notes list
- Keyboard shortcuts: Ctrl+S (save), Escape (back)
- Read-only mode when not editing
- Empty states with call-to-action buttons

### 2. `src/styles/notes.css` - New File

**CSS Classes:**
- `.notes-view` - Container sizing (850x700 like settings)
- `.notes-header` - Top bar with back, title, new button
- `.notes-container` - Flex layout for sidebar + editor
- `.notes-sidebar` - Left panel with search + list
- `.notes-search-wrapper` - Search input with icon
- `.notes-list` - Scrollable note list
- `.notes-list-item` - Individual note card with accent bar
- `.notes-list-item.active` - Selected state with accent color
- `.notes-list-item-accent` - Colored left border strip
- `.notes-editor` - Right panel editor area
- `.notes-editor-header` - Status + action buttons
- `.notes-editor-body` - Textarea container
- `.notes-textarea` - Main editing area
- `.notes-editor-footer` - Save button + info
- `.notes-save-btn` - Accent-colored save button
- `.notes-empty-sidebar` / `.notes-empty-editor` - Empty states

**Accent Color Usage:**
- Selected note item border and background
- Save button background
- Search input focus border
- New note button
- Status saved indicator color
- Empty state button

### 3. No changes needed to:
- `src/core/notes.ts` - Data layer stays the same
- `src/core/commands/builtin/notes.ts` - Commands stay the same
- `src/App.tsx` - Integration stays the same

## Design Details

### Layout
```
┌────────────────────────────────────────────────┐
│ ← Zurück    Notizen (12)    [+ Neue Notiz]     │  Header
├───────────────────┬────────────────────────────┤
│ 🔍 Suche          │ ✓ Gespeichert    [📋][🗑️]  │
│ ┌───────────────┐ │ ┌────────────────────────┐ │
│ │▌Notiz 1       │ │ │                        │ │
│ │ Vor 5 Min.    │ │ │   Textarea             │ │
│ ├───────────────┤ │ │                        │ │
│ │ Notiz 2       │ │ │                        │ │
│ │ Vor 1 Std.    │ │ └────────────────────────┘ │
│ ├───────────────┤ │ 123 Zeichen | 5 Zeilen     │
│ │ Notiz 3       │ │              [💾 Speichern]│
│ └───────────────┘ └────────────────────────────┤
└────────────────────────────────────────────────┘
```

### Color Scheme (using existing CSS variables)
- Selected note: `background: var(--item-selected)`, `border-left: 3px solid var(--accent)`
- Save button: `background: var(--accent)`, `color: #fff`
- Saved status: `color: var(--accent)`
- Unsaved status: `color: var(--orange)` or `var(--text-muted)`
- Delete button: hover with red tint
- Search focus: `border-color: var(--accent)`

## Implementation Steps

1. Write new `src/views/NotesView.tsx` content
2. Create new `src/styles/notes.css` file  
3. Verify TypeScript compilation with `npx tsc --noEmit`
4. Test the notes view opens correctly from search
