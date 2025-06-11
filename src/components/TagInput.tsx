import React, { useState } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

const TagInput: React.FC<TagInputProps> = ({ 
  tags, 
  onTagsChange, 
  placeholder = "Type and press Enter to add tags",
  className = ""
}) => {
  const [currentTag, setCurrentTag] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        onTagsChange([...tags, currentTag.trim()]);
      }
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className={`flex flex-wrap items-center w-full border rounded-lg p-2 min-h-[42px] bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 ${className}`}>
      {tags.map(tag => (
        <span 
          key={tag} 
          className="flex items-center bg-blue-100 text-blue-800 text-sm font-medium mr-2 mb-1 px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-2 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-100 transition-colors"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={currentTag}
        onChange={(e) => setCurrentTag(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-grow bg-transparent outline-none text-gray-800 dark:text-gray-200 min-w-[120px]"
      />
    </div>
  );
};

export default TagInput;