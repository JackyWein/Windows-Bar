// ===========================================
// Windows Bar - Command Handlers
// All commands with robust error handling
// ===========================================

// Types
export interface CommandResult {
    title: string;
    subtitle: string;
    type: string;
    path?: string;
    isWeb?: boolean;
    copyToClipboard?: string;
}

// ===========================================
// 1. CLIPBOARD HISTORY
// ===========================================
const CLIPBOARD_KEY = 'windowsbar_clipboard_history';

export function saveToClipboardHistory(text: string): void {
    try {
        if (!text || !text.trim()) return;
        const history = getClipboardHistory();
        const filtered = history.filter(item => item !== text);
        const newHistory = [text, ...filtered].slice(0, 15);
        localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(newHistory));
    } catch (e) {
        console.error('Clipboard history save error:', e);
    }
}

export function getClipboardHistory(): string[] {
    try {
        const saved = localStorage.getItem(CLIPBOARD_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

export function clearClipboardHistory(): void {
    localStorage.removeItem(CLIPBOARD_KEY);
}

export function handleClipboardCommand(query: string): CommandResult[] {
    const sub = query.replace(/^\/(cb|clipboard)\s*/i, '').trim();

    if (sub === 'clear' || sub === 'löschen') {
        clearClipboardHistory();
        return [{
            title: 'Zwischenablage-Verlauf gelöscht',
            subtitle: 'Alle Einträge wurden entfernt',
            type: 'system'
        }];
    }

    const history = getClipboardHistory();
    if (history.length === 0) {
        return [{
            title: 'Zwischenablage leer',
            subtitle: 'Kopiere etwas, um es hier zu sehen',
            type: 'system'
        }];
    }

    return history.map((text, idx) => ({
        title: text.length > 50 ? text.substring(0, 50) + '...' : text,
        subtitle: `Eintrag ${idx + 1} • Klicken zum Kopieren`,
        type: 'clipboard',
        copyToClipboard: text
    }));
}

// ===========================================
// 2. TIMER & STOPWATCH
// ===========================================
const TIMERS_KEY = 'windowsbar_timers';

interface Timer {
    id: string;
    type: 'timer' | 'stopwatch';
    startTime: number;
    duration?: number; // for timers in ms
    label?: string;
}

export function getActiveTimers(): Timer[] {
    try {
        const saved = localStorage.getItem(TIMERS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

export function saveTimers(timers: Timer[]): void {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
}

export function parseTimerInput(query: string): { duration: number; label: string } | null {
    const match = query.match(/^\/timer\s+(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|std)?\s*(.*)$/i);
    if (!match) return null;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 's').toLowerCase();
    const label = match[3].trim();

    let durationMs = value * 1000; // default seconds
    if (unit === 'm' || unit === 'min') durationMs = value * 60 * 1000;
    if (unit === 'h' || unit === 'std') durationMs = value * 60 * 60 * 1000;

    return { duration: durationMs, label };
}

export function handleTimerCommand(query: string): CommandResult[] {
    const results: CommandResult[] = [];

    // Check for new timer
    const parsed = parseTimerInput(query);
    if (parsed) {
        const minutes = Math.floor(parsed.duration / 60000);
        const seconds = Math.floor((parsed.duration % 60000) / 1000);
        const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

        results.push({
            title: `Timer starten: ${timeStr}`,
            subtitle: parsed.label || 'Klicken zum Starten',
            type: 'timer',
            path: `timer:start:${parsed.duration}:${parsed.label || ''}`
        });
    }

    // Show stopwatch option
    if (query.match(/^\/(timer|stopwatch)/i)) {
        results.push({
            title: 'Stoppuhr starten',
            subtitle: 'Klicken zum Starten',
            type: 'timer',
            path: 'stopwatch:start'
        });
    }

    // Show active timers
    const activeTimers = getActiveTimers();
    const now = Date.now();

    for (const timer of activeTimers) {
        if (timer.type === 'timer' && timer.duration) {
            const remaining = timer.startTime + timer.duration - now;
            if (remaining > 0) {
                const mins = Math.floor(remaining / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                results.push({
                    title: `Timer: ${mins}m ${secs}s verbleibend`,
                    subtitle: timer.label || 'Aktiver Timer',
                    type: 'timer',
                    path: `timer:stop:${timer.id}`
                });
            }
        } else if (timer.type === 'stopwatch') {
            const elapsed = now - timer.startTime;
            const mins = Math.floor(elapsed / 60000);
            const secs = Math.floor((elapsed % 60000) / 1000);
            results.push({
                title: `Stoppuhr: ${mins}m ${secs}s`,
                subtitle: 'Klicken zum Stoppen',
                type: 'timer',
                path: `stopwatch:stop:${timer.id}`
            });
        }
    }

    return results;
}

// ===========================================
// 3. TRANSLATION
// ===========================================
export async function handleTranslateCommand(query: string): Promise<CommandResult[]> {
    const match = query.match(/^\/(de|en|es|fr|it|pt|nl)\s+(.+)$/i);
    if (!match) {
        return [{
            title: 'Übersetzung',
            subtitle: '/de Text → Deutsch, /en Text → Englisch, /es → Spanisch, etc.',
            type: 'web'
        }];
    }

    const targetLang = match[1].toLowerCase();
    const text = match[2].trim();

    const langNames: Record<string, string> = {
        de: 'Deutsch',
        en: 'Englisch',
        es: 'Spanisch',
        fr: 'Französisch',
        it: 'Italienisch',
        pt: 'Portugiesisch',
        nl: 'Niederländisch'
    };

    // Use DeepL or Google Translate URL
    const url = `https://www.deepl.com/translator#auto/${targetLang}/${encodeURIComponent(text)}`;

    return [{
        title: `"${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" nach ${langNames[targetLang]} übersetzen`,
        subtitle: 'DeepL Translator öffnen',
        type: 'web',
        path: url,
        isWeb: true
    }];
}

// ===========================================
// 4. PASSWORD GENERATOR
// ===========================================
export function handlePasswordCommand(query: string): CommandResult[] {
    const match = query.match(/^\/(pw|password)\s*(\d*)$/i);
    const length = match && match[2] ? parseInt(match[2]) : 16;
    const safeLength = Math.max(8, Math.min(64, length || 16));

    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';

    // Use crypto API for secure random
    const array = new Uint32Array(safeLength);
    crypto.getRandomValues(array);
    for (let i = 0; i < safeLength; i++) {
        password += chars[array[i] % chars.length];
    }

    return [{
        title: password,
        subtitle: `Sicheres Passwort (${safeLength} Zeichen) • Klicken zum Kopieren`,
        type: 'password',
        copyToClipboard: password
    }];
}

// ===========================================
// 5. UNIT CONVERTER
// ===========================================
export function handleUnitConversion(query: string): CommandResult | null {
    // Length
    const lengthUnits: Record<string, number> = {
        km: 1000, m: 1, cm: 0.01, mm: 0.001,
        mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254
    };

    // Weight
    const weightUnits: Record<string, number> = {
        kg: 1, g: 0.001, mg: 0.000001,
        lb: 0.453592, oz: 0.0283495
    };

    // Volume
    const volumeUnits: Record<string, number> = {
        l: 1, ml: 0.001, gal: 3.78541, qt: 0.946353
    };

    // Temperature needs special handling
    const tempMatch = query.match(/^(-?\d+(?:\.\d+)?)\s*(c|celsius|f|fahrenheit|k|kelvin)\s+(?:in|to|nach)\s*(c|celsius|f|fahrenheit|k|kelvin)$/i);
    if (tempMatch) {
        const value = parseFloat(tempMatch[1]);
        const from = tempMatch[2].toLowerCase();
        const to = tempMatch[3].toLowerCase();

        let celsius: number;
        if (from === 'c' || from === 'celsius') celsius = value;
        else if (from === 'f' || from === 'fahrenheit') celsius = (value - 32) * 5 / 9;
        else celsius = value - 273.15; // kelvin

        let result: number;
        let unit: string;
        if (to === 'c' || to === 'celsius') {
            result = celsius;
            unit = '°C';
        } else if (to === 'f' || to === 'fahrenheit') {
            result = celsius * 9 / 5 + 32;
            unit = '°F';
        } else {
            result = celsius + 273.15;
            unit = 'K';
        }

        return {
            title: `${result.toFixed(2)} ${unit}`,
            subtitle: `${value} ${from.toUpperCase()} = ${result.toFixed(2)} ${unit}`,
            type: 'calc'
        };
    }

    // General unit conversion
    const unitMatch = query.match(/^(\d+(?:\.\d+)?)\s*(km|m|cm|mm|mi|yd|ft|in|kg|g|mg|lb|oz|l|ml|gal|qt)\s+(?:in|to|nach)\s*(km|m|cm|mm|mi|yd|ft|in|kg|g|mg|lb|oz|l|ml|gal|qt)$/i);
    if (unitMatch) {
        const value = parseFloat(unitMatch[1]);
        const from = unitMatch[2].toLowerCase();
        const to = unitMatch[3].toLowerCase();

        let units = lengthUnits;
        if (weightUnits[from]) units = weightUnits;
        if (volumeUnits[from]) units = volumeUnits;

        if (units[from] && units[to]) {
            const baseValue = value * units[from];
            const result = baseValue / units[to];

            return {
                title: `${result.toFixed(4)} ${to}`,
                subtitle: `${value} ${from} = ${result.toFixed(4)} ${to}`,
                type: 'calc'
            };
        }
    }

    return null;
}

// ===========================================
// 6. QR CODE GENERATOR
// ===========================================
export function handleQRCommand(query: string): CommandResult[] {
    const text = query.replace(/^\/qr\s*/i, '').trim();

    if (!text) {
        return [{
            title: 'QR-Code Generator',
            subtitle: '/qr Text oder URL eingeben',
            type: 'web'
        }];
    }

    // Use QR code API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;

    return [{
        title: `QR-Code: "${text.substring(0, 25)}${text.length > 25 ? '...' : ''}"`,
        subtitle: 'Klicken um QR-Code zu öffnen',
        type: 'web',
        path: qrUrl,
        isWeb: true
    }];
}

// ===========================================
// 7. EMOJI PICKER
// ===========================================
const EMOJI_MAP: Record<string, string> = {
    // Faces
    smile: '😊', grin: '😁', laugh: '😂', joy: '😂', wink: '😉',
    sad: '😢', cry: '😭', angry: '😠', rage: '😡', think: '🤔',
    cool: '😎', love: '😍', heart_eyes: '😍', star: '⭐', fire: '🔥',
    thumbsup: '👍', thumbsdown: '👎', ok: '👌', clap: '👏', wave: '👋',
    // Hearts
    heart: '❤️', redheart: '❤️', blueheart: '💙', greenheart: '💚', yellowheart: '💛',
    purpleheart: '💜', broken: '💔', sparkles: '✨', sparkle: '✨',
    // Objects
    coffee: '☕', beer: '🍺', pizza: '🍕', burger: '🍔', cake: '🎂',
    book: '📖', pencil: '✏️', pen: '🖊️', phone: '📱', computer: '💻',
    rocket: '🚀', check: '✅', cross: '❌', warning: '⚠️', info: 'ℹ️',
    // Arrows
    arrow: '➡️', right: '➡️', left: '⬅️', up: '⬆️', down: '⬇️',
    // Other
    sun: '☀️', moon: '🌙', cloud: '☁️', rain: '🌧️', snow: '❄️',
    music: '🎵', note: '🎵', bell: '🔔', gift: '🎁', party: '🎉',
    trash: '🗑️', recycle: '♻️', lock: '🔒', unlock: '🔓', key: '🔑',
    bulb: '💡', zap: '⚡', gem: '💎', crown: '👑', trophy: '🏆'
};

export function handleEmojiCommand(query: string): CommandResult[] {
    const search = query.replace(/^\/emoji\s*/i, '').trim().toLowerCase();

    if (!search) {
        const popular = ['❤️', '🔥', '✨', '😊', '👍', '😂', '🎉', '💯'];
        return popular.map(emoji => ({
            title: emoji,
            subtitle: 'Klicken zum Kopieren',
            type: 'emoji',
            copyToClipboard: emoji
        }));
    }

    const results: CommandResult[] = [];

    for (const [name, emoji] of Object.entries(EMOJI_MAP)) {
        if (name.includes(search) || search.includes(name)) {
            results.push({
                title: `${emoji} ${name}`,
                subtitle: 'Klicken zum Kopieren',
                type: 'emoji',
                copyToClipboard: emoji
            });
        }
    }

    if (results.length === 0) {
        results.push({
            title: 'Kein Emoji gefunden',
            subtitle: 'Versuche: heart, fire, smile, thumbsup, etc.',
            type: 'system'
        });
    }

    return results.slice(0, 10);
}

// ===========================================
// 8. IP ADDRESS
// ===========================================
export async function handleIPCommand(): Promise<CommandResult[]> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const response = await fetch('https://api.ipify.org?format=json', {
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) throw new Error('API error');

        const data = await response.json();

        return [{
            title: data.ip,
            subtitle: 'Deine öffentliche IP-Adresse • Klicken zum Kopieren',
            type: 'system',
            copyToClipboard: data.ip
        }];
    } catch (e) {
        return [{
            title: 'IP konnte nicht abgerufen werden',
            subtitle: 'Netzwerkfehler oder Timeout',
            type: 'system'
        }];
    }
}

// ===========================================
// 9. CURRENCY CONVERTER
// ===========================================
const CURRENCY_SYMBOLS: Record<string, string> = {
    usd: '$', eur: '€', gbp: '£', jpy: '¥', chf: 'Fr', cad: 'C$', aud: 'A$',
    sek: 'kr', nok: 'kr', dkk: 'kr', pln: 'zł', rub: '₽', cny: '¥',
    inr: '₹', brl: 'R$', mxn: '$', krw: '₩', try: '₺', zar: 'R'
};

export async function handleCurrencyCommand(query: string): Promise<CommandResult[]> {
    const match = query.match(/^(\d+(?:\.\d+)?)\s*(usd|eur|gbp|jpy|chf|cad|aud|sek|nok|dkk|pln|rub|cny|inr|brl|mxn|krw|try|zar)\s+(?:in|to|nach)\s*(usd|eur|gbp|jpy|chf|cad|aud|sek|nok|dkk|pln|rub|cny|inr|brl|mxn|krw|try|zar)$/i);

    if (!match) {
        return [{
            title: 'Währungsrechner',
            subtitle: 'z.B. 100USD in EUR oder 50EUR in GBP',
            type: 'calc'
        }];
    }

    const amount = parseFloat(match[1]);
    const from = match[2].toUpperCase();
    const to = match[3].toUpperCase();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        // Using exchangerate-api.com free tier (no API key needed for basic)
        const response = await fetch(
            `https://api.exchangerate.host/latest?base=${from}&symbols=${to}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        const rate = data.rates[to];

        if (!rate) throw new Error('No rate');

        const result = amount * rate;
        const fromSym = CURRENCY_SYMBOLS[from.toLowerCase()] || from;
        const toSym = CURRENCY_SYMBOLS[to.toLowerCase()] || to;

        return [{
            title: `${toSym} ${result.toFixed(2)}`,
            subtitle: `${fromSym} ${amount} = ${toSym} ${result.toFixed(2)} (Kurs: ${rate.toFixed(4)})`,
            type: 'calc',
            copyToClipboard: result.toFixed(2)
        }];
    } catch (e) {
        // Fallback: Open Google
        const url = `https://www.google.com/search?q=${amount}+${from}+in+${to}`;
        return [{
            title: `${amount} ${from} → ${to}`,
            subtitle: 'Online suchen (API nicht verfügbar)',
            type: 'web',
            path: url,
            isWeb: true
        }];
    }
}

// ===========================================
// 10. CALENDAR WEEK & COUNTDOWN
// ===========================================
export function handleCalendarCommand(query: string): CommandResult[] {
    const results: CommandResult[] = [];
    const now = new Date();

    // Calendar week
    if (query.match(/^\/(kw|week|kalenderwoche)/i)) {
        const start = new Date(now.getFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
        const week = Math.ceil((days + start.getDay() + 1) / 7);

        results.push({
            title: `Kalenderwoche ${week}`,
            subtitle: `${now.getFullYear()} • ${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}`,
            type: 'calc'
        });
    }

    // Countdown
    const countdownMatch = query.match(/^\/countdown\s+(\d{4}-\d{2}-\d{2})$/i);
    if (countdownMatch) {
        const target = new Date(countdownMatch[1]);
        const diff = target.getTime() - now.getTime();
        const days = Math.ceil(diff / (24 * 60 * 60 * 1000));

        if (days > 0) {
            results.push({
                title: `${days} Tage verbleibend`,
                subtitle: `Bis zum ${target.toLocaleDateString('de-DE')}`,
                type: 'calc'
            });
        } else if (days === 0) {
            results.push({
                title: 'Heute ist der Tag!',
                subtitle: target.toLocaleDateString('de-DE'),
                type: 'calc'
            });
        } else {
            results.push({
                title: `${Math.abs(days)} Tage vergangen`,
                subtitle: `Seit dem ${target.toLocaleDateString('de-DE')}`,
                type: 'calc'
            });
        }
    }

    return results;
}

// ===========================================
// 11. UUID GENERATOR
// ===========================================
export function handleUUIDCommand(): CommandResult {
    // Generate v4 UUID
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });

    return {
        title: uuid,
        subtitle: 'UUID v4 • Klicken zum Kopieren',
        type: 'calc',
        copyToClipboard: uuid
    };
}

// ===========================================
// 12. BASE64 ENCODE/DECODE
// ===========================================
export function handleBase64Command(query: string): CommandResult[] {
    const encodeMatch = query.match(/^\/b64e\s+(.+)$/i);
    const decodeMatch = query.match(/^\/b64d\s+(.+)$/i);

    if (encodeMatch) {
        try {
            const text = encodeMatch[1];
            const encoded = btoa(unescape(encodeURIComponent(text)));
            return [{
                title: encoded,
                subtitle: 'Base64 kodiert • Klicken zum Kopieren',
                type: 'calc',
                copyToClipboard: encoded
            }];
        } catch (e) {
            return [{
                title: 'Fehler beim Kodieren',
                subtitle: 'Ungültiger Eingabetext',
                type: 'system'
            }];
        }
    }

    if (decodeMatch) {
        try {
            const encoded = decodeMatch[1].trim();
            const decoded = decodeURIComponent(escape(atob(encoded)));
            return [{
                title: decoded,
                subtitle: 'Base64 dekodiert • Klicken zum Kopieren',
                type: 'calc',
                copyToClipboard: decoded
            }];
        } catch (e) {
            return [{
                title: 'Fehler beim Dekodieren',
                subtitle: 'Ungültiger Base64-String',
                type: 'system'
            }];
        }
    }

    return [{
        title: 'Base64 Tools',
        subtitle: '/b64e Text → Kodieren, /b64d BASE64 → Dekodieren',
        type: 'calc'
    }];
}

// ===========================================
// 13. HASH GENERATOR
// ===========================================
export async function handleHashCommand(query: string): Promise<CommandResult[]> {
    const match = query.match(/^\/hash\s+(md5|sha1|sha256|sha512)\s+(.+)$/i);

    if (!match) {
        return [{
            title: 'Hash Generator',
            subtitle: '/hash sha256 Text, /hash md5 Text, /hash sha1 Text',
            type: 'calc'
        }];
    }

    const algorithm = match[1].toLowerCase();
    const text = match[2];

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);

        let hashBuffer: ArrayBuffer;

        if (algorithm === 'md5') {
            // MD5 is not supported by SubtleCrypto, implement simple version
            // For simplicity, use a basic implementation
            const md5 = simpleMD5(text);
            return [{
                title: md5,
                subtitle: `MD5 Hash • Klicken zum Kopieren`,
                type: 'calc',
                copyToClipboard: md5
            }];
        }

        const algoName = algorithm.toUpperCase().replace('SHA', 'SHA-') as any;
        hashBuffer = await crypto.subtle.digest(algoName, data);

        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        return [{
            title: hashHex.substring(0, 32) + (hashHex.length > 32 ? '...' : ''),
            subtitle: `${algorithm.toUpperCase()} Hash • Klicken zum Kopieren`,
            type: 'calc',
            copyToClipboard: hashHex
        }];
    } catch (e) {
        return [{
            title: 'Hash-Fehler',
            subtitle: 'Konnte Hash nicht generieren',
            type: 'system'
        }];
    }
}

// Simple MD5 implementation
function simpleMD5(string: string): string {
    function rotateLeft(x: number, n: number) {
        return (x << n) | (x >>> (32 - n));
    }

    function addUnsigned(x: number, y: number) {
        const x8 = x & 0x80000000;
        const y8 = y & 0x80000000;
        const x4 = x & 0x40000000;
        const y4 = y & 0x40000000;
        const result = (x & 0x3FFFFFFF) + (y & 0x3FFFFFFF);
        if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
        if (x4 | y4) {
            if (result & 0x40000000) return result ^ 0xC0000000 ^ x8 ^ y8;
            return result ^ 0x40000000 ^ x8 ^ y8;
        }
        return result ^ x8 ^ y8;
    }

    function F(x: number, y: number, z: number) { return (x & y) | (~x & z); }
    function G(x: number, y: number, z: number) { return (x & z) | (y & ~z); }
    function H(x: number, y: number, z: number) { return x ^ y ^ z; }
    function I(x: number, y: number, z: number) { return y ^ (x | ~z); }

    function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
    }

    function convertToWordArray(str: string) {
        const utf8 = unescape(encodeURIComponent(str));
        const len = utf8.length;
        const words = [];
        for (let i = 0; i < len; i += 4) {
            words.push(
                (utf8.charCodeAt(i) || 0) |
                ((utf8.charCodeAt(i + 1) || 0) << 8) |
                ((utf8.charCodeAt(i + 2) || 0) << 16) |
                ((utf8.charCodeAt(i + 3) || 0) << 24)
            );
        }
        const bitLen = len * 8;
        words[len >> 2] |= 0x80 << ((len % 4) * 8);
        words[(((len + 8) >>> 6) << 4) + 14] = bitLen;
        return words;
    }

    function wordToHex(value: number) {
        let hex = '';
        for (let i = 0; i < 4; i++) {
            const byte = (value >>> (i * 8)) & 255;
            hex += ('0' + byte.toString(16)).slice(-2);
        }
        return hex;
    }

    const x = convertToWordArray(string);
    let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;

    for (let k = 0; k < x.length; k += 16) {
        const AA = a, BB = b, CC = c, DD = d;

        a = FF(a, b, c, d, x[k], 7, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], 12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], 17, 0x242070DB); b = FF(b, c, d, a, x[k + 3], 22, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], 7, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], 12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], 17, 0xA8304613); b = FF(b, c, d, a, x[k + 7], 22, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], 7, 0x698098D8); d = FF(d, a, b, c, x[k + 9], 12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], 17, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], 22, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], 7, 0x6B901122); d = FF(d, a, b, c, x[k + 13], 12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], 17, 0xA679438E); b = FF(b, c, d, a, x[k + 15], 22, 0x49B40821);

        a = GG(a, b, c, d, x[k + 1], 5, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], 9, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], 14, 0x265E5A51); b = GG(b, c, d, a, x[k], 20, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], 5, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], 9, 0x2441453);
        c = GG(c, d, a, b, x[k + 15], 14, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], 20, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], 5, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], 9, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], 14, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], 20, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], 5, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], 9, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], 14, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], 20, 0x8D2A4C8A);

        a = HH(a, b, c, d, x[k + 5], 4, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], 11, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], 16, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], 23, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], 4, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], 11, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], 16, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], 23, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], 4, 0x289B7EC6); d = HH(d, a, b, c, x[k], 11, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], 16, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], 23, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], 4, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], 11, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], 16, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], 23, 0xC4AC5665);

        a = II(a, b, c, d, x[k], 6, 0xF4292244); d = II(d, a, b, c, x[k + 7], 10, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], 15, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], 21, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], 6, 0x655B59C3); d = II(d, a, b, c, x[k + 3], 10, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], 15, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], 21, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], 6, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], 10, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], 15, 0xA3014314); b = II(b, c, d, a, x[k + 13], 21, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], 6, 0xF7537E82); d = II(d, a, b, c, x[k + 11], 10, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], 15, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], 21, 0xEB86D391);

        a = addUnsigned(a, AA); b = addUnsigned(b, BB); c = addUnsigned(c, CC); d = addUnsigned(d, DD);
    }

    return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
}

// ===========================================
// 14. UNIX TIMESTAMP
// ===========================================
export function handleTimestampCommand(_query: string): CommandResult[] {
    const now = new Date();
    const unix = Math.floor(now.getTime() / 1000);

    const results: CommandResult[] = [{
        title: unix.toString(),
        subtitle: 'Unix Timestamp (Sekunden) • Klicken zum Kopieren',
        type: 'calc',
        copyToClipboard: unix.toString()
    }];

    // Also show milliseconds
    results.push({
        title: (unix * 1000).toString(),
        subtitle: 'Unix Timestamp (Millisekunden) • Klicken zum Kopieren',
        type: 'calc',
        copyToClipboard: (unix * 1000).toString()
    });

    // Show human readable
    results.push({
        title: now.toISOString(),
        subtitle: 'ISO 8601 Format',
        type: 'calc',
        copyToClipboard: now.toISOString()
    });

    return results;
}

// ===========================================
// 15. LOREM IPSUM
// ===========================================
const LOREM_WORDS = [
    'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
    'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
    'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
    'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
    'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
];

export function handleLoremCommand(query: string): CommandResult {
    const match = query.match(/^\/lorem\s*(\d*)\s*(w|words|s|sentences|p|paragraphs)?$/i);

    const count = match && match[1] ? parseInt(match[1]) : 50;
    const type = (match && match[2] ? match[2].toLowerCase() : 'w');

    let text = '';

    if (type === 'p' || type === 'paragraphs') {
        // Generate paragraphs
        for (let p = 0; p < Math.min(count, 5); p++) {
            const sentences = 4 + Math.floor(Math.random() * 4);
            let para = '';
            for (let s = 0; s < sentences; s++) {
                const wordCount = 8 + Math.floor(Math.random() * 10);
                for (let w = 0; w < wordCount; w++) {
                    para += LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)] + ' ';
                }
                para = para.trim() + '. ';
            }
            text += para.trim() + '\n\n';
        }
    } else if (type === 's' || type === 'sentences') {
        // Generate sentences
        for (let s = 0; s < Math.min(count, 10); s++) {
            const wordCount = 8 + Math.floor(Math.random() * 10);
            for (let w = 0; w < wordCount; w++) {
                text += LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)] + ' ';
            }
            text = text.trim() + '. ';
        }
    } else {
        // Generate words
        for (let w = 0; w < Math.min(count, 200); w++) {
            text += LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)] + ' ';
        }
        text = text.trim();
    }

    return {
        title: text.length > 60 ? text.substring(0, 60) + '...' : text,
        subtitle: `${count} ${type === 'p' ? 'Absätze' : type === 's' ? 'Sätze' : 'Wörter'} • Klicken zum Kopieren`,
        type: 'calc',
        copyToClipboard: text.trim()
    };
}

// ===========================================
// 16. WIKIPEDIA
// ===========================================
export async function handleWikiCommand(query: string): Promise<CommandResult[]> {
    const term = query.replace(/^\/(wiki|wikipedia)\s*/i, '').trim();

    if (!term) {
        return [{
            title: 'Wikipedia Suche',
            subtitle: '/wiki Suchbegriff eingeben',
            type: 'web'
        }];
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(
            `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) {
            // Try search
            const searchUrl = `https://de.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(term)}`;
            return [{
                title: `"${term}" auf Wikipedia suchen`,
                subtitle: 'Artikel nicht gefunden, Suche öffnen',
                type: 'web',
                path: searchUrl,
                isWeb: true
            }];
        }

        const data = await response.json();

        return [{
            title: data.title || term,
            subtitle: data.extract ? data.extract.substring(0, 100) + '...' : 'Wikipedia Artikel',
            type: 'web',
            path: data.content_url || `https://de.wikipedia.org/wiki/${encodeURIComponent(term)}`,
            isWeb: true
        }];
    } catch (e) {
        const url = `https://de.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(term)}`;
        return [{
            title: `"${term}" auf Wikipedia`,
            subtitle: 'Wikipedia öffnen',
            type: 'web',
            path: url,
            isWeb: true
        }];
    }
}

// ===========================================
// 17. URL SHORTENER
// ===========================================
export async function handleShortenCommand(query: string): Promise<CommandResult[]> {
    const urlMatch = query.match(/^\/shorten\s+(https?:\/\/.+)$/i);

    if (!urlMatch) {
        return [{
            title: 'URL Shortener',
            subtitle: '/shorten https://beispiel.de/sehr-lange-url',
            type: 'web'
        }];
    }

    const url = urlMatch[1];

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        // Using is.gd (free, no API key)
        const response = await fetch(
            `https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!response.ok) throw new Error('API error');

        const data = await response.json();

        if (data.shorturl) {
            return [{
                title: data.shorturl,
                subtitle: 'Kurze URL • Klicken zum Kopieren',
                type: 'web',
                copyToClipboard: data.shorturl
            }];
        }

        throw new Error('No shorturl');
    } catch (e) {
        return [{
            title: 'URL konnte nicht gekürzt werden',
            subtitle: 'Service nicht verfügbar',
            type: 'system'
        }];
    }
}

// ===========================================
// 18. QUICK NOTES
// ===========================================
const NOTES_KEY = 'windowsbar_notes';

interface Note {
    id: string;
    text: string;
    createdAt: number;
}

export function getNotes(): Note[] {
    try {
        const saved = localStorage.getItem(NOTES_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

export function saveNote(text: string): void {
    try {
        const notes = getNotes();
        const newNote: Note = {
            id: Date.now().toString(),
            text,
            createdAt: Date.now()
        };
        notes.unshift(newNote);
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes.slice(0, 50)));
    } catch (e) {
        console.error('Note save error:', e);
    }
}

export function deleteNote(id: string): void {
    try {
        const notes = getNotes().filter(n => n.id !== id);
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (e) { }
}

export function handleNotesCommand(query: string): CommandResult[] {
    const noteText = query.replace(/^\/(note|notiz)\s*/i, '').trim();

    if (noteText === 'clear' || noteText === 'löschen') {
        localStorage.removeItem(NOTES_KEY);
        return [{
            title: 'Alle Notizen gelöscht',
            subtitle: 'Notizbuch wurde geleert',
            type: 'system'
        }];
    }

    if (noteText) {
        saveNote(noteText);
        return [{
            title: 'Notiz gespeichert',
            subtitle: `"${noteText.substring(0, 40)}${noteText.length > 40 ? '...' : ''}"`,
            type: 'system'
        }];
    }

    const notes = getNotes();

    if (notes.length === 0) {
        return [{
            title: 'Keine Notizen',
            subtitle: '/note Text um eine Notiz zu speichern',
            type: 'system'
        }];
    }

    return notes.slice(0, 10).map(note => ({
        title: note.text.length > 50 ? note.text.substring(0, 50) + '...' : note.text,
        subtitle: new Date(note.createdAt).toLocaleString('de-DE'),
        type: 'note',
        copyToClipboard: note.text
    }));
}

// ===========================================
// MAIN COMMAND ROUTER
// ===========================================
export function detectCommand(query: string): string | null {
    const q = query.trim().toLowerCase();

    if (q.startsWith('/cb') || q.startsWith('/clipboard')) return 'clipboard';
    if (q.startsWith('/timer') || q.startsWith('/stopwatch')) return 'timer';
    if (q.match(/^\/(de|en|es|fr|it|pt|nl)\s/)) return 'translate';
    if (q.startsWith('/pw') || q.startsWith('/password')) return 'password';
    if (q.startsWith('/qr')) return 'qr';
    if (q.startsWith('/emoji')) return 'emoji';
    if (q === '/ip') return 'ip';
    if (q.match(/^\/(kw|week|kalenderwoche|countdown)/)) return 'calendar';
    if (q === '/uuid') return 'uuid';
    if (q.startsWith('/b64e') || q.startsWith('/b64d')) return 'base64';
    if (q.startsWith('/hash')) return 'hash';
    if (q === '/ts' || q === '/timestamp') return 'timestamp';
    if (q.startsWith('/lorem')) return 'lorem';
    if (q.startsWith('/wiki') || q.startsWith('/wikipedia')) return 'wiki';
    if (q.startsWith('/shorten')) return 'shorten';
    if (q.startsWith('/note') || q.startsWith('/notiz')) return 'notes';
    if (q.startsWith('/settings') || q.startsWith('/einstellungen')) return 'settings';
    if (q === '/sys' || q === '/system') return 'sysmon';
    if (q === '/sleep' || q === '/bildschirm') return 'sleep';
    if (q.match(/^\/vol(ume)?\s*\d*$/i) || q === '/mute') return 'volume';
    if (q === '/trash' || q === '/papierkorb') return 'trash';
    if (q === '/screen' || q === '/screenshot') return 'screenshot';
    if (q.startsWith('/kill')) return 'kill';

    // Unit/Currency conversions
    if (query.match(/^\d+\s*(c|f|k)\s+(in|to|nach)\s*(c|f|k)/i)) return 'unit';
    if (query.match(/^\d+\s*(km|m|cm|mm|mi|yd|ft|in|kg|g|lb|oz|l|gal)\s+(in|to|nach)/i)) return 'unit';
    if (query.match(/^\d+\s*(usd|eur|gbp|jpy|chf)\s+(in|to|nach)/i)) return 'currency';

    return null;
}

export async function executeCommand(command: string, query: string): Promise<CommandResult[]> {
    try {
        switch (command) {
            case 'clipboard':
                return handleClipboardCommand(query);
            case 'timer':
                return handleTimerCommand(query);
            case 'translate':
                return await handleTranslateCommand(query);
            case 'password':
                return handlePasswordCommand(query);
            case 'qr':
                return handleQRCommand(query);
            case 'emoji':
                return handleEmojiCommand(query);
            case 'ip':
                return await handleIPCommand();
            case 'calendar':
                return handleCalendarCommand(query);
            case 'uuid':
                return [handleUUIDCommand()];
            case 'base64':
                return handleBase64Command(query);
            case 'hash':
                return await handleHashCommand(query);
            case 'timestamp':
                return handleTimestampCommand(query);
            case 'lorem':
                return [handleLoremCommand(query)];
            case 'wiki':
                return await handleWikiCommand(query);
            case 'shorten':
                return await handleShortenCommand(query);
            case 'notes':
                return handleNotesCommand(query);
            case 'unit':
                const unitResult = handleUnitConversion(query);
                return unitResult ? [unitResult] : [];
            case 'currency':
                return await handleCurrencyCommand(query);
            default:
                return [];
        }
    } catch (e) {
        console.error('Command execution error:', e);
        return [{
            title: 'Fehler beim Ausführen',
            subtitle: 'Befehl konnte nicht ausgeführt werden',
            type: 'system'
        }];
    }
}