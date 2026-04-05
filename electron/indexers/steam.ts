// Steam games indexer
import { promises as fs } from 'fs';
import { join } from 'path';
import { IndexItem, SKIP_EXES } from './types';
import { getSteamPath } from '../utils/icons';

export async function scanSteamGames(): Promise<IndexItem[]> {
    const items: IndexItem[] = [];
    const steamPath = getSteamPath();
    if (!steamPath) return items;

    const libraryRoots = [steamPath];

    // Parse libraryfolders.vdf for additional libraries
    try {
        const vdfPath = join(steamPath, 'steamapps', 'libraryfolders.vdf');
        const vdf = await fs.readFile(vdfPath, 'utf-8');
        const pathMatches = vdf.match(/"path"\s+"([^"]+)"/g);
        if (pathMatches) {
            for (const m of pathMatches) {
                const p = m.match(/"path"\s+"([^"]+)"/)?.[1]?.replace(/\\\\/g, '\\');
                if (p && !libraryRoots.includes(p)) libraryRoots.push(p);
            }
        }
    } catch { }

    for (const root of libraryRoots) {
        const appsDir = join(root, 'steamapps');
        try {
            const files = await fs.readdir(appsDir);
            for (const f of files) {
                if (!f.startsWith('appmanifest_') || !f.endsWith('.acf')) continue;
                try {
                    const content = await fs.readFile(join(appsDir, f), 'utf-8');
                    const appId = content.match(/"appid"\s+"(\d+)"/)?.[1];
                    const name = content.match(/"name"\s+"([^"]+)"/)?.[1];
                    const installDir = content.match(/"installdir"\s+"([^"]+)"/)?.[1];

                    if (appId && name && installDir) {
                        const gameFolder = join(root, 'steamapps', 'common', installDir);
                        const exePath = await findMainExe(gameFolder);
                        items.push({
                            title: name,
                            path: `steam://rungameid/${appId}`,
                            realPath: gameFolder,
                            iconPath: exePath || gameFolder,
                            type: 'game',
                            priority: 0
                        });
                    }
                } catch { }
            }
        } catch { }
    }
    return items;
}

async function findMainExe(dir: string): Promise<string | null> {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const exes = entries
            .filter(e => !e.isDirectory() && e.name.toLowerCase().endsWith('.exe'))
            .filter(e => !SKIP_EXES.has(e.name.toLowerCase()))
            .map(e => e.name);

        if (exes.length === 0) return null;
        if (exes.length === 1) return join(dir, exes[0]);

        const folderName = dir.split('\\').pop()?.toLowerCase() || '';
        const match = exes.find(e => e.toLowerCase().replace('.exe', '').includes(folderName));
        if (match) return join(dir, match);

        let largest = { name: exes[0], size: 0 };
        for (const exe of exes) {
            try {
                const stat = await fs.stat(join(dir, exe));
                if (stat.size > largest.size) largest = { name: exe, size: stat.size };
            } catch { }
        }
        return join(dir, largest.name);
    } catch { return null; }
}