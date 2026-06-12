import { contextBridge, ipcRenderer } from "electron";

export interface FileEntry {
  name: string;
  path: string;
}

export interface FileWithContent extends FileEntry {
  content: string;
}

export interface MDCanvasAPI {
  fileRead: (path: string) => Promise<string>;
  fileWrite: (path: string, content: string) => Promise<boolean>;
  fileCreate: () => Promise<string>;
  fileList: () => Promise<FileEntry[]>;
  fileDelete: (path: string) => Promise<boolean>;
  fileRename: (oldPath: string, newName: string) => Promise<string | null>;
  fileReadAll: () => Promise<FileWithContent[]>;
  dialogOpen: () => Promise<string | null>;
  windowNew: () => Promise<string>;
  windowTogglePin: () => Promise<boolean>;
  windowCollapseToggle: (collapsed: boolean) => Promise<boolean>;
  windowGetFilepath: () => Promise<string>;
  exportPdf: (html: string, title: string) => Promise<boolean>;
}

const api: MDCanvasAPI = {
  fileRead: (path) => ipcRenderer.invoke("file:read", path),
  fileWrite: (path, content) => ipcRenderer.invoke("file:write", path, content),
  fileCreate: () => ipcRenderer.invoke("file:create"),
  fileList: () => ipcRenderer.invoke("file:list"),
  fileDelete: (path) => ipcRenderer.invoke("file:delete", path),
  fileRename: (oldPath, newName) => ipcRenderer.invoke("file:rename", oldPath, newName),
  fileReadAll: () => ipcRenderer.invoke("file:read-all"),
  dialogOpen: () => ipcRenderer.invoke("dialog:open"),
  windowNew: () => ipcRenderer.invoke("window:new"),
  windowTogglePin: () => ipcRenderer.invoke("window:toggle-pin"),
  windowCollapseToggle: (collapsed: boolean) => ipcRenderer.invoke("window:collapse-toggle", collapsed),
  windowGetFilepath: () => ipcRenderer.invoke("window:get-filepath"),
  exportPdf: (html, title) => ipcRenderer.invoke("export:pdf", html, title),
};

contextBridge.exposeInMainWorld("mdCanvas", api);
