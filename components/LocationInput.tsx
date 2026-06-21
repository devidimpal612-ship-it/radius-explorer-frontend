"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type Suggestion = {
  lat: number;
  lon: number;
  display_name: string;
  type: string;
};

type Props = {
  value: string;
  onChange: (val: string) => void;
  onSelect: (suggestion: Suggestion) => void;
  placeholder?: string;
  accentColor?: string;
};

export default function LocationInput({ value, onChange, onSelect, placeholder, accentColor = "#00D4FF" }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`${API}/api/autocomplete?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    setShowDropdown(true);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  };

  const handleSelect = (s: Suggestion) => {
    onSelect(s);
    setShowDropdown(false);
    setSuggestions([]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => value.trim().length >= 3 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 8,
          background: "#0D1B2A", border: "1px solid rgba(0,212,255,0.2)",
          color: "#F0F4FF", fontSize: 14, outline: "none", boxSizing: "border-box",
        }}
      />

      {showDropdown && (suggestions.length > 0 || loadingSuggestions) && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#0D1B2A", border: "1px solid rgba(0,212,255,0.2)",
          borderRadius: 8, overflow: "hidden", zIndex: 50,
          boxShadow: "0 12px 32px rgba(0,0,0,0.5)", maxHeight: 260, overflowY: "auto",
        }}>
          {loadingSuggestions && suggestions.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 13, color: "#7A8BA0" }}>Searching...</div>
          )}
          {suggestions.map((s, i) => (
            <div
              key={`${s.lat}-${s.lon}-${i}`}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: "10px 14px", fontSize: 13, cursor: "pointer",
                background: activeIndex === i ? "rgba(0,212,255,0.1)" : "transparent",
                borderBottom: i < suggestions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                display: "flex", alignItems: "flex-start", gap: 8,
              }}
            >
              <span style={{ color: accentColor, marginTop: 1, flexShrink: 0 }}>📍</span>
              <span style={{ color: "#F0F4FF", lineHeight: 1.4 }}>{s.display_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
