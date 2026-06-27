import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, Check, X, Search } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  placeholder?: string;
  maxSelection?: number;
  disabled?: boolean;
  className?: string;
  searchable?: boolean;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Select options...",
  maxSelection,
  disabled = false,
  className = "",
  searchable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      // Small timeout to allow render
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchTerm(''); // Clear search on close
    }
  }, [isOpen, searchable]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (optionValue: string) => {
    const isSelected = value.includes(optionValue);
    let newValue: string[];

    if (isSelected) {
      newValue = value.filter((v) => v !== optionValue);
    } else {
      if (maxSelection && value.length >= maxSelection) {
        return; // Max limit reached
      }
      newValue = [...value, optionValue];
    }

    onChange(newValue);
    // Keep open for multiple selections
  };

  const handleRemove = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation(); // Prevent toggling dropdown
    const newValue = value.filter((v) => v !== optionValue);
    onChange(newValue);
  };

  // Filter options based on search
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Get selected option labels for chips
  const selectedOptions = options.filter(o => value.includes(o.value));

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div
        onClick={handleToggle}
        className={`w-full bg-white border border-slate-300 rounded-md py-2 px-3 min-h-[42px] flex items-center justify-between shadow-sm text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500 sm:text-sm ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'hover:border-slate-400'
          }`}
      >
        <div className="flex flex-wrap gap-2 flex-grow">
          {selectedOptions.length > 0 ? (
            selectedOptions.map(option => (
              <span
                key={option.value}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, option.value)}
                  className="ml-1.5 h-3.5 w-3.5 rounded-full inline-flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus:outline-none"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-500 py-0.5">{placeholder}</span>
          )}
        </div>
        <span className="ml-2 flex items-center pointer-events-none text-slate-400">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-hidden flex flex-col sm:text-sm">

          {searchable && (
            <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="block w-full pl-10 pr-3 py-1.5 border border-slate-200 rounded-md leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-xs"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="overflow-auto flex-1 max-h-[200px]">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);
                const isDisabled =
                  !isSelected && maxSelection !== undefined && value.length >= maxSelection;

                return (
                  <div
                    key={option.value}
                    onClick={() => !isDisabled && handleSelect(option.value)}
                    className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-slate-50 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`h-4 w-4 border rounded mr-3 flex items-center justify-center transition-colors ${isSelected
                          ? 'bg-slate-900 border-slate-900'
                          : 'border-slate-300 bg-white'
                          }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`block truncate ${isSelected ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                        {option.label}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-2 px-3 text-center text-slate-500 text-xs">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
