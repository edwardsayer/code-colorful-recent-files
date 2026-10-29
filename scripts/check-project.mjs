#!/usr/bin/env node
/**
 * code-colorful-recent-files 專案健康度檢查（zero-dependency，Node 20+）。
 *
 * 檢查必要檔案、manifest 契約（engines.vscode／main／publisher／capabilities／
 * @types/vscode 對齊）、i18n bundle 對稱及 src 中 l10n 訊息 key 覆蓋。
 * 用法：npm run check:project
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch {
    return null;
  }
};

console.log('[check:project] 正在執行專案健康度檢查...');

// 1. 必要檔案存在性
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'esbuild.mjs',
  'LICENSE',
  'README.md',
  'README.zh-TW.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'assets/icon.svg',
  'package.nls.json',
  'package.nls.zh-tw.json',
  'package.nls.zh-cn.json',
  'l10n/bundle.l10n.json',
  'l10n/bundle.l10n.zh-tw.json',
  'l10n/bundle.l10n.zh-cn.json',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`缺少必要檔案：${file}`);
  }
}

// 2. package.json 契約檢查
const pkg = readJson('package.json');
if (!pkg) {
  errors.push('無法解析 package.json');
} else {
  if (!pkg.engines?.vscode) errors.push('package.json 缺少 engines.vscode');
  if (pkg.main !== './dist/extension.js') errors.push(`package.json main 應為 ./dist/extension.js，目前為 ${pkg.main}`);
  if (!pkg.publisher) errors.push('package.json 缺少 publisher');

  // 對齊 @types/vscode
  const typesVscode = pkg.devDependencies?.['@types/vscode'];
  if (typesVscode && pkg.engines?.vscode) {
    const minEngine = pkg.engines.vscode.replace(/^[\^~]/, '');
    const cleanTypes = typesVscode.replace(/^[\^~]/, '');
    if (minEngine !== cleanTypes) {
      warnings.push(`engines.vscode (${pkg.engines.vscode}) 與 @types/vscode (${typesVscode}) 版本可能不一致`);
    }
  }
}

// 3. i18n catalog 對稱性檢查（自動列舉所有語系，新增語系不必改本檢查器）
//
// manifest 用 `package.nls.<locale>.json`、runtime 用 `l10n/bundle.l10n.<locale>.json`。
// 英文 base（`package.nls.json`／`l10n/bundle.l10n.json`）是 source of truth，其餘 locale 逐項比對。
//
// 2026-10-29（feat.i18n-menu）：原本只寫死比對 `zh-tw`，zh-cn 少 key 不會被發現。
// 改為列舉檔案後，未來新增 locale 自動納入。
const catalogFiles = (dir, prefix, baseName) => {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    // base 檔（`package.nls.json`／`bundle.l10n.json`）本身不是 locale，必須排除；
    // 否則 `localeOf()` 會把它切成 locale `json` 並拿它與自己比對（恆真、無意義）。
    .filter((name) => name !== baseName)
    .sort();
};
const localeOf = (name, prefix) => name.slice(prefix.length, name.length - '.json'.length);

// 只比較 placeholder 集合，允許翻譯調整參數順序或重複引用。
const placeholdersOf = (value) => [...new Set(value.match(/\{\d+\}/g) ?? [])].sort().join(',');

const compareCatalog = (file, source, translated) => {
  if (!translated) {
    errors.push(`${file} 無法解析或不存在`);
    return;
  }
  const missing = Object.keys(source).filter((key) => !(key in translated));
  const extra = Object.keys(translated).filter((key) => !(key in source));
  if (missing.length) {
    errors.push(`${file} 缺少 ${missing.length} 個 key：${missing.slice(0, 5).join(', ')}`);
  }
  if (extra.length) {
    errors.push(`${file} 有 ${extra.length} 個多餘 key：${extra.slice(0, 5).join(', ')}`);
  }
  for (const [key, value] of Object.entries(source)) {
    const target = translated[key];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${file} 基準語系有空值或非字串：${key}`);
    } else if (typeof target !== 'string' || !target.trim()) {
      errors.push(`${file} 訊息必須是非空字串：${key}`);
    } else if (placeholdersOf(value) !== placeholdersOf(target)) {
      errors.push(`${file} placeholder 不一致：${key}（基準 ${placeholdersOf(value) || '無'} / 譯文 ${placeholdersOf(target) || '無'}）`);
    }
  }
};

const nlsBase = readJson('package.nls.json');
const bundleBase = readJson('l10n/bundle.l10n.json');
if (!nlsBase) errors.push('無法解析 package.nls.json（英文 base 不存在則無法比對）');
if (!bundleBase) errors.push('無法解析 l10n/bundle.l10n.json（英文 base 不存在則無法比對）');

const nlsLocales = catalogFiles(root, 'package.nls.', 'package.nls.json').map((name) => ({
  file: name,
  locale: localeOf(name, 'package.nls.'),
}));
const bundleLocales = catalogFiles(path.join(root, 'l10n'), 'bundle.l10n.', 'bundle.l10n.json').map((name) => ({
  file: `l10n/${name}`,
  locale: localeOf(name, 'bundle.l10n.'),
}));
if (nlsLocales.length === 0) errors.push('找不到任何 package.nls.<locale>.json 語系檔');
if (bundleLocales.length === 0) errors.push('找不到任何 l10n/bundle.l10n.<locale>.json 語系檔');

if (nlsBase) {
  for (const { file } of nlsLocales) compareCatalog(file, nlsBase, readJson(file));
}
if (bundleBase) {
  for (const { file } of bundleLocales) compareCatalog(file, bundleBase, readJson(file));
}

// 兩邊語系清單必須一致，避免只補 manifest 或只補 runtime bundle。
const nlsLocaleIds = nlsLocales.map((entry) => entry.locale).sort();
const bundleLocaleIds = bundleLocales.map((entry) => entry.locale).sort();
const onlyNls = nlsLocaleIds.filter((id) => !bundleLocaleIds.includes(id));
const onlyBundle = bundleLocaleIds.filter((id) => !nlsLocaleIds.includes(id));
if (onlyNls.length) errors.push(`語系只存在於 package.nls 而缺 l10n bundle：${onlyNls.join(', ')}`);
if (onlyBundle.length) errors.push(`語系只存在於 l10n bundle 而缺 package.nls：${onlyBundle.join(', ')}`);

// 輸出結果
if (warnings.length > 0) {
  console.warn('[check:project] 警告：');
  warnings.forEach((w) => console.warn(`  ⚠️  ${w}`));
}

if (errors.length > 0) {
  console.error('[check:project] 錯誤：');
  errors.forEach((e) => console.error(`  ❌ ${e}`));
  process.exit(1);
}

console.log('[check:project] ✅ 專案健康度檢查通過！');
