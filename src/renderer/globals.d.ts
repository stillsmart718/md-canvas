export {};

interface FileEntry {
  name: string;
  path: string;
}

interface FileWithContent extends FileEntry {
  content: string;
}

declare global {
  interface Window {
    mdCanvas: {
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
      exportImage: (html: string, title: string) => Promise<boolean>;
      imageSave: (fileName: string, data: string) => Promise<string>;
    };
  }
}
