import React, { useState, useEffect, useCallback, useRef } from "react";
import { marked } from "marked";
import Editor, { type EditorHandle } from "./Editor";
import Preview from "./Preview";
import Titlebar from "./Titlebar";
import MiniCard from "./MiniCard";
import TocSidebar, { slugify } from "./TocSidebar";
import NotesList from "./NotesList";
import QuickSwitcher from "./QuickSwitcher";
import type { FileEntry } from "../preload";

type FocusMode = "split" | "edit-only" | "preview-only";

// ── Auto-title helpers ──────────────────────────────────────
function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (!match) return null;
  return match[1].trim();
}

function sanitizeFilename(title: string): string {
  return title.replace(/[/\\:*?"<>|]/g, "").trim() || "未命名";
}

const App: React.FC = () => {
  const [filePath, setFilePath] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [savedContent, setSavedContent] = useState<string>("");
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [fileName, setFileName] = useState("未命名");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>("split");
  const [tocVisible, setTocVisible] = useState(true);
  const [notesVisible, setNotesVisible] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);

  const splitRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollSyncLock = useRef(false);
  const pendingSearchQuery = useRef<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fp = params.get("file");
    if (fp) {
      const decoded = decodeURIComponent(fp);
      setFilePath(decoded);
      setFileName(decoded.split("/").pop() || "未命名");
    } else {
      setFilePath("untitled.md");
    }
  }, []);

  useEffect(() => {
    if (!filePath) return;
    window.mdCanvas.fileRead(filePath).then((text) => {
      setContent(text);
      setSavedContent(text);
    }).catch(() => {
      const t = "# 新建便签\n\n开始写作...\n";
      setContent(t);
      setSavedContent(t);
    });
  }, [filePath]);

  // After content loads and render settles, scroll to search match
  useEffect(() => {
    const q = pendingSearchQuery.current;
    if (!q || !content) return;
    pendingSearchQuery.current = "";
    // Wait for editor + preview to re-render with new content
    const timer = setTimeout(() => {
      // Scroll editor to match
      editorRef.current?.scrollToMatch(q);
      // Scroll preview to first text node containing query
      if (previewRef.current) {
        const walker = document.createTreeWalker(previewRef.current, NodeFilter.SHOW_TEXT);
        let node: Text | null;
        while ((node = walker.nextNode() as Text | null)) {
          const idx = node.textContent?.toLowerCase().indexOf(q.toLowerCase());
          if (idx !== undefined && idx >= 0) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + q.length);
            const rect = range.getBoundingClientRect();
            const containerTop = previewRef.current.getBoundingClientRect().top;
            previewRef.current.scrollTo({
              top: previewRef.current.scrollTop + rect.top - containerTop - 120,
              behavior: "smooth",
            });
            break;
          }
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 600);
    return () => clearTimeout(timer);
  }, []);

  // ── Auto-save + auto-title ────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (content === savedContent || !filePath) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await window.mdCanvas.fileWrite(filePath, content);
      setSavedContent(content);

      // Auto-title: rename file to match first H1 heading
      const title = extractTitle(content);
      if (title) {
        const safeTitle = sanitizeFilename(title);
        const newName = safeTitle + ".md";
        const currentName = filePath.split("/").pop() || "";
        if (newName !== currentName) {
          const newPath = await window.mdCanvas.fileRename(filePath, newName);
          if (newPath) {
            setFilePath(newPath);
            setFileName(newName);
          }
        }
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [content, savedContent, filePath]);

  const handleSave = useCallback(async () => {
    if (!filePath) return;
    await window.mdCanvas.fileWrite(filePath, content);
    setSavedContent(content);
  }, [filePath, content]);

  // ── Collapse ─────────────────────────────────────────────
  const handleToggleCollapse = useCallback(async () => {
    const next = !isCollapsed;
    const result = await window.mdCanvas.windowCollapseToggle(next);
    setIsCollapsed(result);
  }, [isCollapsed]);

  // ── Split resize ─────────────────────────────────────────
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const container = splitRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setSplitRatio(Math.min(0.8, Math.max(0.2, (ev.clientX - rect.left) / rect.width)));
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // ── Scroll sync ──────────────────────────────────────────
  const handleEditorScroll = useCallback(() => {
    if (scrollSyncLock.current) return;
    scrollSyncLock.current = true;
    const editorScroller = document.querySelector(".cm-scroller");
    const previewPane = previewRef.current;
    if (!editorScroller || !previewPane) { scrollSyncLock.current = false; return; }
    const ratio = editorScroller.scrollTop / (editorScroller.scrollHeight - editorScroller.clientHeight);
    if (!isNaN(ratio)) {
      previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight);
    }
    setTimeout(() => { scrollSyncLock.current = false; }, 50);
  }, []);

  const handlePreviewScroll = useCallback(() => {
    if (scrollSyncLock.current) return;
    scrollSyncLock.current = true;
    const editorScroller = document.querySelector(".cm-scroller");
    const previewPane = previewRef.current;
    if (!editorScroller || !previewPane) { scrollSyncLock.current = false; return; }
    const ratio = previewPane.scrollTop / (previewPane.scrollHeight - previewPane.clientHeight);
    if (!isNaN(ratio)) {
      editorScroller.scrollTop = ratio * (editorScroller.scrollHeight - editorScroller.clientHeight);
    }
    setTimeout(() => { scrollSyncLock.current = false; }, 50);
  }, []);

  // Update active heading based on preview scroll
  const handlePreviewScrollForToc = useCallback(() => {
    if (!previewRef.current) return;
    const headings = previewRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let active = "";
    const containerTop = previewRef.current.scrollTop + 80;
    headings.forEach((h) => {
      const el = h as HTMLElement;
      if (el.offsetTop <= containerTop) {
        active = slugify(el.textContent || "");
      }
    });
    setActiveHeadingId(active);
  }, []);

  const onPreviewScroll = useCallback(() => {
    handlePreviewScroll();
    handlePreviewScrollForToc();
  }, [handlePreviewScroll, handlePreviewScrollForToc]);

  // Attach scroll listeners
  useEffect(() => {
    const editorScroller = document.querySelector(".cm-scroller");
    if (editorScroller) {
      editorScroller.addEventListener("scroll", handleEditorScroll);
    }
    return () => {
      editorScroller?.removeEventListener("scroll", handleEditorScroll);
    };
  }, [handleEditorScroll, focusMode]);

  // ── TOC heading click → scroll preview ──────────────────
  const handleTocClick = useCallback((id: string) => {
    if (!previewRef.current) return;
    const headings = previewRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headings.forEach((h) => {
      const el = h as HTMLElement;
      if (slugify(el.textContent || "") === id) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, []);

  // ── Quick switcher ───────────────────────────────────────
  const handleQuickSwitch = useCallback(async (entry: FileEntry, query?: string) => {
    pendingSearchQuery.current = query || "";
    setFilePath(entry.path);
    setFileName(entry.name);
  }, []);

  // ── Notes list handlers ──────────────────────────────────
  const handleNotesSelect = useCallback(async (entry: FileEntry, query?: string) => {
    pendingSearchQuery.current = query || "";
    setFilePath(entry.path);
    setFileName(entry.name);
  }, []);

  const handleNotesDelete = useCallback((_entry: FileEntry) => {
    // Window closes via main process, UI updates via file list refresh
  }, []);

  const handleNotesRename = useCallback((entry: FileEntry, newName: string) => {
    setFileName(newName);
    setFilePath((prev) => {
      const dir = prev.split("/").slice(0, -1).join("/");
      return dir + "/" + newName;
    });
  }, []);

  // ── Export PDF ───────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    const html = marked.parse(content) as string;
    const title = extractTitle(content) || fileName.replace(/\.md$/, "");
    await window.mdCanvas.exportPdf(html, title);
  }, [content, fileName]);

  // ── Focus mode rotation ──────────────────────────────────
  const handleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      if (prev === "split") return "edit-only";
      if (prev === "edit-only") return "preview-only";
      return "split";
    });
  }, []);

  // ── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        window.mdCanvas.windowNew().then((newPath) => {
          setFilePath(newPath);
          setFileName(newPath.split("/").pop() || "未命名");
        });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "o") { e.preventDefault(); window.mdCanvas.dialogOpen(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "e") { e.preventDefault(); handleToggleCollapse(); }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") { e.preventDefault(); window.mdCanvas.windowTogglePin().then(setIsPinned); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "p")) {
        e.preventDefault();
        setQuickSwitcherOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "f") {
        e.preventDefault();
        handleFocusMode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, handleToggleCollapse, handleFocusMode]);

  const handleTogglePin = useCallback(async () => {
    const pinned = await window.mdCanvas.windowTogglePin();
    setIsPinned(pinned);
  }, []);
  const handleNew = useCallback(() => {
    window.mdCanvas.windowNew().then((newPath) => {
      setFilePath(newPath);
      setFileName(newPath.split("/").pop() || "未命名");
    });
  }, []);
  const handleOpen = useCallback(() => window.mdCanvas.dialogOpen(), []);

  // ── Derived state ────────────────────────────────────────
  const dirty = content !== savedContent;
  const displayTitle = fileName + (dirty ? " ●" : "");
  const showEditor = focusMode !== "preview-only";
  const showPreview = focusMode !== "edit-only";

  if (isCollapsed) {
    return <MiniCard fileName={fileName} content={content} onExpand={handleToggleCollapse} />;
  }

  const editorPane = (
    <div className="split-pane" style={{ flex: showPreview ? `0 0 ${splitRatio * 100}%` : "1 1 100%" }}>
      <div className="pane-content">
        <Editor ref={editorRef} value={content} onChange={setContent} />
      </div>
    </div>
  );

  const previewPane = (
    <div
      className="split-pane"
      style={{ flex: showEditor ? `0 0 ${(1 - splitRatio) * 100}%` : "1 1 100%" }}
    >
      <div ref={previewRef} className="pane-content preview-pane" onScroll={onPreviewScroll}>
        <Preview markdown={content} />
      </div>
    </div>
  );

  return (
    <div className={`app-shell ${isAnimating ? "animating" : ""}`}>
      <div className={`canvas-overlay ${isAnimating ? "active" : ""}`} />
      <Titlebar
        fileName={displayTitle}
        isCollapsed={isCollapsed}
        isPinned={isPinned}
        focusMode={focusMode}
        onToggleCollapse={handleToggleCollapse}
        onTogglePin={handleTogglePin}
        onSave={handleSave}
        onNew={handleNew}
        onOpen={handleOpen}
        onExportPdf={handleExportPdf}
        onFocusMode={handleFocusMode}
      />

      <div className="main-area">
        {/* Notes list sidebar */}
        <NotesList
          currentPath={filePath}
          onSelect={handleNotesSelect}
          onDelete={handleNotesDelete}
          onRename={handleNotesRename}
          visible={notesVisible}
          onToggle={() => setNotesVisible((v) => !v)}
        />

        {/* Split area */}
        <div className="split-container">
          {showEditor && editorPane}
          {showEditor && showPreview && (
            <div ref={splitRef} className="split-divider" onMouseDown={handleSplitMouseDown}>
              <div className="split-handle" />
            </div>
          )}
          {showPreview && previewPane}
        </div>

        {/* TOC sidebar */}
        <TocSidebar
          markdown={content}
          activeId={activeHeadingId}
          onHeadingClick={handleTocClick}
          visible={tocVisible}
          onToggle={() => setTocVisible((v) => !v)}
        />
      </div>

      {/* Quick Switcher modal */}
      <QuickSwitcher
        visible={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onSelect={handleQuickSwitch}
      />
    </div>
  );
};

export default App;
