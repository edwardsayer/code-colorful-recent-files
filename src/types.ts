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
export type ColorScheme = 'timeBucket' | 'rankSpectrum' | 'plainText';

/** 分組模式：平鋪清單、依目錄分組、依檔案類型分組 */
export type GroupByMode = 'none' | 'directory' | 'type';


/** 樹狀節點項目 */
export type RecentTreeElement = RecentFolderElement | RecentFileElement;

export interface RecentFolderElement {
  kind: 'folder';
  groupKind: 'directory' | 'type'; // 標記是實體目錄還是檔案類型
  folderKey: string;               // 唯一排序與辨識 key (如 "dir:/path" 或 "type:TS")
  folderPath: string;              // 相對工作區或目錄路徑 (或類型名稱)
  folderAbsolutePath: string;      // 完整絕對路徑
  folderName: string;              // 顯示名稱 (如目錄名或大寫副檔名 'TS')
  files: RecentFileRecord[];
  primaryFileFsPath?: string;      // 該資料夾中排序第一 (最新) 的檔案路徑
  isPinned: boolean;               // 是否已 Pin (決定排序區塊與右鍵選單)
  latestActivity: number;          // 組內最活躍檔案時間，供未 Pin 分組排序
}

export interface RecentFileElement {
  kind: 'file';
  record: RecentFileRecord;
  parentFolder?: string;
}

/** 擴充套件設定型別 */
export interface ExtensionConfig {
  groupBy: GroupByMode;
  groupByDirectory: boolean;       // 向後相容旗標
  maxRecentFiles: number;
  highlightMode: 'lastAccess' | 'lastModified';
  colorScheme: ColorScheme;
  showColorDotIcon: boolean;
  styleNativeExplorer: boolean;
  syncWithOpenTabs: boolean;
}
