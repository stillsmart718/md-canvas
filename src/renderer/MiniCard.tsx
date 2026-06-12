import React, { useMemo } from "react";

interface Props {
  fileName: string;
  content: string;
  onExpand: () => void;
}

function stripMarkdown(md: string, maxLen = 120): string {
  let text = md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^---+/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

const MiniCard: React.FC<Props> = ({ fileName, content, onExpand }) => {
  const preview = useMemo(() => stripMarkdown(content), [content]);

  return (
    <div className="mini-card" style={{ WebkitAppRegion: "drag" } as React.CSSProperties} onClick={onExpand}>
      <div className="mini-card-header">
        <span className="mini-card-filename">{fileName}</span>
      </div>
      <div className="mini-card-body">
        <p className="mini-card-preview">{preview || "空便签"}</p>
      </div>
      <div className="mini-card-footer">
        <button className="mini-card-expand" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          onClick={(e) => { e.stopPropagation(); onExpand(); }} title="展开">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4,10 8,6 12,10" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MiniCard;
