import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { PrompterCellKind } from './promptCellCommands';

// Register command to create a new notebook
export function registerCreateNotebookCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.notebook.createNotebook', async () => {
        const uri = vscode.Uri.parse(`untitled:Untitled-${Date.now()}.ppnb`);
        
        // Get default code language
        const config = vscode.workspace.getConfiguration('prompter');
        const defaultLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
        
        // Create notebook data in the new format
        const cells: vscode.NotebookCellData[] = [];
        
        // Add ID for each cell
        cells.forEach((cell, index) => {
            cell.metadata = {
                id: `cell-${uuidv4()}`
            };
        });
        
        const notebookData = new vscode.NotebookData(cells);
        
        const doc = await vscode.workspace.openNotebookDocument('prompter-notebook', notebookData);
        await vscode.window.showNotebookDocument(doc);
    });
    
    context.subscriptions.push(command);
    return command;
}

// Register command to run cell
export function registerRunCellCommand(context: vscode.ExtensionContext, cellExecutor: any) {
    const command = vscode.commands.registerCommand('prompter.notebook.runCell', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            const cell = editor.notebook.cellAt(editor.selection.start);
            if (cell) {
                await cellExecutor.executeCell(cell);
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// Register command to run all cells
export function registerRunAllCellsCommand(context: vscode.ExtensionContext, cellExecutor: any) {
    const command = vscode.commands.registerCommand('prompter.notebook.runAllCells', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (editor) {
            for (const cell of editor.notebook.getCells()) {
                if (cell.kind === vscode.NotebookCellKind.Code) {
                    await cellExecutor.executeCell(cell);
                }
            }
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// Register command to save notebook
export function registerSaveNotebookCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.notebook.saveNotebook', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (!editor || editor.notebook.notebookType !== 'prompter-notebook') {
            vscode.window.showInformationMessage('No active Prompter notebook to save.');
            return;
        }
        try {
            if (editor.notebook.uri.scheme === 'file') {
                await vscode.commands.executeCommand('workbench.action.files.save');
            } else {
                await vscode.commands.executeCommand('workbench.action.files.saveAs');
            }
        } catch (err) {
            console.error('Manual save failed:', err);
            vscode.window.showErrorMessage(`Manual save failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    });
    
    context.subscriptions.push(command);
    return command;
}

// Register command to set cell type
export function registerSetCellTypeCommand(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand('prompter.notebook.setCellType', async (cellUri?: vscode.Uri, cellIndex?: number) => {
        const editor = vscode.window.activeNotebookEditor;
        if (!editor) {
            return;
        }

        let targetCell: vscode.NotebookCell;
        
        if (typeof cellIndex === 'number') {
            targetCell = editor.notebook.cellAt(cellIndex);
        } else {
            targetCell = editor.notebook.cellAt(editor.selection.start);
        }

        if (!targetCell) {
            return;
        }

        // Define available cell types
        const cellTypes = [
            { label: '$(code) Code Cell', value: 'code', description: 'Execute code in various languages' },
            { label: '$(sparkle) Prompt Cell', value: 'prompt', description: 'Send prompts to LLM' },
            { label: '$(markdown) Markdown Cell', value: 'markdown', description: 'Rich text and documentation' }
        ];

        const selectedType = await vscode.window.showQuickPick(cellTypes, {
            placeHolder: 'Select cell type',
            ignoreFocusOut: true
        });

        if (!selectedType) {
            return;
        }

        // Set cell based on selected type
        let newCellKind: vscode.NotebookCellKind;
        let newLanguage: string;
        let newMetadata: any = { ...targetCell.metadata };

        switch (selectedType.value) {
            case 'code':
                newCellKind = vscode.NotebookCellKind.Code;
                const config = vscode.workspace.getConfiguration('prompter');
                newLanguage = config.get<string>('defaultCodeLanguage') || 'javascript';
                break;
            case 'prompt':
                newCellKind = vscode.NotebookCellKind.Code;
                newLanguage = 'prompt';
                break;
            case 'markdown':
                newCellKind = vscode.NotebookCellKind.Markup;
                newLanguage = 'markdown';
                break;
            default:
                return;
        }

        // Create new cell data
        const newCellData = new vscode.NotebookCellData(
            newCellKind,
            targetCell.document.getText(),
            newLanguage
        );
        newCellData.metadata = newMetadata;

        // Replace cell
        const edit = new vscode.WorkspaceEdit();
        const nbEdit = vscode.NotebookEdit.replaceCells(
            new vscode.NotebookRange(targetCell.index, targetCell.index + 1),
            [newCellData]
        );
        edit.set(editor.notebook.uri, [nbEdit]);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage(`Cell type changed to ${selectedType.label.replace(/\$\([^)]+\)\s*/, '')}`);
    });
    
    // Register language mode change event handler
    context.subscriptions.push(
        vscode.workspace.onDidChangeNotebookDocument(async event => {
            if (event.notebook.notebookType !== 'prompter-notebook') {
                return;
            }
            
            // Import CellExecutor instance
            const { cellExecutor } = require('../extension');
            if (!cellExecutor) {
                console.error('CellExecutor not found in extension exports');
                return;
            }
            
            // Check each changed cell
            for (const cellChange of event.cellChanges) {
                // Ensure document property exists
                if (!cellChange.document) {
                    continue;
                }
                
                // If language has changed
                if (cellChange.cell.document.languageId !== cellChange.document.languageId) {
                    const cell = cellChange.cell;
                    const newLanguageId = cellChange.document.languageId;
                    
                    // Use CellExecutor's applyLanguageModeChange method to update the cell
                    await cellExecutor.applyLanguageModeChange(cell, newLanguageId);
                }
            }
        })
    );
    
    context.subscriptions.push(command);
    return command;
}
