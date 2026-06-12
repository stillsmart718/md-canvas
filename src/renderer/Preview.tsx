import React, { useMemo } from "react";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

// Configure marked with highlight.js via marked-highlight extension
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
  const html = useMemo(() => {
    try {
      return marked.parse(markdown) as string;
    } catch {
      return "<p>渲染错误</p>";
    }
  }, [markdown]);

  return (
    <div
      className="preview-content markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default Preview;
