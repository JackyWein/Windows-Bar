import React from 'react';
import { Search } from 'lucide-react';

import './SearchBar.css';

interface SearchBarProps {
    query: string;
    setQuery: (query: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    inputRef: React.RefObject<HTMLInputElement>;
    autoFocus?: boolean;
}

export function SearchBar({ query, setQuery, onKeyDown, inputRef, autoFocus }: SearchBarProps) {
    return (
        <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
                ref={inputRef}
                className="search-input"
                placeholder="Suchen..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                autoFocus={autoFocus}
            />
            <div className="shortcut-hint">
                <kbd>ESC</kbd>
            </div>
        </div>
    );
}