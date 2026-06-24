// Icon extraction utilities
import { app, shell } from 'electron';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { execSync } from 'child_process';

const iconCache = new Map<string, string>();

export { iconCache };

// Read image files directly as base64
export async function readImageFileAsBase64(imgPath: string): Promise<string | null> {
    try {
        await fs.access(imgPath);
        const buffer = await fs.readFile(imgPath);
        if (buffer.length < 100) return null;
        const ext = imgPath.toLowerCase();
        if (ext.endsWith('.png')) return `data:image/png;base64,${buffer.toString('base64')}`;
        if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) return `data:image/jpeg;base64,${buffer.toString('base64')}`;
        if (ext.endsWith('.ico')) return `data:image/x-icon;base64,${buffer.toString('base64')}`;
        if (ext.endsWith('.bmp')) return `data:image/bmp;base64,${buffer.toString('base64')}`;
        return null;
    } catch { return null; }
}

// Check if a file path exists and is accessible
export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Resolve shortcut (.lnk) to get the best icon source
export async function resolveShortcutIcon(lnkPath: string): Promise<string | null> {
    try {
        const sh = shell.readShortcutLink(lnkPath);

        // Priority 1: Explicit custom icon that exists
        if (sh.icon && sh.icon.trim()) {
            const iconPath = sh.icon.trim();
            // Handle icon index syntax like "C:\path\to\file.exe,0"
            const cleanPath = iconPath.split(',')[0].replace(/^["']|["']$/g, '');
            if (await fileExists(cleanPath)) return cleanPath;
        }

        // Priority 2: Shortcut target exists
        if (sh.target && sh.target.trim()) {
            const targetPath = sh.target.trim();
            if (await fileExists(targetPath)) return targetPath;
        }

        // Priority 3: The .lnk file itself (Windows can extract from it)
        if (await fileExists(lnkPath)) return lnkPath;
    } catch {
        // If shortcut reading fails, try the .lnk itself
        if (await fileExists(lnkPath)) return lnkPath;
    }
    return null;
}

// Try to get icon with retries and multiple fallback strategies
export async function tryGetIconWithRetry(targetPath: string, retries = 2): Promise<string | null> {
    if (!targetPath) return null;

    // Direct image files first
    if (targetPath.match(/\.(ico|png|jpg|jpeg|bmp)$/i)) {
        const directIcon = await readImageFileAsBase64(targetPath);
        if (directIcon) return directIcon;
    }

    // For .url files, try to get icon from the file itself
    if (targetPath.toLowerCase().endsWith('.url')) {
        try {
            const content = await fs.readFile(targetPath, 'utf-8');
            const iconMatch = content.match(/IconFile=(.+)/i);
            if (iconMatch?.[1]) {
                let extractedPath = iconMatch[1].trim().replace(/^["']|["']$/g, '');
                // Handle relative paths
                if (!extractedPath.match(/^[A-Za-z]:\\/)) {
                    const urlDir = dirname(targetPath);
                    extractedPath = resolve(urlDir, extractedPath);
                }
                // Remove index suffix like ",0"
                extractedPath = extractedPath.split(',')[0];
                if (await fileExists(extractedPath)) {
                    const urlIcon = await tryGetIconWithRetry(extractedPath, retries);
                    if (urlIcon) return urlIcon;
                }
            }
        } catch { /* ignore */ }
    }

    // Check if path exists before trying getFileIcon
    if (!(await fileExists(targetPath))) {
        console.warn(`[Icon] File not found: ${targetPath}`);
        return null;
    }

    // Electron's getFileIcon with retries (will fetch custom shortcut icons for .lnk)
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

    // Fallback: Resolve .lnk files to their actual target if getFileIcon completely failed
    if (targetPath.toLowerCase().endsWith('.lnk')) {
        const resolved = await resolveShortcutIcon(targetPath);
        if (resolved && resolved !== targetPath) {
            // Recursively try with resolved path
            return tryGetIconWithRetry(resolved, retries);
        }
    }

    // Final fallback: try parent folder for folder icon
    try {
        const parentDir = dirname(targetPath);
        if (await fileExists(parentDir)) {
            const img = await app.getFileIcon(parentDir, { size: 'large' });
            const dataUrl = img.toDataURL();
            if (dataUrl && dataUrl.length > 100) return dataUrl;
        }
    } catch { /* ignore */ }

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
