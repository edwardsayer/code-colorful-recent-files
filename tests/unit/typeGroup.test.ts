import { describe, expect, it } from 'vitest';
import { getFileTypeGroup } from '../../src/util/typeGroup';

describe('getFileTypeGroup', () => {
  it('extracts uppercase extension for standard files', () => {
    expect(getFileTypeGroup('/path/to/file.ts')).toBe('TS');
    expect(getFileTypeGroup('C:\\Users\\user\\index.tsx')).toBe('TSX');
    expect(getFileTypeGroup('package.json')).toBe('JSON');
    expect(getFileTypeGroup('photo.png')).toBe('PNG');
    expect(getFileTypeGroup('script.min.js')).toBe('JS');
  });

  it('handles dotfiles and files without extensions', () => {
    expect(getFileTypeGroup('.gitignore')).toBe('GITIGNORE');
    expect(getFileTypeGroup('.env')).toBe('ENV');
    expect(getFileTypeGroup('Dockerfile')).toBe('OTHER');
    expect(getFileTypeGroup('LICENSE')).toBe('OTHER');
    expect(getFileTypeGroup('')).toBe('OTHER');
  });

  it('correctly categorizes numeric extensions into 1-3, 4-6, and 7+ digits', () => {
    // 1 到 3 碼數字
    expect(getFileTypeGroup('app.log.1')).toBe('1-3 DIGITS');
    expect(getFileTypeGroup('patch.12')).toBe('1-3 DIGITS');
    expect(getFileTypeGroup('data.001')).toBe('1-3 DIGITS');
    expect(getFileTypeGroup('123')).toBe('1-3 DIGITS');

    // 4 到 6 碼數字
    expect(getFileTypeGroup('archive.1234')).toBe('4-6 DIGITS');
    expect(getFileTypeGroup('backup.202401')).toBe('4-6 DIGITS');
    expect(getFileTypeGroup('987654')).toBe('4-6 DIGITS');

    // 7 碼以上數字
    expect(getFileTypeGroup('snapshot.20261023')).toBe('7+ DIGITS');
    expect(getFileTypeGroup('record.1729654800')).toBe('7+ DIGITS');
    expect(getFileTypeGroup('123456789')).toBe('7+ DIGITS');
  });
});
