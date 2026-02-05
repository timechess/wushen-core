"use client";

import React, { useState, useRef, useEffect } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
}

export default function SearchableSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "搜索...",
  error,
  disabled = false,
  searchable = true,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 获取当前选中项的标签
  const selectedOption = options.find((opt) => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : "";

  // 过滤选项（前缀匹配，不区分大小写）
  const filteredOptions = searchable
    ? options.filter((option) =>
        option.label.toLowerCase().startsWith(searchTerm.toLowerCase()),
      )
    : options;

  // 点击外部关闭下拉列表
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSelect = (selectedValue: string) => {
    if (disabled) return;
    onChange(selectedValue);
    setIsOpen(false);
    setSearchTerm("");
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredOptions.length
        ) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
      } else if (e.key === "Escape") {
        setIsOpen(false);
        setSearchTerm("");
        setHighlightedIndex(-1);
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, highlightedIndex, filteredOptions]);

  // 滚动到高亮项
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[
        highlightedIndex
      ] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (!searchable) return;
    const term = e.target.value;
    setSearchTerm(term);
    setHighlightedIndex(-1);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    // 如果已经有选中值，清空搜索词以便重新搜索
    if (searchable && value) {
      setSearchTerm("");
    }
  };

  const inputValue = searchable
    ? isOpen
      ? searchTerm
      : displayValue
    : displayValue;
  const inputPlaceholder = searchable
    ? placeholder
    : displayValue
      ? ""
      : placeholder;

  return (
    <div className={`w-full relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[var(--app-ink-muted)] mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={inputPlaceholder}
          disabled={disabled}
          readOnly={!searchable}
          className={`
            w-full px-3 py-2 border rounded-lg bg-[var(--app-surface-soft)] text-[var(--app-ink)]
            focus:outline-none focus:ring-2 focus:ring-[var(--app-ring)] focus:border-[var(--app-accent)]
            ${error ? "border-red-500" : "border-[var(--app-border)]"}
            ${isOpen ? "rounded-b-none" : ""}
            disabled:opacity-60 disabled:cursor-not-allowed
          `}
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""} ${disabled ? "opacity-60" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {isOpen && !disabled && (
        <div
          ref={listRef}
          className={`
            absolute z-50 w-full mt-0 bg-[var(--app-surface)] border border-[var(--app-border)] border-t-0 rounded-b-lg
            shadow-lg max-h-60 overflow-y-auto
          `}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              未找到匹配项
            </div>
          ) : (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  px-3 py-2 cursor-pointer hover:bg-[var(--app-accent-soft)] transition-colors
                  ${value === option.value ? "bg-[var(--app-accent-soft)] font-medium" : ""}
                  ${index === highlightedIndex ? "bg-[var(--app-accent-soft)]" : ""}
                `}
              >
                {option.label}
              </div>
            ))
          )}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
