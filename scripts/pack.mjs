#!/usr/bin/env node
/**
 * 打包 VSIX，輸出檔名固定為 `colorful-recent-files-<version>.vsix`。
 *
 * 為什麼不用 `vsce package --out colorful-recent-files-${npm_package_version}.vsix`：
 * npm 的 `${npm_package_version}` 變數只在 npm script 的 shell 中被展開，
 * 而 Windows 上 npm 預設用 cmd.exe、Git Bash 直呼 `npm run` 時行為又不同，
 * 曾實測產出字面值 `colorful-recent-files-${npm_package_version}.vsix`。
 * 直接讀 package.json 的 version 最穩定，也避免依賴 shell。
 *
 * 用法：
 *   npm run package:vsix
 *   node scripts/pack.mjs            # 等同上行（不含 production build）
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const outName = `colorful-recent-files-${pkg.version}.vsix`;

// 呼叫本地 vsce（Windows 需要 .cmd）
const isWin = process.platform === 'win32';
const vsce = join(root, 'node_modules', '.bin', isWin ? 'vsce.cmd' : 'vsce');

// Windows 上 .cmd 必須經 shell 執行；以字串形式傳命令避免 shell 注入警告
if (isWin) {
  execFileSync(`"${vsce}" package --out "${outName}"`, { cwd: root, stdio: 'inherit', shell: true });
} else {
  execFileSync(vsce, ['package', '--out', outName], { cwd: root, stdio: 'inherit' });
}

const outPath = join(root, outName);
if (!existsSync(outPath)) {
  console.error(`[pack] 預期產物不存在：${outPath}`);
  process.exit(1);
}

const sha256 = createHash('sha256').update(readFileSync(outPath)).digest('hex');
const bytes = statSync(outPath).size;

console.log('');
console.log(`[pack] 產物：${outName}`);
console.log(`[pack] 大小：${bytes} bytes`);
console.log(`[pack] SHA-256：${sha256}`);
console.log('[pack] 注意：VSIX 內含 zip 時間戳，重新打包會得到不同的 SHA-256。');
console.log('[pack] 內容是否變更請以逐檔內容清單比對，見 pre-release gate 的 decision.md。');
