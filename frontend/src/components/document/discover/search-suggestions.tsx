import { debounce } from "lodash";
import { Loader2, Search } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { cn } from "@/lib/utils";
import { AppDispatch, RootState } from "@/store";
import {
  fetchSuggestions,
  selectSuggestions,
  setSearchTerm
} from "@/store/slices/searchSlice";

interface SearchSuggestionsProps {
  onSearch: () => void;
  className?: string;
  placeholder?: string;
}

const SearchSuggestions = ({
                             onSearch,
                             className = "",
                             placeholder
                           }: SearchSuggestionsProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const suggestions = useSelector(selectSuggestions);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTerm = useSelector((state: RootState) => state.search.searchTerm);
  const loadingSuggestions = useSelector((state: RootState) => state.search.loadingSuggestions);

  // Debounced suggestion fetching
  const debouncedFetchSuggestions = useRef(
    debounce((value: string) => {
      if (value.trim()) {
        dispatch(fetchSuggestions(value));
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, 350)
  ).current;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    dispatch(setSearchTerm(value));

    // Always try to fetch suggestions when input changes
    debouncedFetchSuggestions(value);
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIndex(prev =>
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIndex(prev => prev > -1 ? prev - 1 : prev);
        }
        break;
      case "Enter":
        event.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionSelect(suggestions[selectedIndex]);
        } else if (searchTerm.trim()) {
          onSearch();
          setShowSuggestions(false);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    // Remove HTML tags and clean up whitespace
    const cleanText = suggestion
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/[\n\t]+/g, " ")
      .trim();

    dispatch(setSearchTerm(cleanText));
    setShowSuggestions(false);
    onSearch();
  };

  const cleanSuggestion = (suggestion: string) => {
    // Replace newlines and tabs with a single space and trim any excess whitespace
    return suggestion.replace(/[\n\t]+/g, " ").trim();
  };

  // Reset suggestions visibility when search term changes to empty
  useEffect(() => {
    if (!searchTerm.trim()) {
      setShowSuggestions(false);
    }
  }, [searchTerm]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("w-full relative", className)}>
      <div className="relative rounded-lg border shadow-sm">
        <div className="flex items-center px-3 gap-2">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <input
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // Show suggestions on focus if there's a search term
              if (searchTerm.trim()) {
                setShowSuggestions(true);
                debouncedFetchSuggestions(searchTerm);
              }
            }}
            placeholder={placeholder}
            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none"
          />
          {loadingSuggestions && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </div>

      {suggestions.length > 0 && showSuggestions && searchTerm && (
        <div className="absolute mt-2 w-full rounded-md border bg-popover text-popover-foreground shadow-md z-50">
          <div className="overflow-hidden p-1">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-sm rounded whitespace-pre-wrap break-words",
                  "hover:bg-accent hover:text-accent-foreground",
                  index === selectedIndex && "bg-accent text-accent-foreground"
                )}
                onClick={() => handleSuggestionSelect(suggestion)}
                dangerouslySetInnerHTML={{ __html: `...${cleanSuggestion(suggestion)}...` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSuggestions;