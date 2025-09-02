import * as vscode from 'vscode';
import { BookmarkManager } from '../bookmarkManager';
import { BookmarkWebviewProvider } from '../bookmarkWebview';

/**
 * Register toggle bookmark command
 */
export function registerToggleBookmarkCommand(context: vscode.ExtensionContext, bookmarkProvider: BookmarkWebviewProvider) {
  const bookmarkManager = BookmarkManager.getInstance(context);
  
  const command = vscode.commands.registerCommand('prompter.cell.toggleBookmark', async (cell: vscode.NotebookCell) => {
    if (!cell) {
      const editor = vscode.window.activeNotebookEditor;
      if (!editor || editor.notebook.notebookType !== 'prompter-notebook') {
        return;
      }
      
      // If no cell parameter is passed, use the currently selected cell
      if (editor.selections.length > 0) {
        cell = editor.notebook.cellAt(editor.selections[0].start);
      } else {
        return;
      }
    }
    
    // Toggle bookmark status
    if (bookmarkManager.isBookmarked(cell)) {
      // Get cell ID
      const cellId = cell.metadata?.id || `cell-${cell.index}`;
      // Find the corresponding bookmark
      const bookmark = bookmarkManager.getBookmarkByCell(cellId, cell.notebook.uri.toString());
      if (bookmark) {
        await bookmarkManager.removeBookmark(bookmark.id);
        vscode.window.showInformationMessage('Bookmark removed');
      }
    } else {
      await bookmarkManager.addBookmark(cell);
      vscode.window.showInformationMessage('Bookmark added');
    }
  });
  
  context.subscriptions.push(command);
}

/**
 * Register show bookmark panel command
 */
export function registerToggleBookmarkPanelCommand(context: vscode.ExtensionContext, bookmarkProvider: BookmarkWebviewProvider) {
  const command = vscode.commands.registerCommand('prompter.notebook.toggleBookmarkPanel', () => {
    // Use the correct API to create webview panel
    vscode.commands.executeCommand('workbench.view.extension.prompter-activitybar');
    vscode.commands.executeCommand('prompter.view.bookmarkView.focus');
  });
  
  context.subscriptions.push(command);
}