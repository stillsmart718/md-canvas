import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { FileEntry, FileWithContent } from "../preload";
import { matchScore, extractTags, highlightText, extractContext } from "./searchUtils";

interface Props {
  currentPath: string;
  onSelect: (entry: FileEntry, query?: string) => void;
  onDelete: (entry: FileEntry) => void;
  onRename: (entry: FileEntry, newName: string) => void;
  visible: boolean;
  onToggle: () => void;
}

const NotesList: React.FC<Props> = ({ currentPath, onSelect, onDelete, onRename, visible, onToggle }) => {
  const [files, setFiles] = useState<FileWithContent[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    const data = await window.mdCanvas.fileReadAll();
    setFiles(data);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const allTags = useMemo(() => {
    const tagCount = new Map<string, number>();
    files.forEach((f) => {
      const tags = extractTags(f.content);
      tags.forEach((t) => tagCount.set(t, (tagCount.get(t) || 0) + 1));
    });
    return Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);
  }, [files]);

  const query = search.trim();

  const filtered = useMemo(() => {
    let result = files;
    if (tagFilter) {
      result = result.filter((f) => extractTags(f.content).includes(tagFilter));
    }
    if (query) {
      const scored = result
        .map((f) => {
          const name = f.name.replace(/\.md$/, "");
          const tags = extractTags(f.content);
          const nameScore = matchScore(name, query);
          const tagScore = matchScore(tags.join(" "), query);
          const contentScore = matchScore(f.content, query);
          const bestScore = Math.max(nameScore, tagScore, contentScore);
          return { file: f, score: bestScore };
        })
        .filter((e) => e.score > -Infinity)
        .sort((a, b) => b.score - a.score);
      result = scored.map((e) => e.file);
    }
    return result;
  }, [files, query, tagFilter]);

  // Reset dropdown index when results change
  useEffect(() => { setDropdownIndex(0); }, [filtered]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.parentElement?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[dropdownIndex]) {
          onSelect(filtered[dropdownIndex], query);
          setSearch("");
          setShowDropdown(false);
        }
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        searchRef.current?.blur();
      }
    },
    [filtered, dropdownIndex, onSelect]
  );

  const handleRenameStart = (f: FileWithContent) => {
    setRenaming(f.path);
    setRenameValue(f.name);
  };

  const handleRenameSubmit = async (f: FileWithContent) => {
    if (renameValue && renameValue !== f.name && renameValue.endsWith(".md")) {
      await window.mdCanvas.fileRename(f.path, renameValue);
      loadFiles();
    }
    setRenaming(null);
    setRenameValue("");
  };

  const handleDelete = async (f: FileWithContent) => {
    await window.mdCanvas.fileDelete(f.path);
    loadFiles();
  };

  const isSearching = query.length > 0;

  // ── Render helpers ────────────────────────────────────────
  const renderName = (name: string) => (
    <span className="noteslist-filename">
      {isSearching ? highlightText(name.replace(/\.md$/, ""), query) : name.replace(/\.md$/, "")}
    </span>
  );

  const renderContext = (content: string) => {
    if (!isSearching) return null;
    const ctx = extractContext(content, query);
    if (!ctx) return null;
    return (
      <span className="search-context">
        {highlightText(ctx, query)}
      </span>
    );
  };

  if (!visible) {
    return (
      <button className="noteslist-toggle-btn" onClick={onToggle} title="显示便签列表">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      </button>
    );
  }

  return (
    <div className="noteslist-sidebar">
      <div className="noteslist-header">
        <span className="noteslist-title">便签</span>
        <button className="noteslist-close-btn" onClick={onToggle} title="关闭列表">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="noteslist-search" style={{ position: "relative" }}>
        <input
          ref={searchRef}
          className="noteslist-search-input"
          type="text"
          placeholder="搜索便签或标签..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleSearchKeyDown}
        />
        {/* Floating dropdown */}
        {showDropdown && query && (
          <div className="noteslist-dropdown">
            {filtered.length === 0 ? (
              <div className="noteslist-dropdown-empty">无匹配结果</div>
            ) : (
              filtered.map((f, i) => (
                <button
                  key={f.path}
                  className={`noteslist-dropdown-item ${i === dropdownIndex ? "noteslist-dropdown-active" : ""} ${f.path === currentPath ? "noteslist-dropdown-current" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(f, query);
                    setSearch("");
                    setShowDropdown(false);
                  }}
                  onMouseEnter={() => setDropdownIndex(i)}
                >
                  <div className="noteslist-dropdown-info">
                    <span className="noteslist-dropdown-name">
                      {highlightText(f.name.replace(/\.md$/, ""), query)}
                    </span>
                    {renderContext(f.content)}
                  </div>
                  <span className="noteslist-dropdown-tags">
                    {extractTags(f.content).slice(0, 3).map((t) => (
                      <span key={t} className="noteslist-dropdown-tag">#{t}</span>
                    ))}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="noteslist-tags">
          {tagFilter && (
            <button className="tag-chip tag-clear" onClick={() => setTagFilter(null)}>
              ✕ 清除
            </button>
          )}
          {allTags.map(([tag, count]) => (
            <button
              key={tag}
              className={`tag-chip ${tagFilter === tag ? "tag-active" : ""}`}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
            >
              #{tag} <span className="tag-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* File list */}
      <div className="noteslist-files">
        {filtered.length === 0 && <p className="noteslist-empty">暂无便签</p>}
        {filtered.map((f) => (
          <div
            key={f.path}
            className={`noteslist-item ${f.path === currentPath ? "noteslist-item-active" : ""}`}
            onClick={() => onSelect(f, query)}
          >
            <div className="noteslist-item-main">
              {renaming === f.path ? (
                <input
                  className="noteslist-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameSubmit(f)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit(f);
                    if (e.key === "Escape") { setRenaming(null); setRenameValue(""); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                renderName(f.name)
              )}
              <div className="noteslist-item-tags">
                {extractTags(f.content).slice(0, 3).map((t) => (
                  <span key={t} className="noteslist-item-tag">#{t}</span>
                ))}
              </div>
            </div>
            <div className="noteslist-item-actions">
              <button
                className="noteslist-action-btn"
                title="重命名"
                onClick={(e) => { e.stopPropagation(); handleRenameStart(f); }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 14L6 10L10 6L12 8L8 12L2 14Z" />
                  <line x1="10" y1="6" x2="13" y2="3" />
                </svg>
              </button>
              <button
                className="noteslist-action-btn noteslist-delete-btn"
                title="删除"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确定删除 "${f.name}" 吗？此操作不可撤销。`)) handleDelete(f);
                }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotesList;
