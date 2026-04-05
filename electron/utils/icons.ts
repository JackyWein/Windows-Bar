// Icon extraction utilities
import { app, shell } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const iconCache = new Map<string, string>();

export { iconCache };

// Read image files directly as base64
export async function readImageFileAsBase64(imgPath: string): Promise<string | null> {
    try {
        const buffer = await fs.readFile(imgPath);
        const ext = imgPath.toLowerCase();
        if (ext.endsWith('.png')) return `data:image/png;base64,${buffer.toString('base64')}`;
        if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return `data:image/jpeg;base64,${buffer.toString('base64')}`;
        if (ext.endsWith('.ico')) return `data:image/x-icon;base64,${buffer.toString('base64')}`;
        if (ext.endsWith('.bmp')) return `data:image/bmp;base64,${buffer.toString('base64')}`;
        return null;
    } catch { return null; }
}

// Try to get icon with retries
export async function tryGetIconWithRetry(targetPath: string, retries = 2): Promise<string | null> {
    if (!targetPath) return null;

    // Direct image files first
    if (targetPath.match(/\.(ico|png|jpg|jpeg|bmp)$/i)) {
        const directIcon = await readImageFileAsBase64(targetPath);
        if (directIcon) return directIcon;
    }

    // Electron's getFileIcon with retries
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const img = await app.getFileIcon(targetPath, { size: 'large' });
            const dataUrl = img.toDataURL();
            if (dataUrl && dataUrl.length > 100) return dataUrl;
        } catch {
            try {
                const img = await app.getFileIcon(targetPath, { size: 'normal' });
                const dataUrl = img.toDataURL();
                if (dataUrl && dataUrl.length > 100) return dataUrl;
            } catch {
                if (attempt < retries) await new Promise(r => setTimeout(r, 50));
            }
        }
    }
    return null;
}

// Get Steam path
export function getSteamPath(): string | null {
    try {
        const out = execSync('reg query HKCU\\Software\\Valve\\Steam /v SteamPath').toString();
        const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/);
        if (match) return match[1].trim().replace(/\//g, '\\');
    } catch { }

    const fallbacks = ['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam', 'D:\\Steam', 'E:\\Steam'];
    for (const f of fallbacks) {
        try { if (require('fs').existsSync(f)) return f; } catch { }
    }
    return null;
}