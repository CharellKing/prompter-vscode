import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';

// Define custom cell types
export const enum PrompterCellKind {
    Prompt = 'prompt',
    Markdown = 'markdown',
    Code = "code",
    Output = 'output',
    Error = 'error'
}

// Common function for creating prompt cells
export function insertPromptCell(editor: vscode.NotebookEditor, insertIndex: number) {
    if (!editor) {
        return null;
    }
    
    const notebook = editor.notebook;
    
    // Create new prompt cell
    const newCell = new vscode.NotebookCellData(
        vscode.NotebookCellKind.Code,
        'Please enter your prompt content here...',
        'prompt'
    );
    
    newCell.metadata = {
        id: `prompt-cell-${uuidv4()}`,
    };
    
    // Insert new cell at specified position
    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.insertCells(insertIndex, [newCell]);
    edit.set(notebook.uri, [nbEdit]);
    
    return { edit, insertIndex };
}


// Register command to insert prompt cell above current cell
export function registerInsertPromptCellAboveCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertPromptCellAbove', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // Determine insertion position (above current cell)
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex;
            } else {
                insertIndex = editor.selection.start;
            }
            
            // Create and insert prompt cell
            const result = insertPromptCell(editor, insertIndex);
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

// Register command to insert prompt cell below current cell
export function registerInsertPromptCellBelowCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.cell.insertPromptCellBelow', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            // Determine insertion position (below current cell)
            let insertIndex: number;
            if (typeof cellIndex === 'number') {
                insertIndex = cellIndex + 1;
            } else if (editor && editor.selection) {
                insertIndex = editor.selection.start + 1;
            } else {
                insertIndex = 0;
            }
            
            // Create and insert prompt cell
            const result = insertPromptCell(editor, insertIndex);
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