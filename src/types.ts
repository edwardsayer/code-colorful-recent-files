/** 最近檔案記錄結構 */
export interface RecentFileRecord {
  uri: string;              // 檔案 URI 字串 (file://...)
  fsPath: string;           // 檔案本機絕對路徑
  lastOpenedTime: number;   // 最後開啟或切換聚焦的時間戳記 (毫秒)
  lastModifiedTime: number; // 最後編輯或存檔的時間戳記 (毫秒)
}

/** 時間熱度等級 */
export enum HeatmapLevel {
  Fresh = 'fresh',     // < 15 分鐘 (綠色)
  Warm = 'warm',       // < 2 小時 (黃色)
  Day = 'day',         // < 24 小時 (橘色)
  Old = 'old',         // >= 24 小時 (無顏色/次要色)
}

/** 樹狀節點項目 */
export type RecentTreeElement = RecentFolderElement | RecentFileElement;

export interface RecentFolderElement {
  kind: 'folder';
  folderPath: string;      // 相對工作區或目錄路徑
  folderName: string;
  files: RecentFileRecord[];
}

export interface RecentFileElement {
  kind: 'file';
  record: RecentFileRecord;
  parentFolder?: string;
}

/** 擴充套件設定型別 */
export interface ExtensionConfig {
  groupByDirectory: boolean;
  maxRecentFiles: number;
  highlightMode: 'lastAccess' | 'lastModified';
}
