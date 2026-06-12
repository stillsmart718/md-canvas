import React, { useState, useEffect, useCallback, useRef } from "react";
import { marked } from "marked";
import Editor, { type EditorHandle } from "./Editor";
import Preview from "./Preview";
import Titlebar from "./Titlebar";
import MiniCard from "./MiniCard";
import TocSidebar, { slugify } from "./TocSidebar";
import NotesList from "./NotesList";
import QuickSwitcher from "./QuickSwitcher";
import TabBar, { type Tab } from "./TabBar";
import TableInserter from "./TableInserter";
import LinkDialog from "./LinkDialog";
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
  // ── Tab state ─────────────────────────────────────────────
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [tabContents, setTabContents] = useState<Record<string, string>>({});
  const [tabSaved, setTabSaved] = useState<Record<string, string>>({});
  const [activeIdx, setActiveIdx] = useState(0);

  const filePath = tabs[activeIdx]?.path || "";
  const content = tabContents[filePath] || "";
  const savedContent = tabSaved[filePath] || "";
  const fileName = tabs[activeIdx]?.name || "未命名";
  const setContent = useCallback((val: string) => {
    setTabContents((prev) => ({ ...prev, [filePath]: val }));
  }, [filePath]);

  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>("split");
  const [tocVisible, setTocVisible] = useState(true);
  const [notesVisible, setNotesVisible] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [tableInserterOpen, setTableInserterOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPreselect, setLinkPreselect] = useState("");

  const splitRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollSyncLock = useRef(false);
  const pendingSearchQuery = useRef<string>("");
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  // ── Initialize first tab ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fp = params.get("file");
    if (fp) {
      const decoded = decodeURIComponent(fp);
      const name = decoded.split("/").pop() || "未命名";
      setTabs([{ path: decoded, name }]);
    } else {
      setTabs([{ path: "untitled.md", name: "未命名" }]);
    }
  }, []);

  // ── Load file content on tab switch / init ────────────────
  useEffect(() => {
    if (!filePath) return;
    if (tabContents[filePath] !== undefined && tabSaved[filePath] !== undefined) return; // already loaded
    window.mdCanvas.fileRead(filePath).then((text) => {
      setTabContents((prev) => ({ ...prev, [filePath]: text }));
      setTabSaved((prev) => ({ ...prev, [filePath]: text }));
    }).catch(() => {
      const t = "# 新建便签\n\n开始写作...\n";
      setTabContents((prev) => ({ ...prev, [filePath]: t }));
      setTabSaved((prev) => ({ ...prev, [filePath]: t }));
    });
  }, [filePath]);

  // ── Scroll to search match after content loads ─────────────
  useEffect(() => {
    const q = pendingSearchQuery.current;
    if (!q || !content) return;
    pendingSearchQuery.current = "";
    const timer = setTimeout(() => {
      editorRef.current?.scrollToMatch(q);
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
            previewRef.current.scrollTo({ top: previewRef.current.scrollTop + rect.top - containerTop - 120, behavior: "smooth" });
            break;
          }
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [content]);

  useEffect(() => { const t = setTimeout(() => setIsAnimating(false), 600); return () => clearTimeout(t); }, []);

  // ── Refs to avoid stale closure in save callbacks ───────────
  const tabContentsRef = useRef(tabContents);
  tabContentsRef.current = tabContents;
  const tabSavedRef = useRef(tabSaved);
  tabSavedRef.current = tabSaved;
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;

  // ── Auto-save + auto-title ────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (content === savedContent || !filePath) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const fp = filePathRef.current;
      const latest = tabContentsRef.current[fp] || content;
      await window.mdCanvas.fileWrite(fp, latest);
      setTabSaved((prev) => ({ ...prev, [fp]: latest }));

      const title = extractTitle(latest);
      if (title) {
        const safeTitle = sanitizeFilename(title);
        const newName = safeTitle + ".md";
        const currentName = fp.split("/").pop() || "";
        if (newName !== currentName) {
          const newPath = await window.mdCanvas.fileRename(fp, newName);
          if (newPath) {
            setTabs((prev) => prev.map((t) => t.path === fp ? { path: newPath, name: newName } : t));
            setTabContents((prev) => {
              const next = { ...prev, [newPath]: prev[fp] };
              delete next[fp];
              return next;
            });
            setTabSaved((prev) => {
              const next = { ...prev, [newPath]: prev[fp] };
              delete next[fp];
              return next;
            });
          }
        }
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [content, savedContent, filePath]);

  const handleSave = useCallback(async () => {
    const fp = filePathRef.current;
    if (!fp) return;
    const latest = tabContentsRef.current[fp] || "";
    await window.mdCanvas.fileWrite(fp, latest);
    setTabSaved((prev) => ({ ...prev, [fp]: latest }));
  }, []);

  // ── Tab handlers ──────────────────────────────────────────
  const openTab = useCallback((path: string, name: string) => {
    setTabs((prev) => {
      const existing = prev.findIndex((t) => t.path === path);
      if (existing >= 0) { setActiveIdx(existing); return prev; }
      setActiveIdx(prev.length);
      return [...prev, { path, name }];
    });
  }, []);

  const closeTab = useCallback((idx: number) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      // Clean up state for closed tab
      const closedPath = prev[idx].path;
      setTabContents((pc) => { const n = { ...pc }; delete n[closedPath]; return n; });
      setTabSaved((pc) => { const n = { ...pc }; delete n[closedPath]; return n; });
      // Adjust active index
      if (idx <= activeIdx) {
        const newIdx = Math.max(0, activeIdx - 1);
        if (newIdx >= next.length) setActiveIdx(next.length - 1);
        else setTimeout(() => setActiveIdx(newIdx), 0);
      } else {
        if (activeIdx >= next.length) setActiveIdx(next.length - 1);
      }
      return next;
    });
  }, [activeIdx]);

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
    if (!isNaN(ratio)) previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight);
    setTimeout(() => { scrollSyncLock.current = false; }, 50);
  }, []);

  const handlePreviewScroll = useCallback(() => {
    if (scrollSyncLock.current) return;
    scrollSyncLock.current = true;
    const editorScroller = document.querySelector(".cm-scroller");
    const previewPane = previewRef.current;
    if (!editorScroller || !previewPane) { scrollSyncLock.current = false; return; }
    const ratio = previewPane.scrollTop / (previewPane.scrollHeight - previewPane.clientHeight);
    if (!isNaN(ratio)) editorScroller.scrollTop = ratio * (editorScroller.scrollHeight - editorScroller.clientHeight);
    setTimeout(() => { scrollSyncLock.current = false; }, 50);
  }, []);

  const handlePreviewScrollForToc = useCallback(() => {
    if (!previewRef.current) return;
    const headings = previewRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let active = "";
    const containerTop = previewRef.current.scrollTop + 80;
    headings.forEach((h) => {
      const el = h as HTMLElement;
      if (el.offsetTop <= containerTop) active = slugify(el.textContent || "");
    });
    setActiveHeadingId(active);
  }, []);

  const onPreviewScroll = useCallback(() => { handlePreviewScroll(); handlePreviewScrollForToc(); }, [handlePreviewScroll, handlePreviewScrollForToc]);

  useEffect(() => {
    const scroller = document.querySelector(".cm-scroller");
    if (scroller) scroller.addEventListener("scroll", handleEditorScroll);
    return () => scroller?.removeEventListener("scroll", handleEditorScroll);
  }, [handleEditorScroll, focusMode]);

  const handleTocClick = useCallback((id: string) => {
    if (!previewRef.current) return;
    const headings = previewRef.current.querySelectorAll("h1, h2, h3, h4, h5, h6");
    headings.forEach((h) => { const el = h as HTMLElement; if (slugify(el.textContent || "") === id) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
  }, []);

  // ── Quick switcher / Notes list ───────────────────────────
  const handleQuickSwitch = useCallback(async (entry: FileEntry, query?: string) => {
    pendingSearchQuery.current = query || "";
    openTab(entry.path, entry.name);
  }, [openTab]);

  const handleNotesSelect = useCallback(async (entry: FileEntry, query?: string) => {
    pendingSearchQuery.current = query || "";
    openTab(entry.path, entry.name);
  }, [openTab]);

  const handleNotesDelete = useCallback((_entry: FileEntry) => { /* window closes via main */ }, []);
  const handleNotesRename = useCallback((entry: FileEntry, newName: string) => {
    setTabs((prev) => prev.map((t) => t.path === entry.path ? { ...t, name: newName } : t));
  }, []);

  // ── Export ────────────────────────────────────────────────
  const handleExportPdf = useCallback(async () => {
    const fp = filePathRef.current;
    const latest = tabContentsRef.current[fp] || "";
    const html = marked.parse(latest) as string;
    const title = extractTitle(latest) || (fp.split("/").pop() || "").replace(/\.md$/, "");
    await window.mdCanvas.exportPdf(html, title);
  }, []);

  const handleExportImage = useCallback(async () => {
    const fp = filePathRef.current;
    const latest = tabContentsRef.current[fp] || "";
    const html = marked.parse(latest) as string;
    const title = extractTitle(latest) || (fp.split("/").pop() || "").replace(/\.md$/, "");
    await window.mdCanvas.exportImage(html, title);
  }, []);

  // ── Focus mode ────────────────────────────────────────────
  const handleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      if (prev === "split") return "edit-only";
      if (prev === "edit-only") return "preview-only";
      return "split";
    });
  }, []);

  // ── Table / Link inserts ──────────────────────────────────
  const handleInsertTable = useCallback((r: number, c: number) => {
    editorRef.current?.insertTableAtCursor(r, c);
  }, []);

  const handleInsertLink = useCallback((text: string, url: string) => {
    editorRef.current?.insertLink(text, url);
  }, []);

  const handleOpenLinkDialog = useCallback(() => {
    const sel = editorRef.current?.getSelectedText() || "";
    setLinkPreselect(sel);
    setLinkDialogOpen(true);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.shiftKey && e.key === "t") { e.preventDefault(); setTableInserterOpen((v) => !v); }
      if (mod && e.key === "l") { e.preventDefault(); handleOpenLinkDialog(); }
      if (mod && e.shiftKey && e.key === "e") { e.preventDefault(); handleExportImage(); }
      if (mod && e.key === "w") {
        e.preventDefault();
        closeTab(activeIdx);
      }
      if (mod && e.key === "s") { e.preventDefault(); handleSave(); }
      if (mod && e.key === "n") {
        e.preventDefault();
        window.mdCanvas.windowNew().then((newPath) => {
          const name = newPath.split("/").pop() || "未命名";
          openTab(newPath, name);
        });
      }
      if (mod && e.key === "o") { e.preventDefault(); window.mdCanvas.dialogOpen(); }
      if (mod && e.key === "e") { e.preventDefault(); handleToggleCollapse(); }
      if (mod && e.shiftKey && e.key === "p") { e.preventDefault(); window.mdCanvas.windowTogglePin().then(setIsPinned); }
      if (mod && (e.key === "k" || e.key === "p")) {
        e.preventDefault();
        setQuickSwitcherOpen((v) => !v);
      }
      if (mod && e.shiftKey && e.key === "f") { e.preventDefault(); handleFocusMode(); }
      // Tab switching: Cmd+1..9
      if (mod && !isNaN(Number(e.key)) && Number(e.key) >= 1 && Number(e.key) <= 9) {
        const idx = Number(e.key) - 1;
        if (idx < tabsRef.current.length) { e.preventDefault(); setActiveIdx(idx); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, handleToggleCollapse, handleFocusMode, handleExportImage, handleOpenLinkDialog, activeIdx, closeTab, openTab]);

  const handleTogglePin = useCallback(async () => {
    const pinned = await window.mdCanvas.windowTogglePin();
    setIsPinned(pinned);
  }, []);
  const handleNew = useCallback(() => {
    window.mdCanvas.windowNew().then((newPath) => {
      const name = newPath.split("/").pop() || "未命名";
      openTab(newPath, name);
    });
  }, [openTab]);
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
    <div className="split-pane" style={{ flex: showEditor ? `0 0 ${(1 - splitRatio) * 100}%` : "1 1 100%" }}>
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
        onExportImage={handleExportImage}
        onFocusMode={handleFocusMode}
      />
      <TabBar tabs={tabs} activeIndex={activeIdx} onSwitch={setActiveIdx} onClose={closeTab} />
      <div className="main-area">
        <NotesList
          currentPath={filePath}
          onSelect={handleNotesSelect}
          onDelete={handleNotesDelete}
          onRename={handleNotesRename}
          visible={notesVisible}
          onToggle={() => setNotesVisible((v) => !v)}
        />
        <div className="split-container">
          {showEditor && editorPane}
          {showEditor && showPreview && (
            <div ref={splitRef} className="split-divider" onMouseDown={handleSplitMouseDown}>
              <div className="split-handle" />
            </div>
          )}
          {showPreview && previewPane}
        </div>
        <TocSidebar
          markdown={content}
          activeId={activeHeadingId}
          onHeadingClick={handleTocClick}
          visible={tocVisible}
          onToggle={() => setTocVisible((v) => !v)}
        />
      </div>
      <QuickSwitcher
        visible={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onSelect={handleQuickSwitch}
      />
      <TableInserter
        visible={tableInserterOpen}
        onClose={() => setTableInserterOpen(false)}
        onInsert={handleInsertTable}
      />
      <LinkDialog
        visible={linkDialogOpen}
        preselectText={linkPreselect}
        onClose={() => setLinkDialogOpen(false)}
        onInsert={handleInsertLink}
      />
    </div>
  );
};

export default App;
