// ========================
// Session Store
// ========================

import type { ChatSession, ChatMessage } from './types';
import { generateId, generateSessionTitle } from './types';

const STORAGE_KEY = 'windowsbar_ai_sessions';
const MAX_SESSIONS = 50;

/**
 * Manages persistence of chat sessions in localStorage.
 */
export class SessionStore {
  private sessions: Map<string, ChatSession> = new Map();

  constructor() {
    this.load();
  }

  /** Load sessions from localStorage */
  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      for (const item of parsed) {
        if (this.isValidSession(item)) {
          this.sessions.set(item.id, item);
        }
      }

      this.pruneIfNeeded();
    } catch {
      // Corrupted data — start fresh
      this.sessions.clear();
    }
  }

  /** Persist current sessions to localStorage */
  private save(): void {
    const data = Array.from(this.sessions.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /** Remove oldest sessions if over the limit */
  private pruneIfNeeded(): void {
    if (this.sessions.size <= MAX_SESSIONS) return;

    const sorted = Array.from(this.sessions.values()).sort(
      (a, b) => a.updatedAt - b.updatedAt,
    );

    const toRemove = sorted.slice(0, sorted.length - MAX_SESSIONS);
    for (const session of toRemove) {
      this.sessions.delete(session.id);
    }
    this.save();
  }

  /** Type guard for validating session data from localStorage */
  private isValidSession(data: unknown): data is ChatSession {
    if (typeof data !== 'object' || data === null) return false;
    const s = data as Record<string, unknown>;
    return (
      typeof s.id === 'string' &&
      typeof s.title === 'string' &&
      typeof s.providerId === 'string' &&
      typeof s.modelId === 'string' &&
      Array.isArray(s.messages) &&
      typeof s.createdAt === 'number' &&
      typeof s.updatedAt === 'number'
    );
  }

  /** Get all sessions sorted by updatedAt (newest first) */
  getAll(): readonly ChatSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }

  /** Get a session by ID */
  getById(id: string): ChatSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Create a new session. If the first message is provided, use it to generate the title.
   */
  create(
    providerId: string,
    modelId: string,
    firstMessage?: string,
  ): ChatSession {
    const now = Date.now();
    const session: ChatSession = {
      id: generateId(),
      title: firstMessage ? generateSessionTitle(firstMessage) : 'New Chat',
      providerId,
      modelId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    this.pruneIfNeeded();
    return session;
  }

  /** Add a message to a session and update its timestamp */
  addMessage(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const updatedMessages = [...session.messages, message];
    const updated: ChatSession = {
      ...session,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };

    // Auto-update title from first user message
    if (
      message.role === 'user' &&
      session.messages.filter((m) => m.role === 'user').length === 0
    ) {
      updated.title = generateSessionTitle(message.content);
    }

    this.sessions.set(sessionId, updated);
    this.save();
  }

  /** Update the messages array for a session (full replace) */
  updateMessages(sessionId: string, messages: readonly ChatMessage[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const updated: ChatSession = {
      ...session,
      messages: [...messages],
      updatedAt: Date.now(),
    };
    this.sessions.set(sessionId, updated);
    this.save();
  }

  /** Delete a session */
  delete(sessionId: string): boolean {
    const removed = this.sessions.delete(sessionId);
    if (removed) this.save();
    return removed;
  }

  /** Clear all sessions */
  clearAll(): void {
    this.sessions.clear();
    localStorage.removeItem(STORAGE_KEY);
  }
}

/** Singleton session store */
export const sessionStore = new SessionStore();
