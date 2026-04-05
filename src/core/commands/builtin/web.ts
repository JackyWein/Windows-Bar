import type { Command } from '../../../types';

const webCommands: readonly Command[] = [
  {
    id: 'qr',
    trigger: '/qr ',
    description: 'QR-Code generieren',
    usage: 'z.B. /qr https://example.com',
    category: 'web',
    handler(args: string) {
      const text = args.trim();
      const preview = text.length > 20 ? text.substring(0, 20) + '...' : text;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
      return {
        results: [{ id: 'cmd-qr', title: `QR-Code: ${preview}`, subtitle: 'Enter um zu öffnen', type: 'web', path: qrUrl, isWeb: true }],
      };
    },
    enabled: true,
  },
  {
    id: 'ip',
    trigger: '/ip',
    description: 'Öffentliche IP-Adresse anzeigen',
    category: 'web',
    async handler() {
      try {
        const r = await fetch('https://api.ipify.org?format=json');
        const data = await r.json();
        const ip = data.ip;
        return {
          results: [{ id: 'cmd-ip', title: ip, subtitle: 'Öffentliche IP \u2022 Enter zum Kopieren', type: 'system', path: ip }],
          copyToClipboard: ip,
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'IP nicht abrufbar', subtitle: 'Netzwerkfehler', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'wiki',
    trigger: '/wiki ',
    description: 'Wikipedia-Artikel suchen',
    usage: 'z.B. /wiki Albert Einstein',
    category: 'web',
    async handler(args: string) {
      const term = args.trim();
      try {
        const r = await fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`);
        const data = await r.json();
        const title = data.title || term;
        const subtitle = data.extract?.substring(0, 80) || 'Artikel öffnen';
        const url = data.content_url || `https://de.wikipedia.org/wiki/${term}`;
        return {
          results: [{ id: 'cmd-wiki', title, subtitle, type: 'web', path: url, isWeb: true }],
        };
      } catch {
        const url = `https://de.wikipedia.org/wiki/${term}`;
        return {
          results: [{ id: 'cmd-wiki', title: `${term} auf Wikipedia`, subtitle: 'Enter zum Öffnen', type: 'web', path: url, isWeb: true }],
        };
      }
    },
    enabled: true,
  },
  {
    id: 'tr',
    trigger: '/tr ',
    description: 'Text übersetzen (DeepL)',
    category: 'web',
    handler(args: string) {
      const match = args.trim().match(/^([a-z]{2}):([a-z]{2})\s+(.+)$/i);
      if (match) {
        const from = match[1];
        const to = match[2];
        const text = match[3];
        const preview = text.length > 25 ? text.substring(0, 25) + '...' : text;
        const url = `https://www.deepl.com/translator#${from}/${to}/${encodeURIComponent(text)}`;
        return {
          results: [{ id: 'cmd-tr', title: `"${preview}" übersetzen`, subtitle: `${from.toUpperCase()} \u2192 ${to.toUpperCase()} via DeepL`, type: 'web', path: url, isWeb: true }],
        };
      }
      return { results: [{ id: 'cmd-err', title: 'Ungültiges Format', subtitle: '/tr de:en Hallo Welt', type: 'system' }] };
    },
    enabled: true,
  },
];

export default webCommands;
