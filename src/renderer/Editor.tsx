import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { EditorState, type Extension, type Range, StateEffect, StateField } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

export interface EditorHandle {
  insertAtCursor: (text: string) => void;
  scrollToMatch: (query: string) => void;
  insertTableAtCursor: (rows: number, cols: number) => void;
  insertLink: (text: string, url: string) => void;
  getSelectedText: () => string;
}

// ── Search highlight state ──────────────────────────────────

const setSearchQuery = StateEffect.define<string>();

const searchHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(decorations, tr) {
    if (tr.docChanged) return Decoration.none;
    for (const e of tr.effects) {
      if (e.is(setSearchQuery)) {
        const q = e.value;
        if (!q) return Decoration.none;
        const doc = tr.state.doc.toString();
        const lower = doc.toLowerCase();
        const ql = q.toLowerCase();
        const ranges: Range<Decoration>[] = [];
        let idx = 0;
        while ((idx = lower.indexOf(ql, idx)) >= 0) {
          ranges.push(Decoration.mark({ class: "cm-search-match" }).range(idx, idx + q.length));
          idx += q.length;
        }
        return Decoration.set(ranges);
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Typewriter Reveal ViewPlugin ─────────────────────────────

const revealPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  cleanup: ReturnType<typeof setTimeout> | null = null;
  constructor() { this.decorations = Decoration.none; }
  update(update: ViewUpdate) {
    if (!update.docChanged) return;
    this.decorations = this.decorations.map(update.changes);
    const newRanges: Range<Decoration>[] = [];
    update.changes.iterChanges((_fa, _ta, fb, tb, ins) => {
      if (ins.length > 0) {
        const dur = Math.min(Math.max((tb - (fb as number)) * 18, 60), 2000);
        newRanges.push(Decoration.mark({
          attributes: { style: `--tw-dur: ${dur}ms` },
          class: "typewriter-reveal",
        }).range(fb as number, tb));
      }
    });
    if (newRanges.length > 0) {
      this.decorations = this.decorations.update({ add: newRanges });
      if (this.cleanup) clearTimeout(this.cleanup);
      this.cleanup = setTimeout(() => { this.decorations = Decoration.none; update.view.dispatch({}); }, 2200);
    }
  }
  destroy() { if (this.cleanup) clearTimeout(this.cleanup); }
}, { decorations: (v) => v.decorations });

// ── Helper: generate table markdown ──────────────────────────

function genTable(rows: number, cols: number): string {
  const lines: string[] = [];
  const header = "| " + Array.from({ length: cols }, (_, i) => `列${i + 1}`).join(" | ") + " |";
  const sep = "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |";
  lines.push(header, sep);
  for (let r = 0; r < rows - 1; r++) {
    lines.push("| " + Array.from({ length: cols }, () => "   ").join(" | ") + " |");
  }
  return "\n" + lines.join("\n") + "\n";
}

// ── Editor Component ─────────────────────────────────────────

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const Editor = forwardRef<EditorHandle, Props>(({ value, onChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      const view = viewRef.current; if (!view) return;
      const pos = view.state.selection.main.head;
      view.dispatch({ changes: { from: pos, to: pos, insert: text }, selection: { anchor: pos + text.length } });
      view.focus();
    },
    scrollToMatch(query: string) {
      const view = viewRef.current; if (!view || !query) return;
      const doc = view.state.doc.toString();
      const idx = doc.toLowerCase().indexOf(query.toLowerCase());
      if (idx < 0) return;
      view.dispatch({ effects: [setSearchQuery.of(query)], selection: { anchor: idx, head: idx + query.length }, scrollIntoView: true });
      view.focus();
    },
    insertTableAtCursor(rows: number, cols: number) {
      const view = viewRef.current; if (!view) return;
      const pos = view.state.selection.main.head;
      const md = genTable(rows, cols);
      view.dispatch({ changes: { from: pos, to: pos, insert: md }, selection: { anchor: pos + md.length } });
      view.focus();
    },
    insertLink(text: string, url: string) {
      const view = viewRef.current; if (!view) return;
      const sel = view.state.selection.main;
      if (sel.empty) {
        const md = `[${text}](${url})`;
        view.dispatch({ changes: { from: sel.head, to: sel.head, insert: md }, selection: { anchor: sel.head + md.length } });
      } else {
        const md = `[${sel.from === sel.to ? text : view.state.doc.sliceString(sel.from, sel.to)}](${url})`;
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: md }, selection: { anchor: sel.from + md.length } });
      }
      view.focus();
    },
    getSelectedText() {
      const view = viewRef.current; if (!view) return "";
      const sel = view.state.selection.main;
      return sel.empty ? "" : view.state.doc.sliceString(sel.from, sel.to);
    },
  }));

  // ── Image paste / drop handler ─────────────────────────────
  useEffect(() => {
    const el = containerRef.current; if (!el) return;

    async function handleImage(file: File) {
      if (!file.type.startsWith("image/")) return;
      const view = viewRef.current; if (!view) return;
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const relPath = await window.mdCanvas.imageSave(file.name, b64);
      const md = `\n![](${relPath})\n`;
      const pos = view.state.selection.main.head;
      view.dispatch({ changes: { from: pos, to: pos, insert: md }, selection: { anchor: pos + md.length } });
      view.focus();
    }

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const file = items[i].getAsFile();
        if (file && file.type.startsWith("image/")) { e.preventDefault(); handleImage(file); return; }
      }
    };

    const onDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) { e.preventDefault(); handleImage(files[i]); return; }
      }
    };

    const onDragOver = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };

    el.addEventListener("paste", onPaste);
    el.addEventListener("drop", onDrop);
    el.addEventListener("dragover", onDragOver);
    return () => {
      el.removeEventListener("paste", onPaste);
      el.removeEventListener("drop", onDrop);
      el.removeEventListener("dragover", onDragOver);
    };
  }, []);

  // ── Build extensions ───────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    });
    const ext: Extension[] = [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      lineNumbers(), highlightActiveLine(), history(), EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener, EditorState.tabSize.of(2),
      searchHighlightField, revealPlugin,
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px", fontFamily: "'SF Mono', 'Menlo', 'Monaco', monospace", background: "#ffffff", color: "#1d1d1f" },
        ".cm-scroller": { overflow: "auto" },
        ".cm-content": { padding: "16px", caretColor: "#007aff" },
        ".cm-gutters": { borderRight: "none", backgroundColor: "#fafafa", color: "#aeaeb2" },
        ".cm-activeLineGutter": { backgroundColor: "rgba(0,122,255,0.06)" },
        ".cm-activeLine": { backgroundColor: "rgba(0,122,255,0.04)" },
        ".cm-cursor": { borderLeftColor: "#007aff" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(0,122,255,0.15)" },
        ".cm-search-match": { background: "rgba(253, 224, 71, 0.45)", borderRadius: "2px", outline: "1px solid rgba(253, 224, 71, 0.7)" },
      }),
    ];
    const state = EditorState.create({ doc: value, extensions: ext });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  useEffect(() => {
    const view = viewRef.current; if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value && !view.hasFocus) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return <div ref={containerRef} className="editor-container" />;
});

export default Editor;
