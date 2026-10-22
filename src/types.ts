/** 專屬 URI Scheme 用於局部裝飾自訂 TreeView，隔離原生 Explorer */
export const RECENT_SCHEME = 'colorful-recent';
export const RECENT_FOLDER_SCHEME = 'colorful-recent-folder';

/** 最近檔案記錄結構 */
export interface RecentFileRecord {
  uri: string;              // 檔案 URI 字串 (file://...)
  fsPath: string;           // 檔案本機絕對路徑
  lastOpenedTime: number;   // 最後開啟或切換聚焦的時間戳記 (毫秒)
  lastModifiedTime: number; // 最後編輯或存檔的時間戳記 (毫秒)
}

/** 時間熱度等級 (時間階梯模式) */
export enum HeatmapLevel {
  Fresh = 'fresh',     // < 15 分鐘 (綠色)
  Warm = 'warm',       // < 2 小時 (黃色)
  Day = 'day',         // < 24 小時 (橘色)
  Old = 'old',         // >= 24 小時 (無顏色/次要色)
}

/** 色彩標記配置模式 */
export type ColorScheme = 'timeBucket' | 'rankSpectrum';

/** 樹狀節點項目 */
export type RecentTreeElement = RecentFolderElement | RecentFileElement;

export interface RecentFolderElement {
  kind: 'folder';
  folderPath: string;         // 相對工作區或目錄路徑
  folderAbsolutePath: string; // 完整絕對路徑
  folderName: string;
  files: RecentFileRecord[];
  primaryFileFsPath?: string; // 該資料夾中排序第一 (最新) 的檔案路徑
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
  colorScheme: ColorScheme;
  showColorDotIcon: boolean;
  styleNativeExplorer: boolean;
}
