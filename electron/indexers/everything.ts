/**
 * Everything Search Integration
 * 
 * Uses the "Everything" tool by Voidtools (https://www.voidtools.com/)
 * for instant file system search across ALL files on ALL drives.
 * 
 * Everything reads the NTFS MFT directly, providing results in milliseconds
 * for millions of files - much faster than Windows Search.
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import type { IndexItem } from './types';

// Check if Everything is running.
// Cached for a short TTL: the search handler calls this on (nearly) every keystroke,
// and the underlying `tasklist` is a synchronous, main-thread-blocking process spawn
// (~50-200ms). Probing once per ~30s instead keeps search input snappy.
let everythingRunningCache: { value: boolean; ts: number } | null = null;
const EVERYTHING_PROBE_TTL_MS = 30_000;

export function isEverythingRunning(): boolean {
    if (everythingRunningCache && Date.now() - everythingRunningCache.ts < EVERYTHING_PROBE_TTL_MS) {
        return everythingRunningCache.value;
    }
    let value = false;
    try {
        const result = execSync('tasklist /fi "imagename eq everything.exe" /nh', {
            encoding: 'utf-8',
            timeout: 2000
        });
        value = result.toLowerCase().includes('everything.exe');
    } catch {
        value = false;
    }
    everythingRunningCache = { value, ts: Date.now() };
    return value;
}

// Search using Everything command-line interface (es.exe)
// This is the most reliable method
async function searchWithEverything(query: string, maxResults: number = 50): Promise<IndexItem[]> {
    if (!query?.trim()) return [];

    // Find es.exe (Everything command-line)
    const esPaths = [
        'C:\\Program Files\\Everything\\es.exe',
        'C:\\Program Files (x86)\\Everything\\es.exe',
        'D:\\Program Files\\Everything\\es.exe',
        `${process.env.LOCALAPPDATA}\\Everything\\es.exe`,
    ];

    let esPath: string | null = null;
    for (const p of esPaths) {
        try {
            await fs.access(p);
            esPath = p;
            break;
        } catch { /* ignore - not found */ }
    }

    if (!esPath) {
        console.log('[Everything] es.exe not found, falling back to other methods');
        return [];
    }

    try {
        // Build query - escape special characters
        const escapedQuery = query.replace(/"/g, '""');

        // Use es.exe to search
        // -n = max results, -path = full path, -filename = filename only
        const cmd = `"${esPath}" -n ${maxResults} -path "${escapedQuery}"`;

        const result = execSync(cmd, {
            encoding: 'utf-16le', // es.exe outputs UTF-16
            timeout: 5000,
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });

        const lines = result.split(/\r?\n/).filter(l => l.trim());
        const items: IndexItem[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            try {
                const stat = await fs.stat(trimmedLine);
                const isDir = stat.isDirectory();
                const fileName = trimmedLine.split('\\').pop() || trimmedLine;
                const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()?.toLowerCase() : '';

                let type: 'app' | 'file' | 'folder' | 'game' = isDir ? 'folder' : 'file';

                // Detect type based on extension — check game paths BEFORE the generic
                // .exe→app rule, otherwise every game exe is mis-typed as a plain app.
                if (!isDir) {
                    const lower = trimmedLine.toLowerCase();
                    if (ext === '.exe' && (
                        lower.includes('steam\\steamapps\\common') ||
                        lower.includes('epic games') ||
                        lower.includes('riot games')
                    )) {
                        type = 'game';
                    } else if (['.exe', '.lnk', '.url', '.msi', '.bat', '.cmd', '.ps1'].includes(ext)) {
                        type = 'app';
                    }
                }

                items.push({
                    title: fileName,
                    path: trimmedLine,
                    type,
                    priority: 5,
                    iconPath: trimmedLine
                });
            } catch {
                // File might not be accessible, still add it
                const fileName = trimmedLine.split('\\').pop() || trimmedLine;
                items.push({
                    title: fileName,
                    path: trimmedLine,
                    type: 'file',
                    priority: 5,
                    iconPath: trimmedLine
                });
            }
        }

        console.log(`[Everything] Found ${items.length} results for "${query}"`);
        return items;
    } catch (error) {
        console.error('[Everything] Search error:', error);
        return [];
    }
}

// Search using Everything HTTP API (if Everything is running with HTTP server)
async function searchWithEverythingHTTP(query: string, maxResults: number = 50): Promise<IndexItem[]> {
    if (!query?.trim()) return [];

    try {
        // Everything HTTP server typically runs on localhost:8080
        const response = await fetch(`http://127.0.0.1:8080/?search=${encodeURIComponent(query)}&count=${maxResults}&path_column=1&json=1`, {
            signal: AbortSignal.timeout(3000)
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json() as { results?: Array<{ path?: string; type?: string }> };
        const items: IndexItem[] = [];

        if (data.results && Array.isArray(data.results)) {
            for (const result of data.results) {
                const path = result.path || '';
                const fileName = path.split('\\').pop() || path;
                const isDir = result.type === 'folder';

                items.push({
                    title: fileName,
                    path,
                    type: isDir ? 'folder' : 'file',
                    priority: 5,
                    iconPath: path
                });
            }
        }

        console.log(`[Everything HTTP] Found ${items.length} results for "${query}"`);
        return items;
    } catch {
        // HTTP server not running
        return [];
    }
}

// Combined Everything search - tries multiple methods
export async function searchEverything(query: string, maxResults: number = 50): Promise<IndexItem[]> {
    // First check if Everything is running
    if (!isEverythingRunning()) {
        console.log('[Everything] Not running, skipping Everything search');
        return [];
    }

    // Try HTTP API first (fastest)
    const httpResults = await searchWithEverythingHTTP(query, maxResults);
    if (httpResults.length > 0) {
        return httpResults;
    }

    // Fallback to command-line
    return searchWithEverything(query, maxResults);
}