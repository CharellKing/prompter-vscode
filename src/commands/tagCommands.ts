import * as vscode from 'vscode';

/**
 * This function adds tags to a cell's metadata
 */
export async function addTagsToCell(cell: vscode.NotebookCell, tags: string[]): Promise<void> {
    if (!cell) {
        console.error('No cell provided');
        return;
    }
    
    // Get current metadata
    const currentMetadata = cell.metadata || {};
    
    // Create a new NotebookCellData with the same content
    const cellData = new vscode.NotebookCellData(
        cell.kind,
        cell.document.getText(),
        cell.document.languageId
    );
    
    // Update metadata with tags
    cellData.metadata = {
        ...currentMetadata,
        tags: tags
    };
    
    // Create edit to replace the cell
    const edit = new vscode.WorkspaceEdit();
    const nbEdit = vscode.NotebookEdit.replaceCells(
        new vscode.NotebookRange(cell.index, cell.index + 1),
        [cellData]
    );
    
    // Apply the edit
    edit.set(cell.notebook.uri, [nbEdit]);
    await vscode.workspace.applyEdit(edit);
    
    console.log(`Added tags to cell ${cell.index}: ${tags.join(', ')}`);
}

/**
 * Command to add a tag to the current cell
 */
export function registerAddTagCommand(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('prompter.cell.addTag', async () => {
        const editor = vscode.window.activeNotebookEditor;
        if (!editor || editor.notebook.notebookType !== 'prompter-notebook') {
            vscode.window.showErrorMessage('Please select a cell in a Prompter notebook');
            return;
        }
        
        const selectedCells = editor.selections
            .map(selection => editor.notebook.cellAt(selection.start))
            .filter(cell => cell !== undefined);
            
        if (selectedCells.length === 0) {
            vscode.window.showErrorMessage('No cell selected');
            return;
        }
        
        // Ask for tag name
        const tagName = await vscode.window.showInputBox({
            prompt: 'Enter tag name (without # symbol)',
            placeHolder: 'tag-name'
        });
        
        if (!tagName) {
            return; // User cancelled
        }
        
        // Add tag to each selected cell
        for (const cell of selectedCells) {
            const currentTags = cell.metadata?.tags || [];
            const newTags = [...new Set([...currentTags, tagName])]; // Ensure uniqueness
            await addTagsToCell(cell, newTags);
        }
    });
    
    context.subscriptions.push(command);
}