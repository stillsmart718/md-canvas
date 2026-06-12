import React, { useMemo, useCallback } from "react";

interface TocItem {
  level: number;
  text: string;
  id: string;
}

interface Props {
  markdown: string;
  activeId: string;
  onHeadingClick: (id: string) => void;
  visible: boolean;
  onToggle: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseToc(md: string): TocItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const items: TocItem[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(md)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    items.push({ level, text, id: slugify(text) });
  }
  return items;
}

const TocSidebar: React.FC<Props> = ({ markdown, activeId, onHeadingClick, visible, onToggle }) => {
  const items = useMemo(() => parseToc(markdown), [markdown]);

  const handleClick = useCallback(
    (id: string) => {
      onHeadingClick(id);
    },
    [onHeadingClick]
  );

  if (!visible) {
    return (
      <button className="toc-toggle-btn" onClick={onToggle} title="显示目录">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="3" x2="14" y2="3" />
          <line x1="2" y1="7" x2="14" y2="7" />
          <line x1="2" y1="11" x2="14" y2="11" />
        </svg>
      </button>
    );
  }

  return (
    <div className="toc-sidebar">
      <div className="toc-header">
        <span className="toc-title">目录</span>
        <button className="toc-close-btn" onClick={onToggle} title="关闭目录">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
      </div>
      <div className="toc-list">
        {items.length === 0 && <p className="toc-empty">暂无标题</p>}
        {items.map((item, i) => (
          <button
            key={i}
            className={`toc-item toc-level-${item.level} ${activeId === item.id ? "toc-active" : ""}`}
            style={{ paddingLeft: `${8 + (item.level - 1) * 14}px` }}
            onClick={() => handleClick(item.id)}
            title={item.text}
          >
            <span className="toc-dot" />
            <span className="toc-text">{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TocSidebar;
export { slugify };
