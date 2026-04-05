// Shared types for indexers
export interface IndexItem {
    title: string;
    path: string;
    type: 'app' | 'file' | 'game' | 'system' | 'folder';
    priority: number;
    realPath?: string;
    iconPath?: string;
}

export const APP_EXTS = new Set(['.exe', '.lnk', '.url', '.msi', '.bat', '.cmd', '.ps1']);
export const DOC_EXTS = new Set(['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm']);
export const MEDIA_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mkv', '.avi', '.mp3', '.wav', '.flac', '.zip', '.rar', '.7z']);
export const ALL_EXTS = new Set([...APP_EXTS, ...DOC_EXTS, ...MEDIA_EXTS]);

export const SKIP_DIRS = new Set([
    'node_modules', '.git', '__pycache__', '.vscode', '.idea', 'dist',
    '$recycle.bin', '$windows.~bt', '$windows.~ws', 'windows',
    'system volume information', 'recovery', 'msocache',
    'perflogs', 'config.msi', 'intel', 'amd', 'nvidia',
    'programdata', 'appdata',
]);

export const SKIP_EXES = new Set([
    'unins000.exe', 'uninstall.exe', 'unitycrashhandler64.exe', 'unitycrashhandler32.exe',
    'crashreporter.exe', 'crashpad_handler.exe', 'ue4prereqsetup_x64.exe',
    'dxsetup.exe', 'vcredist_x64.exe', 'vcredist_x86.exe', 'dotnetfx35setup.exe',
]);