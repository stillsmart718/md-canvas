import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { EditorState, type Extension, type Range, StateEffect, StateField } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

export interface EditorHandle {
  insertAtCursor: (text: string) => void;
  scrollToMatch: (query: string) => void;
}

// ── Search highlight state ──────────────────────────────────
// Uses a StateEffect so the imperative handle can push the
// current search term into the editor state. The field derives
// decorations that highlight every occurrence.

const setSearchQuery = StateEffect.define<string>();

const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Clear on any doc change
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
          ranges.push(
            Decoration.mark({
              class: "cm-search-match",
            }).range(idx, idx + q.length)
          );
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
const revealPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    cleanup: ReturnType<typeof setTimeout> | null = null;

    constructor() {
      this.decorations = Decoration.none;
    }

    update(update: ViewUpdate) {
      if (!update.docChanged) return;
      this.decorations = this.decorations.map(update.changes);

      const newRanges: Range<Decoration>[] = [];
      update.changes.iterChanges((_fa, _ta, fb, tb, ins) => {
        if (ins.length > 0) {
          const charCount = tb - (fb as number);
          const dur = Math.min(Math.max(charCount * 18, 60), 2000);
          newRanges.push(
            Decoration.mark({
              attributes: { style: `--tw-dur: ${dur}ms` },
              class: "typewriter-reveal",
            }).range(fb as number, tb)
          );
        }
      });

      if (newRanges.length > 0) {
        this.decorations = this.decorations.update({ add: newRanges });
        if (this.cleanup) clearTimeout(this.cleanup);
        this.cleanup = setTimeout(() => {
          this.decorations = Decoration.none;
          update.view.dispatch({});
        }, 2200);
      }
    }

    destroy() {
      if (this.cleanup) clearTimeout(this.cleanup);
    }
  },
  { decorations: (v) => v.decorations }
);

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
      const view = viewRef.current;
      if (!view) return;
      const pos = view.state.selection.main.head;
      view.dispatch({
        changes: { from: pos, to: pos, insert: text },
        selection: { anchor: pos + text.length },
      });
      view.focus();
    },
    scrollToMatch(query: string) {
      const view = viewRef.current;
      if (!view || !query) return;
      const doc = view.state.doc.toString();
      const lower = doc.toLowerCase();
      const ql = query.toLowerCase();
      const idx = lower.indexOf(ql);
      if (idx < 0) return;

      // 1) Push the query to the highlight field → all occurrences glow
      view.dispatch({
        effects: [setSearchQuery.of(query)],
        selection: { anchor: idx, head: idx + query.length },
        scrollIntoView: true,
      });
      view.focus();
    },
  }));

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    });
    const extensions: Extension[] = [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      lineNumbers(),
      highlightActiveLine(),
      history(),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      EditorState.tabSize.of(2),
      oneDark,
      searchHighlightField,
      revealPlugin,
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px", fontFamily: "'SF Mono', 'Menlo', 'Monaco', monospace" },
        ".cm-scroller": { overflow: "auto" },
        ".cm-content": { padding: "16px", caretColor: "#528bff" },
        ".cm-gutters": { borderRight: "none", backgroundColor: "transparent" },
        ".cm-search-match": {
          background: "rgba(253, 224, 71, 0.35)",
          borderRadius: "2px",
          outline: "1px solid rgba(253, 224, 71, 0.6)",
        },
        "&.cm-dark .cm-search-match": {
          background: "rgba(133, 77, 14, 0.45)",
          outline: "1px solid rgba(133, 77, 14, 0.6)",
        },
      }),
    ];
    const state = EditorState.create({ doc: value, extensions });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value && view.hasFocus === false) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={containerRef} className="editor-container" />;
});

export default Editor;
