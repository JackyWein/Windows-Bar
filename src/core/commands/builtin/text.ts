import type { Command } from '../../../types';

const textCommands: readonly Command[] = [
  {
    id: 'enc',
    trigger: '/enc ',
    description: 'Text zu Base64 kodieren',
    usage: 'z.B. /enc Hallo Welt',
    category: 'text',
    handler(args: string) {
      const text = args.trim();
      const encoded = btoa(unescape(encodeURIComponent(text)));
      return {
        results: [{ id: 'cmd-enc', title: encoded, subtitle: 'Base64 kodiert \u2022 Enter zum Kopieren', type: 'calc', path: encoded }],
        copyToClipboard: encoded,
      };
    },
    enabled: true,
  },
  {
    id: 'dec',
    trigger: '/dec ',
    description: 'Base64 zu Text dekodieren',
    usage: 'z.B. /dec SGVsbG8gV2VsdA==',
    category: 'text',
    handler(args: string) {
      const text = args.trim();
      try {
        const decoded = decodeURIComponent(escape(atob(text)));
        return {
          results: [{ id: 'cmd-dec', title: decoded, subtitle: 'Base64 dekodiert \u2022 Enter zum Kopieren', type: 'calc', path: decoded }],
          copyToClipboard: decoded,
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Ungültiger Base64-String', subtitle: 'Prüfe die Eingabe', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'json',
    trigger: '/json ',
    description: 'JSON formatieren',
    usage: 'z.B. /json {"name":"Max","age":25}',
    category: 'text',
    handler(args: string) {
      try {
        const obj = JSON.parse(args.trim());
        const formatted = JSON.stringify(obj, null, 2);
        const preview = formatted.length > 50 ? formatted.substring(0, 50) + '...' : formatted;
        return {
          results: [{ id: 'cmd-json', title: preview, subtitle: 'JSON formatiert \u2022 Enter zum Kopieren', type: 'calc', path: formatted }],
          copyToClipboard: formatted,
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Ungültiges JSON', subtitle: 'Prüfe die Syntax', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'rev',
    trigger: '/rev ',
    description: 'Text umkehren',
    usage: 'z.B. /rev Hallo Welt',
    category: 'text',
    handler(args: string) {
      const text = args.trim();
      const reversed = text.split('').reverse().join('');
      return {
        results: [{ id: 'cmd-rev', title: reversed, subtitle: 'Umgekehrt \u2022 Enter zum Kopieren', type: 'calc', path: reversed }],
        copyToClipboard: reversed,
      };
    },
    enabled: true,
  },
  {
    id: 'upper',
    trigger: '/upper ',
    description: 'Text in GROSSBUCHSTABEN',
    usage: 'z.B. /upper hallo welt',
    category: 'text',
    handler(args: string) {
      const text = args.trim().toUpperCase();
      return {
        results: [{ id: 'cmd-upper', title: text, subtitle: 'GROSSBUCHSTABEN', type: 'calc', path: text }],
        copyToClipboard: text,
      };
    },
    enabled: true,
  },
  {
    id: 'lower',
    trigger: '/lower ',
    description: 'Text in kleinbuchstaben',
    usage: 'z.B. /lower HALLO WELT',
    category: 'text',
    handler(args: string) {
      const text = args.trim().toLowerCase();
      return {
        results: [{ id: 'cmd-lower', title: text, subtitle: 'kleinbuchstaben', type: 'calc', path: text }],
        copyToClipboard: text,
      };
    },
    enabled: true,
  },
  {
    id: 'url',
    trigger: '/url ',
    description: 'URL-kodieren',
    usage: 'z.B. /url Hallo & Welt',
    category: 'text',
    handler(args: string) {
      const text = args.trim();
      const encoded = encodeURIComponent(text);
      return {
        results: [{ id: 'cmd-url', title: encoded, subtitle: 'URL-kodiert', type: 'calc', path: encoded }],
        copyToClipboard: encoded,
      };
    },
    enabled: true,
  },
  {
    id: 'unurl',
    trigger: '/unurl ',
    description: 'URL-dekodieren',
    usage: 'z.B. /unurl Hallo%20%26%20Welt',
    category: 'text',
    handler(args: string) {
      const text = args.trim();
      const decoded = decodeURIComponent(text);
      return {
        results: [{ id: 'cmd-unurl', title: decoded, subtitle: 'URL-dekodiert', type: 'calc', path: decoded }],
        copyToClipboard: decoded,
      };
    },
    enabled: true,
  },
];

export default textCommands;
