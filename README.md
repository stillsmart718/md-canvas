# MD预览

> 轻量级 macOS Markdown 便签工具 — 所见即所得，即写即预览

<p align="center">
  <img src="screenshots/app.png" alt="MD预览截图" width="720" />
</p>

**MD预览** 是一款原生 macOS 桌面应用，基于 Electron + React + CodeMirror 构建。它提供**分栏编辑/预览**、**实时渲染**、**模糊搜索**、**自动标题**、**PDF 导出**等功能，适合快速记笔记、写文档、整理 Markdown 内容。

---

## ✨ 功能特性

### 📝 编辑与预览
- **分栏模式** — 左侧 CodeMirror 编辑器 + 右侧 Markdown 实时预览
- **专注模式** — 一键切换「仅编辑 / 仅预览 / 分栏」三种布局
- **滚动同步** — 编辑区和预览区双向滚动联动
- **自动保存** — 输入 500ms 后自动写入磁盘，标题栏红点提示未保存状态
- **语法高亮** — 编辑器支持 Markdown 语法 + 代码块高亮（highlight.js）
- **打字机动画** — 新输入的文字带有流畅揭示动画

### 🏷️ 便签管理
- **侧边栏列表** — 所有便签集中管理，支持重命名和删除
- **标签系统** — 支持 `#tag` 内联标签和 YAML frontmatter 标签，可按标签筛选
- **模糊搜索** — fzf 风格三层混合搜索（子串 + 前缀 + 模糊），搜索词高亮，显示匹配上下文
- **快速切换** — `Cmd+K` / `Cmd+P` 全局弹窗搜便签，支持键盘导航
- **自动标题** — 文件名自动跟随文中第一个 H1 标题重命名

### 🖥️ macOS 原生体验
- **隐藏式标题栏** — 仿 macOS 原生窗口风格，融入系统界面
- **迷你卡片** — `Cmd+E` 将窗口折叠成悬浮卡片，再次点击展开
- **窗口置顶** — `Cmd+Shift+P` 将便签钉在屏幕最上层
- **目录导航** — 右侧边栏自动解析标题层级，点击跳转，滚动高亮

### 📄 导入导出
- **PDF 导出** — 完整排版导出（非截图），保留代码高亮和中文字体
- **打开文件** — `Cmd+O` 打开任意 `.md` / `.markdown` 文件
- **新建便签** — `Cmd+N` 在当前窗口新建，不额外弹窗

---

## 🚀 快速开始

### 系统要求
- macOS 10.12+（Apple Silicon / Intel）
- Node.js 18+

### 下载安装

从 [Releases](https://github.com/stillsmart718/md-canvas/releases) 页面下载最新 `.dmg` 文件，双击安装。

> ⚠️ 应用未签名，首次打开请右键点击 →「打开」以绕过 Gatekeeper。

### 开发运行

```bash
# 克隆仓库
git clone https://github.com/stillsmart718/md-canvas.git
cd md-canvas

# 安装依赖
npm install

# 启动开发模式
npm run dev

# 构建 DMG 安装包
npm run build:app
```

---

## ⌨️ 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Cmd + N` | 新建便签 |
| `Cmd + O` | 打开 Markdown 文件 |
| `Cmd + S` | 手动保存 |
| `Cmd + E` | 折叠/展开 迷你卡片 |
| `Cmd + K` / `Cmd + P` | 全局快速切换便签 |
| `Cmd + Shift + P` | 窗口置顶 |
| `Cmd + Shift + F` | 切换专注模式 |
| `Cmd + Shift + E` | 导出 PDF |

---

## 📁 项目结构

```
md-canvas/
├── src/
│   ├── main.ts                   # Electron 主进程
│   ├── preload.ts                # 预加载脚本 (contextBridge API)
│   └── renderer/
│       ├── index.html            # HTML 入口
│       ├── index.tsx             # React 入口
│       ├── App.tsx               # 主应用组件（状态中心）
│       ├── Editor.tsx            # CodeMirror 编辑器封装
│       ├── Preview.tsx           # Markdown → HTML 渲染
│       ├── Titlebar.tsx          # macOS 风格标题栏
│       ├── NotesList.tsx         # 左侧便签列表 + 搜索
│       ├── QuickSwitcher.tsx     # Cmd+K 全局快速切换
│       ├── TocSidebar.tsx        # 右侧目录导航
│       ├── MiniCard.tsx          # 折叠态迷你卡片
│       ├── searchUtils.tsx       # 搜索算法（模糊匹配/高亮/上下文）
│       ├── styles.css            # 全局样式
│       └── globals.d.ts          # TypeScript 类型声明
├── build/
│   └── icon.icns                 # 应用图标
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 框架 | [Electron](https://www.electronjs.org/) 33 |
| UI | [React](https://react.dev/) 19 + TypeScript |
| 编辑器 | [CodeMirror 6](https://codemirror.net/) |
| Markdown | [marked](https://marked.js.org/) + [highlight.js](https://highlightjs.org/) |
| 打包 | [electron-builder](https://www.electron.build/) |
| 构建 | [esbuild](https://esbuild.github.io/) |

---

## 📄 许可证

MIT License — 详见 [LICENSE](./LICENSE)

---

## 🙏 致谢

- [CodeMirror](https://codemirror.net/) — 强大的浏览器端代码编辑器
- [marked](https://github.com/markedjs/marked) — 极速 Markdown 解析器
- [highlight.js](https://highlightjs.org/) — 代码语法高亮
- [Electron](https://www.electronjs.org/) — 跨平台桌面应用框架
