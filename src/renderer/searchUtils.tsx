import React from "react";

// ── Hybrid search: substring + fuzzy ────────────────────────
export function matchScore(text: string, query: string): number {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;

  if (lower.includes(q)) {
    score += 100;
    if (lower.startsWith(q)) score += 50;
  } else {
    const tokens = lower.split(/[\s\-_.,;:!?，。！？、]+/);
    if (tokens.some((tok) => tok.startsWith(q))) score += 60;
  }

  let ti = 0, prevMatch = -1, matched = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = false;
    while (ti < lower.length) {
      if (lower[ti] === ch) {
        if (prevMatch >= 0 && ti === prevMatch + 1) score += 2;
        score += 5;
        prevMatch = ti;
        ti++;
        matched++;
        found = true;
        break;
      }
      ti++;
    }
    if (!found) break;
  }
  if (matched === q.length) score += 20;

  return score === 0 ? -Infinity : score;
}

// ── Tag extraction ──────────────────────────────────────────
export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const inlineRegex = /(?:^|\s)#([\w一-鿿㐀-䶿-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(content)) !== null) {
    tags.add(match[1]);
  }
  const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (yamlMatch) {
    const fm = yamlMatch[1];
    const tagLine = fm.match(/^tags?\s*:\s*(.+)$/m);
    if (tagLine) {
      const raw = tagLine[1];
      if (raw.startsWith("[")) {
        const listMatch = raw.match(/\[([^\]]*)\]/);
        if (listMatch) {
          listMatch[1].split(",").forEach((t) => {
            const cleaned = t.trim().replace(/["']/g, "");
            if (cleaned) tags.add(cleaned);
          });
        }
      } else {
        raw.split(/\s+/).forEach((t) => {
          const cleaned = t.trim();
          if (cleaned) tags.add(cleaned);
        });
      }
    }
  }
  return Array.from(tags);
}

// ── Highlight matched text ──────────────────────────────────
// Splits text around query matches, wrapping each match in <mark>.
export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.trim();
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lower.indexOf(ql, cursor);
    if (idx === -1) {
      nodes.push(text.slice(cursor));
      break;
    }
    // Text before match
    if (idx > cursor) nodes.push(text.slice(cursor, idx));
    // Highlighted match (use original casing from text)
    nodes.push(
      <mark className="search-highlight" key={idx}>
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    cursor = idx + q.length;
  }

  return nodes.length > 0 ? nodes : text;
}

// ── Extract matching context ────────────────────────────────
// Finds the line that best matches query and returns a snippet
// with ~20 chars of surrounding context, truncated with ellipsis.
export function extractContext(content: string, query: string): string {
  if (!query.trim() || !content.trim()) return "";
  const q = query.trim();
  const lower = content.toLowerCase();
  const ql = q.toLowerCase();

  const lines = content.split("\n");
  // Find the best line: prefer substring match, then fuzzy
  let bestLineIdx = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue; // skip headings, they're shown as title
    // Prefer lines containing the exact query
    if (line.toLowerCase().includes(ql)) {
      const pos = line.toLowerCase().indexOf(ql);
      // Earlier match is better
      const s = 200 - pos;
      if (s > bestScore) {
        bestScore = s;
        bestLineIdx = i;
      }
    }
  }

  // Fallback: use fuzzy on each line
  if (bestLineIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;
      const s = matchScore(line, q);
      if (s > bestScore) {
        bestScore = s;
        bestLineIdx = i;
      }
    }
  }

  if (bestLineIdx === -1) return content.slice(0, 80) + (content.length > 80 ? "…" : "");

  let line = lines[bestLineIdx].trim();
  const maxLen = 60;
  if (line.length <= maxLen) return line;

  // Find the match position and clip around it
  const idx = line.toLowerCase().indexOf(ql);
  if (idx >= 0) {
    const start = Math.max(0, idx - 20);
    const end = Math.min(line.length, idx + q.length + 20);
    let snippet = "";
    if (start > 0) snippet += "…";
    snippet += line.slice(start, end);
    if (end < line.length) snippet += "…";
    return snippet;
  }

  // No exact substring — just trim
  return line.slice(0, maxLen) + (line.length > maxLen ? "…" : "");
}
