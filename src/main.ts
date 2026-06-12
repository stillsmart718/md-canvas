import { app, BrowserWindow, ipcMain, dialog, screen } from "electron";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const NOTES_DIR = path.join(os.homedir(), "md-notes");
const CARD_W = 260, CARD_H = 220;
let activeWindows = new Map<string, BrowserWindow>();
let collapsedBounds = new Map<number, { x: number; y: number; w: number; h: number }>();

async function createNoteWindow(filePath: string) {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const w = 860, h = 600;
  const x = Math.round((screenW - w) / 2), y = 80;

  const win = new BrowserWindow({
    width: w, height: h, x, y,
    minWidth: 400, minHeight: 300,
    title: path.basename(filePath),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: "#f5f5f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  const escapedPath = encodeURIComponent(filePath);
  win.loadFile(path.join(__dirname, "renderer", "index.html"), { query: { file: escapedPath } });
  activeWindows.set(filePath, win);
  win.on("closed", () => { activeWindows.delete(filePath); });
}

app.whenReady().then(async () => {
  await fs.mkdir(NOTES_DIR, { recursive: true });
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  if (fileArg) {
    await createNoteWindow(fileArg.replace("--file=", ""));
  } else {
    const welcomePath = path.join(NOTES_DIR, "welcome.md");
    try { await fs.access(welcomePath); } catch {
      await fs.writeFile(welcomePath, `# MD预览

欢迎使用 MD预览 — 轻量级 macOS Markdown 预览工具。

## 快捷键
- **Cmd+S** — 保存
- **Cmd+N** — 新建便签
- **Cmd+O** — 打开 Markdown 文件

开始写点什么吧！
`, "utf-8");
    }
    await createNoteWindow(welcomePath);
  }
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => {
  if (activeWindows.size === 0) createNoteWindow(path.join(NOTES_DIR, "welcome.md"));
});

// ── IPC ────────────────────────────────────────────────────

ipcMain.handle("file:read", async (_e, p: string) => await fs.readFile(p, "utf-8"));
ipcMain.handle("file:write", async (_e, p: string, c: string) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, c, "utf-8");
  return true;
});

ipcMain.handle("file:create", async () => {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const filePath = path.join(NOTES_DIR, `note-${stamp}.md`);
  await fs.writeFile(filePath, "# 新建便签\n\n", "utf-8");
  await createNoteWindow(filePath);
  return filePath;
});

ipcMain.handle("dialog:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "打开 Markdown 文件",
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    properties: ["openFile"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  await createNoteWindow(filePath);
  return filePath;
});

ipcMain.handle("window:new", async () => {
  const filePath = path.join(NOTES_DIR, `note-${Date.now()}.md`);
  await fs.writeFile(filePath, "# 新建便签\n\n", "utf-8");
  return filePath;
});

ipcMain.handle("window:collapse-toggle", async (event, collapsed: boolean) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  const id = win.id;
  if (collapsed) {
    const b = win.getBounds();
    collapsedBounds.set(id, { x: b.x, y: b.y, w: b.width, h: b.height });
    const cx = Math.round(b.x + (b.width - CARD_W) / 2);
    const cy = Math.round(b.y + (b.height - CARD_H) / 2);
    win.setResizable(false);
    win.setBounds({ x: cx, y: cy, width: CARD_W, height: CARD_H }, true);
    return true;
  } else {
    const prev = collapsedBounds.get(id);
    if (prev) { win.setResizable(true); win.setBounds({ x: prev.x, y: prev.y, width: prev.w, height: prev.h }, true); collapsedBounds.delete(id); }
    return false;
  }
});

ipcMain.handle("window:toggle-pin", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  const pinned = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(pinned);
  return pinned;
});

ipcMain.handle("window:get-filepath", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.getTitle() : "";
});

// ── New IPC: File management ────────────────────────────────

ipcMain.handle("file:list", async () => {
  try {
    const files = await fs.readdir(NOTES_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const results: { name: string; path: string }[] = [];
    for (const f of mdFiles) {
      results.push({ name: f, path: path.join(NOTES_DIR, f) });
    }
    return results;
  } catch {
    return [];
  }
});

ipcMain.handle("file:delete", async (_e, filePath: string) => {
  try {
    await fs.unlink(filePath);
    // Close the window for this file if open
    const win = activeWindows.get(filePath);
    if (win) win.close();
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("file:rename", async (_e, oldPath: string, newName: string) => {
  try {
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    await fs.rename(oldPath, newPath);
    // Update window tracking
    const win = activeWindows.get(oldPath);
    if (win) {
      activeWindows.delete(oldPath);
      activeWindows.set(newPath, win);
      win.setTitle(newName);
    }
    return newPath;
  } catch {
    return null;
  }
});

ipcMain.handle("file:read-all", async () => {
  try {
    const files = await fs.readdir(NOTES_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));
    const results: { name: string; path: string; content: string }[] = [];
    for (const f of mdFiles) {
      const filePath = path.join(NOTES_DIR, f);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        results.push({ name: f, path: filePath, content });
      } catch {
        // skip unreadable files
      }
    }
    return results;
  } catch {
    return [];
  }
});

// ── PDF export helpers ─────────────────────────────────────

function wrapHtmlDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 14px; line-height: 1.8; color: #1d1d1f;
    padding: 40px 48px; max-width: 780px; margin: 0 auto;
  }
  h1 { font-size: 2em; font-weight: 700; margin: 0 0 0.5em; padding-bottom: 0.3em; border-bottom: 1px solid #e5e5ea; }
  h2 { font-size: 1.5em; font-weight: 600; margin: 1.5em 0 0.5em; padding-bottom: 0.25em; border-bottom: 1px solid #e5e5ea; }
  h3 { font-size: 1.25em; font-weight: 600; margin: 1.25em 0 0.5em; }
  h4 { font-size: 1.1em; font-weight: 600; margin: 1em 0 0.4em; }
  h5, h6 { font-size: 1em; font-weight: 600; margin: 1em 0 0.3em; color: #6e6e73; }
  p { margin: 0 0 0.8em; }
  a { color: #007aff; text-decoration: none; }
  ul, ol { padding-left: 2em; margin: 0 0 0.8em; }
  li { margin: 0.25em 0; }
  code {
    background: #f6f8fa; color: #24292e;
    padding: 0.2em 0.4em; border-radius: 4px;
    font-family: "SF Mono", "Menlo", "Monaco", monospace; font-size: 0.9em;
  }
  pre {
    background: #f6f8fa; border-radius: 8px;
    padding: 16px; overflow-x: auto; margin: 0 0 1em;
    border: 1px solid #e5e5ea;
  }
  pre code { background: none; padding: 0; font-size: 0.85em; line-height: 1.55; }
  blockquote {
    border-left: 3px solid #007aff;
    background: rgba(0,122,255,0.04); margin: 0 0 1em;
    padding: 0.5em 1em; color: #6e6e73; border-radius: 0 6px 6px 0;
  }
  table { border-collapse: collapse; width: 100%; margin: 0 0 1em; }
  th, td { border: 1px solid #dfe2e5; padding: 8px 12px; text-align: left; }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) { background: rgba(128,128,128,0.04); }
  hr { border: none; border-top: 1px solid #e5e5ea; margin: 1.5em 0; }
  img { max-width: 100%; border-radius: 6px; }
  input[type="checkbox"] { margin-right: 0.4em; }
  @media print {
    body { padding: 0; max-width: none; }
    @page { margin: 20mm; }
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ── Image save ──────────────────────────────────────────────
const IMAGES_DIR = path.join(os.homedir(), "md-notes", "images");

ipcMain.handle("image:save", async (_e, fileName: string, dataBase64: string) => {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  let name = fileName;
  const ext = path.extname(name) || ".png";
  const base = path.basename(name, ext);
  let dest = path.join(IMAGES_DIR, name);
  // Avoid overwriting existing files
  let counter = 1;
  while (true) {
    try { await fs.access(dest); } catch { break; }
    dest = path.join(IMAGES_DIR, `${base}-${counter}${ext}`);
    counter++;
  }
  const buf = Buffer.from(dataBase64, "base64");
  await fs.writeFile(dest, buf);
  return `images/${path.basename(dest)}`;
});

// ── Export image ────────────────────────────────────────────
ipcMain.handle("export:image", async (event, html: string, title: string) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  if (!senderWin) return false;
  const result = await dialog.showSaveDialog(senderWin, {
    title: "导出图片",
    defaultPath: `${title || "export"}.png`,
    filters: [{ name: "PNG 图片", extensions: ["png"] }],
  });
  if (result.canceled || !result.filePath) return false;

  const printWin = new BrowserWindow({
    width: 900, height: 700,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    const fullHtml = wrapHtmlDocument(html, title);
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    await new Promise((r) => setTimeout(r, 600));
    const image = await printWin.webContents.capturePage();
    const png = image.toPNG();
    await fs.writeFile(result.filePath, png);
    return true;
  } catch {
    return false;
  } finally {
    printWin.close();
  }
});

ipcMain.handle("export:pdf", async (event, html: string, title: string) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  if (!senderWin) return false;
  const result = await dialog.showSaveDialog(senderWin, {
    title: "导出 PDF",
    defaultPath: `${title || "export"}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePath) return false;

  // Create a hidden window to render the HTML → PDF
  const printWin = new BrowserWindow({
    width: 800, height: 600,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    const fullHtml = wrapHtmlDocument(html, title);
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);
    // Wait for rendering to settle
    await new Promise((r) => setTimeout(r, 500));
    const data = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    await fs.writeFile(result.filePath, data);
    return true;
  } catch {
    return false;
  } finally {
    printWin.close();
  }
});
