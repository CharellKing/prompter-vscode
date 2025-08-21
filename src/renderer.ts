import * as vscode from 'vscode';

// This file will be compiled to out/renderer.js
// It provides custom rendering for our notebook cells

export function activate(context: vscode.ExtensionContext) {
  // Register a custom renderer for notebook cells
  const renderer = vscode.notebooks.registerNotebookCellStatusBarItemProvider('prompter-notebook', {
    provideCellStatusBarItems(cell: vscode.NotebookCell): vscode.NotebookCellStatusBarItem[] {
      const items: vscode.NotebookCellStatusBarItem[] = [];
      
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
