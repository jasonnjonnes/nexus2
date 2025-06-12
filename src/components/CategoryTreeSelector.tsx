import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, X, Search } from 'lucide-react';
import type { Category } from '../types/pricebook';

interface CategoryTreeSelectorProps {
  categories: Category[];
  selected: string[];
  onChange: (selected: string[]) => void;
  type?: 'service' | 'material' | 'equipment';
}

const getChildren = (categories: Category[], parentId: string | null, type?: string) =>
  categories.filter(cat => cat.parentId === parentId && (!type || cat.type === type));

const getDescendantIds = (categories: Category[], parentId: string): string[] => {
  const children = categories.filter(cat => cat.parentId === parentId);
  let ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    ids = ids.concat(getDescendantIds(categories, child.id));
  }
  return ids;
};

const getCategoryPath = (categories: Category[], id: string): string => {
  const cat = categories.find(c => c.id === id);
  if (!cat) return '';
  let path = cat.name;
  let parent = cat.parentId ? categories.find(c => c.id === cat.parentId) : undefined;
  while (parent) {
    path = parent.name + ' > ' + path;
    if (!parent.parentId) break;
    parent = categories.find(c => c.id === parent.parentId);
  }
  return path;
};

const CategoryTree: React.FC<{
  categories: Category[];
  selected: string[];
  onCheck: (id: string, checked: boolean) => void;
  parentId: string | null;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  type?: string;
  search: string;
}> = ({ categories, selected, onCheck, parentId, expanded, setExpanded, type, search }) => {
  let children = getChildren(categories, parentId, type);
  if (search) {
    children = children.filter(cat => getCategoryPath(categories, cat.id).toLowerCase().includes(search.toLowerCase()));
  }
  if (!children.length) return null;
  return (
    <ul className="pl-4 border-l border-gray-200 dark:border-slate-700">
      {children.map(cat => {
        const hasChildren = getChildren(categories, cat.id, type).length > 0;
        const isExpanded = expanded.has(cat.id);
        return (
          <li key={cat.id} className="mb-1">
            <div className="flex items-center">
              {hasChildren && (
                <button
                  type="button"
                  className="mr-1 p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev);
                    if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id);
                    return next;
                  })}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              )}
              <input
                type="checkbox"
                checked={selected.includes(cat.id)}
                onChange={e => onCheck(cat.id, e.target.checked)}
                className="mr-2"
                id={`cat-${cat.id}`}
              />
              <label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer">{cat.name}</label>
            </div>
            {hasChildren && isExpanded && (
              <CategoryTree
                categories={categories}
                selected={selected}
                onCheck={onCheck}
                parentId={cat.id}
                expanded={expanded}
                setExpanded={setExpanded}
                type={type}
                search={search}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};

const CategoryTreeSelector: React.FC<CategoryTreeSelectorProps> = ({ categories, selected, onChange, type }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLDivElement>(null);

  // Expand parents of selected categories by default
  useEffect(() => {
    const expandToSelected = () => {
      const next = new Set<string>();
      selected.forEach(selId => {
        let cat = categories.find(c => c.id === selId);
        while (cat && cat.parentId) {
          next.add(cat.parentId);
          cat = categories.find(c => c.id === cat.parentId);
        }
      });
      setExpanded(next);
    };
    expandToSelected();
  }, [selected, categories]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  // Parent/child selection logic
  const handleCheck = (id: string, checked: boolean) => {
    if (checked) {
      // Select this and all descendants
      const allIds = [id, ...getDescendantIds(categories, id)];
      onChange(Array.from(new Set([...selected, ...allIds])));
    } else {
      // Deselect this and all descendants
      const allIds = [id, ...getDescendantIds(categories, id)];
      onChange(selected.filter(selId => !allIds.includes(selId)));
    }
  };

  // Remove a single category (and its descendants)
  const handleRemove = (id: string) => {
    const allIds = [id, ...getDescendantIds(categories, id)];
    onChange(selected.filter(selId => !allIds.includes(selId)));
  };

  // Render selected as tags
  const selectedCats = selected
    .map(id => categories.find(c => c.id === id))
    .filter((cat): cat is Category => Boolean(cat));
  // Only show leaf or top-level selected (not children of other selected)
  const isChildOfSelected = (cat: Category | undefined) => {
    if (!cat) return false;
    let parent = cat.parentId ? categories.find(c => c.id === cat.parentId) : undefined;
    while (parent) {
      if (selected.includes(parent.id)) return true;
      if (!parent.parentId) break;
      parent = categories.find(c => c.id === parent.parentId);
    }
    return false;
  };
  const displayTags = selectedCats.filter(cat => !isChildOfSelected(cat));

  return (
    <div className="relative" ref={inputRef}>
      <div
        className="flex flex-wrap items-center gap-1 min-h-[38px] border rounded px-2 py-1 bg-white dark:bg-slate-800 cursor-pointer"
        onClick={() => setDropdownOpen(v => !v)}
        tabIndex={0}
        role="button"
      >
        {displayTags.length === 0 && <span className="text-gray-400">Select categories...</span>}
        {displayTags.map(cat => (
          <span key={cat.id} className="flex items-center bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-xs mr-1 mb-1">
            {getCategoryPath(categories, cat.id)}
            <button
              type="button"
              className="ml-1 text-blue-600 hover:text-red-600"
              onClick={e => { e.stopPropagation(); handleRemove(cat.id); }}
              aria-label="Remove category"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      {dropdownOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border rounded shadow-lg max-h-72 overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-slate-800 p-2 border-b flex items-center">
            <Search size={16} className="mr-2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="w-full bg-transparent outline-none text-sm"
              autoFocus
            />
          </div>
          <div className="p-2">
            <CategoryTree
              categories={categories}
              selected={selected}
              onCheck={handleCheck}
              parentId={null}
              expanded={expanded}
              setExpanded={setExpanded}
              type={type}
              search={search}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryTreeSelector; 