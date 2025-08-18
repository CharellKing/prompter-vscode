import * as vscode from 'vscode';
import * as crypto from 'crypto';

interface PromptHistoryItem {
    content: string;
    timestamp: string;
    md5: string;
}

class PromptHistoryManager {
    private static instance: PromptHistoryManager;
    private panel: vscode.WebviewPanel | undefined;
    private currentCellContent: string = '';

    static getInstance(): PromptHistoryManager {
        if (!PromptHistoryManager.instance) {
            PromptHistoryManager.instance = new PromptHistoryManager();
        }
        return PromptHistoryManager.instance;
    }

    getHistoryFromCell(cell: vscode.NotebookCell): PromptHistoryItem[] {
        const metadata = cell.metadata || {};
        const history = metadata.history || [];
        
        return history.map((item: any) => ({
            content: item.content || '',
            timestamp: item.timestamp || new Date().toISOString(),
            md5: item.md5 || ''
        }));
    }

    showHistoryPanel(cell: vscode.NotebookCell) {
        const historyItems = this.getHistoryFromCell(cell);
        this.currentCellContent = cell.document.getText();
        
        if (this.panel) {
            this.panel.dispose();
        }

        this.panel = vscode.window.createWebviewPanel(
            'promptHistory',
            'Prompt History',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getWebviewContent(historyItems);

        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'selectPrompt':
                        this.insertPromptToCell(cell, message.prompt);
                        break;
                    case 'resetPrompt':
                        this.resetPromptToCell(cell, message.prompt, message.md5);
                        break;
                    case 'deletePrompt':
                        this.deletePromptFromHistory(cell, message.md5);
                        break;
                }
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    /**
     * Resets the cell content to a historical prompt version
     * Saves the current content to history before replacing it
     */
    private async resetPromptToCell(cell: vscode.NotebookCell, prompt: string, md5: string) {
        try {
            // First save the current content to history
            await this.saveCurrentContentToHistory(cell);
            
            // Then replace the cell content with the historical prompt
            await this.insertPromptToCell(cell, prompt);
            
            // Show confirmation message
            vscode.window.showInformationMessage('Prompt reset to historical version. Current version saved to history.');
            
            // Refresh the history panel
            this.refreshHistoryPanel(cell);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to reset prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Deletes a prompt history item from the cell's metadata
     */
    private async deletePromptFromHistory(cell: vscode.NotebookCell, md5: string) {
        try {
            // Get current metadata
            const metadata = cell.metadata ? { ...cell.metadata } : {};
            const history = [...(metadata.history || [])];
            
            // Find the index of the item to delete
            const itemIndex = history.findIndex((item: any) => item.md5 === md5);
            
            if (itemIndex === -1) {
                throw new Error('History item not found');
            }
            
            // Remove the item
            history.splice(itemIndex, 1);
            
            // Update metadata
            metadata.history = history;
            
            // Apply the metadata update
            const edit = new vscode.WorkspaceEdit();
            const notebookEdit = vscode.NotebookEdit.updateCellMetadata(cell.index, metadata);
            edit.set(cell.notebook.uri, [notebookEdit]);
            await vscode.workspace.applyEdit(edit);
            
            // Show confirmation message
            vscode.window.showInformationMessage('Prompt history item deleted.');
            
            // Refresh the history panel
            this.refreshHistoryPanel(cell);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete history item: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Saves the current cell content to the history metadata
     * Checks if the content already exists in history to avoid duplicates
     */
    private async saveCurrentContentToHistory(cell: vscode.NotebookCell) {
        try {
            const currentContent = cell.document.getText();
            
            // Create MD5 hash of the content for identification
            const md5Hash = crypto.createHash('md5').update(currentContent).digest('hex');
            
            // Get current metadata
            const metadata = cell.metadata ? { ...cell.metadata } : {};
            const history = [...(metadata.history || [])];
            
            // Check if this content already exists in history
            const existingItemIndex = history.findIndex((item: any) => 
                item.md5 === md5Hash || item.content === currentContent
            );
            
            // If content already exists in history, don't add it again
            if (existingItemIndex !== -1) {
                return; // Content already exists in history, no need to add it again
            }
            
            // Create history item
            const historyItem = {
                content: currentContent,
                timestamp: new Date().toISOString(),
                md5: md5Hash
            };
            
            // Add new history item
            history.push(historyItem);
            
            // Update metadata
            metadata.history = history;
            
            // Apply the metadata update
            const edit = new vscode.WorkspaceEdit();
            const notebookEdit = vscode.NotebookEdit.updateCellMetadata(cell.index, metadata);
            edit.set(cell.notebook.uri, [notebookEdit]);
            await vscode.workspace.applyEdit(edit);
        } catch (error) {
            throw new Error(`Failed to save current content to history: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Refreshes the history panel with updated content
     */
    private refreshHistoryPanel(cell: vscode.NotebookCell) {
        if (this.panel) {
            const historyItems = this.getHistoryFromCell(cell);
            this.currentCellContent = cell.document.getText();
            this.panel.webview.html = this.getWebviewContent(historyItems);
        }
    }
    
    private async insertPromptToCell(cell: vscode.NotebookCell, prompt: string) {
        try {
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(0, 0, cell.document.lineCount, 0);
            edit.replace(cell.document.uri, fullRange, prompt);
            await vscode.workspace.applyEdit(edit);
            
            // Focus the cell after inserting the prompt
            const activeEditor = vscode.window.activeNotebookEditor;
            if (activeEditor) {
                const cellIndex = cell.index;
                if (cellIndex >= 0) {
                    const selection = new vscode.NotebookRange(cellIndex, cellIndex + 1);
                    activeEditor.selection = selection;
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to insert prompt: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private getWebviewContent(historyItems: PromptHistoryItem[]): string {
        // Get the current cell content if available
        const currentCellContent = this.currentCellContent || '';
        
        const historyHtml = historyItems
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map(item => {
                const formattedTime = new Date(item.timestamp).toLocaleString(undefined, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                // Generate diff between this historical prompt and the current prompt
                const diffHtml = this.generateDiffHtml(item.content, currentCellContent);
                
                return `
                    <div class="history-item" data-md5="${this.escapeHtml(item.md5)}">
                        <div class="timestamp">${this.escapeHtml(formattedTime)}</div>
                        <div class="diff-container">${diffHtml}</div>
                        <div class="history-item-actions">
                            <button class="action-button reset-button" title="Reset to this version (saves current as history)" onclick="resetPrompt(\`${this.escapeForJs(item.content)}\`, '${item.md5}')">
                                <span class="button-icon">↺</span> Reset
                            </button>
                            <button class="action-button delete-button" title="Delete this history item" onclick="confirmDelete('${item.md5}')">
                                <span class="button-icon">🗑️</span> Delete
                            </button>
                        </div>
                    </div>
                `;
            })
            .join('');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Prompt History</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        margin: 0;
                        padding: 16px;
                    }
                    
                    .header {
                        font-size: 18px;
                        font-weight: bold;
                        margin-bottom: 16px;
                        color: var(--vscode-titleBar-activeForeground);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    
                    .header::before {
                        content: "📜";
                        font-size: 20px;
                    }
                    
                    .history-item {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        padding: 12px;
                        margin-bottom: 16px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        background-color: var(--vscode-editor-background);
                    }
                    
                    .history-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                        border-color: var(--vscode-focusBorder);
                        transform: translateY(-1px);
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    
                    .timestamp {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 10px;
                        font-weight: 500;
                    }
                    
                    .diff-container {
                        font-family: var(--vscode-editor-font-family);
                        white-space: pre-wrap;
                        word-break: break-word;
                        line-height: 1.5;
                        overflow: auto;
                        max-height: 400px;
                        border-radius: 4px;
                    }
                    
                    .diff-line {
                        padding: 2px 0;
                        display: flex;
                    }
                    
                    .diff-line-number {
                        color: var(--vscode-editorLineNumber-foreground);
                        text-align: right;
                        padding-right: 8px;
                        user-select: none;
                        min-width: 40px;
                    }
                    
                    .diff-line-content {
                        flex: 1;
                    }
                    
                    .diff-added {
                        background-color: rgba(0, 255, 0, 0.1);
                    }
                    
                    .diff-removed {
                        background-color: rgba(255, 0, 0, 0.1);
                    }
                    
                    .diff-unchanged {
                        color: var(--vscode-editor-foreground);
                    }
                    
                    .history-item-actions {
                        display: none;
                        margin-top: 10px;
                        gap: 8px;
                        justify-content: flex-end;
                    }
                    
                    .history-item:hover .history-item-actions {
                        display: flex;
                    }
                    
                    .action-button {
                        background-color: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: none;
                        border-radius: 4px;
                        padding: 4px 8px;
                        font-size: 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        transition: background-color 0.2s;
                    }
                    
                    .action-button:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                    
                    .reset-button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    
                    .reset-button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    
                    .delete-button {
                        background-color: var(--vscode-errorForeground);
                        color: white;
                    }
                    
                    .delete-button:hover {
                        background-color: #d32f2f;
                    }
                    
                    .button-icon {
                        font-size: 14px;
                    }
                    
                    .modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-color: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 1000;
                        display: none;
                    }
                    
                    .modal {
                        background-color: var(--vscode-editor-background);
                        border-radius: 6px;
                        padding: 16px;
                        width: 300px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    }
                    
                    .modal-title {
                        font-size: 16px;
                        font-weight: bold;
                        margin-bottom: 12px;
                    }
                    
                    .modal-message {
                        margin-bottom: 16px;
                    }
                    
                    .modal-actions {
                        display: flex;
                        justify-content: flex-end;
                        gap: 8px;
                    }
                    
                    .empty-state {
                        text-align: center;
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                        margin-top: 32px;
                        padding: 32px;
                        border: 2px dashed var(--vscode-panel-border);
                        border-radius: 8px;
                    }
                    
                    .empty-state::before {
                        content: "📝";
                        display: block;
                        font-size: 48px;
                        margin-bottom: 16px;
                    }
                    
                    .history-count {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 16px;
                    }
                </style>
            </head>
            <body>
                <div class="header">Prompt History</div>
                ${historyItems.length > 0 ? `<div class="history-count">${historyItems.length} prompt${historyItems.length === 1 ? '' : 's'} in history</div>` : ''}
                ${historyItems.length > 0 ? historyHtml : '<div class="empty-state">No history available for this cell<br><small>Execute this prompt cell to start building history</small></div>'}
                
                <div class="modal-overlay" id="deleteConfirmModal">
                    <div class="modal">
                        <div class="modal-title">Delete History Item</div>
                        <div class="modal-message">Are you sure you want to delete this history item? This action cannot be undone.</div>
                        <div class="modal-actions">
                            <button class="action-button" onclick="closeModal()">Cancel</button>
                            <button class="action-button delete-button" id="confirmDeleteButton">Delete</button>
                        </div>
                    </div>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    let itemToDeleteMd5 = null;
                    
                    function selectPrompt(prompt) {
                        vscode.postMessage({
                            command: 'selectPrompt',
                            prompt: prompt
                        });
                    }
                    
                    function resetPrompt(prompt, md5) {
                        vscode.postMessage({
                            command: 'resetPrompt',
                            prompt: prompt,
                            md5: md5
                        });
                    }
                    
                    function confirmDelete(md5) {
                        itemToDeleteMd5 = md5;
                        document.getElementById('deleteConfirmModal').style.display = 'flex';
                        document.getElementById('confirmDeleteButton').onclick = () => {
                            deletePrompt(md5);
                            closeModal();
                        };
                    }
                    
                    function deletePrompt(md5) {
                        vscode.postMessage({
                            command: 'deletePrompt',
                            md5: md5
                        });
                    }
                    
                    function closeModal() {
                        document.getElementById('deleteConfirmModal').style.display = 'none';
                        itemToDeleteMd5 = null;
                    }
                    
                    // Close modal if clicking outside of it
                    document.getElementById('deleteConfirmModal').addEventListener('click', (event) => {
                        if (event.target === document.getElementById('deleteConfirmModal')) {
                            closeModal();
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private escapeForJs(text: string): string {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Generates HTML for displaying the diff between two text strings
     * @param oldText The historical prompt text
     * @param newText The current prompt text
     * @returns HTML string representing the diff
     */
    private generateDiffHtml(oldText: string, newText: string): string {
        // Split both texts into lines
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        
        // Simple diff algorithm to identify added, removed, and unchanged lines
        const diffResult: Array<{type: 'added' | 'removed' | 'unchanged', line: string}> = [];
        
        // Use a simple LCS (Longest Common Subsequence) approach for diffing
        const lcsMatrix = this.computeLCSMatrix(oldLines, newLines);
        this.backtrackLCS(lcsMatrix, oldLines, newLines, oldLines.length, newLines.length, diffResult);
        
        // Generate HTML for the diff
        let diffHtml = '';
        let lineNumber = 1;
        
        for (const item of diffResult) {
            const cssClass = `diff-${item.type}`;
            const lineNumberHtml = `<div class="diff-line-number">${lineNumber}</div>`;
            const lineContentHtml = `<div class="diff-line-content">${this.escapeHtml(item.line)}</div>`;
            
            // Only increment line number for unchanged and added lines (not for removed lines)
            if (item.type !== 'removed') {
                lineNumber++;
            }
            
            // Add a prefix to indicate the type of change
            let prefix = '';
            if (item.type === 'added') {
                prefix = '+ ';
            } else if (item.type === 'removed') {
                prefix = '- ';
            } else {
                prefix = '  ';
            }
            
            diffHtml += `<div class="diff-line ${cssClass}">
                ${lineNumberHtml}
                <div class="diff-line-content">${this.escapeHtml(prefix + item.line)}</div>
            </div>`;
        }
        
        return diffHtml;
    }
    
    /**
     * Computes the Longest Common Subsequence matrix for two arrays
     */
    private computeLCSMatrix(oldLines: string[], newLines: string[]): number[][] {
        const matrix: number[][] = Array(oldLines.length + 1)
            .fill(null)
            .map(() => Array(newLines.length + 1).fill(0));
        
        for (let i = 1; i <= oldLines.length; i++) {
            for (let j = 1; j <= newLines.length; j++) {
                if (oldLines[i - 1] === newLines[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1] + 1;
                } else {
                    matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
                }
            }
        }
        
        return matrix;
    }
    
    /**
     * Backtracks through the LCS matrix to build the diff result
     */
    private backtrackLCS(
        matrix: number[][],
        oldLines: string[],
        newLines: string[],
        i: number,
        j: number,
        result: Array<{type: 'added' | 'removed' | 'unchanged', line: string}>
    ): void {
        if (i === 0 && j === 0) {
            // Reverse the result since we're backtracking
            result.reverse();
            return;
        }
        
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            // Lines match - unchanged
            result.push({
                type: 'unchanged',
                line: oldLines[i - 1]
            });
            this.backtrackLCS(matrix, oldLines, newLines, i - 1, j - 1, result);
        } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
            // Line added in new text
            result.push({
                type: 'added',
                line: newLines[j - 1]
            });
            this.backtrackLCS(matrix, oldLines, newLines, i, j - 1, result);
        } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
            // Line removed from old text
            result.push({
                type: 'removed',
                line: oldLines[i - 1]
            });
            this.backtrackLCS(matrix, oldLines, newLines, i - 1, j, result);
        }
    }
}

export function registerPromptHistoryCommands(context: vscode.ExtensionContext) {
    const historyManager = PromptHistoryManager.getInstance();

    // Command to show history for a specific cell
    const showHistoryCommand = vscode.commands.registerCommand(
        'prompter.cell.showPromptHistory',
        async () => {
            const activeEditor = vscode.window.activeNotebookEditor;
            if (!activeEditor) {
                return;
            }

            // Get the currently selected cell
            const selection = activeEditor.selection;
            if (!selection) {
                vscode.window.showErrorMessage('No cell selected');
                return;
            }

            const cell = activeEditor.notebook.cellAt(selection.start);
            if (cell.kind !== vscode.NotebookCellKind.Code || cell.document.languageId !== 'prompt') {
                vscode.window.showErrorMessage('This command is only available for prompt cells');
                return;
            }

            historyManager.showHistoryPanel(cell);
        }
    );

    context.subscriptions.push(showHistoryCommand);

    // Export the history manager so other parts of the extension can use it
    return historyManager;
}

export { PromptHistoryManager };