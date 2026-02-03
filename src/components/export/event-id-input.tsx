'use client';

import { useState, useCallback } from 'react';

interface EventIdInputProps {
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
}

export function EventIdInput({
  value,
  onChange,
  placeholder = 'Enter Event IDs (comma-separated or one per line)',
}: EventIdInputProps) {
  const [inputValue, setInputValue] = useState(value.join(', '));

  const parseEventIds = useCallback((text: string): number[] => {
    // Split by comma, newline, or space
    const parts = text.split(/[,\n\s]+/).filter(Boolean);

    // Parse to numbers and filter valid IDs
    return parts
      .map((part) => parseInt(part.trim(), 10))
      .filter((num) => !isNaN(num) && num > 0);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    const ids = parseEventIds(newValue);
    onChange(ids);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const newValue = inputValue + pastedText;
    setInputValue(newValue);

    const ids = parseEventIds(newValue);
    onChange(ids);
  };

  return (
    <div className="space-y-2">
      <textarea
        value={inputValue}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={5}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y"
      />
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          {value.length} valid Event ID{value.length !== 1 ? 's' : ''} detected
          {value.length > 0 && (
            <span className="ml-2 text-gray-400">({value.join(', ')})</span>
          )}
        </span>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              onChange([]);
            }}
            className="text-red-500 hover:text-red-700 font-medium"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
