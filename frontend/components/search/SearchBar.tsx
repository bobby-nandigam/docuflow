"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles, FileText, Tag, Clock, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

const RECENT_SEARCHES = [
  "Q4 financial report",
  "expiring contracts",
  "marketing campaign brief",
];

const MOCK_SUGGESTIONS = [
  { type: "document", icon: FileText, label: "Q4 2024 Financial Report.pdf", category: "financial" },
  { type: "document", icon: FileText, label: "Employee Handbook 2024.pdf", category: "hr" },
  { type: "ai", icon: Sparkles, label: "Summarize all Q4 documents" },
  { type: "tag", icon: Tag, label: "Documents tagged: contract" },
];

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect AI query intent
  useEffect(() => {
    const aiPhrases = ["what", "summarize", "find all", "show me", "how many", "when"];
    const isAI = aiPhrases.some(phrase => value.toLowerCase().startsWith(phrase));
    setAiMode(isAI);
  }, [value]);

  const showDropdown = focused && value.length === 0;
  const showSuggestions = focused && value.length > 1;

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2.5 bg-surface-50 border rounded-xl px-3 py-2 transition-all ${
        focused ? "border-brand-300 bg-white shadow-glow" : "border-surface-200 hover:border-surface-300"
      }`}>
        {aiMode ? (
          <Sparkles size={16} className="text-brand-500 flex-shrink-0" />
        ) : (
          <Search size={16} className="text-ink-100 flex-shrink-0" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder || "Search documents..."}
          className="flex-1 bg-transparent outline-none text-sm text-ink-500 placeholder-ink-50 min-w-0"
        />
        {value && (
          <button onClick={() => onChange("")} className="p-0.5 hover:bg-surface-200 rounded transition-colors flex-shrink-0">
            <X size={13} className="text-ink-100" />
          </button>
        )}
        {aiMode && (
          <span className="flex-shrink-0 text-xs font-medium bg-brand-50 text-brand-500 px-1.5 py-0.5 rounded-md">
            AI
          </span>
        )}
        <kbd className="hidden md:flex items-center gap-0.5 text-xs text-ink-50 bg-surface-100 px-1.5 py-0.5 rounded flex-shrink-0">
          <span>⌘</span><span>K</span>
        </kbd>
      </div>

      <AnimatePresence>
        {(showDropdown || showSuggestions) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-2xl shadow-card-hover z-50 overflow-hidden"
          >
            {showDropdown && (
              <div className="p-2">
                <p className="text-xs font-semibold text-ink-50 uppercase tracking-wider px-3 py-1.5">Recent</p>
                {RECENT_SEARCHES.map(s => (
                  <button
                    key={s}
                    onClick={() => { onChange(s); inputRef.current?.focus(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-50 transition-colors text-left"
                  >
                    <Clock size={14} className="text-ink-50" />
                    <span className="text-sm text-ink-400">{s}</span>
                  </button>
                ))}
                <div className="border-t border-surface-100 mt-2 pt-2">
                  <p className="text-xs font-semibold text-ink-50 uppercase tracking-wider px-3 py-1.5">Try asking AI</p>
                  {["Summarize my recent contracts", "Find documents about pricing"].map(q => (
                    <button
                      key={q}
                      onClick={() => { onChange(q); inputRef.current?.focus(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-brand-50 transition-colors text-left"
                    >
                      <Sparkles size={14} className="text-brand-400" />
                      <span className="text-sm text-ink-400">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showSuggestions && (
              <div className="p-2">
                {MOCK_SUGGESTIONS.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={i}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-50 transition-colors text-left group"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        s.type === "ai" ? "bg-brand-50" : "bg-surface-100"
                      }`}>
                        <Icon size={14} className={s.type === "ai" ? "text-brand-500" : "text-ink-100"} />
                      </div>
                      <span className="text-sm text-ink-500 truncate">{s.label}</span>
                      {s.type === "ai" && (
                        <span className="ml-auto text-xs text-brand-500 font-medium">Ask AI</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
