/**
 * Windows Search Indexer Integration
 * 
 * Uses Windows built-in search indexer via PowerShell and WMI queries.
 * This provides access to all indexed files on the system.
 */

import { execSync } from 'child_process';
import type { IndexItem } from './types';

// Search using Windows Search via PowerShell
export async function searchWithWindowsIndex(query: string, maxResults: number = 50): Promise<IndexItem[]> {
    if (!query?.trim()) return [];

    try {
        // Use Windows Search via PowerShell with Get-ChildItem for comprehensive search
        // This searches ALL files, not just indexed ones
        const escapedQuery = query.replace(/'/g, "''").replace(/"/g, '`"');

        // Method 1: Try Windows Search Indexer first (faster but only indexed locations)
        const indexerQuery = `
            $ErrorActionPreference = 'SilentlyContinue'
            $query = "${escapedQuery}"
            $results = @()
            
            # Search using Windows Search Indexer
            $conn = New-Object -ComObject ADODB.Connection
            $rs = New-Object -ComObject ADODB.Recordset
            $conn.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
            $sql = "SELECT TOP ${maxResults} System.ItemPathDisplay, System.ItemName, System.ItemType FROM SystemIndex WHERE System.ItemName LIKE '%$query%'"
            $rs.Open($sql, $conn)
            
            while (-not $rs.EOF) {
                $path = $rs.Fields.Item("System.ItemPathDisplay").Value
                $name = $rs.Fields.Item("System.ItemName").Value
                $type = $rs.Fields.Item("System.ItemType").Value
                $results += "$path|$name|$type"
                $rs.MoveNext()
            }
            $rs.Close()
            $conn.Close()
            $results -join [char]10
        `;

        try {
            const result = execSync(`powershell -NoProfile -Command "${indexerQuery.replace(/\n/g, ' ')}"`, {
                encoding: 'utf-8',
                timeout: 10000,
                maxBuffer: 1024 * 1024 * 5
            });

            const items: IndexItem[] = [];
            const lines = result.trim().split('\n').filter(l => l.trim() && l.includes('|'));

            for (const line of lines) {
                const [path, name, type] = line.split('|');
                if (!path || path.trim() === '') continue;

                const isFolder = type?.toLowerCase().includes('folder') || path.endsWith('\\');
                const ext = path.includes('.') ? '.' + path.split('.').pop()?.toLowerCase() : '';

                let itemType: 'app' | 'file' | 'folder' | 'game' = isFolder ? 'folder' : 'file';
                if (!isFolder && ['.exe', '.lnk', '.url', '.msi', '.bat', '.cmd', '.ps1'].includes(ext)) {
                    itemType = 'app';
                }

                items.push({
                    title: name || path.split('\\').pop() || path,
                    path: path.trim(),
                    type: itemType,
                    priority: 5,
                    iconPath: path.trim()
                });
            }

            if (items.length > 0) {
                console.log(`[Windows Search] Found ${items.length} indexed results for "${query}"`);
                return items;
            }
        } catch {
            console.log('[Windows Search] Indexer query failed, falling back to direct search');
        }

        // Method 2: Direct file system search (slower but finds everything)
        return await searchWithDirectScan(query, maxResults);
    } catch (error) {
        console.error('[Windows Search] Error:', error);
        return [];
    }
}

// Direct file system scan - searches ALL files on all drives
async function searchWithDirectScan(query: string, maxResults: number): Promise<IndexItem[]> {
    const items: IndexItem[] = [];
    const escapedQuery = query.replace(/'/g, "''").replace(/[[\]]/g, '`$&');

    // Get all fixed drives
    const drives = execSync('wmic logicaldisk where "drivetype=3" get deviceid /format:list', {
        encoding: 'utf-8',
        timeout: 5000
    }).split('\n')
        .filter(l => l.includes('DeviceID='))
        .map(l => l.split('=')[1]?.trim())
        .filter(d => d);

    console.log(`[Direct Scan] Scanning drives: ${drives.join(', ')}`);

    for (const drive of drives) {
        if (items.length >= maxResults) break;

        try {
            // Use Get-ChildItem with -Recurse and -Filter for comprehensive search
            // Excludes system/hidden directories that are typically not useful
            const psScript = `
                $ErrorActionPreference = 'SilentlyContinue'
                $query = "${escapedQuery}"
                $maxResults = ${maxResults - items.length}
                $results = @()
                
                # Search root directories first (faster)
                Get-ChildItem -Path "${drive}\\" -Directory -ErrorAction SilentlyContinue | 
                    Where-Object { 
                        $_.Name -notmatch '^($|System Volume Information|Recovery|$Recycle|Windows|Program Files|ProgramData|AppData)'
                    } |
                    ForEach-Object {
                        Get-ChildItem -Path $_.FullName -Recurse -File -ErrorAction SilentlyContinue | 
                        Where-Object { $_.Name -like "*$query*" } | 
                        Select-Object -First $maxResults | 
                        ForEach-Object { 
                            $results += "$($_.FullName)|$($_.Name)|file"
                        }
                    }
                
                # Also search user folders specifically
                $userFolders = @('Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Music')
                foreach ($folder in $userFolders) {
                    $path = [Environment]::GetFolderPath($folder)
                    if ($path -and (Test-Path $path)) {
                        Get-ChildItem -Path $path -Recurse -ErrorAction SilentlyContinue | 
                        Where-Object { $_.Name -like "*$query*" } | 
                        Select-Object -First 10 | 
                        ForEach-Object { 
                            $type = if ($_.PSIsContainer) { "folder" } else { "file" }
                            $results += "$($_.FullName)|$($_.Name)|$type"
                        }
                    }
                }
                
                $results -join [char]10
            `;

            const result = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, {
                encoding: 'utf-8',
                timeout: 30000, // 30 second timeout for comprehensive search
                maxBuffer: 1024 * 1024 * 10
            });

            const lines = result.trim().split('\n').filter(l => l.trim() && l.includes('|'));

            for (const line of lines) {
                if (items.length >= maxResults) break;

                const [path, name, type] = line.split('|');
                if (!path || path.trim() === '') continue;

                const ext = path.includes('.') ? '.' + path.split('.').pop()?.toLowerCase() : '';
                let itemType: 'app' | 'file' | 'folder' | 'game' = type === 'folder' ? 'folder' : 'file';

                if (type !== 'folder' && ['.exe', '.lnk', '.url', '.msi', '.bat', '.cmd', '.ps1'].includes(ext)) {
                    itemType = 'app';
                }

                items.push({
                    title: name || path.split('\\').pop() || path,
                    path: path.trim(),
                    type: itemType,
                    priority: 5,
                    iconPath: path.trim()
                });
            }
        } catch (e) {
            console.error(`[Direct Scan] Error scanning drive ${drive}:`, e);
        }
    }

    console.log(`[Direct Scan] Found ${items.length} results for "${query}"`);
    return items;
}

// Quick search using where command (Windows built-in)
export async function searchWithWhere(query: string, maxResults: number = 20): Promise<IndexItem[]> {
    if (!query?.trim()) return [];

    try {
        // Use 'where' command for executable search
        const result = execSync(`where /r C:\\ *${query}* 2>nul`, {
            encoding: 'utf-8',
            timeout: 15000,
            maxBuffer: 1024 * 1024 * 2
        });

        const items: IndexItem[] = [];
        const lines = result.trim().split('\n').filter(l => l.trim());

        for (const line of lines.slice(0, maxResults)) {
            const path = line.trim();
            const fileName = path.split('\\').pop() || path;

            items.push({
                title: fileName,
                path,
                type: 'file',
                priority: 5,
                iconPath: path
            });
        }

        return items;
    } catch {
        return [];
    }
}