// Shared types for indexers
export interface IndexItem {
    title: string;
    path: string;
    type: 'app' | 'file' | 'game' | 'system' | 'folder';
    priority: number;
    realPath?: string;
    iconPath?: string;
}