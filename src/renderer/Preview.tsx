import React, { useMemo, useRef, useEffect } from "react";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/core";

import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGS: Record<string, any> = {
  bash, c, css, diff, go, ini, java, javascript, json, kotlin,
  markdown, plaintext, python, rust, shell, sql, swift, typescript,
  xml, yaml,
};

for (const [name, fn] of Object.entries(LANGS)) {
  hljs.registerLanguage(name, fn);
}

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    },
  })
);

marked.setOptions({ breaks: true, gfm: true });

interface Props {
  markdown: string;
}

const Preview: React.FC<Props> = ({ markdown }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => {
    try {
      return marked.parse(markdown) as string;
    } catch {
      return "<p>渲染错误</p>";
    }
  }, [markdown]);

  // ── Mermaid rendering ──────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const mermaidBlocks = el.querySelectorAll<HTMLElement>("pre code.language-mermaid");
    if (mermaidBlocks.length === 0) return;

    let cancelled = false;
    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      let id = 0;
      mermaidBlocks.forEach(async (codeEl) => {
        const src = codeEl.textContent || "";
        const pre = codeEl.parentElement;
        if (!pre) return;
        try {
          const { svg } = await mermaid.render(`mermaid-${Date.now()}-${id++}`, src);
          const div = document.createElement("div");
          div.className = "mermaid-container";
          div.innerHTML = svg;
          pre.replaceWith(div);
        } catch {
          // Keep the code block on render failure
        }
      });
    });

    return () => { cancelled = true; };
  }, [html]);

  return (
    <div ref={containerRef} className="preview-content markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
};

export default Preview;
