import * as vscode from 'vscode';

/**
 * 最小唯讀虛擬 FileSystemProvider，供自訂 scheme 註冊，
 * 使 VS Code FileDecoration 系統能完全識別自訂 scheme 並正常渲染裝飾。
 */
export class DummyFileSystemProvider implements vscode.FileSystemProvider {
  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  public readonly onDidChangeFile = this._onDidChangeFile.event;

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(_uri: vscode.Uri): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0,
    };
  }

  readDirectory(): [string, vscode.FileType][] {
    return [];
  }

  createDirectory(): void {}

  readFile(): Uint8Array {
    return new Uint8Array();
  }

  writeFile(): void {}

  delete(): void {}

  rename(): void {}
}
