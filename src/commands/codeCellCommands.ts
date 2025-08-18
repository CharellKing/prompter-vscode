import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

// Common function for creating code cells
export function insertCodeCell(editor: vscode.NotebookEditor, insertIndex: number) {
    if (!editor) {
        return null;
    }
    
    const notebook = editor.notebook;
    
    // Get default code language
    const config = vscode.workspace.getConfiguration('prompter');
    const defaultLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
    
    // Create new code cell
    const newCell = new vscode.NotebookCellData(
        vscode.NotebookCellKind.Code,
        '',
        defaultLanguage
    );
    
    newCell.metadata = {
        id: `code-cell-${uuidv4()}`
    };
    
    // Insert new cell at specified position
    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [newCell]);
    edit.set(notebook.uri, [nbEdit]);
    
    return { edit, insertIndex };
}


// Register command to insert code cell above current cell
export function registerInsertCodeCellAboveCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertCodeCellAbove', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // Determine insertion position (above current cell)
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex;
            } else {
                insertIndex = editor.selection.start;
            }
            
            // Create and insert code cell
            const result = insertCodeCell(editor, insertIndex);
            if (result) {
                await vscode.workspace.applyEdit(result.edit);
                
                // Select newly created cell
                const newSelection = new vscode.NotebookRange(result.insertIndex, result.insertIndex + 1);
                editor.selection = newSelection;
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// Register command to insert code cell below current cell
export function registerInsertCodeCellBelowCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertCodeCellBelow', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // Determine insertion position (below current cell)
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex + 1;
            } else {
                insertIndex = editor.selection.start + 1;
            }
            
            // Create and insert code cell
            const result = insertCodeCell(editor, insertIndex);
            if (result) {
                await vscode.workspace.applyEdit(result.edit);
                
                // Select newly created cell
                const newSelection = new vscode.NotebookRange(result.insertIndex, result.insertIndex + 1);
                editor.selection = newSelection;
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}