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
});
