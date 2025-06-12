import React, { useState, useRef, useEffect } from 'react';
import { X, Search } from 'lucide-react';

export interface MultiSelectTagOption { id: string; name: string; }
interface MultiSelectTagProps {
  options: MultiSelectTagOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

const MultiSelectTag: React.FC<MultiSelectTagProps> = ({ options, selected, onChange, placeholder }) => {
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const filtered = options.filter(opt =>
    !selected.includes(opt.id) &&
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  const add = (id: string) => {
    onChange([...selected, id]);
    setSearch('');
    setDropdownOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };
  const remove = (id: string) => {
    onChange(selected.filter(sel => sel !== id));
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="flex flex-wrap items-center gap-1 min-h-[38px] border rounded px-2 py-1 bg-white dark:bg-slate-800 cursor-text"
        onClick={() => { setDropdownOpen(true); if (inputRef.current) inputRef.current.focus(); }}
        tabIndex={0}
        role="button"
      >
        {selected.length === 0 && <span className="text-gray-400">{placeholder || 'Select...'}</span>}
        {selected.map(id => {
          const opt = options.find(o => o.id === id);
          if (!opt) return null;
          return (
            <span key={id} className="flex items-center bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-xs mr-1 mb-1 dark:bg-blue-900 dark:text-blue-200">
              {opt.name}
              <button
                type="button"
                className="ml-1 text-blue-600 hover:text-red-600"
                onClick={e => { e.stopPropagation(); remove(id); }}
                aria-label="Remove"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setDropdownOpen(true); }}
          onFocus={() => setDropdownOpen(true)}
          className="flex-grow bg-transparent outline-none text-gray-800 dark:text-gray-200 min-w-[120px]"
          placeholder={selected.length === 0 ? placeholder : ''}
        />
      </div>
      {dropdownOpen && filtered.length > 0 && (
        <div className="absolute left-0 mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-lg z-10 max-h-48 overflow-auto">
          {filtered.map(opt => (
            <div
              key={opt.id}
              className="px-3 py-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-100"
              onClick={() => add(opt.id)}
            >
              {opt.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MultiSelectTag; 