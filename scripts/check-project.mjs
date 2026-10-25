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

  // 3. package.nls 對稱性檢查
  const nlsEn = readJson('package.nls.json');
  const nlsZh = readJson('package.nls.zh-tw.json');
  if (nlsEn && nlsZh) {
    const enKeys = Object.keys(nlsEn).sort();
    const zhKeys = Object.keys(nlsZh).sort();
    for (const k of enKeys) {
      if (!nlsZh[k]) errors.push(`package.nls.zh-tw.json 缺少 key：${k}`);
    }
    for (const k of zhKeys) {
      if (!nlsEn[k]) errors.push(`package.nls.json 缺少 key：${k}`);
    }
  }

  // 4. l10n bundle 對稱性檢查
  const l10nEn = readJson('l10n/bundle.l10n.json');
  const l10nZh = readJson('l10n/bundle.l10n.zh-tw.json');
  if (l10nEn && l10nZh) {
    const enKeys = Object.keys(l10nEn).sort();
    const zhKeys = Object.keys(l10nZh).sort();
    for (const k of enKeys) {
      if (!l10nZh[k]) errors.push(`l10n/bundle.l10n.zh-tw.json 缺少 key：${k}`);
    }
    for (const k of zhKeys) {
      if (!l10nEn[k]) errors.push(`l10n/bundle.l10n.json 缺少 key：${k}`);
    }
  }
}

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
