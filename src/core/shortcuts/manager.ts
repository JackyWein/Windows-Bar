import type { ShortcutDefinition } from '../../types';
import { defaultShortcuts } from './defaults';

const MODIFIER_KEYS = new Set(['ctrl', 'shift', 'alt', 'meta']);

const SPECIAL_KEY_MAP: Readonly<Record<string, string>> = {
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  enter: 'Enter',
  escape: 'Escape',
  tab: 'Tab',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  f1: 'F1',
  f2: 'F2',
  f3: 'F3',
  f4: 'F4',
  f5: 'F5',
  f6: 'F6',
  f7: 'F7',
  f8: 'F8',
  f9: 'F9',
  f10: 'F10',
  f11: 'F11',
  f12: 'F12',
};

const PRETTY_MODIFIER_MAP: Readonly<Record<string, string>> = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  meta: 'Meta',
};

interface ParsedBinding {
  readonly modifiers: ReadonlySet<string>;
  readonly key: string;
}

function normalizePart(part: string): string {
  const lower = part.trim().toLowerCase();
  return SPECIAL_KEY_MAP[lower] ?? lower;
}

function parseBinding(binding: string): ParsedBinding {
  const parts = binding.split('+');
  const modifiers = new Set<string>();
  const keys: string[] = [];

  for (const part of parts) {
    const normalized = normalizePart(part);
    if (MODIFIER_KEYS.has(normalized.toLowerCase())) {
      modifiers.add(normalized.toLowerCase());
    } else {
      keys.push(normalized);
    }
  }

  // If only modifiers were provided (no key), treat last modifier as key
  const key = keys.length > 0 ? keys[0] : '';

  return { modifiers, key };
}

function isSingleLetterKey(key: string): boolean {
  return key.length === 1 && /[a-zA-Z]/.test(key);
}

export class ShortcutManager {
  private readonly definitions: ReadonlyMap<string, ShortcutDefinition>;
  private readonly userBindings: Map<string, string>;

  constructor(userBindings: Record<string, string>) {
    const definitionMap = new Map<string, ShortcutDefinition>();
    for (const def of defaultShortcuts) {
      definitionMap.set(def.id, def);
    }
    this.definitions = definitionMap;

    this.userBindings = new Map<string, string>();
    for (const [id, binding] of Object.entries(userBindings)) {
      if (id !== undefined && binding !== undefined && definitionMap.has(id)) {
        this.userBindings.set(id, binding);
      }
    }
  }

  getBinding(shortcutId: string): string {
    const userBinding = this.userBindings.get(shortcutId);
    if (userBinding !== undefined) {
      return userBinding;
    }
    const definition = this.definitions.get(shortcutId);
    return definition?.defaultBinding ?? '';
  }

  getAllBindings(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [id] of this.definitions) {
      result[id] = this.getBinding(id);
    }
    return result;
  }

  updateBinding(shortcutId: string, binding: string): void {
    if (!this.definitions.has(shortcutId)) {
      return;
    }
    this.userBindings.set(shortcutId, binding);
  }

  resetToDefault(shortcutId: string): void {
    this.userBindings.delete(shortcutId);
  }

  resetAll(): void {
    this.userBindings.clear();
  }

  matchesShortcut(e: KeyboardEvent, shortcutId: string): boolean {
    const binding = this.getBinding(shortcutId);
    if (binding === '') {
      return false;
    }

    const parsed = parseBinding(binding);

    const ctrlMatch = parsed.modifiers.has('ctrl') === e.ctrlKey;
    const shiftMatch = parsed.modifiers.has('shift') === e.shiftKey;
    const altMatch = parsed.modifiers.has('alt') === e.altKey;
    const metaMatch = parsed.modifiers.has('meta') === e.metaKey;

    if (!ctrlMatch || !shiftMatch || !altMatch || !metaMatch) {
      return false;
    }

    const eventKey = e.key;

    // Match single letter keys case-insensitively (Ctrl+i or Ctrl+I)
    if (isSingleLetterKey(parsed.key)) {
      return eventKey.toLowerCase() === parsed.key.toLowerCase();
    }

    // Match special keys exactly
    return eventKey === parsed.key;
  }

  formatBinding(binding: string): string {
    const parts = binding.split('+');
    const formatted: string[] = [];

    for (const part of parts) {
      const normalized = normalizePart(part);
      const pretty = PRETTY_MODIFIER_MAP[normalized.toLowerCase()] ?? normalized;
      formatted.push(pretty);
    }

    return formatted.join(' + ');
  }

  findConflicts(binding: string, excludeId?: string): string[] {
    const conflicts: string[] = [];
    const normalizedInput = normalizeBindingString(binding);

    for (const [id] of this.definitions) {
      if (excludeId !== undefined && id === excludeId) {
        continue;
      }

      const existing = this.getBinding(id);
      const normalizedExisting = normalizeBindingString(existing);

      if (normalizedExisting === normalizedInput) {
        conflicts.push(id);
      }
    }

    return conflicts;
  }

  getDefinition(shortcutId: string): ShortcutDefinition | undefined {
    return this.definitions.get(shortcutId);
  }

  getDefinitionsByCategory(category: string): readonly ShortcutDefinition[] {
    const filtered: ShortcutDefinition[] = [];
    for (const def of this.definitions.values()) {
      if (def.category === category) {
        filtered.push(def);
      }
    }
    return filtered;
  }
}

function normalizeBindingString(binding: string): string {
  const parts = binding.toLowerCase().split('+').map((p) => p.trim());
  const modifiers: string[] = [];
  const keys: string[] = [];

  for (const part of parts) {
    if (MODIFIER_KEYS.has(part)) {
      modifiers.push(part);
    } else {
      keys.push(normalizePart(part).toLowerCase());
    }
  }

  // Sort modifiers consistently
  modifiers.sort();
  return [...modifiers, ...keys].join('+');
}

export const shortcutManager = new ShortcutManager({});
