import { X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  recommendedTags?: string[];
  onSearch?: (query: string) => Promise<string[]>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  getTagDisplay?: (tag: string) => string;
}

const TagInput = ({
  value = [],
  onChange,
  recommendedTags = [],
  onSearch,
  placeholder = "Enter or select tags...",
  disabled = false,
  className = "",
  getTagDisplay = (tag) => tag,
}: TagInputProps) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Set initial suggestions from recommendedTags
  useEffect(() => {
    if (!onSearch) {
      // When no onSearch is provided, just set all available recommendedTags
      setSuggestions(recommendedTags.filter((tag) => !value.includes(tag)));
    }
  }, [recommendedTags, value, onSearch]);

  // Handle onSearch if provided
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!onSearch || !isFocused) {
        return;
      }

      setLoading(true);
      try {
        const results = await onSearch(inputValue);
        setSuggestions(results.filter((tag) => !value.includes(tag)));
      } catch (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    if (onSearch && isFocused) {
      fetchSuggestions();
    }
  }, [inputValue, isFocused, onSearch, value]);

  // Reset highlighted index when input or suggestions change
  useEffect(() => {
    setHighlightedIndex(null);
  }, [inputValue, suggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const filteredSuggestions = suggestions.filter((suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()),
    );

    if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex !== null && filteredSuggestions[highlightedIndex]) {
        addTag(filteredSuggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue.trim());
      }
    }

    if (e.key === "ArrowDown" && filteredSuggestions.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev === null || prev >= filteredSuggestions.length - 1 ? 0 : prev + 1));
    }

    if (e.key === "ArrowUp" && filteredSuggestions.length > 0) {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev === null || prev <= 0 ? filteredSuggestions.length - 1 : prev - 1));
    }

    if (e.key === "Escape") {
      setIsFocused(false);
      setHighlightedIndex(null);
    }
  };

  const addTag = (tag: string) => {
    if (!tag || value.includes(tag)) return;
    const isValidTag = recommendedTags.includes(tag) || (suggestions.length > 0 && suggestions.includes(tag));
    if (onSearch ? isValidTag : true) {
      // Allow free input if no onSearch
      onChange([...value, tag]);
      setInputValue("");
      setHighlightedIndex(null);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  // Filter suggestions based on translated display value, not raw tag code
  const filteredSuggestions = suggestions.filter((suggestion) => {
    const displayValue = getTagDisplay(suggestion).toLowerCase();
    return displayValue.includes(inputValue.toLowerCase());
  });

  const showDropdown = isFocused && (filteredSuggestions.length > 0 || loading || inputValue.trim().length > 0);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "min-h-10 flex flex-wrap gap-2 p-2 rounded-md border bg-background",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-text",
          isFocused && "border-primary",
          "focus-within:ring-1 focus-within:ring-primary",
        )}
        onClick={() => {
          if (!disabled && inputRef.current) {
            inputRef.current.focus();
          }
        }}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-md text-sm font-medium"
          >
            {getTagDisplay(tag)}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="rounded-full hover:bg-primary/20 transition-colors p-0.5"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Remove tag</span>
              </button>
            )}
          </span>
        ))}
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder={value.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="flex-1 !h-6 !min-h-6 !p-0 !border-0 !ring-0 !shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover rounded-md border shadow-md z-10 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-2 text-sm text-muted-foreground">Loading...</div>
          ) : filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click registers
                  addTag(suggestion);
                }}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                  highlightedIndex === index && "bg-accent text-accent-foreground",
                )}
              >
                {getTagDisplay(suggestion)}
              </button>
            ))
          ) : (
            <div className="p-2 text-sm text-muted-foreground">{t("common.noMatchingOptions")}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TagInput;
