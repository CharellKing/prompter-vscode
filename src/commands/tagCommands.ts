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
 * Command to modify tags of the current cell
 */
export function registerModifyTagCommand(context: vscode.ExtensionContext): void {
    const command = vscode.commands.registerCommand('prompter.cell.modifyTag', async () => {
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
        
        // Get the first selected cell to modify its tags
        const cell = selectedCells[0];
        const currentTags = cell.metadata?.tags || [];
        
        // Show input box with current tags pre-filled
        const tagsInput = await vscode.window.showInputBox({
            prompt: 'Modify tags (comma-separated, without # symbol)',
            placeHolder: 'tag1, tag2, tag3',
            value: currentTags.join(', ')
        });
        
        if (tagsInput === undefined) {
            return; // User cancelled
        }
        
        // Parse the input into an array of tags
        const newTags = tagsInput
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        
        // Update tags for the cell
        await addTagsToCell(cell, newTags);
    });
    
    context.subscriptions.push(command);
}
