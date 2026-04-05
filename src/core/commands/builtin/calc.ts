import type { Command } from '../../../types';

/** Parse EU (DD.MM.YYYY), US (MM/DD/YYYY), or ISO (YYYY-MM-DD) date strings */
function parseFlexibleDate(input: string): Date | null {
  const s = input.trim();

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const d = new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // Dotted: DD.MM.YYYY (EU format — dots are exclusively EU)
  const eu = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (eu) {
    const d = new Date(parseInt(eu[3]), parseInt(eu[2]) - 1, parseInt(eu[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Slashed: MM/DD/YYYY (US format) or DD/MM/YYYY
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const first = parseInt(slash[1]);
    const second = parseInt(slash[2]);
    // If first > 12 it can't be a month → treat as DD/MM/YYYY (EU)
    if (first > 12) {
      const d = new Date(parseInt(slash[3]), second - 1, first);
      if (!isNaN(d.getTime())) return d;
    }
    // If second > 12 it can't be a month → treat as MM/DD/YYYY (US)
    if (second > 12) {
      const d = new Date(parseInt(slash[3]), first - 1, second);
      if (!isNaN(d.getTime())) return d;
    }
    // Ambiguous (e.g. 03/05/2024) — default to EU (DD/MM/YYYY) since app is German
    const d = new Date(parseInt(slash[3]), second - 1, first);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback: let JS parse
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

const calcCommands: readonly Command[] = [
  {
    id: 'calc',
    trigger: '/calc ',
    description: 'Mathematische Ausdrücke berechnen',
    usage: 'z.B. /calc 2+3*4  •  /calc (10+5)/3  •  /calc 15%4',
    category: 'calc',
    handler(args: string) {
      try {
        const expr = args.trim();
        if (/^[0-9+\-*/().%\s]+$/.test(expr)) {
          const result = new Function(`return (${expr})`)();
          if (result !== undefined && !isNaN(result)) {
            return {
              results: [{ id: 'cmd-calc', title: String(result), subtitle: `Ergebnis von ${expr}`, type: 'calc' }],
            };
          }
        }
      } catch { /* ignore */ }
      return { results: [{ id: 'cmd-err', title: 'Ungültiger Ausdruck', subtitle: 'z.B. /calc 2+3*4', type: 'system' }] };
    },
    enabled: true,
  },
  {
    id: 'uuid',
    trigger: '/uuid',
    description: 'Zufällige UUID v4 generieren',
    category: 'calc',
    handler() {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
      return {
        results: [{ id: 'cmd-uuid', title: uuid, subtitle: 'UUID v4 \u2022 Enter zum Kopieren', type: 'calc', path: uuid }],
        copyToClipboard: uuid,
      };
    },
    enabled: true,
  },
  {
    id: 'now',
    trigger: '/now',
    description: 'Aktuelles Datum & Uhrzeit anzeigen',
    category: 'calc',
    handler() {
      const now = new Date();
      return {
        results: [{ id: 'cmd-now', title: now.toLocaleString('de-DE'), subtitle: `Unix: ${Math.floor(now.getTime() / 1000)}`, type: 'calc' }],
      };
    },
    enabled: true,
    aliases: ['/ts'],
  },
  {
    id: 'ts',
    trigger: '/ts',
    description: 'Aktuellen Unix-Zeitstempel anzeigen',
    category: 'calc',
    handler() {
      const now = new Date();
      return {
        results: [{ id: 'cmd-now', title: now.toLocaleString('de-DE'), subtitle: `Unix: ${Math.floor(now.getTime() / 1000)}`, type: 'calc' }],
      };
    },
    enabled: true,
  },
  {
    id: 'random',
    trigger: '/random',
    description: 'Zufallszahl generieren',
    usage: '/random 100  •  /random 1-50  •  /random  (1–100)',
    category: 'calc',
    handler(args: string) {
      const match = args.match(/^\s*(\d+)?(-(\d+))?/);
      if (match) {
        const min = match[3] ? parseInt(match[1]) : 1;
        const max = match[3] ? parseInt(match[3]) : (match[1] ? parseInt(match[1]) : 100);
        const result = Math.floor(Math.random() * (max - min + 1)) + min;
        return {
          results: [{ id: 'cmd-random', title: String(result), subtitle: `Zufallszahl zwischen ${min} und ${max}`, type: 'calc' }],
        };
      }
      return { results: [{ id: 'cmd-err', title: 'Ungültige Eingabe', subtitle: '/random [min]-[max] oder /random [max]', type: 'system' }] };
    },
    enabled: true,
  },
  {
    id: 'pass',
    trigger: '/pass',
    description: 'Sicheres Passwort generieren',
    usage: '/pass  •  /pass 32  (Standard: 16 Zeichen)',
    category: 'calc',
    handler(args: string) {
      const match = args.match(/^\s*(\d*)/);
      const len = match && match[1] ? parseInt(match[1]) : 16;
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      const arr = new Uint32Array(len);
      crypto.getRandomValues(arr);
      const password = Array.from(arr, x => chars[x % chars.length]).join('');
      return {
        results: [{ id: 'cmd-pass', title: password, subtitle: `Passwort (${len} Zeichen) \u2022 Enter zum Kopieren`, type: 'calc', path: password }],
        copyToClipboard: password,
      };
    },
    enabled: true,
  },
  {
    id: 'hash',
    trigger: '/hash ',
    description: 'SHA-256 Hash erstellen',
    usage: 'z.B. /hash hallo welt',
    category: 'calc',
    async handler(args: string) {
      const text = args.trim();
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(text));
      const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      return {
        results: [{ id: 'cmd-hash', title: hash.substring(0, 32) + '...', subtitle: `SHA-256 von "${text}" \u2022 Enter zum Kopieren`, type: 'calc', path: hash }],
        copyToClipboard: hash,
      };
    },
    enabled: true,
  },
  {
    id: 'color',
    trigger: '/color ',
    description: 'Farbe anzeigen',
    usage: 'z.B. /color #ff6600  •  /color red',
    category: 'calc',
    handler(args: string) {
      const color = args.trim().toUpperCase();
      return {
        results: [{ id: 'cmd-color', title: color, subtitle: 'Farbe \u2022 Enter zum Kopieren', type: 'calc', path: color }],
        copyToClipboard: color,
      };
    },
    enabled: true,
  },
  {
    id: 'lorem',
    trigger: '/lorem',
    description: 'Lorem Ipsum Text generieren',
    usage: '/lorem  •  /lorem 100  (Standard: 50 Wörter)',
    category: 'calc',
    handler(args: string) {
      const words = parseInt(args.trim()) || 50;
      const lorem = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
      const text = Array.from({ length: Math.min(words, 100) }, () => lorem[Math.floor(Math.random() * lorem.length)]).join(' ');
      return {
        results: [{ id: 'cmd-lorem', title: text.substring(0, 50) + '...', subtitle: `${words} Wörter Lorem Ipsum`, type: 'calc', path: text }],
        copyToClipboard: text,
      };
    },
    enabled: true,
  },
  {
    id: 'bin',
    trigger: '/bin ',
    description: 'Text zu Binär konvertieren',
    usage: 'z.B. /bin Hallo',
    category: 'calc',
    handler(args: string) {
      const text = args.trim();
      const binary = text.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
      return {
        results: [{ id: 'cmd-bin', title: binary.substring(0, 40) + '...', subtitle: 'Binär \u2022 Enter zum Kopieren', type: 'calc', path: binary }],
        copyToClipboard: binary,
      };
    },
    enabled: true,
  },
  {
    id: 'hex',
    trigger: '/hex ',
    description: 'Text zu Hexadezimal konvertieren',
    usage: 'z.B. /hex ABC',
    category: 'calc',
    handler(args: string) {
      const text = args.trim();
      const hex = text.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
      return {
        results: [{ id: 'cmd-hex', title: hex, subtitle: 'Hexadezimal \u2022 Enter zum Kopieren', type: 'calc', path: hex }],
        copyToClipboard: hex,
      };
    },
    enabled: true,
  },
  {
    id: 'age',
    trigger: '/age ',
    description: 'Alter berechnen',
    usage: 'z.B. /age 11.11.2004  •  /age 2004-11-11  •  /age 11/11/2004',
    category: 'calc',
    handler(args: string) {
      const date = parseFlexibleDate(args);
      if (date) {
        const now = new Date();
        let age = now.getFullYear() - date.getFullYear();
        const m = now.getMonth() - date.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--;
        const totalDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
        return {
          results: [{ id: 'cmd-age', title: `${age} Jahre`, subtitle: `${totalDays.toLocaleString('de-DE')} Tage \u2022 ${date.toLocaleDateString('de-DE')}`, type: 'calc' }],
        };
      }
      return { results: [{ id: 'cmd-err', title: 'Ungültiges Datum', subtitle: 'z.B. /age 11.11.2004  •  /age 2004-11-11  •  /age 11/11/2004', type: 'system' }] };
    },
    enabled: true,
  },
  {
    id: 'days',
    trigger: '/days ',
    description: 'Tage bis Datum berechnen',
    usage: 'z.B. /days 24.12.2025  •  /days 2025-12-24  •  /days 12/24/2025',
    category: 'calc',
    handler(args: string) {
      const date = parseFlexibleDate(args);
      if (date) {
        const days = Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        const label = days >= 0 ? `noch ${days} Tage` : `${Math.abs(days)} Tage her`;
        return {
          results: [{ id: 'cmd-days', title: `${days} Tage`, subtitle: `${label} \u2022 ${date.toLocaleDateString('de-DE')}`, type: 'calc' }],
        };
      }
      return { results: [{ id: 'cmd-err', title: 'Ungültiges Datum', subtitle: 'z.B. /days 24.12.2025  •  /days 2025-12-24', type: 'system' }] };
    },
    enabled: true,
  },
  {
    id: 'week',
    trigger: '/week',
    description: 'Aktuelle Kalenderwoche',
    category: 'calc',
    handler() {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const week = Math.ceil((((now.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
      return {
        results: [{ id: 'cmd-week', title: `KW ${week}`, subtitle: now.getFullYear().toString(), type: 'calc' }],
      };
    },
    enabled: true,
  },
  {
    id: 'len',
    trigger: '/len ',
    description: 'Zeichen & Wörter zählen',
    usage: 'z.B. /len Hallo Welt wie geht es dir',
    category: 'calc',
    handler(args: string) {
      const text = args.trim();
      const wordCount = text.split(/\s+/).filter(w => w).length;
      return {
        results: [{ id: 'cmd-len', title: `${text.length} Zeichen`, subtitle: `${wordCount} Wörter`, type: 'calc' }],
      };
    },
    enabled: true,
  },
];

export default calcCommands;
