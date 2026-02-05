'use client';

import { useState, useEffect } from 'react';
import { ALL_CSV_COLUMNS, CSVColumn, getDefaultSelectedColumns } from '@/lib/csv/generator';

interface FieldSelectorProps {
  selectedFields: string[];
  onChange: (fields: string[]) => void;
}

export function FieldSelector({ selectedFields, onChange }: FieldSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = (key: string) => {
    if (selectedFields.includes(key)) {
      onChange(selectedFields.filter((k) => k !== key));
    } else {
      onChange([...selectedFields, key]);
    }
  };

  const handleSelectAll = () => {
    onChange(ALL_CSV_COLUMNS.map((c) => c.key));
  };

  const handleSelectDefault = () => {
    onChange(getDefaultSelectedColumns());
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <span className="font-medium text-gray-900">Export Fields</span>
          <span className="ml-2 text-sm text-gray-500">
            ({selectedFields.length} of {ALL_CSV_COLUMNS.length} selected)
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2 py-3 border-b border-gray-100">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleSelectDefault}
              className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              Reset to Default
            </button>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            >
              Deselect All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
            {ALL_CSV_COLUMNS.map((column) => (
              <label
                key={column.key}
                className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedFields.includes(column.key)
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFields.includes(column.key)}
                  onChange={() => handleToggle(column.key)}
                  className="mt-0.5 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-gray-900 truncate">
                    {column.header}
                  </span>
                  {column.description && (
                    <span className="block text-xs text-gray-500 truncate">
                      {column.description}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function useFieldSelector() {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  useEffect(() => {
    setSelectedFields(getDefaultSelectedColumns());
  }, []);

  return { selectedFields, setSelectedFields };
}
