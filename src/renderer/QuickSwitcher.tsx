import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { FileEntry, FileWithContent } from "../preload";
import { matchScore, extractTags, highlightText, extractContext } from "./searchUtils";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (entry: FileEntry, query?: string) => void;
}

const QuickSwitcher: React.FC<Props> = ({ visible, onClose, onSelect }) => {
  const [files, setFiles] = useState<FileWithContent[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (visible) {
      window.mdCanvas.fileReadAll().then(setFiles);
      setQuery("");
      setSelectedIndex(0);
    }
  }, [visible]);

  const q = query.trim().replace(/^#/, "");

  const filtered = useMemo(() => {
    if (!q) return files;
    const scored = files
      .map((f) => {
        const name = f.name.replace(/\.md$/, "");
        const tags = extractTags(f.content);
        const nameScore = matchScore(name, q);
        const tagScore = matchScore(tags.join(" "), q);
        const contentScore = matchScore(f.content, q);
        return { file: f, score: Math.max(nameScore, tagScore, contentScore) };
      })
      .filter((e) => e.score > -Infinity)
      .sort((a, b) => b.score - a.score);
    return scored.map((e) => e.file);
  }, [files, q]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleSelect = useCallback(
    (entry: FileEntry) => {
      onSelect(entry, q);
      onClose();
    },
    [onSelect, onClose, q]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          handleSelect(filtered[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [filtered, selectedIndex, handleSelect, onClose]
  );

  if (!visible) return null;

  return (
    <div className="quick-switcher-overlay" onClick={onClose}>
      <div className="quick-switcher-modal" onClick={(e) => e.stopPropagation()}>
        <div className="quick-switcher-input-wrap">
          <svg className="quick-switcher-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" />
          </svg>
          <input
            className="quick-switcher-input"
            type="text"
            placeholder="搜索便签标题或内容..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        <div className="quick-switcher-list">
          {filtered.length === 0 && (
            <div className="quick-switcher-empty">无匹配结果</div>
          )}
          {filtered.map((f, i) => (
            <button
              key={f.path}
              className={`quick-switcher-item ${i === selectedIndex ? "quick-switcher-active" : ""}`}
              onClick={() => handleSelect(f)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="quick-switcher-info">
                <span className="quick-switcher-filename">
                  {q ? highlightText(f.name.replace(/\.md$/, ""), q) : f.name}
                </span>
                {q && (
                  <span className="search-context">
                    {highlightText(extractContext(f.content, q), q)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickSwitcher;
