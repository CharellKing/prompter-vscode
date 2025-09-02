import * as vscode from 'vscode';
import { BookmarkManager } from './bookmarkManager';

// This file will be compiled to out/renderer.js
// It provides custom rendering for our notebook cells

export function activate(context: vscode.ExtensionContext) {
  // Get bookmark manager instance
  const bookmarkManager = BookmarkManager.getInstance(context);
  // Register a custom renderer for notebook cells
  const renderer = vscode.notebooks.registerNotebookCellStatusBarItemProvider('prompter-notebook', {
    provideCellStatusBarItems(cell: vscode.NotebookCell): vscode.NotebookCellStatusBarItem[] {
      const items: vscode.NotebookCellStatusBarItem[] = [];
      
      // Add bookmark button
      const isBookmarked = bookmarkManager.isBookmarked(cell);
      
      // Create bookmark item with appropriate icon
      // For bookmarked cells, use star-full icon (yellow)
      // For non-bookmarked cells, use regular bookmark icon (gray)
      const bookmarkText = isBookmarked 
        ? '$(star-full)' // Star icon for bookmarked cells (appears yellow)
        : '$(bookmark)'; // Regular bookmark icon for non-bookmarked cells (appears gray)
      
      const bookmarkItem = new vscode.NotebookCellStatusBarItem(
        bookmarkText,
        vscode.NotebookCellStatusBarAlignment.Right
      );
      
      // Set tooltip based on bookmark status
      bookmarkItem.tooltip = isBookmarked ? 'Remove bookmark' : 'Add bookmark';
      
      // Set command to toggle bookmark
      bookmarkItem.command = 'prompter.cell.toggleBookmark';
      
      // Add the bookmark item to our list
      items.push(bookmarkItem);
      
      // Check if the cell has tags in its metadata
      if (cell.metadata?.tags && Array.isArray(cell.metadata.tags) && cell.metadata.tags.length > 0) {
        // Create a status bar item for tags
        const tagItem = new vscode.NotebookCellStatusBarItem(
          cell.metadata.tags.map((tag: string) => `#${tag}`).join(' '),
          vscode.NotebookCellStatusBarAlignment.Left
        );
        
        // Set tooltip to show all tags
        tagItem.tooltip = `Tags: ${cell.metadata.tags.join(', ')}`;
        
        // Add the item to our list
        items.push(tagItem);
      }
      
      return items;
    }
  });
  
  // Add the renderer to the context subscriptions
  context.subscriptions.push(renderer);
  
  console.log('Prompter notebook renderer activated with tag display support');
}
