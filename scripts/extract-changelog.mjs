#!/usr/bin/env node
/**
 * 從 `CHANGELOG.md` 擷取指定版本的章節，輸出成 GitHub Release notes。
 *
 * 為什麼需要：Release 由**本機**用 gate 候選建立（`gh release create --notes-file`），
 * 而 CI 不建立 Release（一個版本只建置一次，見 `dev/workspace/docs/release-runbook.md` §3.2／§3.6）。
 * Release notes 直接取自 repo 內的 CHANGELOG，避免手抄漏字或與 tag 不一致。
 *
 * 用法：
 *   node scripts/extract-changelog.mjs v0.4.0        # tag 形式（自動去掉前導 v）
 *   node scripts/extract-changelog.mjs 0.4.0
 *   node scripts/extract-changelog.mjs v0.4.0 --version-suffix
 *
 * 輸出：該版本章節（不含 `## [x.y.z]` 標題行本身），以 stdout 輸出；找不到版本時 exit 1。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const changelogPath = join(root, 'CHANGELOG.md');

const rawArg = process.argv[2];
if (!rawArg) {
  console.error('用法：node scripts/extract-changelog.mjs v<version>');
  process.exit(1);
}
const version = rawArg.replace(/^v/i, '').trim();

const lines = readFileSync(changelogPath, 'utf8').split(/\r?\n/);
// 標題形如：`## [0.4.0] - 2026-11-01` 或 `## 0.4.0`
const heading = new RegExp(`^##\\s*\\[?${version.replace(/\./g, '\\.')}\\]?`);
const startIndex = lines.findIndex((line) => heading.test(line));
if (startIndex === -1) {
  console.error(`CHANGELOG.md 找不到版本 ${version} 的章節（預期標題形如 "## [${version}] - YYYY-MM-DD"）`);
  process.exit(1);
}

const body = [];
for (let i = startIndex + 1; i < lines.length; i += 1) {
  if (/^##\s/.test(lines[i])) {
    break;
  }
  body.push(lines[i]);
}

const trimmed = body.join('\n').replace(/^\n+/, '').trimEnd();
if (!trimmed) {
  console.error(`版本 ${version} 的章節是空的`);
  process.exit(1);
}

process.stdout.write(`${trimmed}\n`);
