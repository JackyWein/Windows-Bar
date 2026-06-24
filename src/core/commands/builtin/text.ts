import type { Command } from '../../../types';

// ── UTF-8 safe Base64 (TextEncoder/TextDecoder, no deprecated escape/unescape) ──
function toBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ── SHA hashes via Web Crypto (SHA-1 / SHA-256 / SHA-512) ──
async function shaHex(algo: 'SHA-1' | 'SHA-256' | 'SHA-512', text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Compact, correct MD5 (Web Crypto has no MD5) ──
function md5(input: string): string {
  function rl(n: number, c: number) { return (n << c) | (n >>> (32 - c)); }
  function add(x: number, y: number) { const l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) { return add(rl(add(add(a, q), add(x, t)), s), b); }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function toBytes(str: string) { return new TextEncoder().encode(str); }
  function toWords(bytes: Uint8Array) {
    const len = bytes.length;
    const words: number[] = [];
    for (let i = 0; i < len; i++) words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << ((i % 4) * 8));
    words[len >> 2] = (words[len >> 2] || 0) | (0x80 << ((len % 4) * 8));
    const bitLenIndex = (((len + 8) >> 6) + 1) * 16 - 2;
    while (words.length <= bitLenIndex) words.push(0);
    words[bitLenIndex] = len * 8;
    return words;
  }
  const x = toWords(toBytes(input));
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < x.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, x[i] | 0, 7, -680876936); d = ff(d, a, b, c, x[i + 1] | 0, 12, -389564586); c = ff(c, d, a, b, x[i + 2] | 0, 17, 606105819); b = ff(b, c, d, a, x[i + 3] | 0, 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4] | 0, 7, -176418897); d = ff(d, a, b, c, x[i + 5] | 0, 12, 1200080426); c = ff(c, d, a, b, x[i + 6] | 0, 17, -1473231341); b = ff(b, c, d, a, x[i + 7] | 0, 22, -45705983);
    a = ff(a, b, c, d, x[i + 8] | 0, 7, 1770035416); d = ff(d, a, b, c, x[i + 9] | 0, 12, -1958414417); c = ff(c, d, a, b, x[i + 10] | 0, 17, -42063); b = ff(b, c, d, a, x[i + 11] | 0, 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12] | 0, 7, 1804603682); d = ff(d, a, b, c, x[i + 13] | 0, 12, -40341101); c = ff(c, d, a, b, x[i + 14] | 0, 17, -1502002290); b = ff(b, c, d, a, x[i + 15] | 0, 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1] | 0, 5, -165796510); d = gg(d, a, b, c, x[i + 6] | 0, 9, -1069501632); c = gg(c, d, a, b, x[i + 11] | 0, 14, 643717713); b = gg(b, c, d, a, x[i] | 0, 20, -373897302);
    a = gg(a, b, c, d, x[i + 5] | 0, 5, -701558691); d = gg(d, a, b, c, x[i + 10] | 0, 9, 38016083); c = gg(c, d, a, b, x[i + 15] | 0, 14, -660478335); b = gg(b, c, d, a, x[i + 4] | 0, 20, -405537848);
    a = gg(a, b, c, d, x[i + 9] | 0, 5, 568446438); d = gg(d, a, b, c, x[i + 14] | 0, 9, -1019803690); c = gg(c, d, a, b, x[i + 3] | 0, 14, -187363961); b = gg(b, c, d, a, x[i + 8] | 0, 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13] | 0, 5, -1444681467); d = gg(d, a, b, c, x[i + 2] | 0, 9, -51403784); c = gg(c, d, a, b, x[i + 7] | 0, 14, 1735328473); b = gg(b, c, d, a, x[i + 12] | 0, 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5] | 0, 4, -378558); d = hh(d, a, b, c, x[i + 8] | 0, 11, -2022574463); c = hh(c, d, a, b, x[i + 11] | 0, 16, 1839030562); b = hh(b, c, d, a, x[i + 14] | 0, 23, -35309556);
    a = hh(a, b, c, d, x[i + 1] | 0, 4, -1530992060); d = hh(d, a, b, c, x[i + 4] | 0, 11, 1272893353); c = hh(c, d, a, b, x[i + 7] | 0, 16, -155497632); b = hh(b, c, d, a, x[i + 10] | 0, 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13] | 0, 4, 681279174); d = hh(d, a, b, c, x[i] | 0, 11, -358537222); c = hh(c, d, a, b, x[i + 3] | 0, 16, -722521979); b = hh(b, c, d, a, x[i + 6] | 0, 23, 76029189);
    a = hh(a, b, c, d, x[i + 9] | 0, 4, -640364487); d = hh(d, a, b, c, x[i + 12] | 0, 11, -421815835); c = hh(c, d, a, b, x[i + 15] | 0, 16, 530742520); b = hh(b, c, d, a, x[i + 2] | 0, 23, -995338651);
    a = ii(a, b, c, d, x[i] | 0, 6, -198630844); d = ii(d, a, b, c, x[i + 7] | 0, 10, 1126891415); c = ii(c, d, a, b, x[i + 14] | 0, 15, -1416354905); b = ii(b, c, d, a, x[i + 5] | 0, 21, -57434055);
    a = ii(a, b, c, d, x[i + 12] | 0, 6, 1700485571); d = ii(d, a, b, c, x[i + 3] | 0, 10, -1894986606); c = ii(c, d, a, b, x[i + 10] | 0, 15, -1051523); b = ii(b, c, d, a, x[i + 1] | 0, 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8] | 0, 6, 1873313359); d = ii(d, a, b, c, x[i + 15] | 0, 10, -30611744); c = ii(c, d, a, b, x[i + 6] | 0, 15, -1560198380); b = ii(b, c, d, a, x[i + 13] | 0, 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4] | 0, 6, -145523070); d = ii(d, a, b, c, x[i + 11] | 0, 10, -1120210379); c = ii(c, d, a, b, x[i + 2] | 0, 15, 718787259); b = ii(b, c, d, a, x[i + 9] | 0, 21, -343485551);
    a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
  }
  function hex(n: number) { let s = ''; for (let i = 0; i < 4; i++) s += ((n >> (i * 8 + 4)) & 0x0f).toString(16) + ((n >> (i * 8)) & 0x0f).toString(16); return s; }
  return hex(a) + hex(b) + hex(c) + hex(d);
}

const textCommands: readonly Command[] = [
  {
    id: 'enc',
    trigger: '/enc ',
    description: 'Text zu Base64 kodieren',
    usage: 'z.B. /enc Hallo Welt',
    category: 'text',
    handler(args: string) {
      const text = args.trim();
      const encoded = toBase64(text);
      return {
        results: [{ id: 'cmd-enc', title: encoded, subtitle: 'Base64 kodiert • Enter zum Kopieren', type: 'calc', path: encoded }],
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
      try {
        const decoded = fromBase64(args.trim());
        return {
          results: [{ id: 'cmd-dec', title: decoded, subtitle: 'Base64 dekodiert • Enter zum Kopieren', type: 'calc', path: decoded }],
          copyToClipboard: decoded,
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Ungültiger Base64-String', subtitle: 'Prüfe die Eingabe', type: 'system' }] };
      }
    },
    enabled: true,
  },
  {
    id: 'md5',
    trigger: '/md5 ',
    description: 'MD5-Hash erstellen',
    usage: 'z.B. /md5 hallo welt',
    category: 'text',
    handler(args: string) {
      const text = args.trim();
      const hash = md5(text);
      return {
        results: [{ id: 'cmd-md5', title: hash, subtitle: `MD5 von "${text.slice(0, 24)}" • Enter zum Kopieren`, type: 'calc', path: hash }],
        copyToClipboard: hash,
      };
    },
    enabled: true,
  },
  {
    id: 'sha1',
    trigger: '/sha1 ',
    description: 'SHA-1-Hash erstellen',
    usage: 'z.B. /sha1 hallo welt',
    category: 'text',
    async handler(args: string) {
      const text = args.trim();
      const hash = await shaHex('SHA-1', text);
      return {
        results: [{ id: 'cmd-sha1', title: hash, subtitle: `SHA-1 • Enter zum Kopieren`, type: 'calc', path: hash }],
        copyToClipboard: hash,
      };
    },
    enabled: true,
  },
  {
    id: 'sha512',
    trigger: '/sha512 ',
    description: 'SHA-512-Hash erstellen',
    usage: 'z.B. /sha512 hallo welt',
    category: 'text',
    async handler(args: string) {
      const text = args.trim();
      const hash = await shaHex('SHA-512', text);
      return {
        results: [{ id: 'cmd-sha512', title: hash.slice(0, 48) + '…', subtitle: `SHA-512 • Enter zum Kopieren`, type: 'calc', path: hash }],
        copyToClipboard: hash,
      };
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
          results: [{ id: 'cmd-json', title: preview, subtitle: 'JSON formatiert • Enter zum Kopieren', type: 'calc', path: formatted }],
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
      const reversed = args.trim().split('').reverse().join('');
      return {
        results: [{ id: 'cmd-rev', title: reversed, subtitle: 'Umgekehrt • Enter zum Kopieren', type: 'calc', path: reversed }],
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
      const encoded = encodeURIComponent(args.trim());
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
      try {
        const decoded = decodeURIComponent(args.trim());
        return {
          results: [{ id: 'cmd-unurl', title: decoded, subtitle: 'URL-dekodiert', type: 'calc', path: decoded }],
          copyToClipboard: decoded,
        };
      } catch {
        return { results: [{ id: 'cmd-err', title: 'Ungültige URL-Kodierung', subtitle: 'Prüfe die Eingabe', type: 'system' }] };
      }
    },
    enabled: true,
  },
];

export default textCommands;
