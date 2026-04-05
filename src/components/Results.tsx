import React, { useState } from 'react';
import { File, AppWindow, Gamepad2, Bot, Globe, Calculator, Folder, FileText, Settings, CloudRain, HardDrive, Music, Video, Image, Archive, Code, FileSpreadsheet, Presentation } from 'lucide-react';
import './Results.css';

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    type: 'app' | 'file' | 'game' | 'ai' | 'web' | 'system' | 'weather' | 'calc' | 'folder';
    path?: string;
    isWeb?: boolean;
    iconBase64?: string;
    isExpandBtn?: boolean;
    isSubItem?: boolean;
    isRecent?: boolean;
}

interface ResultsProps {
    results: SearchResult[];
    selectedIndex: number;
    expandedFolder: string | null;
    folderItems: SearchResult[];
    folderLoading: boolean;
    onSelect: (index: number) => void;
    onExecute: (result: SearchResult) => void;
    onToggleFolder: (path: string) => void;
}

// Get icon based on file extension
const getFileTypeIcon = (path: string | undefined): React.ReactNode => {
    if (!path) return <File size={16} />;
    const ext = path.split('.').pop()?.toLowerCase() || '';

    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) return <Music size={16} />;
    if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) return <Video size={16} />;
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) return <Image size={16} />;
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return <Archive size={16} />;
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml'].includes(ext)) return <Code size={16} />;
    if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return <FileText size={16} />;
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return <FileSpreadsheet size={16} />;
    if (['ppt', 'pptx', 'odp'].includes(ext)) return <Presentation size={16} />;
    if (path.match(/^[A-Z]:\\$/i)) return <HardDrive size={16} />;
    return <File size={16} />;
};

const getIcon = (type: string, path?: string): React.ReactNode => {
    switch (type) {
        case 'app': return <AppWindow size={16} />;
        case 'game': return <Gamepad2 size={16} />;
        case 'file': return getFileTypeIcon(path);
        case 'system': return <Settings size={16} />;
        case 'weather': return <CloudRain size={16} />;
        case 'calc': return <Calculator size={16} />;
        case 'ai': return <Bot size={16} />;
        case 'web': return <Globe size={16} />;
        case 'folder': return <Folder size={16} />;
        default: return <FileText size={16} />;
    }
};

const getBadge = (type: string): string => {
    switch (type) {
        case 'app': return 'App';
        case 'game': return 'Spiel';
        case 'system': return 'System';
        case 'weather': return 'Wetter';
        case 'calc': return 'Mathe';
        case 'file': return 'Datei';
        case 'ai': return 'KI';
        case 'web': return 'Web';
        default: return '';
    }
};

export function Results({
    results, selectedIndex, expandedFolder, folderItems, folderLoading, onSelect, onExecute, onToggleFolder
}: ResultsProps) {
    const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());

    const handleIconError = (path: string) => {
        setFailedIcons(prev => new Set(prev).add(path));
    };

    return (
        <div className="results-container">
            {results.map((res, idx) => (
                <div
                    key={res.id}
                    className={`result-item ${idx === selectedIndex ? 'selected' : ''} ${res.isSubItem ? 'sub-item' : ''}`}
                    onClick={() => onExecute(res)}
                    onMouseEnter={() => onSelect(idx)}
                    data-type={res.type}
                >
                    <div className={`result-icon ${res.iconBase64 && !failedIcons.has(res.path || '') ? 'custom' : res.type}`}>
                        {res.iconBase64 && !failedIcons.has(res.path || '') ? (
                            <img
                                src={res.iconBase64}
                                className="result-icon-img"
                                alt=""
                                onError={() => res.path && handleIconError(res.path)}
                            />
                        ) : getIcon(res.type, res.path)}
                    </div>
                    <div className="result-content">
                        <span className="result-title">{res.title}</span>
                        {res.subtitle && <span className="result-subtitle">{res.subtitle}</span>}
                    </div>
                    {!res.isExpandBtn && <span className="result-badge">{getBadge(res.type)}</span>}
                    <span className="result-enter">{res.isExpandBtn ? 'Tab' : '↵'}</span>
                </div>
            ))}
        </div>
    );
}