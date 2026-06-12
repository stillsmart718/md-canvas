import React from "react";

interface Props {
  fileName: string;
  isCollapsed: boolean;
  isPinned: boolean;
  focusMode: "split" | "edit-only" | "preview-only";
  onToggleCollapse: () => void;
  onTogglePin: () => void;
  onSave: () => void;
  onNew: () => void;
  onOpen: () => void;
  onExportPdf: () => void;
  onFocusMode: () => void;
}

const Titlebar: React.FC<Props> = ({
  fileName, isCollapsed, isPinned, focusMode,
  onToggleCollapse, onTogglePin, onSave, onNew, onOpen,
  onExportPdf, onFocusMode,
}) => {
  const focusLabel = focusMode === "split" ? "专注" : focusMode === "edit-only" ? "编辑" : "预览";
  const focusColor = focusMode === "split" ? "#7c3aed" : focusMode === "edit-only" ? "#2563eb" : "#059669";

  return (
    <div className="titlebar" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
      <div className="titlebar-left">
        <button
          className="titlebar-btn icon-btn"
          onClick={onToggleCollapse}
          title={isCollapsed ? "展开 (Cmd+E)" : "收起 (Cmd+E)"}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            {isCollapsed ? <polyline points="4,6 8,10 12,6" /> : <polyline points="4,10 8,6 12,10" />}
          </svg>
        </button>
        <span className="titlebar-filename">{fileName}</span>
      </div>
      <div className="titlebar-actions" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button className="titlebar-btn labeled-btn btn-new" onClick={onNew} title="新建便签 (Cmd+N)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" />
          </svg>
          <span>新建</span>
        </button>
        <button className="titlebar-btn labeled-btn btn-open" onClick={onOpen} title="打开文件 (Cmd+O)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4.5V13h12V5.5L9.5 2H4.5L2 4.5z" /><polyline points="2,4.5 6,4.5 6,2" />
          </svg>
          <span>打开</span>
        </button>
        <button className="titlebar-btn labeled-btn btn-save" onClick={onSave} title="保存 (Cmd+S)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 13V2h7l3 3v8H3z" /><rect x="5" y="2" width="1.5" height="4" /><rect x="5" y="10" width="6" height="3" />
          </svg>
          <span>保存</span>
        </button>
        <button className="titlebar-btn labeled-btn btn-export" onClick={onExportPdf} title="导出 PDF">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 10V13h10v-3M8 2v9M5 7l3 3 3-3" />
          </svg>
          <span>导出</span>
        </button>
        <button
          className={`titlebar-btn labeled-btn btn-focus`}
          style={{ backgroundColor: focusColor + "18", color: focusColor, borderColor: focusColor + "40" } as React.CSSProperties}
          onClick={onFocusMode}
          title="切换专注模式"
        >
          <span>{focusLabel}</span>
        </button>
        <button
          className={`titlebar-btn icon-btn ${isPinned ? "btn-pin-active" : ""}`}
          onClick={onTogglePin}
          title="置顶 (Cmd+Shift+P)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
            <path d="M6 10L2 14M10 6l4-4M9.5 2.5l4 4L10 10 6 6l3.5-3.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Titlebar;
